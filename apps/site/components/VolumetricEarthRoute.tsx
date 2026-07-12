"use client";

/* eslint-disable react-hooks/immutability */

import { OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  ClampToEdgeWrapping,
  Color,
  FrontSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  NormalBlending,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  TOUCH,
  Texture,
  Vector2,
  Vector3
} from "three";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import {
  type LandingQuality,
  type QualityProfile,
  type ResolvedQualityTier,
  useQualityTier,
  useReducedMotionPreference
} from "@miralith/visual-core";

const EARTH_RADIUS = 1;
const CLOUD_BOTTOM_RADIUS = 1.008;
const CLOUD_TOP_RADIUS = 1.034;
const ATMOSPHERE_RADIUS = 1.115;
const SUN_DIRECTION = new Vector3(-0.5, 0.22, 0.84).normalize();
const INITIAL_YAW = -0.76;

const MOBILE_TEXTURES = {
  day: "/assets/lubirth/textures/earth-day-2k.jpg",
  night: "/assets/lubirth/textures/earth-night-2k.jpg",
  clouds: "/assets/lubirth/textures/earth-clouds-2k-light.jpg",
  cloudDeck: "/assets/lubirth/textures/earth-cloud-deck-2k.png",
  specular: "/assets/lubirth/textures/earth-specular-4k.png"
};

const HIGH_TEXTURES = {
  day: "/assets/lubirth/textures/earth-day-8k.webp",
  night: "/assets/lubirth/textures/earth-night-8k.webp",
  clouds: "/assets/lubirth/textures/earth-clouds-8k.webp",
  cloudDeck: "/assets/lubirth/textures/earth-cloud-deck-4k.webp",
  specular: "/assets/lubirth/textures/earth-specular-4k.png"
};

const BALANCED_TEXTURES = {
  day: "/assets/lubirth/textures/earth-day-8k.webp",
  night: "/assets/lubirth/textures/earth-night-8k.webp",
  clouds: "/assets/lubirth/textures/earth-clouds-2k.jpg",
  cloudDeck: "/assets/lubirth/textures/earth-cloud-deck-2k.png",
  specular: "/assets/lubirth/textures/earth-specular-4k.png"
};

type VolumetricTextureMode = "balanced" | "high" | "mobile";

interface OrbitFraming {
  cameraPosition: [number, number, number];
  fov: number;
  maxDistance: number;
  minDistance: number;
  target: [number, number, number];
}

interface RayBudget {
  atmosphereSteps: number;
  cloudLightSteps: number;
  cloudSteps: number;
}

const DESKTOP_FRAMING: OrbitFraming = {
  cameraPosition: [0.16, 0.36, 2.7],
  fov: 42,
  maxDistance: 5.2,
  minDistance: 1.17,
  target: [0, -0.035, 0]
};

const MOBILE_FRAMING: OrbitFraming = {
  cameraPosition: [0.12, 0.46, 3.35],
  fov: 54,
  maxDistance: 6.2,
  minDistance: 1.24,
  target: [0, -0.02, 0]
};

interface VolumetricEarthErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface VolumetricEarthErrorBoundaryState {
  failed: boolean;
}

class VolumetricEarthErrorBoundary extends Component<
  VolumetricEarthErrorBoundaryProps,
  VolumetricEarthErrorBoundaryState
> {
  state: VolumetricEarthErrorBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.setState({ failed: true });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function canUseWebGL() {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function readRequestedQuality(): LandingQuality {
  if (typeof window === "undefined") {
    return "auto";
  }

  const quality = new URLSearchParams(window.location.search).get("quality");
  return quality === "high" || quality === "medium" || quality === "low" || quality === "fallback"
    ? quality
    : "auto";
}

function readPreserveDrawingBuffer() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("visualTest") === "pixels";
}

function subscribeRuntimeSnapshot() {
  return () => undefined;
}

function serverRequestedQualitySnapshot(): LandingQuality {
  return "auto";
}

function serverPreserveDrawingBufferSnapshot() {
  return false;
}

function serverWebGLAvailableSnapshot() {
  return true;
}

function texturePathsForMode(mode: VolumetricTextureMode) {
  if (mode === "high") {
    return HIGH_TEXTURES;
  }

  if (mode === "balanced") {
    return BALANCED_TEXTURES;
  }

  return MOBILE_TEXTURES;
}

function textureModeForQuality(quality: QualityProfile, requestedQuality: LandingQuality): VolumetricTextureMode {
  if (quality.tier === "high" && requestedQuality === "high") {
    return "high";
  }

  if (quality.tier === "high") {
    return "balanced";
  }

  return "mobile";
}

function resolveVolumetricQualityProfile(quality: QualityProfile, requestedQuality: LandingQuality): QualityProfile {
  if (
    requestedQuality === "auto" &&
    quality.tier === "medium" &&
    typeof window !== "undefined" &&
    window.innerWidth >= 980
  ) {
    return {
      ...quality,
      tier: "high",
      dpr: Math.min(quality.dpr, 1),
      reason: "volumetric-earth-desktop",
      segments: Math.max(quality.segments, 128),
      stars: Math.max(quality.stars, 760)
    };
  }

  return quality;
}

function orbitFramingForWidth(width: number): OrbitFraming {
  return width < 680 ? MOBILE_FRAMING : DESKTOP_FRAMING;
}

function segmentsForQuality(quality: QualityProfile, textureMode: VolumetricTextureMode) {
  if (textureMode === "high") {
    return 192;
  }

  if (quality.tier === "high") {
    return 160;
  }

  if (quality.tier === "medium") {
    return 128;
  }

  return 96;
}

function starCountForQuality(quality: QualityProfile, textureMode: VolumetricTextureMode) {
  if (textureMode === "high") {
    return 980;
  }

  if (quality.tier === "high") {
    return 760;
  }

  if (quality.tier === "medium") {
    return 560;
  }

  return 260;
}

function budgetForQuality(tier: ResolvedQualityTier): RayBudget {
  if (tier === "high") {
    return { atmosphereSteps: 18, cloudLightSteps: 5, cloudSteps: 18 };
  }

  if (tier === "medium") {
    return { atmosphereSteps: 12, cloudLightSteps: 4, cloudSteps: 12 };
  }

  return { atmosphereSteps: 8, cloudLightSteps: 3, cloudSteps: 8 };
}

function useVolumetricEarthTextures(mode: VolumetricTextureMode) {
  const paths = useMemo(() => {
    const resolved = texturePathsForMode(mode);
    return [resolved.day, resolved.night, resolved.clouds, resolved.cloudDeck, resolved.specular];
  }, [mode]);
  const [day, night, clouds, cloudDeck, specular] = useTexture(paths) as Texture[];
  const { gl } = useThree();

  useEffect(() => {
    const maxAnisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), mode === "mobile" ? 8 : 14);

    for (const texture of [day, night, clouds, cloudDeck, specular]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.magFilter = LinearFilter;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.anisotropy = maxAnisotropy;
      texture.needsUpdate = true;
    }

    day.colorSpace = SRGBColorSpace;
    night.colorSpace = SRGBColorSpace;
    clouds.colorSpace = SRGBColorSpace;
  }, [cloudDeck, clouds, day, gl, mode, night, specular]);

  return { cloudDeck, clouds, day, night, specular };
}

function createSurfaceMaterial(textures: ReturnType<typeof useVolumetricEarthTextures>) {
  return new ShaderMaterial({
    name: "MiraLithVolumetricEarthSurface",
    uniforms: {
      dayMap: { value: textures.day },
      nightMap: { value: textures.night },
      specularMap: { value: textures.specular },
      cloudMap: { value: textures.clouds },
      cloudDeckMap: { value: textures.cloudDeck },
      sunDir: { value: SUN_DIRECTION.clone() },
      yaw: { value: INITIAL_YAW },
      cloudOffset: { value: new Vector2(0, 0) },
      atmosphereBlue: { value: new Color(0.16, 0.43, 0.92) },
      karmanWhite: { value: new Color(0.94, 0.985, 1.0) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D specularMap;
      uniform sampler2D cloudMap;
      uniform sampler2D cloudDeckMap;
      uniform vec3 sunDir;
      uniform float yaw;
      uniform vec2 cloudOffset;
      uniform vec3 atmosphereBlue;
      uniform vec3 karmanWhite;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      const float TAU = 6.28318530718;

      float clamp01(float value) {
        return clamp(value, 0.0, 1.0);
      }

      float luma(vec3 color) {
        return dot(color, vec3(0.2126, 0.7152, 0.0722));
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(sunDir);
        vec2 uv = vec2(fract(vUv.x + yaw / TAU), clamp(vUv.y, 0.001, 0.999));
        vec2 cloudUv = vec2(fract(uv.x + cloudOffset.x), clamp(uv.y + cloudOffset.y, 0.001, 0.999));
        vec2 lightUv = normalize(vec2(-lightDirection.z, lightDirection.y) + vec2(0.0001));
        vec2 cloudShadowUv = vec2(fract(cloudUv.x + lightUv.x * 0.014), clamp(cloudUv.y + lightUv.y * 0.012, 0.001, 0.999));

        float sunDot = dot(normal, lightDirection);
        float dayAmount = smoothstep(-0.30, 0.18, sunDot);
        float nightAmount = 1.0 - smoothstep(-0.36, 0.08, sunDot);
        float terminator = smoothstep(-0.24, 0.12, sunDot) * (1.0 - smoothstep(0.18, 0.52, sunDot));
        float limb = 1.0 - clamp01(dot(normal, viewDirection));

        vec3 dayColor = texture2D(dayMap, uv).rgb;
        vec3 nightColor = texture2D(nightMap, uv).rgb;
        float oceanMask = clamp01(texture2D(specularMap, uv).r);
        float cloudCaster = pow(luma(texture2D(cloudMap, cloudShadowUv).rgb), 0.62);
        float deckCaster = texture2D(cloudDeckMap, cloudShadowUv).g;
        float localCloud = max(
          pow(luma(texture2D(cloudMap, cloudUv).rgb), 0.58),
          texture2D(cloudDeckMap, cloudUv).g * 0.82
        );
        float projectedShadow = smoothstep(0.16, 0.78, max(cloudCaster, deckCaster * 0.86)) * smoothstep(-0.2, 0.58, sunDot);
        float glintCloudClear = 1.0 - smoothstep(0.18, 0.74, localCloud);

        dayColor *= 1.0 - projectedShadow * 0.28;

        vec3 halfVector = normalize(lightDirection + viewDirection);
        float glintAlignment = clamp01(dot(normal, halfVector));
        vec3 glintAxis = normalize(vec3(0.82, 0.12, -0.56));
        vec3 glintTangent = normalize(glintAxis - normal * dot(glintAxis, normal) + vec3(0.0001));
        vec3 glintBitangent = normalize(cross(normal, glintTangent));
        vec3 glintDelta = halfVector - normal * glintAlignment;
        float glintAlong = dot(glintDelta, glintTangent);
        float glintAcross = dot(glintDelta, glintBitangent);
        float directionalCore = exp(-(glintAlong * glintAlong * 4200.0 + glintAcross * glintAcross * 15500.0));
        float directionalBloom = exp(-(glintAlong * glintAlong * 760.0 + glintAcross * glintAcross * 2500.0));
        float oceanGlintCore = directionalCore * pow(glintAlignment, 260.0) * oceanMask * dayAmount * glintCloudClear;
        float oceanGlintBloom = directionalBloom * pow(glintAlignment, 92.0) * oceanMask * dayAmount * glintCloudClear;
        float grazingSpecular = pow(clamp01(dot(reflect(-lightDirection, normal), viewDirection)), 64.0) * oceanMask;

        vec3 twilightColor = mix(vec3(1.0, 0.36, 0.08), vec3(0.12, 0.32, 0.70), clamp01(sunDot + 0.22));
        vec3 surfaceColor = mix(nightColor * (0.72 + nightAmount * 1.75), dayColor, dayAmount);
        surfaceColor += twilightColor * terminator * (0.055 + limb * 0.13);
        surfaceColor += vec3(1.0, 0.94, 0.78) * oceanGlintCore * 0.82;
        surfaceColor += vec3(0.86, 0.96, 1.0) * oceanGlintBloom * 0.036;
        surfaceColor += vec3(0.10, 0.26, 0.54) * grazingSpecular * dayAmount * 0.035;
        surfaceColor += atmosphereBlue * pow(limb, 3.4) * dayAmount * 0.018;
        surfaceColor += karmanWhite * smoothstep(0.90, 0.988, limb) * (1.0 - smoothstep(0.993, 1.0, limb)) * dayAmount * 0.034;

        gl_FragColor = vec4(surfaceColor, 1.0);
      }
    `
  });
}

function createCloudMaterial(cloudTexture: Texture, cloudDeckTexture: Texture, budget: RayBudget, tier: ResolvedQualityTier) {
  return new ShaderMaterial({
    name: "MiraLithIndependentVolumetricClouds",
    defines: {
      CLOUD_LIGHT_STEPS: String(budget.cloudLightSteps),
      CLOUD_STEPS: String(budget.cloudSteps)
    },
    uniforms: {
      cloudMap: { value: cloudTexture },
      cloudDeckMap: { value: cloudDeckTexture },
      sunDir: { value: SUN_DIRECTION.clone() },
      yaw: { value: INITIAL_YAW },
      cloudOffset: { value: new Vector2(0, 0) },
      opacity: { value: tier === "low" ? 0.72 : 0.92 },
      atmosphereTint: { value: new Color(0.13, 0.36, 0.78) }
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudMap;
      uniform sampler2D cloudDeckMap;
      uniform vec3 sunDir;
      uniform float yaw;
      uniform vec2 cloudOffset;
      uniform float opacity;
      uniform vec3 atmosphereTint;

      varying vec3 vWorldPosition;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;
      const float EARTH_RADIUS = ${EARTH_RADIUS.toFixed(3)};
      const float CLOUD_BOTTOM = ${CLOUD_BOTTOM_RADIUS.toFixed(3)};
      const float CLOUD_TOP = ${CLOUD_TOP_RADIUS.toFixed(3)};

      float clamp01(float value) {
        return clamp(value, 0.0, 1.0);
      }

      float luma(vec3 color) {
        return dot(color, vec3(0.2126, 0.7152, 0.0722));
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      bool raySphere(vec3 origin, vec3 direction, float radius, out float t0, out float t1) {
        float b = dot(origin, direction);
        float c = dot(origin, origin) - radius * radius;
        float h = b * b - c;
        if (h < 0.0) {
          return false;
        }
        h = sqrt(h);
        t0 = -b - h;
        t1 = -b + h;
        return t1 > 0.0;
      }

      vec2 sphericalUv(vec3 point) {
        vec3 n = normalize(point);
        float u = atan(n.z, n.x) / TAU + 0.5 + yaw / TAU + cloudOffset.x;
        float v = asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5 + cloudOffset.y;
        return vec2(fract(u), clamp(v, 0.001, 0.999));
      }

      float cloudPhase(float g, float mu) {
        float gg = g * g;
        return (1.0 - gg) / max(pow(1.0 + gg - 2.0 * g * mu, 1.5), 0.001);
      }

      float shellMask(float radius) {
        float bottom = smoothstep(CLOUD_BOTTOM, CLOUD_BOTTOM + 0.012, radius);
        float top = 1.0 - smoothstep(CLOUD_TOP - 0.016, CLOUD_TOP, radius);
        return bottom * top;
      }

      float cloudDensityAt(vec3 point) {
        float radius = length(point);
        vec2 uv = sphericalUv(point);
        float shell = shellMask(radius);
        float base = pow(luma(texture2D(cloudMap, uv).rgb), 0.72);
        vec4 deck = texture2D(cloudDeckMap, uv);
        float weather = deck.r * 0.44 + pow(deck.g, 1.24) * 0.48 + deck.a * 0.12;
        float detail = noise2(uv * vec2(96.0, 48.0) + radius * 27.0) * 0.5 +
          noise2(uv * vec2(221.0, 93.0) - radius * 61.0) * 0.5;
        float cellularBreak = noise2(uv * vec2(17.0, 8.0) + vec2(2.1, 7.4));
        float density = base * 0.62 + weather * 0.58 + detail * 0.16;
        density = smoothstep(0.30, 0.86, density);
        density *= mix(0.72, 1.16, cellularBreak);
        density *= shell;
        return clamp01(density);
      }

      float lightTransmittance(vec3 point, vec3 lightDirection) {
        float lightDensity = 0.0;
        float t0;
        float t1;

        if (!raySphere(point, lightDirection, CLOUD_TOP, t0, t1)) {
          return 1.0;
        }

        float stepSize = max(t1, 0.0) / float(CLOUD_LIGHT_STEPS);
        for (int i = 0; i < CLOUD_LIGHT_STEPS; i += 1) {
          float stepIndex = float(i) + 0.52;
          vec3 samplePoint = point + lightDirection * stepSize * stepIndex;
          lightDensity += cloudDensityAt(samplePoint) * stepSize;
        }

        return exp(-lightDensity * 4.8);
      }

      void main() {
        vec3 rayOrigin = cameraPosition;
        vec3 rayDirection = normalize(vWorldPosition - cameraPosition);
        vec3 lightDirection = normalize(sunDir);

        float outerNear;
        float outerFar;
        if (!raySphere(rayOrigin, rayDirection, CLOUD_TOP, outerNear, outerFar)) {
          discard;
        }

        float innerNear;
        float innerFar;
        bool hitsInner = raySphere(rayOrigin, rayDirection, CLOUD_BOTTOM, innerNear, innerFar);
        float marchStart = max(outerNear, 0.0);
        float marchEnd = hitsInner ? min(max(innerNear, marchStart), outerFar) : outerFar;

        if (marchEnd <= marchStart) {
          discard;
        }

        float segmentLength = marchEnd - marchStart;
        float stepSize = segmentLength / float(CLOUD_STEPS);
        float jitter = hash21(gl_FragCoord.xy + cloudOffset * 8192.0);
        float transmittance = 1.0;
        vec3 accum = vec3(0.0);

        for (int i = 0; i < CLOUD_STEPS; i += 1) {
          float stepIndex = float(i) + 0.34 + jitter * 0.42;
          vec3 samplePoint = rayOrigin + rayDirection * (marchStart + stepSize * stepIndex);
          vec3 normal = normalize(samplePoint);
          float density = cloudDensityAt(samplePoint);

          if (density > 0.001) {
            float sunDot = dot(normal, lightDirection);
            float day = smoothstep(-0.28, 0.34, sunDot);
            float twilight = smoothstep(-0.36, 0.04, sunDot) * (1.0 - smoothstep(0.12, 0.58, sunDot));
            float lightThroughCloud = lightTransmittance(samplePoint, lightDirection);
            float forward = cloudPhase(0.42, clamp(dot(rayDirection, lightDirection), -1.0, 1.0));
            float silver = pow(clamp01(1.0 - dot(normal, -rayDirection)), 4.0) * smoothstep(-0.1, 0.58, sunDot);

            vec3 coldBase = vec3(0.28, 0.34, 0.43);
            vec3 litTop = vec3(0.95, 0.985, 1.0);
            vec3 warmEdge = vec3(1.0, 0.58, 0.24);
            vec3 color = mix(coldBase, litTop, day * (0.42 + lightThroughCloud * 0.58));
            color = mix(color, warmEdge, twilight * 0.26);
            color += atmosphereTint * silver * lightThroughCloud * 0.26;
            color += vec3(0.85, 0.93, 1.0) * forward * density * day * 0.11;
            color *= mix(0.46, 1.0, day + twilight * 0.4);

            float alpha = density * stepSize * opacity * 5.2;
            alpha = clamp(alpha, 0.0, 0.24);
            accum += color * alpha * transmittance;
            transmittance *= 1.0 - alpha;
          }
        }

        float alpha = clamp01(1.0 - transmittance);
        vec3 shellNormal = normalize(vWorldPosition);
        float outerGrazing = 1.0 - clamp01(dot(shellNormal, -rayDirection));
        float readableLimb = smoothstep(0.34, 0.66, outerGrazing) * (1.0 - smoothstep(0.76, 0.94, outerGrazing));
        float extremeGrazingTrim = 1.0 - smoothstep(0.56, 0.94, outerGrazing) * 0.88;
        accum *= extremeGrazingTrim;
        alpha *= extremeGrazingTrim;
        accum += atmosphereTint * readableLimb * alpha * 0.045;

        if (alpha < 0.006) {
          discard;
        }

        gl_FragColor = vec4(accum / max(alpha, 0.001), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    side: FrontSide
  });
}

function createAtmosphereMaterial(budget: RayBudget) {
  return new ShaderMaterial({
    name: "MiraLithIndependentVolumetricAtmosphere",
    defines: {
      ATMOSPHERE_STEPS: String(budget.atmosphereSteps)
    },
    uniforms: {
      sunDir: { value: SUN_DIRECTION.clone() },
      rayleighColor: { value: new Color(0.22, 0.58, 1.0) },
      mieColor: { value: new Color(0.92, 0.97, 1.0) },
      ozoneColor: { value: new Color(0.04, 0.12, 0.32) },
      intensity: { value: 1.0 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDir;
      uniform vec3 rayleighColor;
      uniform vec3 mieColor;
      uniform vec3 ozoneColor;
      uniform float intensity;

      varying vec3 vWorldPosition;

      const float PI = 3.14159265359;
      const float EARTH_RADIUS = ${EARTH_RADIUS.toFixed(3)};
      const float ATMOSPHERE_RADIUS = ${ATMOSPHERE_RADIUS.toFixed(3)};

      float clamp01(float value) {
        return clamp(value, 0.0, 1.0);
      }

      bool raySphere(vec3 origin, vec3 direction, float radius, out float t0, out float t1) {
        float b = dot(origin, direction);
        float c = dot(origin, origin) - radius * radius;
        float h = b * b - c;
        if (h < 0.0) {
          return false;
        }
        h = sqrt(h);
        t0 = -b - h;
        t1 = -b + h;
        return t1 > 0.0;
      }

      float rayleighPhase(float mu) {
        return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
      }

      float miePhase(float mu) {
        float g = 0.76;
        float gg = g * g;
        return ((3.0 * (1.0 - gg)) / (2.0 * (2.0 + gg))) *
          ((1.0 + mu * mu) / pow(max(1.0 + gg - 2.0 * g * mu, 0.0001), 1.5));
      }

      vec3 densityAt(vec3 point) {
        float height = max(length(point) - EARTH_RADIUS, 0.0);
        float rayleigh = exp(-height / 0.056);
        float mie = exp(-height / 0.018);
        float ozoneBand = exp(-pow((height - 0.15) / 0.07, 2.0));
        return vec3(rayleigh, mie, ozoneBand);
      }

      void main() {
        vec3 rayOrigin = cameraPosition;
        vec3 rayDirection = normalize(vWorldPosition - cameraPosition);
        vec3 lightDirection = normalize(sunDir);

        float atmosphereNear;
        float atmosphereFar;
        if (!raySphere(rayOrigin, rayDirection, ATMOSPHERE_RADIUS, atmosphereNear, atmosphereFar)) {
          discard;
        }

        float groundNear;
        float groundFar;
        if (raySphere(rayOrigin, rayDirection, EARTH_RADIUS, groundNear, groundFar)) {
          atmosphereFar = min(atmosphereFar, max(groundNear, 0.0));
        }

        float marchStart = max(atmosphereNear, 0.0);
        float marchEnd = atmosphereFar;
        if (marchEnd <= marchStart) {
          discard;
        }

        float segmentLength = marchEnd - marchStart;
        float stepSize = segmentLength / float(ATMOSPHERE_STEPS);
        float mu = dot(rayDirection, lightDirection);
        float phaseRayleigh = rayleighPhase(mu);
        float phaseMie = miePhase(mu);
        vec3 accumulated = vec3(0.0);
        vec3 opticalDepth = vec3(0.0);

        for (int i = 0; i < ATMOSPHERE_STEPS; i += 1) {
          float stepIndex = float(i) + 0.5;
          vec3 samplePoint = rayOrigin + rayDirection * (marchStart + stepSize * stepIndex);
          vec3 normal = normalize(samplePoint);
          float sunDot = dot(normal, lightDirection);
          float day = smoothstep(-0.16, 0.32, sunDot);
          vec3 density = densityAt(samplePoint) * stepSize;
          opticalDepth += density;

          vec3 absorb = exp(-vec3(5.2, 9.4, 20.0) * opticalDepth.x - vec3(1.4, 1.55, 1.7) * opticalDepth.y);
          vec3 localScatter =
            rayleighColor * phaseRayleigh * density.x * 8.2 +
            mieColor * phaseMie * density.y * 0.22 -
            ozoneColor * density.z * 0.035;

          accumulated += max(localScatter, vec3(0.0)) * absorb * (0.22 + day * 0.78);
        }

        float viewLimb = 1.0 - clamp01(dot(normalize(vWorldPosition), -rayDirection));
        float limbBoost = smoothstep(0.60, 0.92, viewLimb) * (1.0 - smoothstep(0.966, 0.992, viewLimb));
        float horizonNeedle = smoothstep(0.90, 0.978, viewLimb) * (1.0 - smoothstep(0.986, 0.997, viewLimb));
        vec3 color = accumulated * intensity * (0.30 + limbBoost * 1.05);
        color += vec3(0.90, 0.975, 1.0) * horizonNeedle * 0.34 * intensity;
        color += vec3(0.22, 0.56, 1.0) * limbBoost * 0.03 * intensity;

        float alpha = clamp(length(accumulated) * 0.18 + horizonNeedle * 0.132 + limbBoost * 0.012, 0.0, 0.22);
        if (alpha < 0.002) {
          discard;
        }

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    side: BackSide,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending
  });
}

function VolumetricEarthMaterials({
  quality,
  reducedMotion,
  textureMode
}: {
  quality: QualityProfile;
  reducedMotion: boolean;
  textureMode: VolumetricTextureMode;
}) {
  const textures = useVolumetricEarthTextures(textureMode);
  const { cloudDeck, clouds, day, night, specular } = textures;
  const planetGroup = useRef<Group>(null);
  const yaw = useRef(INITIAL_YAW);
  const cloudOffset = useRef(new Vector2(0.018, 0.0));
  const segments = segmentsForQuality(quality, textureMode);
  const budget = useMemo(() => budgetForQuality(quality.tier), [quality.tier]);
  const surfaceMaterial = useMemo(
    () => createSurfaceMaterial({ cloudDeck, clouds, day, night, specular }),
    [cloudDeck, clouds, day, night, specular]
  );
  const cloudMaterial = useMemo(
    () => createCloudMaterial(clouds, cloudDeck, budget, quality.tier),
    [budget, cloudDeck, clouds, quality.tier]
  );
  const atmosphereMaterial = useMemo(() => createAtmosphereMaterial(budget), [budget]);

  useEffect(() => {
    return () => {
      surfaceMaterial.dispose();
      cloudMaterial.dispose();
      atmosphereMaterial.dispose();
    };
  }, [atmosphereMaterial, cloudMaterial, surfaceMaterial]);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.033);
    const elapsed = state.clock.elapsedTime;
    const rotationSpeed = reducedMotion ? 0 : quality.tier === "low" ? 0.012 : 0.018;

    yaw.current = (yaw.current + safeDelta * rotationSpeed) % (Math.PI * 2);
    cloudOffset.current.x = (cloudOffset.current.x + safeDelta * (reducedMotion ? 0.0004 : 0.0026)) % 1;
    cloudOffset.current.y = Math.sin(elapsed * 0.026) * 0.003;

    surfaceMaterial.uniforms.yaw.value = yaw.current;
    surfaceMaterial.uniforms.cloudOffset.value.copy(cloudOffset.current);
    cloudMaterial.uniforms.yaw.value = yaw.current;
    cloudMaterial.uniforms.cloudOffset.value.copy(cloudOffset.current);
    cloudMaterial.uniforms.opacity.value = quality.tier === "low" ? 0.72 : 0.92;
    atmosphereMaterial.uniforms.intensity.value = quality.tier === "low" ? 0.78 : quality.tier === "medium" ? 0.94 : 1.05;
  });

  return (
    <group ref={planetGroup}>
      <mesh material={surfaceMaterial} renderOrder={2}>
        <sphereGeometry args={[EARTH_RADIUS, segments, Math.floor(segments / 2)]} />
      </mesh>
      <mesh material={cloudMaterial} renderOrder={5}>
        <sphereGeometry args={[CLOUD_TOP_RADIUS, Math.max(96, segments), Math.max(48, Math.floor(segments / 2))]} />
      </mesh>
      <mesh material={atmosphereMaterial} renderOrder={8}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, Math.max(128, segments), Math.max(64, Math.floor(segments / 2))]} />
      </mesh>
    </group>
  );
}

function ResponsiveCameraRig({ framing }: { framing: OrbitFraming }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const perspectiveCamera = camera as typeof camera & { fov?: number; updateProjectionMatrix?: () => void };
    if (typeof perspectiveCamera.fov === "number") {
      perspectiveCamera.fov = framing.fov;
      perspectiveCamera.position.set(...framing.cameraPosition);
      perspectiveCamera.lookAt(...framing.target);
      perspectiveCamera.updateProjectionMatrix?.();
    }
  }, [camera, framing, size.width]);

  return null;
}

function StarField({ count }: { count: number }) {
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const radius = 24 + seededUnit(index, 3) * 20;
      const theta = seededUnit(index, 7) * Math.PI * 2;
      const phi = Math.acos(2 * seededUnit(index, 11) - 1);
      const item = index * 3;

      values[item] = radius * Math.sin(phi) * Math.cos(theta);
      values[item + 1] = radius * Math.cos(phi);
      values[item + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    return values;
  }, [count]);

  return (
    <points renderOrder={0}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#dcecff" size={0.024} sizeAttenuation transparent opacity={0.86} depthWrite={false} />
    </points>
  );
}

function seededUnit(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function VolumetricEarthScene({
  quality,
  reducedMotion,
  textureMode
}: {
  quality: QualityProfile;
  reducedMotion: boolean;
  textureMode: VolumetricTextureMode;
}) {
  const sunPosition = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(8), []);
  const { size } = useThree();
  const framing = useMemo(() => orbitFramingForWidth(size.width), [size.width]);

  return (
    <>
      <color attach="background" args={["#000107"]} />
      <ResponsiveCameraRig framing={framing} />
      <ambientLight intensity={0.012} />
      <directionalLight position={sunPosition.toArray()} intensity={1.86} color="#ffe4bd" />
      <StarField count={starCountForQuality(quality, textureMode)} />
      <VolumetricEarthMaterials quality={quality} reducedMotion={reducedMotion} textureMode={textureMode} />
      <OrbitControls
        enableDamping
        dampingFactor={0.075}
        enablePan={false}
        minDistance={framing.minDistance}
        maxDistance={framing.maxDistance}
        rotateSpeed={0.44}
        zoomSpeed={0.7}
        target={framing.target}
        touches={{
          ONE: TOUCH.ROTATE,
          TWO: TOUCH.DOLLY_PAN
        }}
      />
    </>
  );
}

function VolumetricEarthFallback() {
  return (
    <div className="volumetric-earth__fallback" role="img" aria-label="Volumetric Earth fallback">
      <div className="volumetric-earth__fallback-poster" />
      <div className="volumetric-earth__fallback-copy">
        <strong>Volumetric Earth</strong>
        <span>WebGL unavailable. Showing static orbital poster.</span>
      </div>
    </div>
  );
}

function VolumetricEarthHud({ quality, textureMode }: { quality: QualityProfile; textureMode: VolumetricTextureMode }) {
  const budget = budgetForQuality(quality.tier);
  const textureTier = textureMode === "high"
    ? "8K surface + cloud"
    : textureMode === "balanced"
      ? "8K surface / 2K cloud"
      : "2K surface";

  return (
    <section className="volumetric-earth__hud" aria-label="Volumetric Earth render telemetry">
      <div className="volumetric-earth__hud-heading">
        <p>Volumetric Earth</p>
        <span>route spike</span>
      </div>
      <dl className="volumetric-earth__hud-grid">
        <div>
          <dt>Cloud</dt>
          <dd>{budget.cloudSteps} ray steps</dd>
        </div>
        <div>
          <dt>Light</dt>
          <dd>{budget.cloudLightSteps} cloud taps</dd>
        </div>
        <div>
          <dt>Air</dt>
          <dd>{budget.atmosphereSteps} samples</dd>
        </div>
        <div>
          <dt>Texture</dt>
          <dd>{textureTier}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{quality.tier}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>independent</dd>
        </div>
      </dl>
    </section>
  );
}

export function VolumetricEarthRoute() {
  const reducedMotion = useReducedMotionPreference();
  const requestedQuality = useSyncExternalStore(
    subscribeRuntimeSnapshot,
    readRequestedQuality,
    serverRequestedQualitySnapshot
  );
  const preserveDrawingBuffer = useSyncExternalStore(
    subscribeRuntimeSnapshot,
    readPreserveDrawingBuffer,
    serverPreserveDrawingBufferSnapshot
  );
  const webglAvailable = useSyncExternalStore(
    subscribeRuntimeSnapshot,
    canUseWebGL,
    serverWebGLAvailableSnapshot
  );
  const [contextLost, setContextLost] = useState(false);
  const baseQuality = useQualityTier(requestedQuality, reducedMotion);
  const quality = resolveVolumetricQualityProfile(baseQuality, requestedQuality);
  const textureMode = textureModeForQuality(quality, requestedQuality);
  const showFallback = !webglAvailable || contextLost || quality.tier === "fallback";

  return (
    <main className="volumetric-earth">
      {showFallback ? (
        <VolumetricEarthFallback />
      ) : (
        <div className="volumetric-earth__canvas" aria-label="Independent volumetric Earth route">
          <VolumetricEarthErrorBoundary fallback={<VolumetricEarthFallback />}>
            <Canvas
              dpr={[1, quality.dpr || 1]}
              camera={{ fov: DESKTOP_FRAMING.fov, position: DESKTOP_FRAMING.cameraPosition, near: 0.01, far: 90 }}
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer }}
              onCreated={({ gl }) => {
                gl.outputColorSpace = SRGBColorSpace;
                gl.toneMapping = ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.05;
                gl.domElement.addEventListener("webglcontextlost", (event) => {
                  event.preventDefault();
                  setContextLost(true);
                });
              }}
            >
              <Suspense fallback={null}>
                <VolumetricEarthScene quality={quality} reducedMotion={reducedMotion} textureMode={textureMode} />
              </Suspense>
            </Canvas>
          </VolumetricEarthErrorBoundary>
        </div>
      )}
      <VolumetricEarthHud quality={quality} textureMode={textureMode} />
      <div className="volumetric-earth__shade" aria-hidden="true" />
      <style>{`
        .volumetric-earth {
          position: relative;
          width: 100vw;
          min-height: 100svh;
          height: 100svh;
          overflow: hidden;
          background: #000107;
          color: #f6fbff;
          isolation: isolate;
          font-family: "Avenir Next", "SF Pro Display", "PingFang SC", sans-serif;
        }

        .volumetric-earth__canvas,
        .volumetric-earth__fallback {
          position: fixed;
          inset: 0;
          z-index: 1;
        }

        .volumetric-earth__canvas,
        .volumetric-earth__canvas canvas {
          width: 100% !important;
          height: 100% !important;
          touch-action: none;
        }

        .volumetric-earth__shade {
          position: fixed;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            radial-gradient(circle at 68% 42%, transparent 0 24%, rgba(0, 1, 7, 0.22) 56%, rgba(0, 1, 7, 0.74) 100%),
            linear-gradient(90deg, rgba(0, 1, 7, 0.52), transparent 24%, transparent 76%, rgba(0, 1, 7, 0.58)),
            linear-gradient(180deg, rgba(0, 1, 9, 0.34), transparent 30%, rgba(0, 1, 9, 0.52));
          mix-blend-mode: multiply;
          opacity: 0.66;
        }

        .volumetric-earth__hud {
          position: fixed;
          left: clamp(18px, 3.4vw, 46px);
          bottom: clamp(18px, 3.2vw, 40px);
          z-index: 3;
          width: min(424px, calc(100vw - 36px));
          padding: 14px 15px 13px;
          border: 1px solid rgba(185, 215, 255, 0.2);
          background: linear-gradient(180deg, rgba(1, 9, 24, 0.68), rgba(0, 4, 13, 0.44));
          color: rgba(239, 247, 255, 0.92);
          pointer-events: none;
          text-shadow: 0 0 16px rgba(95, 169, 255, 0.12);
        }

        .volumetric-earth__hud::before {
          content: "";
          position: absolute;
          inset: 5px;
          border: 1px solid rgba(185, 215, 255, 0.08);
          pointer-events: none;
        }

        .volumetric-earth__hud-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
          margin: 0 0 11px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(185, 215, 255, 0.14);
        }

        .volumetric-earth__hud-heading p {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .volumetric-earth__hud-heading span {
          color: rgba(180, 211, 245, 0.66);
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .volumetric-earth__hud-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px 12px;
          margin: 0;
        }

        .volumetric-earth__hud-grid div {
          min-width: 0;
        }

        .volumetric-earth__hud-grid dt {
          margin: 0 0 3px;
          color: rgba(149, 183, 224, 0.58);
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .volumetric-earth__hud-grid dd {
          margin: 0;
          color: rgba(243, 249, 255, 0.9);
          font-size: 11px;
          line-height: 1.25;
        }

        .volumetric-earth__fallback {
          display: grid;
          place-items: center;
          background: #000107;
        }

        .volumetric-earth__fallback-poster {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: url("/assets/lubirth/poster-field.webp") center / cover no-repeat;
          opacity: 0.58;
        }

        .volumetric-earth__fallback-copy {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 5px;
          width: min(340px, calc(100vw - 48px));
          padding: 14px 16px;
          border: 1px solid rgba(202, 226, 255, 0.22);
          background: rgba(0, 6, 18, 0.62);
          color: rgba(245, 250, 255, 0.88);
        }

        .volumetric-earth__fallback-copy strong {
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .volumetric-earth__fallback-copy span {
          color: rgba(198, 220, 245, 0.72);
          font-size: 12px;
          line-height: 1.45;
        }

        @media (max-width: 680px) {
          .volumetric-earth__shade {
            background:
              linear-gradient(90deg, rgba(0, 1, 7, 0.36), transparent 18%, transparent 82%, rgba(0, 1, 7, 0.34)),
              linear-gradient(180deg, rgba(0, 1, 9, 0.28), transparent 24%, transparent 76%, rgba(0, 1, 9, 0.46));
          }

          .volumetric-earth__hud {
            right: 12px;
            bottom: 12px;
            left: 12px;
            width: auto;
            padding: 8px 9px 8px;
          }

          .volumetric-earth__hud-heading {
            margin-bottom: 7px;
            padding-bottom: 6px;
          }

          .volumetric-earth__hud-heading p {
            font-size: 11px;
          }

          .volumetric-earth__hud-heading span,
          .volumetric-earth__hud-grid dt {
            font-size: 7px;
          }

          .volumetric-earth__hud-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px 8px;
          }

          .volumetric-earth__hud-grid dd {
            font-size: 9px;
          }
        }
      `}</style>
    </main>
  );
}
