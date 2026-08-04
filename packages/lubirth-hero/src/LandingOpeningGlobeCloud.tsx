"use client";

import { useEffect, useMemo } from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  NoColorSpace,
  RepeatWrapping,
  VideoTexture
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import {
  LandingReliefCloudShell,
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
  bottomScale: number;
  cloudIlluminationFloor: number;
  debugBoost: number;
  fieldPacking: "left-rgb-right-concavity";
  frame: number;
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
    <LandingReliefCloudShell
      composition={composition}
      fieldDecoder={policy.fieldDecoder}
      fieldTexture={texture}
      fieldUvOffset={[0, 0]}
      lightingFrame={lightingFrame}
      mobile={layer.mobile}
      onFrame={({ texture: activeTexture }) => {
        window.__MiraLithLuBirthOpeningGlobeCloud = {
          active: true,
          attachment: "earth-group",
          bottomScale: policy.bottomScale,
          cloudIlluminationFloor: policy.cloudIlluminationFloor,
          debugBoost: policy.debugBoost,
          fieldPacking: "left-rgb-right-concavity",
          frame: layer.frame,
          mapping: "equirectangular-earth-uv",
          mobile: layer.mobile,
          opacity: policy.opacity,
          reliefLightingScale: policy.reliefLightingScale,
          sunSteps: policy.sunSteps,
          textureColorSpace: policy.textureColorSpace,
          textureUuid: activeTexture.uuid,
          textureVersion: activeTexture.version,
          topScale: policy.topScale,
          viewSteps: policy.viewSteps
        };
      }}
      policy={policy}
      quality={quality}
      renderOrder={4}
      runtime={{
        cloudOffset: 0,
        cloudIlluminationFloor: policy.cloudIlluminationFloor,
        debugBoost: policy.debugBoost,
        opacity: policy.opacity,
        reliefLightingScale: policy.reliefLightingScale
      }}
    />
  );
}
