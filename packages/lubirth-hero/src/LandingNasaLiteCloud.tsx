"use client";

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AddEquation,
  ClampToEdgeWrapping,
  CustomBlending,
  FrontSide,
  MathUtils,
  Mesh,
  OneMinusSrcAlphaFactor,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import {
  LANDING_NASA_LITE_CLOUD_BOTTOM_SCALE,
  LANDING_NASA_LITE_CLOUD_TOP_SCALE,
  isLandingNasaLiteMobileViewport,
  resolveLandingNasaLiteBudget,
  type LandingNasaLiteBudget
} from "./landingNasaLitePolicy";
import { HOME_CLOUD_FIELD_OFFSET_X, HOME_CLOUD_FIELD_OFFSET_Y } from "./homeCloudField";
import { createLandingGpuTimer, type LandingGpuTimerSnapshot } from "./landingGpuTimer";
import type {
  LandingComposition,
  LandingProjectedEarthFrame,
  LandingResolvedAssets
} from "./types";
import { useLandingTexture } from "./useLandingTexture";

interface LandingNasaLiteCloudProps {
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  projection: RefObject<LandingProjectedEarthFrame>;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
  cloudOffsetRef?: MutableRefObject<number>;
}

interface NasaLiteCloudTelemetry {
  active: boolean;
  activeLightTextureReads: number;
  activeTextureReads: number;
  activeViewTextureReads: number;
  band: LandingNasaLiteBudget["band"];
  cloudLightSamples: number;
  cloudBottomScale: number;
  cloudOffset: number;
  cloudTopScale: number;
  cloudViewSteps: number;
  estimatedActiveTextureBytes: number;
  gpuTimer: LandingGpuTimerSnapshot;
  mobile: boolean;
  lodBlend: number;
  pendingCloudLightSamples: 0 | 1 | null;
  pendingCloudViewSteps: 1 | 2 | 4 | null;
  previousCloudLightSamples: 0 | 1;
  previousCloudViewSteps: number;
  projectedRadiusRatio: number;
  requestedCloudLightSamples: 0 | 1;
  requestedCloudViewSteps: 1 | 2 | 4;
  rendererTextureCount: number;
  shellCount: number;
  steadyTextureReads: number;
  textureSource?: string;
  textureUuid?: string;
  transitioning: boolean;
}

interface NasaLiteBudgetOverride {
  atmosphereLightScreenSide?: -1 | 1;
  atmosphereSteps?: 1 | 2 | 4;
  cloudLightSamples?: 0 | 1;
  cloudOffset?: number;
  cloudOpacityScale?: number;
  cloudViewSteps?: 1 | 2 | 4;
}

interface NasaLiteLodTransition {
  blend: number;
  fromLightSamples: 0 | 1;
  fromViewSteps: 1 | 2 | 4;
  pendingLightSamples: 0 | 1 | null;
  pendingViewSteps: 1 | 2 | 4 | null;
  toLightSamples: 0 | 1;
  toViewSteps: 1 | 2 | 4;
}

declare global {
  interface Window {
    __MiraLithLuBirthNasaLiteBudgetOverride?: NasaLiteBudgetOverride;
    __MiraLithLuBirthNasaLiteCloud?: NasaLiteCloudTelemetry;
  }
}

const LOD_CROSSFADE_SECONDS = 0.42;
const cameraWorld = new Vector3();
const cameraLocal = new Vector3();
const localLight = new Vector3();
const fallbackLight = new Vector3();
const worldQuaternion = new Quaternion();

function estimateRgbaTextureBytes(width: number, height: number) {
  return Math.ceil(width * height * 4 * (4 / 3));
}

function sameLodBudget(
  viewSteps: 1 | 2 | 4,
  lightSamples: 0 | 1,
  otherViewSteps: 1 | 2 | 4,
  otherLightSamples: 0 | 1
) {
  return viewSteps === otherViewSteps && lightSamples === otherLightSamples;
}

function startLodTransition(
  transition: NasaLiteLodTransition,
  viewSteps: 1 | 2 | 4,
  lightSamples: 0 | 1
) {
  transition.fromViewSteps = transition.toViewSteps;
  transition.fromLightSamples = transition.toLightSamples;
  transition.toViewSteps = viewSteps;
  transition.toLightSamples = lightSamples;
  transition.blend = 0;
}

function createNasaLiteCloudMaterial(
  composition: LandingComposition,
  cloudBottom: number,
  cloudTop: number,
  texture: NonNullable<ReturnType<typeof useLandingTexture>["texture"]>
) {
  return new ShaderMaterial({
    name: "MiraLithNasaLiteCloud",
    uniforms: {
      cameraLocal: { value: new Vector3(0, 0, 4) },
      cloudBottom: { value: cloudBottom },
      cloudFieldMap: { value: texture },
      cloudOffset: { value: 0 },
      cloudTop: { value: cloudTop },
      debugBoost: { value: 0 },
      lightDir: { value: new Vector3(...composition.light.fixedSunDir).normalize() },
      lightSamples: { value: 1 },
      lodBlend: { value: 1 },
      opacity: { value: composition.earth.cloudOpacity },
      previousLightSamples: { value: 1 },
      previousViewSteps: { value: 4 },
      viewSteps: { value: 4 }
    },
    vertexShader: `
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudFieldMap;
      uniform vec3 cameraLocal;
      uniform vec3 lightDir;
      uniform float cloudBottom;
      uniform float cloudTop;
      uniform float cloudOffset;
      uniform float opacity;
      uniform float viewSteps;
      uniform float previousViewSteps;
      uniform float lightSamples;
      uniform float previousLightSamples;
      uniform float lodBlend;
      uniform float debugBoost;

      varying vec3 vLocalPosition;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

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

      vec2 sphericalUv(vec3 point) {
        vec3 n = normalize(point);
        float u = atan(n.z, n.x) / TAU + 0.5 + ${HOME_CLOUD_FIELD_OFFSET_X.toFixed(3)} + cloudOffset;
        float v = asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5 + ${HOME_CLOUD_FIELD_OFFSET_Y.toFixed(3)};
        return vec2(fract(u), clamp(v, 0.001, 0.999));
      }

      void tangentFrame(vec3 normal, out vec3 east, out vec3 north) {
        east = abs(normal.y) > 0.98
          ? normalize(cross(vec3(0.0, 0.0, 1.0), normal))
          : normalize(cross(vec3(0.0, 1.0, 0.0), normal));
        north = normalize(cross(normal, east));
      }

      float henyeyGreenstein(float g, float mu) {
        float gg = g * g;
        return (1.0 - gg) / max(pow(1.0 + gg - 2.0 * g * mu, 1.5), 0.001);
      }

      vec3 cloudDomain(vec2 uv, float height01) {
        float longitude = uv.x * TAU;
        float latitude = (uv.y - 0.5) * PI;
        float latitudeRadius = cos(latitude);
        return vec3(
          cos(longitude) * latitudeRadius,
          sin(latitude),
          sin(longitude) * latitudeRadius
        ) + vec3(0.0, 0.0, height01 * 0.28);
      }

      float cloudDetailNoise(vec2 uv, float height01, float sampleBudget) {
        float detailLod = smoothstep(1.0, 4.0, sampleBudget);
        vec3 sphericalDomain = cloudDomain(uv, height01);
        vec3 macroDomain = sphericalDomain * 3.4;
        vec3 detailDomain = sphericalDomain * mix(6.4, 12.4, detailLod);
        float macroShape = sin(macroDomain.x * 1.17 + macroDomain.z * 0.74 + height01 * 1.8) *
          cos(macroDomain.y * 1.09 - macroDomain.z * 0.53 - height01 * 1.25);
        float foldedDetail = sin(detailDomain.x * 1.83 - detailDomain.z * 1.19 + height01 * 4.1) *
          cos(detailDomain.y * 1.47 + detailDomain.z * 1.61 - height01 * 3.4);
        return clamp01(
          0.52 + macroShape * 0.25 + foldedDetail * mix(0.075, 0.18, detailLod)
        );
      }

      float densityFromField(
        vec4 field,
        float height01,
        float detailNoise
      ) {
        float coverage = smoothstep(0.045, 0.72, field.r);
        float columnHeight = mix(0.2, 0.95, smoothstep(0.035, 0.94, field.a));
        float lowerBody = smoothstep(0.006, 0.135, height01);
        float topFeather = mix(0.22, 0.105, smoothstep(0.28, 0.88, coverage));
        float upperBody = 1.0 - smoothstep(
          max(0.055, columnHeight - topFeather),
          min(1.0, columnHeight + 0.018),
          height01
        );
        float verticalBody = lowerBody * upperBody;
        float body = coverage * verticalBody * mix(0.64, 1.18, field.a) *
          mix(0.68, 1.22, detailNoise);
        float erosion = mix(0.235, 0.055, coverage) * (1.0 - detailNoise) * verticalBody;
        float erodedBody = max(body - erosion, 0.0);
        return smoothstep(0.012, 0.29, erodedBody) * mix(0.84, 1.1, detailNoise);
      }

      void integrateCloud(
        float sampleBudget,
        vec3 rayOrigin,
        vec3 rayDirection,
        float marchStart,
        float segmentLength,
        float shellThickness,
        float lightTransmittance,
        out vec3 accumulated,
        out float transmittance,
        out float accumulatedDensity
      ) {
        float stepSize = segmentLength / max(sampleBudget, 1.0);
        float opticalStep = min(segmentLength, shellThickness * 2.75) /
          max(sampleBudget, 1.0);
        accumulated = vec3(0.0);
        transmittance = 1.0;
        accumulatedDensity = 0.0;

        for (int index = 0; index < 4; index += 1) {
          if (float(index) < sampleBudget) {
            float sampleIndex = float(index) + 0.5;
            vec3 samplePoint = rayOrigin + rayDirection * (marchStart + stepSize * sampleIndex);
            float height01 = clamp01((length(samplePoint) - cloudBottom) / shellThickness);
            vec2 cloudUv = sphericalUv(samplePoint);
            vec4 field = texture2D(cloudFieldMap, cloudUv);
            float detailNoise = cloudDetailNoise(cloudUv, height01, sampleBudget);
            float density = densityFromField(field, height01, detailNoise);
            vec3 sampleNormal = normalize(samplePoint);
            float sampleViewFacing = max(dot(sampleNormal, -rayDirection), 0.0);
            float limbApproach = smoothstep(0.025, 0.18, sampleViewFacing);
            float denseColumn = smoothstep(0.48, 0.9, field.r * 0.62 + field.a * 0.5);
            float limbVisibility = mix(
              limbApproach,
              mix(0.28, 1.0, limbApproach),
              denseColumn
            );
            density *= limbVisibility;

            if (density > 0.001) {
              vec3 normal = sampleNormal;
              vec3 east;
              vec3 north;
              tangentFrame(normal, east, north);
              vec2 tangentNormal = (field.gb * 2.0 - 1.0) * 0.58;
              float normalZ = sqrt(max(1.0 - min(dot(tangentNormal, tangentNormal), 0.94), 0.06));
              vec3 shapedNormal = normalize(east * tangentNormal.x + north * tangentNormal.y + normal * normalZ);
              float sun = dot(normal, lightDir);
              float shapedSun = max(dot(shapedNormal, lightDir), 0.0);
              float daylight = smoothstep(-0.24, 0.34, sun);
              float twilight = smoothstep(-0.3, 0.02, sun) * (1.0 - smoothstep(0.08, 0.38, sun));
              float phase = min(henyeyGreenstein(0.56, dot(-rayDirection, lightDir)), 4.4);
              float viewFacing = sampleViewFacing;
              float viewGrazing = 1.0 - viewFacing;
              float columnHeight = mix(0.2, 0.95, smoothstep(0.035, 0.94, field.a));
              float relativeHeight = clamp01(height01 / max(columnHeight, 0.08));
              float columnMass = smoothstep(0.08, 0.88, field.r * 0.62 + field.a * 0.52);
              float cloudCore = smoothstep(0.38, 0.94, density * mix(0.88, 1.2, columnMass));
              float remainingColumn = pow(1.0 - relativeHeight, 1.18) * columnMass;
              float solarElevation = smoothstep(-0.08, 0.62, sun);
              float localLightTransmittance = lightTransmittance * exp(
                -remainingColumn * mix(3.4, 1.05, solarElevation)
              );
              float topFraction = smoothstep(0.38, 0.9, relativeHeight);
              float bottomFraction = 1.0 - smoothstep(0.08, 0.48, relativeHeight);
              float cloudSide = 1.0 - smoothstep(0.12, 0.68, shapedSun);
              float internalShadow = (1.0 - localLightTransmittance) *
                (0.34 + cloudCore * 0.66);
              float silver = pow(viewGrazing, 3.6) *
                smoothstep(0.006, 0.065, viewFacing) * daylight * localLightTransmittance;
              float forwardScatter = phase * localLightTransmittance *
                smoothstep(-0.36, 0.16, sun) * (1.0 - cloudCore * 0.28);
              float volumeFidelity = smoothstep(1.0, 4.0, sampleBudget);
              vec3 coldBody = vec3(0.135, 0.18, 0.25);
              vec3 middleBody = vec3(0.46, 0.54, 0.62);
              vec3 litTop = mix(
                vec3(0.58, 0.65, 0.72),
                vec3(0.91, 0.93, 0.92),
                volumeFidelity
              );
              vec3 color = mix(
                coldBody,
                middleBody,
                0.18 + localLightTransmittance * 0.42 + relativeHeight * 0.2
              );
              float topExposure = daylight * localLightTransmittance *
                (0.12 + topFraction * 0.5) * (0.54 + shapedSun * 0.46);
              topExposure *= mix(0.12, 1.0, smoothstep(0.08, 0.42, viewFacing));
              topExposure *= mix(0.44, 1.0, volumeFidelity);
              topExposure *= mix(
                0.76,
                1.34,
                smoothstep(0.42, 0.88, detailNoise) * topFraction * volumeFidelity
              );
              color = mix(color, litTop, topExposure);
              color *= 1.0 - bottomFraction * internalShadow * 0.46;
              color *= 1.0 - cloudSide * internalShadow * 0.36;
              color *= 1.0 - cloudCore * internalShadow * 0.28;
              color *= mix(0.82, 1.1, shapedSun);
              float localRelief = (detailNoise - 0.5) * 2.0;
              color *= 1.0 + localRelief *
                (0.08 + cloudCore * 0.18 + topFraction * 0.06) * volumeFidelity;
              color *= mix(0.86, 1.12, detailNoise);
              float backlitSilver = smoothstep(0.42, 0.94, dot(-rayDirection, lightDir)) *
                pow(viewGrazing, 2.8) *
                smoothstep(0.44, 0.86, columnMass) *
                smoothstep(0.26, 0.76, relativeHeight) *
                (1.0 - cloudCore * 0.58) *
                localLightTransmittance;
              color += vec3(0.68, 0.82, 1.0) * silver * (0.034 + phase * 0.018);
              color += vec3(0.72, 0.82, 0.96) * backlitSilver * 0.041;
              color += vec3(1.0, 0.48, 0.2) * twilight * silver * 0.026;
              color += vec3(0.7, 0.82, 1.0) * forwardScatter * 0.018;
              color *= mix(
                0.15,
                1.0,
                clamp01(daylight + twilight * 0.72 + forwardScatter * 0.08)
              );

              float extinction = mix(32.0, 54.0, columnMass);
              extinction *= mix(0.62, 1.0, volumeFidelity);
              float opticalDepth = density * opticalStep * extinction * opacity;
              float alphaStep = clamp01(1.0 - exp(-opticalDepth));
              accumulated += color * alphaStep * transmittance;
              accumulatedDensity += density;
              transmittance *= exp(-opticalDepth);
            }
          }
        }
      }

      void main() {
        vec3 rayOrigin = cameraLocal;
        vec3 rayDirection = normalize(vLocalPosition - cameraLocal);

        float outerNear;
        float outerFar;
        if (!raySphere(rayOrigin, rayDirection, cloudTop, outerNear, outerFar)) {
          gl_FragColor = vec4(0.0);
          return;
        }

        float innerNear;
        float innerFar;
        bool hitsInner = raySphere(rayOrigin, rayDirection, cloudBottom, innerNear, innerFar);
        float marchStart = max(outerNear, 0.0);
        float closestT = max(-dot(rayOrigin, rayDirection), marchStart);
        float marchEnd = hitsInner
          ? min(max(innerNear, marchStart), outerFar)
          : min(max(closestT, marchStart), outerFar);
        if (marchEnd <= marchStart) {
          gl_FragColor = vec4(0.0);
          return;
        }

        float segmentLength = marchEnd - marchStart;
        float shellThickness = max(cloudTop - cloudBottom, 0.001);
        vec3 representativePoint = rayOrigin + rayDirection * (marchStart + segmentLength * 0.56);
        vec3 representativeNormal = normalize(representativePoint);
        vec3 representativeEast;
        vec3 representativeNorth;
        tangentFrame(representativeNormal, representativeEast, representativeNorth);
        float representativeSun = dot(representativeNormal, lightDir);
        vec2 tangentSun = vec2(
          dot(lightDir, representativeEast),
          dot(lightDir, representativeNorth)
        ) / max(representativeSun, 0.09);
        float sunPath = min(length(tangentSun), 5.0);
        vec2 sunDirection = tangentSun / max(length(tangentSun), 0.001);
        float maximumLightSamples = max(lightSamples, previousLightSamples);
        float fullLightTransmittance = 1.0;
        if (maximumLightSamples > 0.001) {
          vec2 lightUv = sphericalUv(representativePoint);
          lightUv = vec2(
            fract(lightUv.x - sunDirection.x * mix(0.0015, 0.008, sunPath / 5.0)),
            clamp(lightUv.y - sunDirection.y * mix(0.0008, 0.004, sunPath / 5.0), 0.001, 0.999)
          );
          vec4 lightField = texture2D(cloudFieldMap, lightUv);
          float lightOpticalDepth = lightField.r * lightField.a * mix(1.4, 4.8, sunPath / 5.0);
          fullLightTransmittance = exp(-lightOpticalDepth);
        }
        float currentLightTransmittance = mix(1.0, fullLightTransmittance, lightSamples);
        float previousLightTransmittance = mix(1.0, fullLightTransmittance, previousLightSamples);

        vec3 currentAccumulated;
        float currentTransmittance;
        float currentDensity;
        integrateCloud(
          viewSteps,
          rayOrigin,
          rayDirection,
          marchStart,
          segmentLength,
          shellThickness,
          currentLightTransmittance,
          currentAccumulated,
          currentTransmittance,
          currentDensity
        );

        vec3 accumulated = currentAccumulated;
        float alpha = clamp01(1.0 - currentTransmittance);
        float accumulatedDensity = currentDensity;
        if (lodBlend < 0.999 && abs(previousViewSteps - viewSteps) > 0.1) {
          vec3 previousAccumulated;
          float previousTransmittance;
          float previousDensity;
          integrateCloud(
            previousViewSteps,
            rayOrigin,
            rayDirection,
            marchStart,
            segmentLength,
            shellThickness,
            previousLightTransmittance,
            previousAccumulated,
            previousTransmittance,
            previousDensity
          );
          accumulated = mix(previousAccumulated, currentAccumulated, lodBlend);
          alpha = mix(clamp01(1.0 - previousTransmittance), alpha, lodBlend);
          accumulatedDensity = mix(previousDensity, currentDensity, lodBlend);
        }

        float edgeWidth = max(fwidth(alpha) * 1.35, 0.0015);
        float softCoverage = smoothstep(0.0015 - edgeWidth, 0.0015 + edgeWidth, alpha);
        softCoverage *= smoothstep(0.0004, 0.004, accumulatedDensity);
        accumulated *= softCoverage;
        alpha *= softCoverage;
        if (alpha < 0.00005) {
          gl_FragColor = vec4(0.0);
          return;
        }

        vec3 finalColor = accumulated / max(alpha, 0.0001);
        finalColor *= 1.0 + debugBoost * 0.12;
        gl_FragColor = vec4(max(finalColor, vec3(0.0)), alpha);
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    side: FrontSide,
    depthTest: true,
    depthWrite: false
  });
}

export function LandingNasaLiteCloud({
  composition,
  assets,
  quality,
  projection,
  sceneLightDirection,
  emphasis = false,
  cloudOffsetRef
}: LandingNasaLiteCloudProps) {
  const cloud = useRef<Mesh>(null);
  const budget = useRef<LandingNasaLiteBudget>({
    atmosphereSteps: 4,
    band: "near",
    cloudLightSamples: 1,
    cloudViewSteps: 4,
    mobile: false,
    projectedRadiusRatio: 1
  });
  const lodTransition = useRef<NasaLiteLodTransition>({
    blend: 1,
    fromLightSamples: 1,
    fromViewSteps: 4,
    pendingLightSamples: null,
    pendingViewSteps: null,
    toLightSamples: 1,
    toViewSteps: 4
  });
  const { camera, gl, size } = useThree();
  const visualTestOverridesEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("visualTest") === "pixels";
  }, []);
  const gpuTimerEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("visualTest") === "performance" || params.get("nasaLiteGpuTimer") === "on";
  }, []);
  const gpuTimer = useMemo(
    () => createLandingGpuTimer(gl.getContext(), gpuTimerEnabled),
    [gl, gpuTimerEnabled]
  );
  const cloudField = assets.earthCloudField;
  const { texture, failed } = useLandingTexture(cloudField?.src, {
    colorSpace: cloudField?.colorSpace ?? "linear",
    wrapS: RepeatWrapping,
    wrapT: ClampToEdgeWrapping,
    anisotropy: 4
  });
  const cloudBottom =
    composition.earth.radius * LANDING_NASA_LITE_CLOUD_BOTTOM_SCALE;
  const cloudTop =
    composition.earth.radius * LANDING_NASA_LITE_CLOUD_TOP_SCALE;
  const material = useMemo(
    () => texture ? createNasaLiteCloudMaterial(composition, cloudBottom, cloudTop, texture) : null,
    [cloudBottom, cloudTop, composition, texture]
  );
  const enabled = Boolean(material && texture && !failed && quality.tier !== "fallback");

  useEffect(() => () => material?.dispose(), [material]);
  useEffect(() => () => gpuTimer.dispose(), [gpuTimer]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (!enabled) {
      window.__MiraLithLuBirthNasaLiteCloud = undefined;
    }

    return () => {
      window.__MiraLithLuBirthNasaLiteCloud = undefined;
    };
  }, [enabled]);

  useFrame((_state, delta) => {
    if (!cloud.current || !material || !texture || !cloudField) {
      return;
    }

    const touchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints;
    const mobile = isLandingNasaLiteMobileViewport(size.width, size.height, touchPoints);
    const radiusRatio = projection.current.radius / Math.max(1, Math.min(size.width, size.height));
    const resolvedBudget = resolveLandingNasaLiteBudget({
      mobile,
      previousBand: budget.current.band,
      projectedRadiusRatio: radiusRatio,
      qualityTier: quality.tier
    });
    const override = visualTestOverridesEnabled
      ? window.__MiraLithLuBirthNasaLiteBudgetOverride
      : undefined;
    const nextBudget: LandingNasaLiteBudget = {
      ...resolvedBudget,
      cloudLightSamples: override?.cloudLightSamples ?? resolvedBudget.cloudLightSamples,
      cloudViewSteps: override?.cloudViewSteps ?? resolvedBudget.cloudViewSteps
    };
    budget.current = nextBudget;
    const cloudMaterial = cloud.current.material as ShaderMaterial;
    const transition = lodTransition.current;
    const transitionIsActive = transition.blend < 1;
    const requestMatchesDestination = sameLodBudget(
      nextBudget.cloudViewSteps,
      nextBudget.cloudLightSamples,
      transition.toViewSteps,
      transition.toLightSamples
    );

    if (transitionIsActive) {
      if (requestMatchesDestination) {
        transition.pendingViewSteps = null;
        transition.pendingLightSamples = null;
      } else {
        // Finish the visible blend before applying the latest request. Resetting to
        // either endpoint here would discard the currently displayed mixture.
        transition.pendingViewSteps = nextBudget.cloudViewSteps;
        transition.pendingLightSamples = nextBudget.cloudLightSamples;
      }
      transition.blend = Math.min(1, transition.blend + delta / LOD_CROSSFADE_SECONDS);
    } else if (!requestMatchesDestination) {
      startLodTransition(
        transition,
        nextBudget.cloudViewSteps,
        nextBudget.cloudLightSamples
      );
    } else {
      transition.fromViewSteps = transition.toViewSteps;
      transition.fromLightSamples = transition.toLightSamples;
    }

    if (transition.blend >= 1) {
      transition.blend = 1;
      transition.fromViewSteps = transition.toViewSteps;
      transition.fromLightSamples = transition.toLightSamples;

      const pendingViewSteps = transition.pendingViewSteps;
      const pendingLightSamples = transition.pendingLightSamples;
      transition.pendingViewSteps = null;
      transition.pendingLightSamples = null;
      if (
        pendingViewSteps !== null &&
        pendingLightSamples !== null &&
        !sameLodBudget(
          pendingViewSteps,
          pendingLightSamples,
          transition.toViewSteps,
          transition.toLightSamples
        )
      ) {
        startLodTransition(transition, pendingViewSteps, pendingLightSamples);
      }
    }
    const smoothLodBlend = transition.blend * transition.blend * (3 - 2 * transition.blend);
    const blendsTwoViewIntegrals = smoothLodBlend < 0.999 &&
      transition.fromViewSteps !== transition.toViewSteps;
    const activeViewTextureReads = blendsTwoViewIntegrals
      ? transition.fromViewSteps + transition.toViewSteps
      : transition.toViewSteps;
    const activeLightTextureReads = Math.max(
      transition.fromLightSamples,
      transition.toLightSamples
    );
    const activeTextureReads = activeViewTextureReads + activeLightTextureReads;

    cloud.current.rotation.set(0, MathUtils.degToRad(composition.earth.yawDeg), 0);
    cloud.current.updateWorldMatrix(true, false);
    camera.getWorldPosition(cameraWorld);
    cameraLocal.copy(cameraWorld);
    cloud.current.worldToLocal(cameraLocal);
    const activeLight = sceneLightDirection ?? fallbackLight.set(...composition.light.fixedSunDir);
    cloud.current.getWorldQuaternion(worldQuaternion).invert();
    localLight.copy(activeLight).normalize().applyQuaternion(worldQuaternion).normalize();

    cloudMaterial.uniforms.cameraLocal.value.copy(cameraLocal);
    cloudMaterial.uniforms.cloudFieldMap.value = texture;
    const activeCloudOffset = visualTestOverridesEnabled &&
      override?.cloudOffset !== undefined
      ? MathUtils.euclideanModulo(override.cloudOffset, 1)
      : cloudOffsetRef?.current ?? 0;
    cloudMaterial.uniforms.cloudOffset.value = activeCloudOffset;
    cloudMaterial.uniforms.debugBoost.value = emphasis ? 1 : 0;
    cloudMaterial.uniforms.lightDir.value.copy(localLight);
    cloudMaterial.uniforms.lightSamples.value = transition.toLightSamples;
    cloudMaterial.uniforms.lodBlend.value = smoothLodBlend;
    const cloudOpacityScale = visualTestOverridesEnabled
      ? MathUtils.clamp(override?.cloudOpacityScale ?? 1, 0, 1)
      : 1;
    cloudMaterial.uniforms.opacity.value = composition.earth.useClouds
      ? composition.earth.cloudOpacity * cloudOpacityScale
      : 0;
    cloudMaterial.uniforms.previousLightSamples.value = transition.fromLightSamples;
    cloudMaterial.uniforms.previousViewSteps.value = transition.fromViewSteps;
    cloudMaterial.uniforms.viewSteps.value = transition.toViewSteps;

    window.__MiraLithLuBirthNasaLiteCloud = {
      active: true,
      activeLightTextureReads,
      activeTextureReads,
      activeViewTextureReads,
      band: nextBudget.band,
      cloudBottomScale: LANDING_NASA_LITE_CLOUD_BOTTOM_SCALE,
      cloudLightSamples: transition.toLightSamples,
      cloudOffset: activeCloudOffset,
      cloudTopScale: LANDING_NASA_LITE_CLOUD_TOP_SCALE,
      cloudViewSteps: transition.toViewSteps,
      estimatedActiveTextureBytes: estimateRgbaTextureBytes(cloudField.width, cloudField.height),
      gpuTimer: gpuTimer.poll(),
      mobile: nextBudget.mobile,
      lodBlend: smoothLodBlend,
      pendingCloudLightSamples: transition.pendingLightSamples,
      pendingCloudViewSteps: transition.pendingViewSteps,
      previousCloudLightSamples: transition.fromLightSamples,
      previousCloudViewSteps: transition.fromViewSteps,
      projectedRadiusRatio: nextBudget.projectedRadiusRatio,
      requestedCloudLightSamples: nextBudget.cloudLightSamples,
      requestedCloudViewSteps: nextBudget.cloudViewSteps,
      rendererTextureCount: gl.info.memory.textures,
      shellCount: 1,
      steadyTextureReads: transition.toViewSteps + transition.toLightSamples,
      textureSource: cloudField.src,
      textureUuid: texture.uuid,
      transitioning: smoothLodBlend < 0.999
    };
  });

  if (!enabled || !material) {
    return null;
  }

  return (
    <mesh
      ref={cloud}
      material={material}
      renderOrder={3}
      onBeforeRender={gpuTimer.begin}
      onAfterRender={gpuTimer.end}
    >
      <sphereGeometry
        args={[
          cloudTop,
          quality.tier === "high" ? 192 : quality.tier === "medium" ? 160 : 112,
          quality.tier === "high" ? 112 : quality.tier === "medium" ? 96 : 64
        ]}
      />
    </mesh>
  );
}
