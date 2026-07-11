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
  type ResolvedQualityTier,
  type QualityProfile,
  mapOpeningProgress,
  useQualityTier,
  useReducedMotionPreference
} from "@miralith/visual-core";

const EARTH_RADIUS = 1;
const CLOUD_BOTTOM_RADIUS = 1.006;
const CLOUD_TOP_RADIUS = 1.046;
const KARMAN_LINE_RADIUS = 1.068;
const ATMOSPHERE_RADIUS = 1.145;
const INITIAL_YAW = 0;
const SUN_DIRECTION = new Vector3(0.64, -0.08, 0.76).normalize();
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
const BALANCED_DESKTOP_TEXTURES = {
  day: "/assets/lubirth/textures/earth-day-8k.webp",
  night: "/assets/lubirth/textures/earth-night-8k.webp",
  clouds: "/assets/lubirth/textures/earth-clouds-2k.jpg",
  cloudDeck: "/assets/lubirth/textures/earth-cloud-deck-2k.png",
  specular: "/assets/lubirth/textures/earth-specular-4k.png"
};

type NasaTextureMode = "balanced-desktop" | "high" | "mobile";
type NasaSceneMode = "near" | "far";

interface OrbitFraming {
  cameraPosition: [number, number, number];
  earthPitchRad: number;
  earthYawRad: number;
  fov: number;
  maxDistance: number;
  minDistance: number;
  target: [number, number, number];
}

const degToRad = (value: number) => (value * Math.PI) / 180;
const clamp01Number = (value: number) => Math.min(1, Math.max(0, value));
const easeInOutNumber = (value: number) => value * value * (3 - 2 * value);

function orbitFramingForScene(sceneMode: NasaSceneMode): OrbitFraming {
  const progress = sceneMode === "near" ? 0 : 1;
  const frame = { ...mapOpeningProgress(progress) };
  const orbitalGrazing = 1 - easeInOutNumber(clamp01Number(progress / 0.72));

  frame.cameraElevation += degToRad(1.7 * orbitalGrazing);
  frame.cameraLookAtY += 0.44 * orbitalGrazing;
  frame.earthY -= 0.02 * orbitalGrazing;

  const cameraX = Math.sin(frame.cameraAzimuth) * frame.cameraDistance;
  const cameraY = Math.sin(frame.cameraElevation) * frame.cameraDistance;
  const cameraZ = Math.cos(frame.cameraAzimuth) * frame.cameraDistance;
  const earthScale = frame.earthScale;
  const earthX = frame.earthX;
  const earthY = frame.earthY;
  const targetY = frame.cameraLookAtY;
  const cameraPosition: [number, number, number] = [
    (cameraX - earthX) / earthScale,
    (cameraY - earthY) / earthScale,
    cameraZ / earthScale
  ];
  const target: [number, number, number] = [
    -earthX / earthScale,
    (targetY - earthY) / earthScale,
    0
  ];

  return {
    cameraPosition,
    earthPitchRad: degToRad(frame.earthPitchDeg),
    earthYawRad: degToRad(frame.earthYawDeg),
    fov: 45,
    maxDistance: sceneMode === "near" ? 3.8 : 9.2,
    minDistance: sceneMode === "near" ? 1.04 : 1.18,
    target
  };
}

const DEFAULT_NEAR_FRAMING = orbitFramingForScene("near");

interface ObservationTelemetry {
  rangeEarthRadii: number;
  fov: number;
}

interface RayBudget {
  atmosphereSteps: number;
  cloudLightSteps: number;
  cloudSteps: number;
}

const DEFAULT_OBSERVATION_TELEMETRY: ObservationTelemetry = {
  rangeEarthRadii: rangeForFraming(DEFAULT_NEAR_FRAMING),
  fov: DEFAULT_NEAR_FRAMING.fov
};

interface NasaEarthErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface NasaEarthErrorBoundaryState {
  failed: boolean;
}

class NasaEarthErrorBoundary extends Component<NasaEarthErrorBoundaryProps, NasaEarthErrorBoundaryState> {
  state: NasaEarthErrorBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("NasaEarthRoute render failed", error);
    this.setState({ failed: true });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
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

function readRequestedSceneMode(): NasaSceneMode {
  if (typeof window === "undefined") {
    return "near";
  }

  return new URLSearchParams(window.location.search).get("scene") === "far" ? "far" : "near";
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

function serverRequestedSceneModeSnapshot(): NasaSceneMode {
  return "near";
}

function formatUtcTimestamp(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ") + "Z";
}

function readUtcTimestamp() {
  return formatUtcTimestamp(new Date());
}

function readServerUtcTimestamp() {
  return "Syncing UTC";
}

function useUtcTimestamp() {
  const [utcTimestamp, setUtcTimestamp] = useState(readServerUtcTimestamp);

  useEffect(() => {
    const timer = window.setInterval(() => setUtcTimestamp(readUtcTimestamp()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return utcTimestamp;
}

function rangeForFraming(framing: OrbitFraming) {
  const [cameraX, cameraY, cameraZ] = framing.cameraPosition;
  const [targetX, targetY, targetZ] = framing.target;
  const deltaX = cameraX - targetX;
  const deltaY = cameraY - targetY;
  const deltaZ = cameraZ - targetZ;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
}

function utcClockFromTimestamp(timestamp: string) {
  return timestamp.includes(" ") ? timestamp.slice(11) : "Syncing";
}

function texturePathsForMode(mode: NasaTextureMode) {
  if (mode === "high") {
    return HIGH_TEXTURES;
  }
  if (mode === "balanced-desktop") {
    return BALANCED_DESKTOP_TEXTURES;
  }
  return MOBILE_TEXTURES;
}

function textureModeForQuality(quality: QualityProfile, requestedQuality: LandingQuality): NasaTextureMode {
  if (quality.tier === "high" && requestedQuality === "high") {
    return "high";
  }
  if (
    quality.tier === "high" ||
    (requestedQuality === "auto" && typeof window !== "undefined" && window.innerWidth >= 980 && quality.tier !== "low")
  ) {
    return "balanced-desktop";
  }
  return "mobile";
}

function resolveNasaQualityProfile(quality: QualityProfile, requestedQuality: LandingQuality): QualityProfile {
  if (
    requestedQuality === "auto" &&
    quality.tier === "medium" &&
    typeof window !== "undefined" &&
    window.innerWidth >= 980
  ) {
    return {
      ...quality,
      dpr: Math.min(quality.dpr, 1),
      reason: "nasa-desktop-balanced",
      segments: Math.max(quality.segments, 96),
      stars: Math.max(quality.stars, 640)
    };
  }

  return quality;
}

function orbitFramingForWidth(_width: number, sceneMode: NasaSceneMode): OrbitFraming {
  return orbitFramingForScene(sceneMode);
}

function segmentsForQuality(quality: QualityProfile, textureMode: NasaTextureMode) {
  if (textureMode === "high") {
    return 176;
  }
  if (quality.tier === "high") {
    return 128;
  }
  if (quality.tier === "medium") {
    return 96;
  }
  return 80;
}

function starCountForQuality(quality: QualityProfile, textureMode: NasaTextureMode) {
  if (textureMode === "high") {
    return 860;
  }
  if (quality.tier === "high") {
    return 620;
  }
  if (quality.tier === "medium") {
    return 420;
  }
  return 260;
}

function budgetForQuality(tier: ResolvedQualityTier): RayBudget {
  if (tier === "high") {
    return { atmosphereSteps: 18, cloudLightSteps: 5, cloudSteps: 18 };
  }

  if (tier === "medium") {
    return { atmosphereSteps: 6, cloudLightSteps: 1, cloudSteps: 6 };
  }

  return { atmosphereSteps: 4, cloudLightSteps: 1, cloudSteps: 4 };
}

function useNasaEarthTextures(mode: NasaTextureMode) {
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

function createEarthSurfaceMaterial(textures: ReturnType<typeof useNasaEarthTextures>) {
  return new ShaderMaterial({
    name: "MiraLithNasaEarthSurface",
    uniforms: {
      dayMap: { value: textures.day },
      nightMap: { value: textures.night },
      cloudMap: { value: textures.clouds },
      cloudDeckMap: { value: textures.cloudDeck },
      specularMap: { value: textures.specular },
      sunDir: { value: SUN_DIRECTION.clone() },
      yaw: { value: INITIAL_YAW },
      cloudOffset: { value: new Vector2(0, 0) },
      atmosphereBlue: { value: new Color(0.14, 0.48, 1.0) },
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
      uniform sampler2D cloudMap;
      uniform sampler2D cloudDeckMap;
      uniform sampler2D specularMap;
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

      float luma3(vec3 color) {
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

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(sunDir);
        vec2 uv = vec2(fract(vUv.x + yaw / TAU), clamp(vUv.y, 0.001, 0.999));
        vec2 lightUv = normalize(vec2(-lightDirection.z, lightDirection.y) + vec2(0.0001));
        vec2 movingCloudUv = vec2(fract(uv.x + cloudOffset.x), clamp(uv.y + cloudOffset.y, 0.001, 0.999));
        vec2 projectedShadowUv = vec2(
          fract(movingCloudUv.x + lightUv.x * 0.022),
          clamp(movingCloudUv.y + lightUv.y * 0.017, 0.001, 0.999)
        );
        vec2 projectedShadowUvFar = vec2(
          fract(movingCloudUv.x + lightUv.x * 0.052 + 0.006),
          clamp(movingCloudUv.y + lightUv.y * 0.038 - 0.003, 0.001, 0.999)
        );
        vec2 projectedShadowUvHigh = vec2(
          fract(movingCloudUv.x + lightUv.x * 0.088 - 0.004),
          clamp(movingCloudUv.y + lightUv.y * 0.064 + 0.005, 0.001, 0.999)
        );

        float sunDot = dot(normal, lightDirection);
        float dayAmount = smoothstep(-0.20, 0.18, sunDot);
        float blueHour = smoothstep(-0.42, -0.03, sunDot) * (1.0 - smoothstep(0.02, 0.18, sunDot));
        float nightAmount = 1.0 - smoothstep(-0.30, 0.10, sunDot);
        float terminator = smoothstep(-0.20, 0.015, sunDot) * (1.0 - smoothstep(0.055, 0.24, sunDot));
        float limb = 1.0 - clamp01(dot(normal, viewDirection));

        vec3 dayColor = texture2D(dayMap, uv).rgb;
        vec3 nightColor = texture2D(nightMap, uv).rgb;
        float cloudDensity = pow(luma3(texture2D(cloudMap, movingCloudUv).rgb), 0.78);
        vec4 deckLocal = texture2D(cloudDeckMap, movingCloudUv);
        float projectedCloud = pow(luma3(texture2D(cloudMap, projectedShadowUv).rgb), 0.72);
        float projectedCloudFar = pow(luma3(texture2D(cloudMap, projectedShadowUvFar).rgb), 0.88);
        float projectedCloudHigh = pow(luma3(texture2D(cloudMap, projectedShadowUvHigh).rgb), 1.12);
        float deckShadow = texture2D(cloudDeckMap, projectedShadowUv).g;
        float deckShadowFar = texture2D(cloudDeckMap, projectedShadowUvFar).g;
        float deckShadowHigh = texture2D(cloudDeckMap, projectedShadowUvHigh).a;
        float oceanMask = clamp01(texture2D(specularMap, uv).r);
        float projectedShadow = max(
          smoothstep(0.16, 0.86, max(projectedCloud, deckShadow * 0.9)) * 1.08,
          max(
            smoothstep(0.22, 0.9, max(projectedCloudFar, deckShadowFar * 0.82)) * 0.62,
            smoothstep(0.3, 0.96, max(projectedCloudHigh, deckShadowHigh * 0.74)) * 0.34
          )
        ) * smoothstep(-0.24, 0.52, sunDot);
        float localCloud = max(cloudDensity, max(deckLocal.g * 0.86, deckLocal.a * 0.7));
        float cloudFloorOcclusion = smoothstep(0.18, 0.9, localCloud) * smoothstep(-0.18, 0.62, sunDot);
        float glintCloudClear = 1.0 - smoothstep(0.16, 0.68, localCloud);
        float coastScatter = pow(1.0 - oceanMask, 2.0) * oceanMask;

        dayColor *= vec3(1.04, 1.055, 1.075);
        dayColor += vec3(0.006, 0.028, 0.07) * oceanMask * (0.55 + dayAmount * 0.95);
        dayColor += vec3(0.018, 0.035, 0.055) * coastScatter * dayAmount;
        dayColor *= 1.0 - projectedShadow * mix(0.5, 0.68, oceanMask);
        dayColor *= 1.0 - cloudFloorOcclusion * 0.16;

        vec3 halfVector = normalize(lightDirection + viewDirection);
        float glintAlignment = clamp01(dot(normal, halfVector));
        vec3 glintAxis = normalize(vec3(0.82, 0.12, -0.56));
        vec3 glintTangent = normalize(glintAxis - normal * dot(glintAxis, normal) + vec3(0.0001));
        vec3 glintBitangent = normalize(cross(normal, glintTangent));
        vec3 glintDelta = halfVector - normal * glintAlignment;
        float glintAlong = dot(glintDelta, glintTangent);
        float glintAcross = dot(glintDelta, glintBitangent);
        float directionalCore = exp(-(glintAlong * glintAlong * 1180.0 + glintAcross * glintAcross * 5200.0));
        float directionalBloom = exp(-(glintAlong * glintAlong * 160.0 + glintAcross * glintAcross * 720.0));
        float microCapillary = noise2(uv * vec2(620.0, 148.0) + yaw * 0.05) * 0.6 +
          noise2(uv * vec2(170.0, 52.0) - yaw * 0.03) * 0.4;
        float glitter = mix(0.78, 1.12, microCapillary);
        float fresnelWater = pow(limb, 2.2) * oceanMask * smoothstep(-0.08, 0.48, sunDot);
        float mirrorSpecular = pow(clamp01(dot(reflect(-lightDirection, normal), viewDirection)), 34.0) * oceanMask;
        float oceanGlintCore = directionalCore * pow(glintAlignment, 90.0) * oceanMask * dayAmount * glintCloudClear * glitter;
        float oceanGlintBloom = directionalBloom * pow(glintAlignment, 36.0) * oceanMask * dayAmount * glintCloudClear;
        float grazingSpecular = pow(clamp01(dot(reflect(-lightDirection, normal), viewDirection)), 18.0) * oceanMask;
        float orbitalSeaSheen = smoothstep(0.54, 0.94, limb) *
          (1.0 - smoothstep(0.955, 1.0, limb)) *
          smoothstep(-0.08, 0.46, sunDot) *
          oceanMask *
          glintCloudClear;

        float cityEnergy = smoothstep(0.08, 0.68, luma3(nightColor));
        vec3 cityColor = nightColor * (1.35 + cityEnergy * 2.4);
        vec3 nightBase = mix(vec3(0.001, 0.004, 0.014), nightColor * 0.92, nightAmount);
        nightBase += cityColor * nightAmount * (0.95 + blueHour * 1.25);
        nightBase += vec3(1.0, 0.62, 0.28) * cityEnergy * terminator * (0.28 + limb * 0.22);

        vec3 twilightWarm = vec3(1.0, 0.38, 0.11);
        vec3 twilightBlue = vec3(0.08, 0.30, 0.76);
        vec3 twilightColor = mix(twilightWarm, twilightBlue, smoothstep(-0.06, 0.28, sunDot));
        vec3 surfaceColor = mix(nightBase, dayColor, dayAmount);
        surfaceColor += twilightColor * terminator * (0.045 + limb * 0.11);
        surfaceColor += vec3(1.0, 0.91, 0.68) * oceanGlintCore * 1.62;
        surfaceColor += vec3(0.78, 0.94, 1.0) * oceanGlintBloom * 0.2;
        surfaceColor += vec3(0.70, 0.92, 1.0) * orbitalSeaSheen * 0.22;
        surfaceColor += vec3(0.18, 0.42, 0.74) * fresnelWater * 0.18;
        surfaceColor += vec3(0.22, 0.48, 0.8) * grazingSpecular * dayAmount * 0.09;
        surfaceColor += vec3(1.0, 0.84, 0.58) * mirrorSpecular * dayAmount * glintCloudClear * 0.22;
        surfaceColor += atmosphereBlue * pow(limb, 2.75) * (dayAmount * 0.035 + blueHour * 0.05);
        surfaceColor += karmanWhite * smoothstep(0.86, 0.978, limb) * (1.0 - smoothstep(0.986, 0.998, limb)) * (dayAmount * 0.105 + blueHour * 0.065);
        float nightLimb = smoothstep(0.74, 0.99, limb) * nightAmount;
        surfaceColor.r *= 1.0 - nightLimb * 0.24;
        surfaceColor.g *= 1.0 + nightLimb * 0.035;

        gl_FragColor = vec4(surfaceColor, 1.0);
      }
    `
  });
}

function createCloudMaterial(
  cloudTexture: Texture,
  cloudDeckTexture: Texture,
  budget: RayBudget,
  tier: ResolvedQualityTier
) {
  return new ShaderMaterial({
    name: "MiraLithNasaVolumetricClouds",
    defines: {
      CLOUD_LIGHT_STEPS: String(budget.cloudLightSteps),
      CLOUD_STEPS: String(budget.cloudSteps)
    },
    uniforms: {
      cloudMap: { value: cloudTexture },
      cloudDeckMap: { value: cloudDeckTexture },
      sunDir: { value: SUN_DIRECTION.clone() },
      yaw: { value: INITIAL_YAW },
      earthPitch: { value: 0 },
      earthYaw: { value: 0 },
      cloudOffset: { value: new Vector2(0, 0) },
      opacity: { value: tier === "low" ? 0.22 : tier === "medium" ? 0.3 : 0.42 },
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
      uniform float earthPitch;
      uniform float earthYaw;
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

      float luma3(vec3 color) {
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

      vec3 rotateX(vec3 point, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(point.x, c * point.y - s * point.z, s * point.y + c * point.z);
      }

      vec3 rotateY(vec3 point, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(c * point.x + s * point.z, point.y, -s * point.x + c * point.z);
      }

      vec2 sphericalUv(vec3 point) {
        vec3 n = normalize(rotateY(rotateX(point, -earthPitch), -earthYaw));
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

      float cloudHeight01(float radius) {
        return clamp01((radius - CLOUD_BOTTOM) / max(CLOUD_TOP - CLOUD_BOTTOM, 0.001));
      }

      float cloudDensityAt(vec3 point) {
        float radius = length(point);
        vec2 uv = sphericalUv(point);
        float shell = shellMask(radius);
        float height01 = cloudHeight01(radius);
        float lowerShelf = smoothstep(0.02, 0.24, height01);
        float upperFalloff = 1.0 - smoothstep(0.76, 1.0, height01) * 0.42;
        float verticalBody = lowerShelf * upperFalloff;
        float base = pow(luma3(texture2D(cloudMap, uv).rgb), 0.72);
        vec4 deck = texture2D(cloudDeckMap, uv);
        float weather = deck.r * 0.42 + pow(deck.g, 1.18) * 0.54 + deck.a * 0.18;
        float detail = noise2(uv * vec2(96.0, 48.0) + radius * 27.0) * 0.5 +
          noise2(uv * vec2(221.0, 93.0) - radius * 61.0) * 0.5;
        float cellularBreak = noise2(uv * vec2(17.0, 8.0) + vec2(2.1, 7.4));
        float cauliflower = noise2(uv * vec2(53.0, 25.0) + vec2(height01 * 9.0, -height01 * 14.0));
        float towerMask = smoothstep(0.56, 0.96, base + weather * 0.34) * smoothstep(0.18, 0.72, height01);
        float density = base * 0.58 + weather * 0.66 + detail * 0.18 + cauliflower * towerMask * 0.12;
        density = smoothstep(0.28, 0.84, density);
        density = pow(density, 1.16);
        density *= mix(0.66, 1.28, cellularBreak);
        density *= mix(0.82, 1.18, towerMask);
        density *= verticalBody * shell;
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

        return exp(-lightDensity * 7.6);
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
            float height01 = cloudHeight01(length(samplePoint));
            float forward = min(cloudPhase(0.48, clamp(dot(rayDirection, lightDirection), -1.0, 1.0)), 3.8);
            float silver = pow(clamp01(1.0 - dot(normal, -rayDirection)), 3.2) * smoothstep(-0.16, 0.62, sunDot);
            float lowerShadow = (1.0 - height01) * (1.0 - lightThroughCloud);
            float internalShade = smoothstep(0.34, 1.0, density) * (0.45 + lowerShadow * 0.55);

            vec3 coldBase = vec3(0.25, 0.29, 0.36);
            vec3 middleGrey = vec3(0.58, 0.65, 0.73);
            vec3 litTop = vec3(1.0, 1.0, 0.98);
            vec3 warmEdge = vec3(1.0, 0.56, 0.24);
            vec3 color = mix(coldBase, middleGrey, height01 * 0.62 + lightThroughCloud * 0.22);
            color = mix(color, litTop, day * pow(lightThroughCloud, 0.72) * (0.34 + height01 * 0.72));
            color = mix(color, coldBase * 0.62, internalShade * (1.0 - height01 * 0.28));
            color = mix(color, warmEdge, twilight * (0.22 + silver * 0.18));
            color += atmosphereTint * silver * lightThroughCloud * (0.16 + day * 0.28);
            color += vec3(0.86, 0.94, 1.0) * forward * density * day * lightThroughCloud * 0.16;
            color *= mix(0.18, 1.08, day + twilight * 0.72);

            float alphaStep = pow(density, 1.08) * stepSize * opacity * mix(6.4, 9.2, 1.0 - height01 * 0.3);
            alphaStep *= mix(0.42, 1.0, clamp01(day + twilight * 0.62 + silver * 0.18));
            alphaStep = clamp(alphaStep, 0.0, 0.22);
            accum += color * alphaStep * transmittance;
            transmittance *= 1.0 - alphaStep;
          }
        }

        float alpha = clamp01(1.0 - transmittance);
        vec3 shellNormal = normalize(vWorldPosition);
        float outerGrazing = 1.0 - clamp01(dot(shellNormal, -rayDirection));
        float readableLimb = smoothstep(0.30, 0.64, outerGrazing) * (1.0 - smoothstep(0.74, 0.94, outerGrazing));
        float extremeGrazingTrim = 1.0 - smoothstep(0.48, 0.86, outerGrazing) * 0.9;
        accum *= extremeGrazingTrim;
        alpha *= extremeGrazingTrim;
        accum += atmosphereTint * readableLimb * alpha * 0.07;

        if (alpha < 0.006) {
          discard;
        }

        gl_FragColor = vec4(accum / max(alpha, 0.001), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    side: FrontSide
  });
}

function createCloudTopMaterial(cloudTexture: Texture, cloudDeckTexture: Texture, tier: ResolvedQualityTier) {
  return new ShaderMaterial({
    name: "MiraLithNasaCloudTops",
    uniforms: {
      cloudMap: { value: cloudTexture },
      cloudDeckMap: { value: cloudDeckTexture },
      sunDir: { value: SUN_DIRECTION.clone() },
      yaw: { value: INITIAL_YAW },
      earthPitch: { value: 0 },
      earthYaw: { value: 0 },
      cloudOffset: { value: new Vector2(0, 0) },
      opacity: { value: tier === "low" ? 0.46 : tier === "medium" ? 0.74 : 0.82 },
      atmosphereTint: { value: new Color(0.15, 0.42, 0.9) }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudMap;
      uniform sampler2D cloudDeckMap;
      uniform vec3 sunDir;
      uniform float yaw;
      uniform float earthPitch;
      uniform float earthYaw;
      uniform vec2 cloudOffset;
      uniform float opacity;
      uniform vec3 atmosphereTint;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

      float clamp01(float value) {
        return clamp(value, 0.0, 1.0);
      }

      float luma3(vec3 color) {
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

      vec3 rotateX(vec3 point, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(point.x, c * point.y - s * point.z, s * point.y + c * point.z);
      }

      vec3 rotateY(vec3 point, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(c * point.x + s * point.z, point.y, -s * point.x + c * point.z);
      }

      vec2 sphericalUv(vec3 point) {
        vec3 n = normalize(rotateY(rotateX(point, -earthPitch), -earthYaw));
        float u = atan(n.z, n.x) / TAU + 0.5 + yaw / TAU + cloudOffset.x;
        float v = asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5 + cloudOffset.y;
        return vec2(fract(u), clamp(v, 0.001, 0.999));
      }

      vec4 sampleDeck(vec2 uv) {
        return texture2D(cloudDeckMap, vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999)));
      }

      float cloudSignal(vec2 uv) {
        vec2 sampleUv = vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
        vec4 deck = texture2D(cloudDeckMap, sampleUv);
        float base = pow(luma3(texture2D(cloudMap, sampleUv).rgb), 0.78);
        return base * 0.6 + deck.r * 0.23 + deck.g * 0.52 + deck.a * 0.2;
      }

      float cloudHeightSignal(vec2 uv) {
        float signal = cloudSignal(uv);
        float cell = noise2(uv * vec2(68.0, 32.0) + cloudOffset * 11.0);
        float tower = smoothstep(0.56, 0.98, signal + cell * 0.18);
        return clamp01(signal * 0.78 + tower * 0.34);
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(sunDir);
        vec2 uv = sphericalUv(vWorldPosition);
        vec2 lightUv = normalize(vec2(-lightDirection.z, lightDirection.y) + vec2(0.0001));
        vec4 deck = sampleDeck(uv);
        float base = pow(luma3(texture2D(cloudMap, uv).rgb), 0.76);
        float weather = deck.r * 0.32 + deck.g * 0.62 + deck.a * 0.3;
        float highDetail = noise2(uv * vec2(118.0, 54.0) + cloudOffset * 19.0);
        float cauliflower = noise2(uv * vec2(245.0, 104.0) - cloudOffset * 31.0);
        float cloudField = base * 0.72 + weather * 0.62 + highDetail * 0.1 + cauliflower * weather * 0.12;
        float cloudBody = smoothstep(0.24, 0.76, cloudField);
        float cloudCore = smoothstep(0.48, 0.98, cloudField);
        float cloudEdge = smoothstep(0.16, 0.54, cloudBody) * (1.0 - smoothstep(0.91, 1.0, cloudBody) * 0.12);
        float selfShadow = smoothstep(0.3, 0.9, cloudSignal(uv + lightUv * vec2(0.024, 0.018)));
        float deepShadow = smoothstep(0.38, 1.0, cloudSignal(uv + lightUv * vec2(0.07, 0.05)));
        float sunDot = dot(normal, lightDirection);
        float day = smoothstep(-0.22, 0.42, sunDot);
        float twilight = smoothstep(-0.36, 0.035, sunDot) * (1.0 - smoothstep(0.12, 0.48, sunDot));
        float viewRim = pow(clamp01(1.0 - dot(normal, viewDirection)), 1.8);
        float silver = smoothstep(0.52, 0.96, viewRim) * smoothstep(-0.05, 0.58, sunDot);
        vec3 tangent = normalize(cross(abs(normal.y) < 0.94 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), normal));
        vec3 bitangent = normalize(cross(normal, tangent));
        vec2 reliefStep = vec2(0.0032, 0.0);
        float hCenter = cloudHeightSignal(uv);
        float hEast = cloudHeightSignal(uv + reliefStep.xy);
        float hWest = cloudHeightSignal(uv - reliefStep.xy);
        float hNorth = cloudHeightSignal(uv + reliefStep.yx);
        float hSouth = cloudHeightSignal(uv - reliefStep.yx);
        vec3 reliefNormal = normalize(normal - tangent * (hEast - hWest) * 5.4 - bitangent * (hNorth - hSouth) * 3.6);
        float reliefLight = smoothstep(-0.18, 0.58, dot(reliefNormal, lightDirection));
        float leeShadow = smoothstep(0.24, 0.9, hCenter) * smoothstep(0.44, 0.92, cloudCore) * (1.0 - reliefLight);
        float verticalThickness = smoothstep(0.35, 0.98, hCenter + weather * 0.24);
        float anvilLight = smoothstep(0.48, 0.92, cloudCore + cauliflower * 0.18) * day;
        float topLight = day * (
          0.26 +
          reliefLight * 0.42 +
          (1.0 - selfShadow) * 0.34 +
          (1.0 - deepShadow) * 0.16 +
          anvilLight * 0.24
        );

        vec3 coolBase = vec3(0.22, 0.27, 0.35);
        vec3 middleShelf = vec3(0.56, 0.63, 0.72);
        vec3 softTop = vec3(1.0, 0.995, 0.955);
        vec3 warmEdge = vec3(1.0, 0.56, 0.24);
        vec3 color = mix(coolBase, middleShelf, cloudBody * 0.42 + reliefLight * day * 0.22);
        color = mix(color, softTop, clamp01(topLight));
        color = mix(color, coolBase * 0.5, (selfShadow * 0.42 + deepShadow * 0.36 + leeShadow * 0.5) * cloudBody);
        color = mix(color, warmEdge, twilight * (0.36 + silver * 0.28 + verticalThickness * 0.1));
        color += vec3(0.98, 0.93, 0.78) * anvilLight * (1.0 - deepShadow) * 0.18;
        float horizonFade = smoothstep(0.34, 0.78, viewRim);
        color += atmosphereTint * silver * (0.08 + day * 0.22);
        color *= mix(0.72, 1.12, reliefLight * day + twilight * 0.36);
        color = mix(color, vec3(0.08, 0.18, 0.32), horizonFade * 0.18);

        float alpha = cloudEdge * opacity * (0.12 + day * 0.74 + twilight * 0.32 + silver * 0.12);
        alpha *= mix(0.78, 1.26, cloudCore + verticalThickness * 0.3);
        alpha *= 1.0 - horizonFade * 0.98;

        if (alpha < 0.006) {
          discard;
        }

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    side: FrontSide
  });
}

function createAtmosphereMaterial(budget: RayBudget) {
  return new ShaderMaterial({
    name: "MiraLithNasaScatteringAtmosphere",
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

        vec3 atmoNormal = normalize(vWorldPosition);
        float sunDotShell = dot(atmoNormal, lightDirection);
        float viewLimb = 1.0 - clamp01(dot(atmoNormal, -rayDirection));
        float limbGate = smoothstep(0.54, 0.88, viewLimb);
        float broadGradient = smoothstep(0.48, 0.86, viewLimb) * (1.0 - smoothstep(0.93, 0.994, viewLimb));
        float lowerAir = smoothstep(0.58, 0.86, viewLimb) * (1.0 - smoothstep(0.90, 0.965, viewLimb));
        float limbBoost = smoothstep(0.70, 0.94, viewLimb) * (1.0 - smoothstep(0.968, 0.993, viewLimb));
        float outerArc = smoothstep(0.76, 0.964, viewLimb) * (1.0 - smoothstep(0.984, 0.998, viewLimb));
        float karmanNeedle = smoothstep(0.946, 0.982, viewLimb) * (1.0 - smoothstep(0.989, 0.997, viewLimb));
        float airglowNeedle = smoothstep(0.972, 0.991, viewLimb) * (1.0 - smoothstep(0.995, 0.999, viewLimb));
        float twilightArc = smoothstep(-0.32, 0.03, sunDotShell) * (1.0 - smoothstep(0.10, 0.40, sunDotShell));
        float nightArc = (1.0 - smoothstep(-0.18, 0.10, sunDotShell)) * smoothstep(0.64, 0.93, viewLimb);
        vec3 sunsetColor = vec3(1.0, 0.38, 0.12);
        vec3 electricBlue = vec3(0.12, 0.50, 1.0);
        vec3 color = accumulated * intensity * limbGate * (0.08 + limbBoost * 1.14);
        color += electricBlue * broadGradient * 0.06 * intensity;
        color += vec3(0.25, 0.66, 1.0) * lowerAir * (0.10 + twilightArc * 0.035) * intensity;
        color += sunsetColor * twilightArc * outerArc * 0.18 * intensity;
        color += vec3(0.62, 0.9, 1.0) * karmanNeedle * (0.92 + twilightArc * 0.22) * intensity;
        color += vec3(0.05, 0.52, 1.0) * outerArc * (0.09 + nightArc * 0.08) * intensity;
        color += vec3(0.20, 0.95, 0.76) * airglowNeedle * nightArc * 0.08 * intensity;

        float alpha = clamp(
          length(accumulated) * 0.105 * limbGate +
          broadGradient * 0.01 +
          lowerAir * 0.018 +
          karmanNeedle * (0.28 + twilightArc * 0.04) +
          outerArc * (0.022 + twilightArc * 0.016) +
          airglowNeedle * nightArc * 0.024,
          0.0,
          0.31
        );

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

function createKarmanLineMaterial() {
  return new ShaderMaterial({
    name: "MiraLithNasaKarmanLine",
    uniforms: {
      sunDir: { value: SUN_DIRECTION.clone() },
      blueLine: { value: new Color(0.05, 0.56, 1.0) },
      whiteLine: { value: new Color(0.78, 0.94, 1.0) },
      sunsetLine: { value: new Color(1.0, 0.42, 0.16) },
      intensity: { value: 1.0 }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDir;
      uniform vec3 blueLine;
      uniform vec3 whiteLine;
      uniform vec3 sunsetLine;
      uniform float intensity;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float clamp01(float value) {
        return clamp(value, 0.0, 1.0);
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(sunDir);
        float rim = 1.0 - clamp01(dot(normal, viewDirection));
        float sunDot = dot(normal, lightDirection);
        float day = smoothstep(-0.20, 0.42, sunDot);
        float twilight = smoothstep(-0.34, 0.035, sunDot) * (1.0 - smoothstep(0.10, 0.40, sunDot));
        float nightSide = 1.0 - smoothstep(-0.16, 0.14, sunDot);
        float blueArc = smoothstep(0.82, 0.958, rim) * (1.0 - smoothstep(0.976, 0.994, rim));
        float whiteNeedle = smoothstep(0.962, 0.986, rim) * (1.0 - smoothstep(0.991, 0.999, rim));
        float outerHairline = smoothstep(0.974, 0.992, rim) * (1.0 - smoothstep(0.996, 0.9995, rim));
        vec3 color =
          blueLine * blueArc * (0.22 + day * 0.42 + nightSide * 0.1) +
          whiteLine * whiteNeedle * (0.28 + day * 0.14 + twilight * 0.1) +
          sunsetLine * twilight * (blueArc * 0.1 + whiteNeedle * 0.08) +
          vec3(0.1, 0.6, 1.0) * outerHairline * 0.22;
        float alpha = clamp(
          blueArc * 0.05 +
          whiteNeedle * (0.085 + day * 0.03 + twilight * 0.025) +
          outerHairline * 0.032,
          0.0,
          0.28
        ) * intensity;

        if (alpha < 0.002) {
          discard;
        }

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    side: FrontSide,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending
  });
}

function EarthMaterials({
  framing,
  quality,
  reducedMotion,
  textureMode
}: {
  framing: OrbitFraming;
  quality: QualityProfile;
  reducedMotion: boolean;
  textureMode: NasaTextureMode;
}) {
  const textures = useNasaEarthTextures(textureMode);
  const { cloudDeck, clouds, day, night, specular } = textures;
  const yaw = useRef(INITIAL_YAW);
  const cloudOffset = useRef(new Vector2(0.018, 0.004));
  const segments = segmentsForQuality(quality, textureMode);
  const budget = useMemo(() => budgetForQuality(quality.tier), [quality.tier]);
  const surfaceMaterial = useMemo(
    () => createEarthSurfaceMaterial({ cloudDeck, clouds, day, night, specular }),
    [cloudDeck, clouds, day, night, specular]
  );
  const cloudMaterial = useMemo(
    () => createCloudMaterial(clouds, cloudDeck, budget, quality.tier),
    [budget, cloudDeck, clouds, quality.tier]
  );
  const cloudTopMaterial = useMemo(
    () => createCloudTopMaterial(clouds, cloudDeck, quality.tier),
    [cloudDeck, clouds, quality.tier]
  );
  const atmosphereMaterial = useMemo(() => createAtmosphereMaterial(budget), [budget]);
  const karmanLineMaterial = useMemo(() => createKarmanLineMaterial(), []);

  useEffect(() => {
    return () => {
      surfaceMaterial.dispose();
      cloudMaterial.dispose();
      cloudTopMaterial.dispose();
      atmosphereMaterial.dispose();
      karmanLineMaterial.dispose();
    };
  }, [atmosphereMaterial, cloudMaterial, cloudTopMaterial, karmanLineMaterial, surfaceMaterial]);

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
    cloudMaterial.uniforms.earthPitch.value = framing.earthPitchRad;
    cloudMaterial.uniforms.earthYaw.value = framing.earthYawRad;
    cloudMaterial.uniforms.cloudOffset.value.copy(cloudOffset.current);
    cloudMaterial.uniforms.opacity.value = quality.tier === "low" ? 0.22 : quality.tier === "medium" ? 0.3 : 0.42;
    cloudTopMaterial.uniforms.yaw.value = yaw.current;
    cloudTopMaterial.uniforms.earthPitch.value = framing.earthPitchRad;
    cloudTopMaterial.uniforms.earthYaw.value = framing.earthYawRad;
    cloudTopMaterial.uniforms.cloudOffset.value.copy(cloudOffset.current);
    cloudTopMaterial.uniforms.opacity.value =
      (quality.tier === "low" ? 0.46 : quality.tier === "medium" ? 0.74 : 0.82) *
      (rangeForFraming(framing) > 4 ? 1.12 : 1.0);
    atmosphereMaterial.uniforms.intensity.value = quality.tier === "low" ? 0.88 : quality.tier === "medium" ? 1.02 : 1.14;
    const karmanDistanceBoost = rangeForFraming(framing) > 4 ? 1.58 : 1.0;
    karmanLineMaterial.uniforms.intensity.value =
      (quality.tier === "low" ? 0.78 : quality.tier === "medium" ? 0.98 : 1.08) * karmanDistanceBoost;
  });

  return (
    <group rotation={[framing.earthPitchRad, framing.earthYawRad, 0]}>
      <mesh material={surfaceMaterial} renderOrder={2}>
        <sphereGeometry args={[EARTH_RADIUS, segments, Math.floor(segments / 2)]} />
      </mesh>
      <mesh material={cloudTopMaterial} renderOrder={5}>
        <sphereGeometry
          args={[CLOUD_TOP_RADIUS + 0.0016, Math.max(128, segments), Math.max(64, Math.floor(segments / 2))]}
        />
      </mesh>
      <mesh material={atmosphereMaterial} renderOrder={8}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, Math.max(128, segments), Math.max(64, Math.floor(segments / 2))]} />
      </mesh>
      <mesh material={karmanLineMaterial} renderOrder={9}>
        <sphereGeometry args={[KARMAN_LINE_RADIUS, Math.max(160, segments), Math.max(80, Math.floor(segments / 2))]} />
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

function CameraTelemetryProbe({
  framing,
  onTelemetry
}: {
  framing: OrbitFraming;
  onTelemetry: (telemetry: ObservationTelemetry) => void;
}) {
  const { camera } = useThree();
  const lastSample = useRef(0);
  const target = useMemo(() => new Vector3(...framing.target), [framing]);

  useFrame((state) => {
    if (state.clock.elapsedTime - lastSample.current < 0.45) {
      return;
    }

    lastSample.current = state.clock.elapsedTime;
    const perspectiveCamera = camera as typeof camera & { fov?: number };
    onTelemetry({
      rangeEarthRadii: camera.position.distanceTo(target) / EARTH_RADIUS,
      fov: typeof perspectiveCamera.fov === "number" ? perspectiveCamera.fov : framing.fov
    });
  });

  return null;
}

function StarField({ count }: { count: number }) {
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const radius = 24 + seededUnit(index, 3) * 18;
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
      <pointsMaterial color="#dcecff" size={0.026} sizeAttenuation transparent opacity={0.82} depthWrite={false} />
    </points>
  );
}

function seededUnit(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function NasaEarthScene({
  onTelemetry,
  quality,
  reducedMotion,
  sceneMode,
  textureMode
}: {
  onTelemetry: (telemetry: ObservationTelemetry) => void;
  quality: QualityProfile;
  reducedMotion: boolean;
  sceneMode: NasaSceneMode;
  textureMode: NasaTextureMode;
}) {
  const sunPosition = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(7.5), []);
  const { size } = useThree();
  const framing = useMemo(() => orbitFramingForWidth(size.width, sceneMode), [sceneMode, size.width]);

  return (
    <>
      <color attach="background" args={["#000106"]} />
      <ResponsiveCameraRig framing={framing} />
      <CameraTelemetryProbe framing={framing} onTelemetry={onTelemetry} />
      <ambientLight intensity={0.018} />
      <directionalLight position={sunPosition.toArray()} intensity={2.05} color="#ffe9c7" />
      <StarField count={starCountForQuality(quality, textureMode)} />
      <EarthMaterials framing={framing} quality={quality} reducedMotion={reducedMotion} textureMode={textureMode} />
      <OrbitControls
        key={sceneMode}
        enableDamping
        dampingFactor={0.075}
        enablePan={false}
        minDistance={framing.minDistance}
        maxDistance={framing.maxDistance}
        rotateSpeed={0.46}
        zoomSpeed={0.68}
        target={framing.target}
        touches={{
          ONE: TOUCH.ROTATE,
          TWO: TOUCH.DOLLY_PAN
        }}
      />
    </>
  );
}

function NasaEarthFallback() {
  return (
    <div className="nasa-earth__fallback" role="img" aria-label="NASA Earth orbital view fallback">
      <div className="nasa-earth__fallback-poster" />
      <div className="nasa-earth__fallback-copy">
        <strong>Earth observation preview</strong>
        <span>WebGL unavailable. Showing static orbital poster.</span>
      </div>
    </div>
  );
}

function NasaEarthHud({
  quality,
  sceneMode,
  telemetry,
  textureMode
}: {
  quality: QualityProfile;
  sceneMode: NasaSceneMode;
  telemetry: ObservationTelemetry;
  textureMode: NasaTextureMode;
}) {
  const utcTimestamp = useUtcTimestamp();
  const updateClock = utcClockFromTimestamp(utcTimestamp);
  const textureTier = textureMode === "high"
    ? "8K cloud"
    : textureMode === "balanced-desktop"
      ? "8K / 2K"
      : "2K";
  const rangeLabel = `${telemetry.rangeEarthRadii.toFixed(2)} Re`;
  const budget = budgetForQuality(quality.tier);

  return (
    <section className="nasa-earth__hud" aria-label="Earth observation metadata">
      <div className="nasa-earth__hud-heading">
        <p>Earth</p>
        <span>NASA shader</span>
      </div>
      <dl className="nasa-earth__hud-grid">
        <div className="nasa-earth__hud-wide">
          <dt>UTC</dt>
          <dd>{utcTimestamp}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{updateClock}</dd>
        </div>
        <div>
          <dt>Scene</dt>
          <dd>{sceneMode}</dd>
        </div>
        <div>
          <dt>Altitude</dt>
          <dd>420 km sim</dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd>{rangeLabel}</dd>
        </div>
        <div>
          <dt>Cloud</dt>
          <dd>{budget.cloudSteps} steps</dd>
        </div>
        <div>
          <dt>Light</dt>
          <dd>{budget.cloudLightSteps} taps</dd>
        </div>
        <div>
          <dt>Reflect</dt>
          <dd>Ocean glint</dd>
        </div>
        <div>
          <dt>Air</dt>
          <dd>{budget.atmosphereSteps} samples</dd>
        </div>
      </dl>
      <p>
        Blue Marble-style surface, night lights, volumetric cloud self-shadowing, projected ground shadow,
        ocean specular glint, and Karman-line scattering are composited in WebGL. Texture tier: {textureTier}.
      </p>
    </section>
  );
}

function NasaSceneControls({
  sceneMode,
  setSceneMode
}: {
  sceneMode: NasaSceneMode;
  setSceneMode: (mode: NasaSceneMode) => void;
}) {
  return (
    <div className="nasa-earth__scene-controls" aria-label="Earth scene mode">
      <button
        type="button"
        aria-pressed={sceneMode === "near"}
        onClick={() => setSceneMode("near")}
      >
        Near
      </button>
      <button
        type="button"
        aria-pressed={sceneMode === "far"}
        onClick={() => setSceneMode("far")}
      >
        Far
      </button>
    </div>
  );
}

export function NasaEarthRoute() {
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
  const requestedSceneMode = useSyncExternalStore(
    subscribeRuntimeSnapshot,
    readRequestedSceneMode,
    serverRequestedSceneModeSnapshot
  );
  const [selectedSceneMode, setSelectedSceneMode] = useState<NasaSceneMode | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [telemetry, setTelemetry] = useState<ObservationTelemetry>(DEFAULT_OBSERVATION_TELEMETRY);
  const baseQuality = useQualityTier(requestedQuality, reducedMotion);
  const quality = resolveNasaQualityProfile(baseQuality, requestedQuality);
  const textureMode = textureModeForQuality(quality, requestedQuality);
  const sceneMode = selectedSceneMode ?? requestedSceneMode;

  const showFallback = contextLost || quality.tier === "fallback";

  return (
    <main className="nasa-earth">
      {showFallback ? (
        <NasaEarthFallback />
      ) : (
        <div className="nasa-earth__canvas" aria-label="NASA Earth low orbit view">
          <NasaEarthErrorBoundary fallback={<NasaEarthFallback />}>
            <Canvas
              dpr={[1, quality.dpr || 1]}
              camera={{ fov: DEFAULT_NEAR_FRAMING.fov, position: DEFAULT_NEAR_FRAMING.cameraPosition, near: 0.01, far: 90 }}
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer }}
              onCreated={({ gl }) => {
                gl.outputColorSpace = SRGBColorSpace;
                gl.toneMapping = ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.08;
                gl.domElement.addEventListener("webglcontextlost", (event) => {
                  event.preventDefault();
                  setContextLost(true);
                });
              }}
            >
              <Suspense fallback={null}>
                <NasaEarthScene
                  onTelemetry={setTelemetry}
                  quality={quality}
                  reducedMotion={reducedMotion}
                  sceneMode={sceneMode}
                  textureMode={textureMode}
                />
              </Suspense>
            </Canvas>
          </NasaEarthErrorBoundary>
        </div>
      )}
      <NasaSceneControls sceneMode={sceneMode} setSceneMode={(mode) => setSelectedSceneMode(mode)} />
      <NasaEarthHud quality={quality} sceneMode={sceneMode} telemetry={telemetry} textureMode={textureMode} />
      <div className="nasa-earth__shade" aria-hidden="true" />
      <style>{`
        .nasa-earth {
          position: relative;
          width: 100vw;
          min-height: 100svh;
          height: 100svh;
          overflow: hidden;
          background: #000106;
          color: #f6fbff;
          isolation: isolate;
          font-family: "Avenir Next", "SF Pro Display", "PingFang SC", sans-serif;
        }

        .nasa-earth__canvas,
        .nasa-earth__fallback {
          position: fixed;
          inset: 0;
          z-index: 1;
        }

        .nasa-earth__canvas,
        .nasa-earth__canvas canvas {
          width: 100% !important;
          height: 100% !important;
          touch-action: none;
        }

        .nasa-earth__shade {
          position: fixed;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(0, 1, 6, 0.42), transparent 22%, transparent 78%, rgba(0, 1, 6, 0.34)),
            linear-gradient(180deg, rgba(0, 1, 7, 0.28), transparent 30%, transparent 74%, rgba(0, 1, 7, 0.42));
          mix-blend-mode: multiply;
          opacity: 0.28;
        }

        .nasa-earth__scene-controls {
          position: fixed;
          top: clamp(14px, 2.2vw, 28px);
          right: clamp(14px, 2.6vw, 34px);
          z-index: 3;
          display: inline-grid;
          grid-template-columns: repeat(2, minmax(58px, 1fr));
          gap: 2px;
          padding: 3px;
          border: 1px solid rgba(185, 215, 255, 0.18);
          background: rgba(0, 6, 18, 0.46);
          backdrop-filter: blur(8px);
        }

        .nasa-earth__scene-controls button {
          appearance: none;
          min-width: 0;
          border: 0;
          padding: 7px 10px;
          background: transparent;
          color: rgba(189, 214, 242, 0.72);
          font: inherit;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          line-height: 1;
          text-transform: uppercase;
          cursor: pointer;
        }

        .nasa-earth__scene-controls button[aria-pressed="true"] {
          background: rgba(146, 198, 255, 0.14);
          color: rgba(247, 251, 255, 0.95);
          box-shadow: inset 0 0 0 1px rgba(185, 215, 255, 0.14);
        }

        .nasa-earth__hud {
          display: none;
          position: fixed;
          left: clamp(18px, 3.4vw, 46px);
          bottom: clamp(18px, 3.2vw, 40px);
          z-index: 3;
          width: min(190px, calc(100vw - 36px));
          padding: 7px 8px;
          border: 1px solid rgba(185, 215, 255, 0.04);
          background: linear-gradient(180deg, rgba(1, 9, 22, 0.18), rgba(0, 4, 12, 0.08));
          color: rgba(239, 247, 255, 0.5);
          opacity: 0.28;
          pointer-events: none;
          text-shadow: 0 0 16px rgba(95, 169, 255, 0.12);
        }

        .nasa-earth__hud::before {
          content: none;
          position: absolute;
          inset: 5px;
          border: 1px solid rgba(185, 215, 255, 0.08);
          pointer-events: none;
        }

        .nasa-earth__hud-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
          margin: 0 0 8px;
          padding-bottom: 7px;
          border-bottom: 1px solid rgba(185, 215, 255, 0.1);
        }

        .nasa-earth__hud-heading p {
          margin: 0;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .nasa-earth__hud-heading span {
          color: rgba(180, 211, 245, 0.66);
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .nasa-earth__hud-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 5px 7px;
          margin: 0;
        }

        .nasa-earth__hud-grid div {
          min-width: 0;
        }

        .nasa-earth__hud-wide {
          grid-column: span 2;
        }

        .nasa-earth__hud-grid dt {
          margin: 0 0 3px;
          color: rgba(149, 183, 224, 0.58);
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .nasa-earth__hud-grid dd {
          margin: 0;
          color: rgba(243, 249, 255, 0.9);
          font-size: 11px;
          line-height: 1.25;
          overflow-wrap: break-word;
        }

        .nasa-earth__hud > p {
          display: none;
          margin: 10px 0 0;
          color: rgba(188, 212, 241, 0.68);
          font-size: 11px;
          line-height: 1.45;
        }

        .nasa-earth__fallback {
          display: grid;
          place-items: center;
          background: #000106;
        }

        .nasa-earth__fallback-poster {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: url("/assets/lubirth/backgrounds/8k_stars_milky_way.webp") center / cover no-repeat;
          opacity: 0.58;
        }

        .nasa-earth__fallback-copy {
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

        .nasa-earth__fallback-copy strong {
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .nasa-earth__fallback-copy span {
          color: rgba(198, 220, 245, 0.72);
          font-size: 12px;
          line-height: 1.45;
        }

        @media (max-width: 680px) {
          .nasa-earth__shade {
            background:
              linear-gradient(90deg, rgba(0, 1, 6, 0.38), transparent 18%, transparent 82%, rgba(0, 1, 6, 0.34)),
              linear-gradient(180deg, rgba(0, 1, 7, 0.32), transparent 24%, transparent 76%, rgba(0, 1, 7, 0.46));
          }

          .nasa-earth__hud {
            right: 12px;
            bottom: 10px;
            left: 12px;
            width: auto;
            padding: 7px 8px 7px;
          }

          .nasa-earth__scene-controls {
            top: 10px;
            right: 10px;
            grid-template-columns: repeat(2, 52px);
          }

          .nasa-earth__scene-controls button {
            padding: 6px 7px;
            font-size: 8px;
          }

          .nasa-earth__hud-heading {
            margin-bottom: 7px;
            padding-bottom: 6px;
          }

          .nasa-earth__hud-heading p {
            font-size: 11px;
          }

          .nasa-earth__hud-heading span,
          .nasa-earth__hud-grid dt {
            font-size: 7px;
          }

          .nasa-earth__hud-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 6px 7px;
          }

          .nasa-earth__hud-grid dd,
          .nasa-earth__hud > p {
            font-size: 9px;
          }

          .nasa-earth__hud > p {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}
