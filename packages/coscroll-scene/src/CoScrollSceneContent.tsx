"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useMemo, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import type { CoScrollFallbackReason, CoScrollSceneContentProps } from "./types";
import { CoScrollCausticLightField } from "./CoScrollCausticLightField";
import { CoScrollJadeAnchor, preloadCoScrollAnchorGeometry } from "./CoScrollJadeAnchor";
import { CoScrollSilkBackground } from "./CoScrollSilkBackground";
import { CoScrollTextBillboard } from "./CoScrollTextBillboard";
import { createCoScrollLayeredLyrics, type CoScrollLayeredLyricItem } from "./createCoScrollLayeredLyrics";
import { createCoScrollVisualState } from "./createCoScrollVisualState";

interface CoScrollAssetBoundaryProps {
  children: ReactNode;
  onFallback?: (reason: CoScrollFallbackReason) => void;
}

interface CoScrollAssetBoundaryState {
  failed: boolean;
}

const SOURCE_MATCH_DESKTOP_FONT_SIZE = 0.5;
const SOURCE_MATCH_MOBILE_FONT_SIZE = 0.4;
const SOURCE_MATCH_DESKTOP_Y_LIFT = 0.34;
const SOURCE_MATCH_MODEL_SCALE = 2.8 * 1.2 * 1.1;

class CoScrollAssetBoundary extends Component<CoScrollAssetBoundaryProps, CoScrollAssetBoundaryState> {
  state: CoScrollAssetBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFallback?.("asset-failed");
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function CoScrollSceneContent({
  progress,
  active,
  quality,
  reducedMotion = false,
  timeline,
  assets,
  scrollVelocity = 0,
  paused = false,
  viewport = "desktop",
  onReady,
  onFallback
}: CoScrollSceneContentProps) {
  const sourceMatchMode = quality.reason === "source-match";
  const mobileSourceMatch = sourceMatchMode && viewport === "mobile";
  const { gl, viewport: sceneViewport } = useThree();

  useEffect(() => {
    if (!sourceMatchMode) {
      return;
    }

    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    const previousOutputColorSpace = gl.outputColorSpace;

    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.12;
    gl.outputColorSpace = THREE.SRGBColorSpace;

    return () => {
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousExposure;
      gl.outputColorSpace = previousOutputColorSpace;
    };
  }, [gl, sourceMatchMode]);

  useFrame(({ camera }) => {
    if (!active) {
      return;
    }

    camera.position.set(0, 0, sourceMatchMode ? 12 : 7.2);
    camera.lookAt(0, 0, 0);
    if (camera instanceof THREE.OrthographicCamera) {
      const targetZoom = mobileSourceMatch ? 92 : 100;
      if (camera.zoom !== targetZoom) {
        camera.zoom = targetZoom;
        camera.updateProjectionMatrix();
      }
      return;
    }

    const targetFov = 42;
    if ("fov" in camera && camera.fov !== targetFov) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  }, -2);

  const state = useMemo(
    () =>
      createCoScrollVisualState({
        progress,
        active,
        qualityTier: quality.tier,
        reducedMotion,
        timeline,
        assets,
        scrollVelocity
      }),
    [active, assets, progress, quality.tier, reducedMotion, scrollVelocity, timeline]
  );
  const layeredLyrics = useMemo(
    () =>
      createCoScrollLayeredLyrics({
        lyrics: timeline.lyricSegments,
        visualTime: state.visualTime,
        duration: state.duration,
        options: {
          range: sourceMatchMode ? (mobileSourceMatch ? 3 : 6) : quality.tier === "low" ? 4 : 6,
          horizontalOffset: sourceMatchMode ? (mobileSourceMatch ? 0.65 : 1.24) : undefined,
          travelSpacing: sourceMatchMode ? (mobileSourceMatch ? 0.62 : 0.96) : quality.tier === "low" ? 0.82 : 1,
          topLaneY: sourceMatchMode ? (mobileSourceMatch ? 2.62 : 2.72) : quality.tier === "low" ? 2.05 : 2.45,
          bottomLaneY: sourceMatchMode ? (mobileSourceMatch ? -1.34 : -2.56) : quality.tier === "low" ? -1.95 : -2.32,
          frontDepth: sourceMatchMode ? 6 : 0.78,
          backNearDepth: sourceMatchMode ? -1.85 : -1.2,
          backFarDepth: sourceMatchMode ? -3.25 : -2.08,
          edgeFeatherStart: sourceMatchMode ? (mobileSourceMatch ? 0.26 : 0.28) : undefined,
          edgeFadeStart: sourceMatchMode ? (mobileSourceMatch ? 0.42 : 0.48) : undefined,
          edgeFeatherExponent: sourceMatchMode ? (mobileSourceMatch ? 0.9 : 0.85) : undefined
        }
      }),
    [mobileSourceMatch, quality.tier, sourceMatchMode, state.duration, state.visualTime, timeline.lyricSegments]
  );
  const sourceCausticLyricCenters = useMemo<[number, number, number, number]>(() => {
    const fallback: [number, number, number, number] = [-0.43, -0.18, 0.08, 0.35];
    if (!sourceMatchMode) {
      return fallback;
    }

    const visibleColumns = [...layeredLyrics.back, ...layeredLyrics.front]
      .filter((line) => line.opacity > 0.08 && line.edgeFeather < 0.92)
      .sort((a, b) => a.x - b.x);
    if (visibleColumns.length === 0) {
      return fallback;
    }

    const halfWidth = Math.max(0.01, sceneViewport.width * 0.5);
    const sampleAt = (ratio: number) => {
      const index = Math.min(visibleColumns.length - 1, Math.round((visibleColumns.length - 1) * ratio));
      return Math.max(-0.92, Math.min(0.92, visibleColumns[index].x / halfWidth));
    };
    return [sampleAt(0.14), sampleAt(0.38), sampleAt(0.62), sampleAt(0.86)];
  }, [layeredLyrics, sceneViewport.width, sourceMatchMode]);
  const currentAnchorAsset = useMemo(
    () => assets.anchors.find((asset) => asset.id === state.currentAnchor),
    [assets.anchors, state.currentAnchor]
  );

  useEffect(() => {
    if (quality.tier === "fallback") {
      onFallback?.("quality-tier");
    }
  }, [onFallback, quality.tier]);

  useEffect(() => {
    if (!sourceMatchMode || !active) {
      return;
    }

    assets.anchors.forEach((anchor) => {
      preloadCoScrollAnchorGeometry(anchor.modelSrc, true);
    });
  }, [active, assets.anchors, sourceMatchMode]);

  useEffect(() => {
    if (!state.shouldLoadModel) {
      return;
    }

    if (!currentAnchorAsset) {
      onFallback?.("asset-failed");
    }
  }, [currentAnchorAsset, onFallback, state.shouldLoadModel]);

  const renderStaticReducedScene = state.fallbackMode === "dom-static";

  if (quality.tier === "fallback" || (!active && !renderStaticReducedScene)) {
    return null;
  }

  const lyricYOffset = sourceMatchMode ? (mobileSourceMatch ? -0.02 : -0.82 + SOURCE_MATCH_DESKTOP_Y_LIFT) : 0;
  const renderLyric = (line: CoScrollLayeredLyricItem) => {
    const isFront = line.layer === "front";
    const sourceLayerOpacity =
      isFront
        ? (line.isCurrent ? 0.58 : 0.5)
        : line.layer === "back-near"
          ? (line.isCurrent ? 0.56 : 0.46)
          : 0.36;
    const layerOpacity = sourceMatchMode ? sourceLayerOpacity : isFront ? state.frontLayerOpacity : state.backLayerOpacity;
    const sourceCurrentFrontLift = sourceMatchMode && isFront && line.isCurrent ? (mobileSourceMatch ? -0.1 : 0.02) : 0;

    return (
      <CoScrollTextBillboard
        key={line.key}
        text={line.text}
        position={[line.x, line.y + lyricYOffset + sourceCurrentFrontLift, line.z]}
        opacity={line.opacity * layerOpacity}
        fontSize={
          sourceMatchMode
            ? mobileSourceMatch
              ? SOURCE_MATCH_MOBILE_FONT_SIZE
              : SOURCE_MATCH_DESKTOP_FONT_SIZE
            : quality.tier === "low"
              ? 0.38
              : 0.48
        }
        layer={isFront ? "front" : "back"}
        current={line.isCurrent}
        emphasis={line.emphasis}
        verticalAlign={line.verticalAlign}
        edgeFeather={line.edgeFeather}
        scale={line.scale}
        sourceFont={sourceMatchMode}
        depthTest
        depthWrite
        renderOrder={line.renderOrder}
      />
    );
  };

  return (
    <>
      {sourceMatchMode ? null : <color attach="background" args={["#010205"]} />}
      {sourceMatchMode ? null : <fog attach="fog" args={["#070707", 7.5, 24]} />}
      <ambientLight intensity={sourceMatchMode ? 0.4 : 0.34} color={sourceMatchMode ? "#ffffff" : "#d9fbff"} />
      <directionalLight
        position={sourceMatchMode ? [2, 2, 2] : [3.4, 3.8, 5.2]}
        intensity={sourceMatchMode ? 1.2 : 1.12}
        color={sourceMatchMode ? "#ffffff" : "#e7fbff"}
      />
      <pointLight
        position={sourceMatchMode ? [-2, 2, -2] : [-2.8, -1.8, 2.8]}
        intensity={sourceMatchMode ? 0.3 : 0.48}
        color={sourceMatchMode ? "#4A90E2" : "#7ed6e8"}
      />
      {sourceMatchMode ? null : (
        <CoScrollSilkBackground
          active={active}
          paused={paused}
          reducedMotion={reducedMotion}
          opacity={state.backgroundIntensity}
        />
      )}
      <CoScrollCausticLightField
        active={active}
        paused={paused}
        reducedMotion={reducedMotion}
        sourceMatch={sourceMatchMode}
        layout={viewport}
        opacity={
          sourceMatchMode
            ? state.backgroundIntensity * (mobileSourceMatch ? 0.76 : 0.82)
            : state.backgroundIntensity * (quality.tier === "low" ? 0.12 : 0.2)
        }
        anchorPresence={state.shouldLoadModel ? 1 : 0.45}
        scrollVelocity={state.scrollVelocity}
        lyricCenters={sourceCausticLyricCenters}
        positionZ={sourceMatchMode ? -5.05 : -5.22}
      />

      <group renderOrder={2000}>{layeredLyrics.back.map(renderLyric)}</group>

      {state.shouldLoadModel && currentAnchorAsset ? (
        <CoScrollAssetBoundary onFallback={onFallback}>
          <CoScrollJadeAnchor
            modelSrc={currentAnchorAsset.modelSrc}
            materialPreset={currentAnchorAsset.materialPreset}
            position={sourceMatchMode ? [0, mobileSourceMatch ? 0.95 : -0.41 + SOURCE_MATCH_DESKTOP_Y_LIFT, 0] : [0, 0, 0]}
            scale={
              sourceMatchMode
                ? mobileSourceMatch
                  ? 2.2 * 1.2 * 1.1
                  : SOURCE_MATCH_MODEL_SCALE
                : quality.tier === "low"
                  ? 0.9
                  : 1
            }
            scrollVelocity={state.scrollVelocity}
            reducedMotion={reducedMotion}
            paused={paused}
            baseSpeed={sourceMatchMode ? -0.32 : undefined}
            velocityMultiplier={sourceMatchMode ? -7.5 : undefined}
            deterministicPose={sourceMatchMode && paused}
            sourceMaterial={sourceMatchMode}
            renderOrder={sourceMatchMode ? 2600 : undefined}
            listenToScrollInput={!sourceMatchMode}
            onReady={onReady}
            onFallback={onFallback}
          />
        </CoScrollAssetBoundary>
      ) : null}

      <group renderOrder={3300}>{layeredLyrics.front.map(renderLyric)}</group>
    </>
  );
}
