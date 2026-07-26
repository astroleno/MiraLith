"use client";

import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactNode
} from "react";
import * as THREE from "three";
import type { CoScrollFallbackReason, CoScrollSceneContentProps } from "./types";
import { CoScrollCausticLightField } from "./CoScrollCausticLightField";
import { CoScrollJadeAnchor, preloadCoScrollAnchorGeometry } from "./CoScrollJadeAnchor";
import { CoScrollSilkBackground } from "./CoScrollSilkBackground";
import { CoScrollTextBillboard, preloadCoScrollSourceFont } from "./CoScrollTextBillboard";
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
  readinessGeneration = "default",
  onReadinessGenerationChange,
  onReady,
  onFallback
}: CoScrollSceneContentProps) {
  const sourceMatchMode = quality.reason === "source-match";
  const mobileSourceMatch = sourceMatchMode && viewport === "mobile";
  const { gl } = useThree();
  const sourceAnchorPosition: [number, number, number] = [
    0,
    mobileSourceMatch ? 0.95 : -0.41 + SOURCE_MATCH_DESKTOP_Y_LIFT,
    0
  ];
  const sourceAnchorScale = mobileSourceMatch
    ? 2.2 * 1.2 * 1.1
    : SOURCE_MATCH_MODEL_SCALE;

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
  const currentAnchorAsset = useMemo(
    () => assets.anchors.find((asset) => asset.id === state.currentAnchor),
    [assets.anchors, state.currentAnchor]
  );
  const anchorReadinessGeneration = [
    readinessGeneration,
    state.currentAnchor,
    currentAnchorAsset?.modelSrc ?? "missing",
    state.shouldLoadModel ? "model" : "static"
  ].join("|");
  const readinessRef = useRef({
    generation: anchorReadinessGeneration,
    silk: false,
    anchor: !state.shouldLoadModel,
    font: !sourceMatchMode,
    frame: false,
    reported: false
  });
  const pendingFrameGenerationRef = useRef<string | null>(null);
  if (readinessRef.current.generation !== anchorReadinessGeneration) {
    readinessRef.current = {
      generation: anchorReadinessGeneration,
      silk: readinessRef.current.silk,
      anchor: !state.shouldLoadModel,
      font: !sourceMatchMode,
      frame: false,
      reported: false
    };
  }
  useLayoutEffect(() => {
    onReadinessGenerationChange?.(anchorReadinessGeneration);
  }, [anchorReadinessGeneration, onReadinessGenerationChange]);
  const markReadyPart = useCallback((
    part: "silk" | "anchor" | "font" | "frame",
    reportedGeneration = anchorReadinessGeneration
  ) => {
    if (readinessRef.current.generation !== reportedGeneration) {
      return;
    }
    const wasReady = readinessRef.current[part];
    readinessRef.current[part] = true;
    if (!wasReady && typeof performance !== "undefined") {
      performance.mark(`miralith:coscroll-readiness:${reportedGeneration}:${part}`);
    }
    if (part !== "frame" && !wasReady) {
      readinessRef.current.frame = false;
    }
    const readiness = readinessRef.current;
    if (
      !readiness.reported &&
      readiness.silk &&
      readiness.anchor &&
      readiness.font &&
      readiness.frame
    ) {
      readiness.reported = true;
      onReady?.(reportedGeneration);
    }
  }, [anchorReadinessGeneration, onReady]);
  const reportFallback = useCallback((
    reason: CoScrollFallbackReason,
    reportedGeneration = anchorReadinessGeneration
  ) => {
    if (readinessRef.current.generation === reportedGeneration) {
      onFallback?.(reason, reportedGeneration);
    }
  }, [anchorReadinessGeneration, onFallback]);

  useEffect(() => addAfterEffect(() => {
    const pendingGeneration = pendingFrameGenerationRef.current;
    if (!pendingGeneration) {
      return;
    }
    pendingFrameGenerationRef.current = null;
    markReadyPart("frame", pendingGeneration);
  }), [markReadyPart]);

  useFrame(() => {
    const readiness = readinessRef.current;
    if (
      active &&
      readiness.generation === anchorReadinessGeneration &&
      readiness.silk &&
      readiness.anchor &&
      readiness.font &&
      !readiness.frame
    ) {
      pendingFrameGenerationRef.current = anchorReadinessGeneration;
    }
  });

  useEffect(() => {
    if (!sourceMatchMode) {
      markReadyPart("font");
      return;
    }
    let cancelled = false;
    void preloadCoScrollSourceFont().then((loaded) => {
      if (cancelled) {
        return;
      }
      if (!loaded) {
        reportFallback("asset-failed", anchorReadinessGeneration);
        return;
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelled) {
            markReadyPart("font", anchorReadinessGeneration);
          }
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [anchorReadinessGeneration, markReadyPart, reportFallback, sourceMatchMode]);

  useEffect(() => {
    if (!state.shouldLoadModel) {
      markReadyPart("anchor", anchorReadinessGeneration);
    }
  }, [anchorReadinessGeneration, markReadyPart, state.shouldLoadModel]);

  useEffect(() => {
    if (quality.tier === "fallback") {
      reportFallback("quality-tier", anchorReadinessGeneration);
    }
  }, [anchorReadinessGeneration, quality.tier, reportFallback]);

  useEffect(() => {
    if (!sourceMatchMode || !active) {
      return;
    }

    if (currentAnchorAsset) {
      void preloadCoScrollAnchorGeometry(currentAnchorAsset.modelSrc, true);
    }
  }, [active, currentAnchorAsset, sourceMatchMode]);

  useEffect(() => {
    if (!state.shouldLoadModel) {
      return;
    }

    if (!currentAnchorAsset) {
      reportFallback("asset-failed", anchorReadinessGeneration);
    }
  }, [anchorReadinessGeneration, currentAnchorAsset, reportFallback, state.shouldLoadModel]);

  const renderStaticReducedScene = state.fallbackMode === "dom-static";

  if (quality.tier === "fallback" || (!active && !renderStaticReducedScene)) {
    return null;
  }

  const lyricYOffset = sourceMatchMode ? (mobileSourceMatch ? -0.02 : -0.82 + SOURCE_MATCH_DESKTOP_Y_LIFT) : 0;
  const renderLyric = (line: CoScrollLayeredLyricItem) => {
    const isFront = line.layer === "front";
    const layerOpacity = isFront ? state.frontLayerOpacity : state.backLayerOpacity;

    return (
      <CoScrollTextBillboard
        key={line.key}
        text={line.text}
        position={[line.x, line.y + lyricYOffset, line.z]}
        opacity={sourceMatchMode ? 1 : line.opacity * layerOpacity}
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
        edgeFeather={sourceMatchMode ? 0 : line.edgeFeather}
        scale={sourceMatchMode ? 1 : line.scale}
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
      <CoScrollSilkBackground
        active={active}
        paused={paused}
        reducedMotion={reducedMotion}
        speed={4.9}
        scale={1}
        color="#1f2e38"
        noiseIntensity={1.3}
        rotation={2.42}
        opacity={sourceMatchMode ? 1 : state.backgroundIntensity}
        isolateFromTransmission={sourceMatchMode}
        onReady={() => markReadyPart("silk", anchorReadinessGeneration)}
      />
      {sourceMatchMode ? null : (
        <CoScrollCausticLightField
          active={active}
          paused={paused}
          reducedMotion={reducedMotion}
          layout={viewport}
          opacity={state.backgroundIntensity * (quality.tier === "low" ? 0.12 : 0.2)}
          anchorPresence={state.shouldLoadModel ? 1 : 0.45}
          scrollVelocity={state.scrollVelocity}
          positionZ={-5.22}
        />
      )}

      <group renderOrder={2000}>{layeredLyrics.back.map(renderLyric)}</group>

      {state.shouldLoadModel && currentAnchorAsset ? (
        <CoScrollAssetBoundary
          key={anchorReadinessGeneration}
          onFallback={(reason) => reportFallback(reason, anchorReadinessGeneration)}
        >
          <CoScrollJadeAnchor
            key={anchorReadinessGeneration}
            modelSrc={currentAnchorAsset.modelSrc}
            materialPreset={currentAnchorAsset.materialPreset}
            position={sourceMatchMode ? sourceAnchorPosition : [0, 0, 0]}
            scale={
              sourceMatchMode
                ? sourceAnchorScale
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
            onReady={() => markReadyPart("anchor", anchorReadinessGeneration)}
            onFallback={(reason) => reportFallback(reason, anchorReadinessGeneration)}
          />
        </CoScrollAssetBoundary>
      ) : null}

      <group renderOrder={3300}>{layeredLyrics.front.map(renderLyric)}</group>
    </>
  );
}
