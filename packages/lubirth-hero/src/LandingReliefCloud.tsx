"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  ClampToEdgeWrapping,
  Color,
  FrontSide,
  MathUtils,
  Mesh,
  NormalBlending,
  RepeatWrapping,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import {
  HOME_CLOUD_FIELD_OFFSET_X,
  HOME_CLOUD_FIELD_OFFSET_Y
} from "./homeCloudField";
import {
  LANDING_RELIEF_LITE_CLOUD_BOTTOM_SCALE,
  LANDING_RELIEF_LITE_CLOUD_TOP_SCALE,
  LANDING_RELIEF_LITE_SUN_STEPS,
  isLandingReliefLiteMobileViewport,
  resolveLandingReliefLiteBudget
} from "./landingEarthLiteV2Policy";
import {
  PLANET_LIGHTING_GLSL,
  type LandingPlanetLightingFrame
} from "./landingPlanetLighting";
import {
  createLandingGpuTimer,
  type LandingGpuTimerSnapshot
} from "./landingGpuTimer";
import type { LandingComposition, LandingResolvedAssets } from "./types";
import { useLandingTexture } from "./useLandingTexture";

interface LandingReliefCloudProps {
  assets: LandingResolvedAssets;
  composition: LandingComposition;
  emphasis?: boolean;
  lightingFrame: LandingPlanetLightingFrame;
  quality: QualityProfile;
}

interface LandingReliefCloudTelemetry {
  active: true;
  analyticNoise: false;
  cloudBottomScale: number;
  cloudOffset: number;
  cloudTopScale: number;
  compressedTextureActive: boolean;
  channelLayout: "v3-r-depth-g-height-b-morphology-a-concavity";
  densityIntegration: "front-to-back";
  fragmentTextureReads: 3 | 4;
  gpuTimer: LandingGpuTimerSnapshot;
  integrationPath: "ray-sphere-thin-shell";
  lodTransitions: false;
  mobile: boolean;
  premultipliedAlpha: true;
  rendererTextureCount: number;
  shellCount: 1;
  estimatedActiveTextureBytes: number;
  sunDirection: [number, number, number];
  textureCompression: "uastc" | "rgba8";
  textureSource: string;
  textureUuid: string;
  vertexTextureReads: 1;
  sunSteps: 1;
  thinShellIntegration: true;
  viewSteps: 2 | 3;
}

interface LandingReliefCloudTestOverride {
  cloudOffset?: number;
  cloudOpacityScale?: number;
  densityIntegrationScale?: number;
  reverseSun?: boolean;
  reverseSunField?: boolean;
  reliefLightingScale?: number;
  sunSampleScale?: number;
}

declare global {
  interface Window {
    __MiraLithLuBirthReliefCloud?: LandingReliefCloudTelemetry;
    __MiraLithLuBirthReliefCloudOverride?: LandingReliefCloudTestOverride;
  }
}

const RELIEF_CLOUD_PNG_FALLBACK =
  "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png";
const cloudCameraWorld = new Vector3();
const cloudCameraLocal = new Vector3();

function estimateTextureBytes(
  width: number,
  height: number,
  compressed: boolean
) {
  return Math.round(width * height * (compressed ? 1 : 4) * (4 / 3));
}

export function resolveLandingReliefCloudGeometrySegments(quality: QualityProfile, mobile: boolean) {
  if (mobile || quality.tier === "low") {
    return { height: 80, width: 144 };
  }
  if (quality.tier === "high") {
    return { height: 120, width: 208 };
  }
  return { height: 104, width: 176 };
}

export type LandingReliefCloudFieldDecoder = "rgba-field" | "packed-video-field";

export interface LandingReliefCloudMaterialOptions {
  composition: LandingComposition;
  cloudBottom: number;
  cloudTop: number;
  viewSteps: 2 | 3;
  texture: Texture;
  fieldDecoder?: LandingReliefCloudFieldDecoder;
  fieldUvOffset?: readonly [number, number];
}

export function createLandingReliefCloudMaterial({
  composition,
  cloudBottom,
  cloudTop,
  viewSteps,
  texture,
  fieldDecoder = "rgba-field",
  fieldUvOffset = [HOME_CLOUD_FIELD_OFFSET_X, HOME_CLOUD_FIELD_OFFSET_Y]
}: LandingReliefCloudMaterialOptions) {
  return new ShaderMaterial({
    name: "MiraLithReliefCloud",
    defines: fieldDecoder === "packed-video-field"
      ? { RELIEF_VIEW_STEPS: viewSteps, PACKED_VIDEO_FIELD: 1 }
      : { RELIEF_VIEW_STEPS: viewSteps },
    uniforms: {
      cameraLocal: { value: new Vector3(0, 0, 4) },
      cloudIlluminationFloor: { value: 0.32 },
      cloudBottom: { value: cloudBottom },
      cloudFieldMap: { value: texture },
      cloudOffset: { value: 0 },
      cloudTop: { value: cloudTop },
      debugBoost: { value: 0 },
      densityIntegrationScale: { value: 1 },
      lightColor: { value: new Color(...composition.light.color) },
      lightDir: { value: new Vector3(...composition.light.fixedSunDir).normalize() },
      opacity: { value: composition.earth.cloudOpacity },
      reliefLightingScale: { value: 1 },
      reverseSun: { value: 0 },
      reverseSunField: { value: 0 },
      sunSampleScale: { value: 1 },
      terminatorSoftness: { value: composition.earth.terminatorSoftness },
      fieldUvOffset: { value: new Vector2(...fieldUvOffset) }
    },
    vertexShader: `
      uniform sampler2D cloudFieldMap;
      uniform float cloudBottom;
      uniform float cloudOffset;
      uniform float cloudTop;
      uniform vec2 fieldUvOffset;

      varying float vDisplacedHeight;
      varying vec3 vLocalPosition;
      varying vec2 vUv;
      varying vec3 vViewDirection;
      varying vec3 vWorldEast;
      varying vec3 vWorldNormal;
      varying vec3 vWorldNorth;

      ${PLANET_LIGHTING_GLSL}

      vec4 readCloudField(vec2 uv) {
        vec2 fieldUv = vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
        #ifdef PACKED_VIDEO_FIELD
          vec3 primary = texture2D(cloudFieldMap, vec2(fieldUv.x * 0.5, fieldUv.y)).rgb;
          float concavity = texture2D(
            cloudFieldMap,
            vec2(0.5 + fieldUv.x * 0.5, fieldUv.y)
          ).r;
          return vec4(primary, concavity);
        #else
          return texture2D(cloudFieldMap, fieldUv);
        #endif
      }

      void main() {
        vec2 cloudUv = vec2(
          uv.x + fieldUvOffset.x + cloudOffset,
          clamp(uv.y + fieldUvOffset.y, 0.001, 0.999)
        );
        vec4 heightField = readCloudField(cloudUv);
        float opticalDepth = smoothstep(0.055, 0.82, heightField.r);
        float cloudTopHeight = smoothstep(0.025, 0.95, heightField.g);
        float morphology = heightField.b;
        float displacedHeight = cloudTopHeight * opticalDepth *
          mix(0.78, 1.08, morphology);
        float radius = mix(cloudBottom, cloudTop, displacedHeight);
        vec3 localNormal = normalize(position);
        vec3 displacedPosition = localNormal * radius;
        vec3 localEast;
        vec3 localNorth;
        planetTangentFrame(localNormal, localEast, localNorth);
        vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
        mat3 worldRotation = mat3(modelMatrix);

        vDisplacedHeight = displacedHeight;
        vLocalPosition = displacedPosition;
        vUv = uv;
        vWorldNormal = normalize(worldRotation * localNormal);
        vWorldEast = normalize(worldRotation * localEast);
        vWorldNorth = normalize(worldRotation * localNorth);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudFieldMap;
      uniform vec3 cameraLocal;
      uniform float cloudIlluminationFloor;
      uniform float cloudBottom;
      uniform float cloudOffset;
      uniform float cloudTop;
      uniform float debugBoost;
      uniform float densityIntegrationScale;
      uniform vec3 lightColor;
      uniform vec3 lightDir;
      uniform float opacity;
      uniform float reliefLightingScale;
      uniform float reverseSun;
      uniform float reverseSunField;
      uniform float sunSampleScale;
      uniform float terminatorSoftness;
      uniform vec2 fieldUvOffset;

      varying float vDisplacedHeight;
      varying vec3 vLocalPosition;
      varying vec2 vUv;
      varying vec3 vViewDirection;
      varying vec3 vWorldEast;
      varying vec3 vWorldNormal;
      varying vec3 vWorldNorth;

      ${PLANET_LIGHTING_GLSL}

      vec2 wrapCloudUv(vec2 uv) {
        return vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
      }

      vec4 readCloudField(vec2 uv) {
        vec2 fieldUv = wrapCloudUv(uv);
        #ifdef PACKED_VIDEO_FIELD
          vec3 primary = texture2D(cloudFieldMap, vec2(fieldUv.x * 0.5, fieldUv.y)).rgb;
          float concavity = texture2D(
            cloudFieldMap,
            vec2(0.5 + fieldUv.x * 0.5, fieldUv.y)
          ).r;
          return vec4(primary, concavity);
        #else
          return texture2D(cloudFieldMap, fieldUv);
        #endif
      }

      vec2 directionToCloudUv(vec3 direction) {
        vec3 normal = normalize(direction);
        float longitude = atan(normal.z, normal.x);
        float latitude = asin(clamp(normal.y, -1.0, 1.0));
        return wrapCloudUv(vec2(
          0.5 - longitude / ${(Math.PI * 2).toFixed(8)} + fieldUvOffset.x + cloudOffset,
          latitude / ${Math.PI.toFixed(8)} + 0.5 + fieldUvOffset.y
        ));
      }

      vec2 tangentToCloudUvVector(vec2 tangent, float uvY) {
        float latitudeScale = max(cos((uvY - 0.5) * ${Math.PI.toFixed(8)}), 0.18);
        return normalize(vec2(tangent.x / max(2.0 * latitudeScale, 0.36), tangent.y));
      }

      bool raySphere(vec3 origin, vec3 direction, float radius, out float nearT, out float farT) {
        float b = dot(origin, direction);
        float c = dot(origin, origin) - radius * radius;
        float h = b * b - c;
        if (h < 0.0) {
          return false;
        }
        float root = sqrt(max(h, 0.0));
        nearT = -b - root;
        farT = -b + root;
        return farT > 0.0;
      }

      void main() {
        vec3 sphereNormal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(vViewDirection);
        vec3 sunDirection = normalize(mix(lightDir, -lightDir, step(0.5, reverseSun)));
        vec3 east = normalize(vWorldEast);
        vec3 north = normalize(vWorldNorth);
        float viewFacing = max(dot(sphereNormal, viewDirection), 0.0);
        float grazingView = 1.0 - viewFacing;
        float normalSunDot = dot(sphereNormal, sunDirection);
        PlanetLightMasks lightMasks = resolvePlanetLightMasks(
          normalSunDot,
          terminatorSoftness
        );

        vec2 baseUv = vec2(
          vUv.x + fieldUvOffset.x + cloudOffset,
          clamp(vUv.y + fieldUvOffset.y, 0.001, 0.999)
        );
        vec2 baseUvRaw = vec2(
          vUv.x + fieldUvOffset.x + cloudOffset,
          vUv.y + fieldUvOffset.y
        );
        float shellThickness = max(cloudTop - cloudBottom, 0.0001);
        vec3 localRayOrigin = cameraLocal;
        vec3 localRayDirection = normalize(vLocalPosition - cameraLocal);
        float topNear;
        float topFar;
        float bottomNear;
        float bottomFar;
        bool hitTop = raySphere(localRayOrigin, localRayDirection, cloudTop, topNear, topFar);
        bool hitBottom = raySphere(localRayOrigin, localRayDirection, cloudBottom, bottomNear, bottomFar);
        if (!hitTop) {
          discard;
        }
        float shellEntry = max(topNear, 0.0);
        float shellExit = hitBottom && bottomNear > shellEntry
          ? bottomNear
          : topFar;
        float shellPath = max(shellExit - shellEntry, shellThickness);
        float opticalPath = clamp(shellPath / shellThickness, 1.0, 6.2);
        vec4 accumulatedField = vec4(0.0);
        vec4 frontField = vec4(0.0);
        vec4 singleField = vec4(0.0);
        float accumulatedWeight = 0.0;
        float backMass = 0.0;
        float columnDensity = 0.0;
        float frontCaptured = 0.0;
        float frontMass = 0.0;
        float singleDensity = 0.0;
        float viewTransmittance = 1.0;

        // A fixed, shallow front-to-back integration gives the packed height
        // field an actual optical ordering through the thin cloud shell.
        // Samples behind an opaque front layer no longer remain equally visible.
        for (int i = 0; i < RELIEF_VIEW_STEPS; i += 1) {
          float layerDepth = (float(i) + 0.5) / float(RELIEF_VIEW_STEPS);
          vec3 samplePoint = localRayOrigin + localRayDirection *
            mix(shellEntry, shellExit, layerDepth);
          float sampleRadius = length(samplePoint);
          float layerHeight = clamp((sampleRadius - cloudBottom) / shellThickness, 0.0, 1.0);
          vec2 sampleUv = directionToCloudUv(samplePoint);
          vec4 sampleField = readCloudField(sampleUv);
          float sampleOpticalDepth = pow(clamp(sampleField.r, 0.0, 1.0), 1.18);
          float sampleTopHeight = smoothstep(0.025, 0.95, sampleField.g);
          float sampleMorphology = smoothstep(0.04, 0.86, sampleField.b);
          float sampleConcavity = smoothstep(0.03, 0.92, sampleField.a);
          float verticalBody = smoothstep(
            layerHeight - 0.2,
            layerHeight + 0.065,
            sampleTopHeight
          );
          float softBaseProfile = smoothstep(0.0, 0.26, layerHeight) *
            (1.0 - smoothstep(sampleTopHeight + 0.02, sampleTopHeight + 0.18, layerHeight));
          float heightErosion = mix(1.0, 0.68, sampleMorphology * smoothstep(0.18, 0.92, layerHeight));
          float concavityOcclusion = mix(1.0, 0.72, sampleConcavity * smoothstep(0.0, 0.58, layerHeight));
          float layerDensity = sampleOpticalDepth * verticalBody *
            max(softBaseProfile, 0.24) *
            heightErosion *
            mix(0.86, 1.16, sampleTopHeight) *
            concavityOcclusion;
          float layerOpticalDepth = layerDensity * opticalPath *
            opacity * 5.2 / float(RELIEF_VIEW_STEPS);
          float layerAlpha = 1.0 - exp(-layerOpticalDepth);
          float contribution = viewTransmittance * layerAlpha;
          float captureFront = (1.0 - step(0.5, frontCaptured)) *
            step(0.004, contribution);

          accumulatedField += sampleField * contribution;
          frontField = mix(frontField, sampleField, captureFront);
          frontCaptured += captureFront;
          accumulatedWeight += contribution;
          columnDensity += layerDensity / float(RELIEF_VIEW_STEPS);
          frontMass += contribution * (1.0 - layerDepth);
          backMass += contribution * layerDepth;
          viewTransmittance *= 1.0 - layerAlpha;

          if (i == RELIEF_VIEW_STEPS - 1) {
            singleField = sampleField;
            singleDensity = layerDensity;
          }
        }

        vec4 integratedField = accumulatedField / max(accumulatedWeight, 0.0001);
        float integratedMode = step(0.5, densityIntegrationScale);
        vec4 field = mix(singleField, integratedField, integratedMode);
        vec4 lightingField = mix(
          field,
          frontField,
          integratedMode * step(0.5, frontCaptured) * 0.44
        );
        float singleOpticalDepth = singleDensity * opticalPath * opacity * 5.3;
        float integratedAlpha = mix(
          1.0 - exp(-singleOpticalDepth),
          1.0 - viewTransmittance,
          integratedMode
        );
        columnDensity = mix(singleDensity, columnDensity, integratedMode);
        float massTotal = max(frontMass + backMass, 0.0001);
        float depthBalance = (frontMass - backMass) / massTotal;
        vec3 sunFieldDirection = normalize(mix(
          sunDirection,
          -sunDirection,
          step(0.5, reverseSunField)
        ));
        vec2 sunTangent = vec2(
          dot(sunFieldDirection, east),
          dot(sunFieldDirection, north)
        );
        float sunTangentLength = max(length(sunTangent), 0.001);
        vec2 sunDirectionUv = tangentToCloudUvVector(sunTangent, baseUv.y);
        float sunPath = clamp(sunTangentLength / max(abs(normalSunDot), 0.12), 0.0, 7.0);
        float sunSpan = clamp(
          shellThickness * (0.78 + sunPath * 2.85) / (${(Math.PI * 2).toFixed(8)} * cloudBottom),
          0.0015,
          0.024
        );
        vec4 sunField = readCloudField(baseUv + sunDirectionUv * sunSpan);
        float sunCoverage = pow(clamp(sunField.r, 0.0, 1.0), 1.18);
        float sunTopHeight = smoothstep(0.025, 0.95, sunField.g);
        float sunMorphology = smoothstep(0.04, 0.86, sunField.b);
        float sunConcavity = smoothstep(0.03, 0.92, sunField.a);
        float sampledSunColumnDensity = sunCoverage * sunTopHeight *
          mix(0.82, 1.2, sunTopHeight) *
          mix(0.86, 1.22, sunConcavity) *
          mix(1.05, 0.78, sunMorphology);
        float signedSunColumnDelta = (sampledSunColumnDensity - columnDensity) * sunSampleScale;
        float sunOpeningColumn = max(-signedSunColumnDelta, 0.0);
        float sunOcclusionColumn = max(signedSunColumnDelta, 0.0);
        float sunColumnDensity = columnDensity + sunOcclusionColumn * 0.82;

        float coverageWidth = max(fwidth(field.r) * 1.25, 0.004);
        float coverage = smoothstep(0.025 - coverageWidth, 0.66 + coverageWidth, field.r);
        float topHeight = smoothstep(0.035, 0.94, field.g);
        float morphology = smoothstep(0.04, 0.86, field.b);
        float concavity = smoothstep(0.03, 0.92, field.a);
        float cloudCore = smoothstep(0.36, 0.9, coverage * 0.52 + topHeight * 0.44 + concavity * 0.18);
        float lowSun = 1.0 - smoothstep(0.12, 0.64, max(normalSunDot, 0.0));
        float sunOcclusion = clamp(sunOcclusionColumn * (2.15 + lowSun * 1.45) *
          cloudCore, 0.0, 1.0);
        float sunOpening = clamp(sunOpeningColumn * (2.45 + lowSun * 1.25) *
          cloudCore, 0.0, 1.0);
        float columnRelief = clamp(
          (lightingField.g - columnDensity * 0.62) * 0.48 +
            depthBalance * 0.16,
          -0.3,
          0.36
        ) * reliefLightingScale;
        float heightDx = dFdx(lightingField.g);
        float heightDy = dFdy(lightingField.g);
        vec2 uvDx = dFdx(baseUvRaw);
        vec2 uvDy = dFdy(baseUvRaw);
        float uvDeterminant = uvDx.x * uvDy.y - uvDx.y * uvDy.x;
        vec2 uvGradient = abs(uvDeterminant) > 1e-6
          ? vec2(
              (heightDx * uvDy.y - heightDy * uvDx.y) / uvDeterminant,
              (heightDy * uvDx.x - heightDx * uvDy.x) / uvDeterminant
            )
          : vec2(0.0);
        float latitudeScale = max(cos((baseUvRaw.y - 0.5) * ${Math.PI.toFixed(8)}), 0.18);
        vec2 tangentNormal = vec2(
          -uvGradient.x / max(2.0 * latitudeScale, 0.36),
          uvGradient.y
        ) *
          (0.08 * reliefLightingScale) *
          mix(0.72, 1.18, morphology);
        float normalZ = sqrt(max(1.0 - min(dot(tangentNormal, tangentNormal), 0.84), 0.16));
        vec3 shapedNormal = normalize(
          east * tangentNormal.x + north * tangentNormal.y + sphereNormal * normalZ
        );
        float shapedSun = max(dot(shapedNormal, sunDirection), 0.0);

        float lightOcclusion = (columnDensity * 0.46 + sunColumnDensity * 0.72) *
          mix(0.46, 1.18, cloudCore) *
          mix(0.78, 1.28, max(-depthBalance, 0.0));
        float morphologyShadow = smoothstep(0.18, 0.72, morphology + concavity * 0.42);
        float slopeSelfShadow = morphologyShadow *
          cloudCore * sunSampleScale * mix(0.24, 1.08, lowSun);
        lightOcclusion += slopeSelfShadow;
        lightOcclusion += sunOcclusion * mix(0.18, 0.54, lowSun);
        float opposingSunFieldShadow = smoothstep(0.1, 0.58, normalSunDot) *
          smoothstep(0.08, 0.58, -dot(sphereNormal, sunFieldDirection)) *
          cloudCore * sunSampleScale;
        lightOcclusion += opposingSunFieldShadow * 1.58;
        float lightTransmittance = exp(
          -lightOcclusion * mix(0.95, 4.25, lowSun) *
            mix(0.66, 1.08, cloudCore)
        );

        float sunFieldFacing = dot(sphereNormal, sunFieldDirection);
        float sunFieldTopLight = smoothstep(0.04, 0.58, sunFieldFacing) *
          cloudCore * sunSampleScale * lightTransmittance *
          (1.0 - step(0.5, reverseSunField));
        float topExposure = lightMasks.dayMask * lightTransmittance *
          (0.12 + shapedSun * 0.88) * (0.24 + topHeight * 0.76) *
          mix(1.0, 0.82, concavity);
        topExposure += sunFieldTopLight * 0.16;
        float towerLight = max(columnRelief, 0.0) * shapedSun *
          lightMasks.dayMask * lightTransmittance;
        float cavityShade = max(-columnRelief, 0.0) * cloudCore *
          (0.34 + (1.0 - shapedSun) * 0.66);
        float sunSideShadow = smoothstep(0.08, 0.72, sunColumnDensity - columnDensity * 0.24) *
          cloudCore * (1.0 - shapedSun) * mix(0.42, 1.0, lowSun);
        topExposure += towerLight * 0.09;
        topExposure += sunOpening * 0.92 *
          lightMasks.dayMask * lightTransmittance;
        float sideShadow = (1.0 - shapedSun) * cloudCore *
          (0.14 + (1.0 - lightTransmittance) * 0.58 + concavity * 0.2);
        sideShadow += sunSideShadow * 0.3;
        sideShadow += sunOcclusion * mix(0.2, 0.5, lowSun);
        sideShadow += cavityShade * 0.1;
        float underside = (1.0 - smoothstep(0.16, 0.76, vDisplacedHeight)) *
          cloudCore * (0.1 + grazingView * 0.14 + concavity * 0.24);
        vec3 shadowColor = vec3(0.2, 0.25, 0.32);
        vec3 middleColor = vec3(0.5, 0.56, 0.6);
        vec3 topColor = vec3(0.86, 0.88, 0.86) * lightColor;
        vec3 cloudColor = mix(shadowColor, middleColor, 0.3 + lightTransmittance * 0.44);
        cloudColor = mix(cloudColor, topColor, clamp(topExposure, 0.0, 0.57));
        float coreDepth = cloudCore * topHeight *
          (0.16 + (1.0 - lightTransmittance) * 0.48 + (1.0 - shapedSun) * 0.22);
        cloudColor *= 1.0 - sideShadow * 0.52 - underside * 0.32 - coreDepth * 0.36;
        // The packed normal already affects shapedSun. Keep the independent
        // height response subtle so the same relief is not embossed twice.
        cloudColor *= 1.0 + towerLight * 0.035 - cavityShade * 0.055;
        cloudColor *= 1.0 + sunOpening * lightMasks.dayMask * lightTransmittance * 0.72;
        cloudColor *= 1.0 - sunOcclusion * mix(0.1, 0.26, lowSun);
        cloudColor *= mix(0.84, 1.12, topHeight) * mix(1.0, 0.9, concavity);

        float forwardScatter = pow(max(dot(-viewDirection, sunDirection), 0.0), 7.0);
        float controlledSilver = forwardScatter * pow(grazingView, 2.35) *
          max(lightMasks.dayMask, lightMasks.twilightMask * 0.72) *
          mix(lightTransmittance, 1.0, 0.28) *
          smoothstep(0.18, 0.82, coverage) * (1.0 - cloudCore * 0.58);
        cloudColor += vec3(0.72, 0.82, 0.94) * controlledSilver * 0.11;
        cloudColor += vec3(0.36, 0.105, 0.025) *
          lightMasks.twilightMask * lightTransmittance * 0.045;
        float illuminationVisibility = clamp(
          cloudIlluminationFloor + lightMasks.dayMask * (1.0 - cloudIlluminationFloor) +
            lightMasks.twilightMask * 0.18,
          cloudIlluminationFloor,
          1.0
        );
        cloudColor *= illuminationVisibility * (1.0 + debugBoost * 0.16);
        cloudColor *= 1.035;

        float alpha = integratedAlpha;
        alpha *= smoothstep(0.0003, 0.006, columnDensity);
        alpha += cloudCore * smoothstep(0.025, 0.22, columnDensity) *
          lightMasks.dayMask * opacity * 0.18;
        alpha *= mix(0.9, 1.08, cloudCore);
        alpha *= mix(0.84, 1.0, lightMasks.dayMask + lightMasks.twilightMask * 0.35);
        alpha = clamp(alpha, 0.0, 0.92);
        gl_FragColor = vec4(max(cloudColor, vec3(0.0)) * alpha, alpha);
      }
    `,
    blending: NormalBlending,
    depthTest: true,
    depthWrite: false,
    premultipliedAlpha: true,
    side: FrontSide,
    transparent: true
  });
}

export function LandingReliefCloud({
  assets,
  composition,
  emphasis = false,
  lightingFrame,
  quality
}: LandingReliefCloudProps) {
  const cloud = useRef<Mesh>(null);
  const { camera, gl } = useThree();
  const visualTestOverridesEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("visualTest") === "pixels";
  }, []);
  const visualTestCloudOffset = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("visualTest") !== "pixels") {
      return undefined;
    }
    const value = Number.parseFloat(params.get("cloudOffset") ?? "");
    return Number.isFinite(value) ? MathUtils.euclideanModulo(value, 1) : undefined;
  }, []);
  const visualTestCloudOpacityScale = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("visualTest") !== "pixels") {
      return undefined;
    }
    const value = Number.parseFloat(params.get("cloudOpacityScale") ?? "");
    return Number.isFinite(value) ? MathUtils.clamp(value, 0, 1) : undefined;
  }, []);
  const mobile = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return isLandingReliefLiteMobileViewport(
      window.innerWidth,
      window.innerHeight,
      navigator.maxTouchPoints
    );
  }, []);
  const gpuTimerEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("visualTest") === "performance" ||
      params.get("reliefLiteGpuTimer") === "on" ||
      params.get("reliefLiteValidation") === "on";
  }, []);
  const gpuTimer = useMemo(
    () => createLandingGpuTimer(gl.getContext(), gpuTimerEnabled),
    [gl, gpuTimerEnabled]
  );
  const budget = resolveLandingReliefLiteBudget(mobile);
  const cloudField = assets.earthCloudField;
  const { failed, texture } = useLandingTexture(cloudField?.src, {
    anisotropy: 4,
    colorSpace: cloudField?.colorSpace ?? "linear",
    fallbackSrc: cloudField?.format === "ktx2" ? RELIEF_CLOUD_PNG_FALLBACK : undefined,
    renderer: gl,
    wrapS: RepeatWrapping,
    wrapT: ClampToEdgeWrapping
  });
  const cloudBottom = composition.earth.radius * LANDING_RELIEF_LITE_CLOUD_BOTTOM_SCALE;
  const cloudTop = composition.earth.radius * LANDING_RELIEF_LITE_CLOUD_TOP_SCALE;
  const geometrySegments = resolveLandingReliefCloudGeometrySegments(quality, mobile);
  const material = useMemo(
	    () => texture
	      ? createLandingReliefCloudMaterial({
	        cloudBottom,
	        cloudTop,
	        composition,
	        viewSteps: budget.viewSteps,
	        texture
	      })
	      : null,
	    [budget.viewSteps, cloudBottom, cloudTop, composition, texture]
	  );
  const enabled = Boolean(
    material && texture && !failed && composition.earth.useClouds && quality.tier !== "fallback"
  );

  useEffect(() => () => material?.dispose(), [material]);
  useEffect(() => () => gpuTimer.dispose(), [gpuTimer]);
  useEffect(() => () => {
    window.__MiraLithLuBirthReliefCloud = undefined;
  }, []);

  useFrame(() => {
    if (!cloud.current || !material || !texture || !cloudField) {
      return;
    }

    const cloudMaterial = cloud.current.material as ShaderMaterial;
    const compressedTextureActive = Boolean(
      (texture as Texture & { isCompressedTexture?: boolean }).isCompressedTexture
    );
    const visualTestOverride = visualTestOverridesEnabled
      ? window.__MiraLithLuBirthReliefCloudOverride
      : undefined;
    const activeCloudOffset = visualTestOverride?.cloudOffset === undefined
      ? visualTestCloudOffset ?? lightingFrame.cloudOffsetRef.current
      : MathUtils.euclideanModulo(visualTestOverride.cloudOffset, 1);
    cloud.current.rotation.set(0, MathUtils.degToRad(composition.earth.yawDeg), 0);
    cloud.current.updateWorldMatrix(true, false);
    camera.getWorldPosition(cloudCameraWorld);
    cloudCameraLocal.copy(cloudCameraWorld);
    cloud.current.worldToLocal(cloudCameraLocal);
    cloudMaterial.uniforms.cameraLocal.value.copy(cloudCameraLocal);
    cloudMaterial.uniforms.cloudOffset.value = activeCloudOffset;
    cloudMaterial.uniforms.debugBoost.value = emphasis ? 1 : 0;
    cloudMaterial.uniforms.densityIntegrationScale.value = MathUtils.clamp(
      visualTestOverride?.densityIntegrationScale ?? 1,
      0,
      1
    );
    cloudMaterial.uniforms.lightDir.value.copy(lightingFrame.sunDirection).normalize();
    cloudMaterial.uniforms.opacity.value = composition.earth.cloudOpacity * MathUtils.clamp(
      visualTestOverride?.cloudOpacityScale ?? visualTestCloudOpacityScale ?? 1,
      0,
      1
    );
    cloudMaterial.uniforms.reliefLightingScale.value = MathUtils.clamp(
      visualTestOverride?.reliefLightingScale ?? 1,
      0,
      1
    );
    cloudMaterial.uniforms.reverseSun.value = visualTestOverride?.reverseSun ? 1 : 0;
    cloudMaterial.uniforms.reverseSunField.value = visualTestOverride?.reverseSunField ? 1 : 0;
    cloudMaterial.uniforms.sunSampleScale.value = MathUtils.clamp(
      visualTestOverride?.sunSampleScale ?? 1,
      0,
      1
    );

    window.__MiraLithLuBirthReliefCloud = {
      active: true,
      analyticNoise: false,
      cloudBottomScale: LANDING_RELIEF_LITE_CLOUD_BOTTOM_SCALE,
      cloudOffset: activeCloudOffset,
      cloudTopScale: LANDING_RELIEF_LITE_CLOUD_TOP_SCALE,
      compressedTextureActive,
      channelLayout: "v3-r-depth-g-height-b-morphology-a-concavity",
      densityIntegration: "front-to-back",
      estimatedActiveTextureBytes: estimateTextureBytes(
        cloudField.width,
        cloudField.height,
        compressedTextureActive
      ),
      fragmentTextureReads: budget.textureReads,
      gpuTimer: gpuTimer.poll(),
      integrationPath: "ray-sphere-thin-shell",
      lodTransitions: false,
      mobile,
      premultipliedAlpha: true,
      rendererTextureCount: gl.info.memory.textures,
      shellCount: 1,
      sunDirection: [
        lightingFrame.sunDirection.x,
        lightingFrame.sunDirection.y,
        lightingFrame.sunDirection.z
      ],
      textureCompression: compressedTextureActive ? "uastc" : "rgba8",
	      textureSource: cloudField.src,
	      textureUuid: texture.uuid,
	      sunSteps: LANDING_RELIEF_LITE_SUN_STEPS,
	      thinShellIntegration: true,
	      vertexTextureReads: 1,
	      viewSteps: budget.viewSteps
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
      onBeforeRender={gpuTimerEnabled ? gpuTimer.begin : undefined}
      onAfterRender={gpuTimerEnabled ? gpuTimer.end : undefined}
    >
      <sphereGeometry
        args={[
          composition.earth.radius,
          geometrySegments.width,
          geometrySegments.height
        ]}
      />
    </mesh>
  );
}
