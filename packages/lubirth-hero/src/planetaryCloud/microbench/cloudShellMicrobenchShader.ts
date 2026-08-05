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

float cloudDensity(vec3 positionEcef) {
  float radius = length(positionEcef);
  float shellHeight01 = (radius - shellBaseRadiusEcef) / shellThicknessEcef;
  if (shellHeight01 <= 0.0 || shellHeight01 >= 1.0) {
    return 0.0;
  }

  vec4 weather = texture2D(weatherTexture, getEquirectangularUv(positionEcef));
  float sourceCoverage = weather.r;
  float cloudTop = mix(0.35, 1.0, weather.g);
  float verticalProfile =
    smoothstep(0.0, 0.08, shellHeight01) *
    (1.0 - smoothstep(max(0.08, cloudTop - 0.18), cloudTop, shellHeight01));
  float morphologyGain = mix(0.75, 1.25, weather.b);
  float concavityGain = mix(1.0, 0.72, weather.a);
  return sourceCoverage * verticalProfile * morphologyGain * concavityGain;
}

float traceSunTransmittance(vec3 positionEcef) {
  float stepLengthMeters = shellThicknessEcef / float(LIGHT_STEPS);
  float opticalDepth = 0.0;
  for (int index = 0; index < LIGHT_STEPS; index += 1) {
    float t = (float(index) + 0.5) * stepLengthMeters;
    opticalDepth += cloudDensity(positionEcef + sunDirectionEcef * t) * stepLengthMeters * densityScale;
  }
  return exp(-opticalDepth);
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
  float transmittance = 1.0;
  vec3 radiance = vec3(0.0);
  for (int index = 0; index < PRIMARY_STEPS; index += 1) {
    float tWorld = tCloudEnterWorld + (float(index) + 0.5) * stepLengthWorld;
    vec3 samplePositionEcef = rayOriginEcef + directionEcefPerWorldUnit * tWorld;
    float density = cloudDensity(samplePositionEcef);
    float opticalDepth = density * stepLengthMeters * densityScale;
    float sampleTransmittance = exp(-opticalDepth);
    float scattering = 1.0 - sampleTransmittance;
    radiance += transmittance * scattering * traceSunTransmittance(samplePositionEcef) * vec3(1.0, 0.97, 0.92);
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
