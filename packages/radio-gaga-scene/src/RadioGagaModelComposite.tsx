"use client";

import { ScreenQuad, useFBO } from "@react-three/drei";
import { createPortal, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  Color,
  DirectionalLight,
  LinearFilter,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType
} from "three";
import { RadioGagaFinaleModel, RadioGagaModel } from "./RadioGagaModel";
import { RADIO_GAGA_TIMELINE } from "./radioGagaTimeline";
import type { RadioGagaFrame, RadioGagaFrameRef, RadioGagaSceneMotionRef } from "./types";

interface RadioGagaModelCompositeProps {
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  motionRef?: RadioGagaSceneMotionRef;
  reducedMotion?: boolean;
  loadFinale?: boolean;
  onReady?: () => void;
}

const MODEL_COMPOSITE_VISIBILITY_THRESHOLD = 0.001;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);

function modelCompositeOpacity(frame: RadioGagaFrame) {
  const finalPresence = smooth(
    range(
      frame.progress,
      RADIO_GAGA_TIMELINE.finale.frontLockEnd,
      RADIO_GAGA_TIMELINE.finale.outputStart
    )
  );

  return Math.max(frame.radioOpacity, frame.esp32Opacity, finalPresence);
}

export function RadioGagaModelComposite({
  frame,
  frameRef,
  motionRef,
  reducedMotion = false,
  loadFinale = false,
  onReady
}: RadioGagaModelCompositeProps) {
  const modelScene = useMemo(() => new Scene(), []);
  const restoreClearColor = useMemo(() => new Color(), []);
  const keyLight = useRef<DirectionalLight>(null);
  const openingFill = useRef<DirectionalLight>(null);
  const rimLight = useRef<DirectionalLight>(null);
  const frontSoftbox = useRef<DirectionalLight>(null);
  const renderTarget = useFBO({
    depthBuffer: true,
    format: RGBAFormat,
    generateMipmaps: false,
    magFilter: LinearFilter,
    minFilter: LinearFilter,
    samples: 0,
    stencilBuffer: false,
    type: UnsignedByteType
  });
  const compositeMaterial = useMemo(
    () =>
      new ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader: `
          uniform sampler2D uModelTexture;
          uniform float uOpacity;
          varying vec2 vUv;

          void main() {
            vec4 modelColor = texture2D(uModelTexture, vUv);
            gl_FragColor = vec4(modelColor.rgb, modelColor.a * uOpacity);
            #include <colorspace_fragment>
          }
        `,
        toneMapped: false,
        transparent: true,
        uniforms: {
          uModelTexture: { value: renderTarget.texture },
          uOpacity: { value: 0 }
        },
        vertexShader: `
          varying vec2 vUv;

          void main() {
            vUv = position.xy * 0.5 + 0.5;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `
      }),
    [renderTarget.texture]
  );

  useFrame(({ camera, gl }) => {
    const nextFrame = frameRef?.current ?? frame;
    const compositeOpacity = modelCompositeOpacity(nextFrame);

    compositeMaterial.uniforms.uOpacity.value = compositeOpacity;
    compositeMaterial.visible = compositeOpacity > MODEL_COMPOSITE_VISIBILITY_THRESHOLD;
    if (compositeOpacity <= MODEL_COMPOSITE_VISIBILITY_THRESHOLD) {
      return;
    }

    const esp32LightPresence = Math.max(
      nextFrame.esp32Opacity,
      nextFrame.esp32SolidMotionProgress,
      nextFrame.finalLineOpacity
    );
    const previousTarget = gl.getRenderTarget();
    const previousClearAlpha = gl.getClearAlpha();

    if (keyLight.current) {
      keyLight.current.intensity = 1.08 + nextFrame.backgroundWarmth * 0.42;
    }
    if (openingFill.current) {
      openingFill.current.intensity =
        0.46 * (1 - nextFrame.signatureMomentProgress * 0.24) + nextFrame.finalLineOpacity * 0.18;
    }
    if (rimLight.current) {
      rimLight.current.intensity =
        0.22 + nextFrame.signatureMomentProgress * 0.08 + nextFrame.finalLineOpacity * 0.08;
    }
    if (frontSoftbox.current) {
      frontSoftbox.current.intensity = 0.42 + esp32LightPresence * 0.24 + nextFrame.finalLineOpacity * 0.18;
    }

    gl.getClearColor(restoreClearColor);
    gl.setRenderTarget(renderTarget);
    gl.setClearColor(0x000000, 0);
    gl.render(modelScene, camera);
    gl.setRenderTarget(previousTarget);
    gl.setClearColor(restoreClearColor, previousClearAlpha);
  }, -1);

  useEffect(
    () => () => {
      compositeMaterial.dispose();
    },
    [compositeMaterial]
  );

  return (
    <>
      {createPortal(
        <>
          <ambientLight color="#f3f3ef" intensity={0.68} />
          <directionalLight ref={keyLight} color="#fffaf0" position={[2.4, 2.6, 3.8]} intensity={1.08} />
          <directionalLight ref={openingFill} color="#e7eefc" position={[-2.6, 1.7, 3.2]} intensity={0.46} />
          <directionalLight ref={rimLight} color="#f5d8c8" position={[-3.2, 1.6, -1.8]} intensity={0.22} />
          <directionalLight ref={frontSoftbox} color="#ffffff" position={[0.2, 1.4, 4.6]} intensity={0.42} />
          <RadioGagaModel
            frame={frame}
            frameRef={frameRef}
            motionRef={motionRef}
            reducedMotion={reducedMotion}
            onReady={onReady}
          />
          {loadFinale ? (
            <Suspense fallback={null}>
              <RadioGagaFinaleModel
                frame={frame}
                frameRef={frameRef}
                motionRef={motionRef}
                reducedMotion={reducedMotion}
              />
            </Suspense>
          ) : null}
        </>,
        modelScene
      )}
      <ScreenQuad material={compositeMaterial} renderOrder={1000} />
    </>
  );
}
