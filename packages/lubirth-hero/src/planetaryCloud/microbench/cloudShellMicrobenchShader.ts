export const CLOUD_SHELL_FULLSCREEN_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export interface CloudShellRaymarchShaderInput {
  primarySteps: number;
  lightSteps: number;
}

export function createCloudShellRaymarchFragmentShader({
  primarySteps,
  lightSteps
}: CloudShellRaymarchShaderInput) {
  return /* glsl */ `
#define PRIMARY_STEPS ${primarySteps}
#define LIGHT_STEPS ${lightSteps}

varying vec2 vUv;

uniform sampler2D sceneDepth;
uniform sampler2D weatherTexture;
uniform mat4 inverseProjection;
uniform mat4 cameraMatrixWorld;
uniform mat4 worldToEcef;
uniform vec3 cameraWorldPosition;
uniform vec3 sunDirectionEcef;
uniform float innerRadiusEcef;
uniform float shellBaseRadiusEcef;
uniform float shellThicknessEcef;
uniform float densityScale;
uniform bool showSceneDepthClamp;

const float EPSILON = 0.000001;
const float FAR_DISTANCE = 1.0e20;
const float CLOUD_PI = 3.141592653589793;
const float CLOUD_ALBEDO = 0.88;
const float SKY_FILL = 0.11;
const float SUN_ILLUMINANCE = 8.0;
const float PHASE_G = 0.32;

vec3 reconstructWorldPosition(vec2 uv, float deviceDepth) {
  vec4 clipPosition = vec4(uv * 2.0 - 1.0, deviceDepth * 2.0 - 1.0, 1.0);
  vec4 viewPosition = inverseProjection * clipPosition;
  viewPosition /= max(abs(viewPosition.w), EPSILON);
  return (cameraMatrixWorld * viewPosition).xyz;
}

bool raySphereInterval(
  vec3 originEcef,
  vec3 directionEcefPerWorldUnit,
  float radiusEcef,
  out float tNearWorld,
  out float tFarWorld
) {
  float a = dot(directionEcefPerWorldUnit, directionEcefPerWorldUnit);
  float halfB = dot(originEcef, directionEcefPerWorldUnit);
  float c = dot(originEcef, originEcef) - radiusEcef * radiusEcef;
  float discriminant = halfB * halfB - a * c;
  if (a <= EPSILON || discriminant < 0.0) {
    tNearWorld = 0.0;
    tFarWorld = 0.0;
    return false;
  }

  float root = sqrt(discriminant);
  tNearWorld = (-halfB - root) / a;
  tFarWorld = (-halfB + root) / a;
  return true;
}

vec2 getEquirectangularUv(vec3 positionEcef) {
  vec3 normal = normalize(positionEcef);
  float longitude = atan(normal.y, normal.x) / (2.0 * CLOUD_PI) + 0.5;
  float latitude = asin(clamp(normal.z, -1.0, 1.0));
  return vec2(longitude, 0.5 - latitude / CLOUD_PI);
}

float hash31(vec3 position) {
  position = fract(position * 0.1031);
  position += dot(position, position.yzx + 33.33);
  return fract((position.x + position.y) * position.z);
}

float valueNoise3d(vec3 position) {
  vec3 cell = floor(position);
  vec3 fraction = fract(position);
  vec3 smoothFraction = fraction * fraction * (3.0 - 2.0 * fraction);
  float n000 = hash31(cell + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, smoothFraction.x);
  float x10 = mix(n010, n110, smoothFraction.x);
  float x01 = mix(n001, n101, smoothFraction.x);
  float x11 = mix(n011, n111, smoothFraction.x);
  return mix(mix(x00, x10, smoothFraction.y), mix(x01, x11, smoothFraction.y), smoothFraction.z);
}

// This is a deliberately bounded, seamless ECEF-domain base-shape field.
// It has no time evolution or detail erosion: V3 remains the macro weather map.
float baseShape3d(vec3 positionEcef, float shellHeight01) {
  vec3 normal = normalize(positionEcef);
  vec3 coordinates = normal * 96.0 + vec3(
    shellHeight01 * 13.0,
    shellHeight01 * 7.0,
    shellHeight01 * 19.0
  );
  float coarse = valueNoise3d(coordinates);
  float medium = valueNoise3d(coordinates * 1.93 + vec3(19.7, 7.1, 31.4));
  return mix(coarse, medium, 0.38);
}

float remapCoverageToBaseShape(float weatherCoverage, float baseShape) {
  if (weatherCoverage <= EPSILON) {
    return 0.0;
  }
  // Dense V3 coverage means more cloudlets, never a fully occupied shell.
  float coverageThreshold = mix(0.92, 0.58, clamp(weatherCoverage, 0.0, 1.0));
  return smoothstep(coverageThreshold - 0.09, coverageThreshold + 0.09, baseShape);
}

float cloudDensity(vec3 positionEcef) {
  float radius = length(positionEcef);
  float shellHeight01 = (radius - shellBaseRadiusEcef) / shellThicknessEcef;
  if (shellHeight01 <= 0.0 || shellHeight01 >= 1.0) {
    return 0.0;
  }

  vec4 weather = texture2D(weatherTexture, getEquirectangularUv(positionEcef));
  float sourceCoverage = weather.r;
  float weatherCoverage = clamp(sourceCoverage, 0.0, 1.0);
  float cloudTop = mix(0.30, 0.82, weather.g);
  float baseShape = baseShape3d(positionEcef, shellHeight01);
  float shapedCloudTop = mix(0.24, cloudTop, baseShape);
  float verticalProfile =
    smoothstep(0.02, 0.12, shellHeight01) *
    (1.0 - smoothstep(
      max(0.14, shapedCloudTop - 0.18),
      shapedCloudTop,
      shellHeight01
    ));
  float morphologyGain = mix(0.75, 1.25, weather.b);
  float concavityGain = mix(1.0, 0.72, weather.a);
  float occupancy = remapCoverageToBaseShape(
    weatherCoverage,
    baseShape
  );
  return occupancy * verticalProfile * morphologyGain * concavityGain;
}

float forwardCloudShellLightDistance(vec3 positionEcef) {
  float outerRadiusEcef = shellBaseRadiusEcef + shellThicknessEcef;
  float tOuterNearMeters;
  float tOuterFarMeters;
  if (!raySphereInterval(
    positionEcef,
    sunDirectionEcef,
    outerRadiusEcef,
    tOuterNearMeters,
    tOuterFarMeters
  ) || tOuterFarMeters <= 0.0) {
    return 0.0;
  }

  float tLightEnterMeters = max(tOuterNearMeters, 0.0);
  float tLightExitMeters = tOuterFarMeters;
  float cloudBaseRadiusEcef = shellBaseRadiusEcef;
  float tCloudBaseNearMeters;
  float tCloudBaseFarMeters;
  if (raySphereInterval(
    positionEcef,
    sunDirectionEcef,
    cloudBaseRadiusEcef,
    tCloudBaseNearMeters,
    tCloudBaseFarMeters
  )) {
    if (tCloudBaseNearMeters > tLightEnterMeters && tCloudBaseNearMeters < tLightExitMeters) {
      tLightExitMeters = min(tLightExitMeters, tCloudBaseNearMeters);
    } else if (tCloudBaseFarMeters > tLightEnterMeters) {
      // A sunlight ray that starts inside (or enters) the cloud-base sphere
      // is blocked instead of resuming in an opposite shell behind the Earth.
      return 0.0;
    }
  }
  return max(tLightExitMeters - tLightEnterMeters, 0.0);
}

float traceSunTransmittance(vec3 positionEcef) {
  float lightDistanceMeters = forwardCloudShellLightDistance(positionEcef);
  if (lightDistanceMeters <= EPSILON) {
    return 0.0;
  }
  float stepLengthMeters = lightDistanceMeters / float(LIGHT_STEPS);
  float opticalDepth = 0.0;
  for (int index = 0; index < LIGHT_STEPS; index += 1) {
    float t = (float(index) + 0.5) * stepLengthMeters;
    opticalDepth += cloudDensity(positionEcef + sunDirectionEcef * t) * stepLengthMeters * densityScale;
  }
  return exp(-opticalDepth);
}

float henyeyGreensteinPhase(float cosineTheta, float anisotropy) {
  float anisotropySquared = anisotropy * anisotropy;
  float denominator = max(1.0 + anisotropySquared - 2.0 * anisotropy * cosineTheta, EPSILON);
  return (1.0 - anisotropySquared) / (4.0 * CLOUD_PI * pow(denominator, 1.5));
}

void main() {
  vec3 farWorldPosition = reconstructWorldPosition(vUv, 1.0);
  vec3 rayDirectionWorld = normalize(farWorldPosition - cameraWorldPosition);
  vec3 rayOriginEcef = (worldToEcef * vec4(cameraWorldPosition, 1.0)).xyz;
  vec3 directionEcefPerWorldUnit = mat3(worldToEcef) * rayDirectionWorld;

  float tOuterNearWorld;
  float tOuterFarWorld;
  float outerRadiusEcef = shellBaseRadiusEcef + shellThicknessEcef;
  if (!raySphereInterval(
    rayOriginEcef,
    directionEcefPerWorldUnit,
    outerRadiusEcef,
    tOuterNearWorld,
    tOuterFarWorld
  ) || tOuterFarWorld <= 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float tCloudEnterWorld = max(tOuterNearWorld, 0.0);
  float tCloudExitWorld = tOuterFarWorld;
  float tInnerNearWorld;
  float tInnerFarWorld;
  if (raySphereInterval(
    rayOriginEcef,
    directionEcefPerWorldUnit,
    innerRadiusEcef,
    tInnerNearWorld,
    tInnerFarWorld
  )) {
    if (tInnerNearWorld > tCloudEnterWorld) {
      tCloudExitWorld = min(tCloudExitWorld, tInnerNearWorld);
    } else if (tInnerFarWorld > tCloudEnterWorld) {
      tCloudEnterWorld = max(tCloudEnterWorld, tInnerFarWorld);
    }
  }

  float tUnclampedCloudExitWorld = tCloudExitWorld;

  float deviceDepth = texture2D(sceneDepth, vUv).x;
  float tSceneWorld = FAR_DISTANCE;
  if (deviceDepth < 0.999999) {
    vec3 scenePositionWorld = reconstructWorldPosition(vUv, deviceDepth);
    tSceneWorld = max(dot(scenePositionWorld - cameraWorldPosition, rayDirectionWorld), 0.0);
  }
  tCloudExitWorld = min(tCloudExitWorld, tSceneWorld);
  if (showSceneDepthClamp) {
    float unclampedLength = max(tUnclampedCloudExitWorld - tCloudEnterWorld, EPSILON);
    float visibleFraction = clamp(
      (min(tSceneWorld, tUnclampedCloudExitWorld) - tCloudEnterWorld) / unclampedLength,
      0.0,
      1.0
    );
    gl_FragColor = vec4(vec3(visibleFraction), 1.0);
    return;
  }
  if (tCloudExitWorld <= tCloudEnterWorld + EPSILON) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float stepLengthWorld = (tCloudExitWorld - tCloudEnterWorld) / float(PRIMARY_STEPS);
  float stepLengthMeters = stepLengthWorld * length(directionEcefPerWorldUnit);
  vec3 rayDirectionEcef = normalize(directionEcefPerWorldUnit);
  // sunDirectionEcef points from the sample toward the sun, while this ray
  // points camera-to-sample. Their dot is the forward-scattering cosine.
  float phase = henyeyGreensteinPhase(dot(rayDirectionEcef, sunDirectionEcef), PHASE_G);
  float transmittance = 1.0;
  vec3 radiance = vec3(0.0);
  for (int index = 0; index < PRIMARY_STEPS; index += 1) {
    float tWorld = tCloudEnterWorld + (float(index) + 0.5) * stepLengthWorld;
    vec3 samplePositionEcef = rayOriginEcef + directionEcefPerWorldUnit * tWorld;
    float density = cloudDensity(samplePositionEcef);
    float opticalDepth = density * stepLengthMeters * densityScale;
    float sampleTransmittance = exp(-opticalDepth);
    float singleScatter = (1.0 - sampleTransmittance) * CLOUD_ALBEDO;
    float directSun = traceSunTransmittance(samplePositionEcef) * SUN_ILLUMINANCE * phase;
    float sampleShellHeight01 = clamp(
      (length(samplePositionEcef) - shellBaseRadiusEcef) / shellThicknessEcef,
      0.0,
      1.0
    );
    float skyFill = SKY_FILL * mix(0.72, 1.0, sampleShellHeight01);
    vec3 inScattering =
      directSun * vec3(1.0, 0.97, 0.92) +
      skyFill * vec3(0.48, 0.62, 0.88);
    radiance += transmittance * singleScatter * inScattering;
    transmittance *= sampleTransmittance;
  }

  gl_FragColor = vec4(radiance, transmittance);
}
`;
}

export const CLOUD_SHELL_RESOLVE_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vUv;
uniform sampler2D inputBuffer;

void main() {
  gl_FragColor = texture2D(inputBuffer, vUv);
}
`;

export const CLOUD_SHELL_COMPOSITE_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vUv;
uniform sampler2D sceneColor;
uniform sampler2D cloudBuffer;

void main() {
  vec4 scene = texture2D(sceneColor, vUv);
  vec4 cloud = texture2D(cloudBuffer, vUv);
  gl_FragColor = vec4(cloud.rgb + scene.rgb * cloud.a, 1.0);
}
`;

export const CLOUD_SHELL_OUTPUT_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vUv;
uniform sampler2D sceneColor;
uniform sampler2D cloudBuffer;
uniform sampler2D compositeBuffer;
uniform int debugMode;

void main() {
  vec3 outputColor = texture2D(compositeBuffer, vUv).rgb;
  if (debugMode == 1) {
    outputColor = texture2D(cloudBuffer, vUv).rgb;
  } else if (debugMode == 2) {
    outputColor = texture2D(sceneColor, vUv).rgb;
  } else if (debugMode == 3) {
    float density = 1.0 - texture2D(cloudBuffer, vUv).a;
    outputColor = vec3(density);
  }

  gl_FragColor = vec4(outputColor, 1.0);
  #include <colorspace_fragment>
}
`;
