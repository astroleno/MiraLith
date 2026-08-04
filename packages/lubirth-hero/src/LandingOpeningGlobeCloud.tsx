"use client";

import { useEffect, useMemo } from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  MathUtils,
  NoColorSpace,
  RepeatWrapping,
  VideoTexture
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import {
  LandingReliefCloudShell,
  resolveOpeningCloudDetailOpacity,
  resolveOpeningGlobeCloudFieldUvOffset,
  resolveOpeningGlobeCloudShellPolicy
} from "./LandingReliefCloudShell";
import type { LandingPlanetLightingFrame } from "./landingPlanetLighting";
import type { LandingComposition, LandingOpeningCloudLayer } from "./types";

interface LandingOpeningGlobeCloudProps {
  composition: LandingComposition;
  layer: LandingOpeningCloudLayer;
  lightingFrame: LandingPlanetLightingFrame;
  quality: QualityProfile;
}

interface LandingOpeningGlobeCloudTelemetry {
  active: true;
  attachment: "earth-group";
  base: "persistent-relief-lite";
  bottomScale: number;
  bodyBottomScale: number;
  bodyOpacity: number;
  bodyOpacityFloor: number;
  bodyTopScale: number;
  cloudOffset: number;
  cloudIlluminationFloor: number;
  debugBoost: number;
  detailOpacity: number;
  fieldPacking: "left-rgb-right-concavity";
  frame: number;
  layerCount: 3;
  mapping: "equirectangular-earth-uv";
  mobile: boolean;
  opacity: number;
  reliefLightingScale: number;
  sunSteps: 1;
  textureColorSpace: "none";
  textureUuid: string;
  textureVersion: number;
  topScale: number;
  viewSteps: 2 | 3;
  wispBottomScale: number;
  wispOpacity: number;
  wispTopScale: number;
}

declare global {
  interface Window {
    __MiraLithLuBirthOpeningGlobeCloud?: LandingOpeningGlobeCloudTelemetry;
  }
}

export function LandingOpeningGlobeCloud({
  composition,
  layer,
  lightingFrame,
  quality
}: LandingOpeningGlobeCloudProps) {
  const policy = useMemo(
    () => resolveOpeningGlobeCloudShellPolicy(layer.mobile),
    [layer.mobile]
  );
  const bodyOpacity = resolveOpeningCloudDetailOpacity(layer.frame, policy.body.opacity);
  const wispOpacity = resolveOpeningCloudDetailOpacity(layer.frame, policy.wisps.opacity);
  const fieldUvOffset = resolveOpeningGlobeCloudFieldUvOffset();
  const texture = useMemo(() => {
    const next = new VideoTexture(layer.video);
    next.colorSpace = NoColorSpace;
    next.generateMipmaps = false;
    next.wrapS = RepeatWrapping;
    next.wrapT = ClampToEdgeWrapping;
    next.minFilter = LinearFilter;
    next.magFilter = LinearFilter;
    return next;
  }, [layer.video]);

  useEffect(() => () => {
    texture.dispose();
  }, [texture]);
  // The controller arms frame zero before this component mounts. VideoTexture
  // begins listening only after mount, so mark the already-decoded still frame
  // dirty explicitly; otherwise the opening can show an empty field until the
  // first scroll-driven seek happens.
  useEffect(() => {
    texture.needsUpdate = true;
  }, [layer.frame, texture]);
  useEffect(() => () => {
    window.__MiraLithLuBirthOpeningGlobeCloud = undefined;
  }, []);

  if (!layer.active) return null;

  return (
    <>
      <LandingReliefCloudShell
        composition={composition}
        fieldDecoder={policy.fieldDecoder}
        fieldTexture={texture}
        fieldUvOffset={fieldUvOffset}
        lightingFrame={lightingFrame}
        mobile={layer.mobile}
        onFrame={({ texture: activeTexture }) => {
          window.__MiraLithLuBirthOpeningGlobeCloud = {
            active: true,
            attachment: "earth-group",
            base: "persistent-relief-lite",
            bottomScale: policy.body.bottomScale,
            bodyBottomScale: policy.body.bottomScale,
            bodyOpacity,
            bodyOpacityFloor: policy.body.baseOpacityFloor,
            bodyTopScale: policy.body.topScale,
            cloudOffset: MathUtils.euclideanModulo(lightingFrame.cloudOffsetRef.current, 1),
            cloudIlluminationFloor: policy.cloudIlluminationFloor,
            debugBoost: policy.debugBoost,
            detailOpacity: Math.max(bodyOpacity, wispOpacity),
            fieldPacking: "left-rgb-right-concavity",
            frame: layer.frame,
            layerCount: 3,
            mapping: "equirectangular-earth-uv",
            mobile: layer.mobile,
            opacity: bodyOpacity,
            reliefLightingScale: policy.reliefLightingScale,
            sunSteps: policy.sunSteps,
            textureColorSpace: policy.textureColorSpace,
            textureUuid: activeTexture.uuid,
            textureVersion: activeTexture.version,
            topScale: policy.wisps.topScale,
            viewSteps: policy.body.viewSteps,
            wispBottomScale: policy.wisps.bottomScale,
            wispOpacity,
            wispTopScale: policy.wisps.topScale
          };
        }}
        policy={policy.body}
        quality={quality}
        renderOrder={4}
        runtime={{
          cloudBodyOpacityFloor: policy.body.baseOpacityFloor,
          cloudHeightBand: [0.04, 0.8],
          cloudIlluminationFloor: policy.cloudIlluminationFloor,
          cloudOffsetRef: lightingFrame.cloudOffsetRef,
          cloudOpacityCeiling: 0.97,
          debugBoost: policy.debugBoost,
          opacity: bodyOpacity,
          reliefLightingScale: policy.reliefLightingScale
        }}
      />
      <LandingReliefCloudShell
        composition={composition}
        fieldDecoder={policy.fieldDecoder}
        fieldTexture={texture}
        fieldUvOffset={fieldUvOffset}
        lightingFrame={lightingFrame}
        mobile={layer.mobile}
        policy={policy.wisps}
        quality={quality}
        renderOrder={5}
        runtime={{
          cloudHeightBand: [0.64, 0.98],
          cloudIlluminationFloor: policy.cloudIlluminationFloor,
          cloudOffsetRef: lightingFrame.cloudOffsetRef,
          cloudOpacityCeiling: 0.82,
          debugBoost: policy.debugBoost * 0.48,
          opacity: wispOpacity,
          reliefLightingScale: policy.reliefLightingScale * 0.9
        }}
      />
    </>
  );
}
