"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  Matrix4,
  NormalBlending,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3
} from "three";
import { RADIO_GAGA_PROOF_POSITION } from "./RadioGagaProofPlanes";
import {
  radioGagaParticleFragmentShader,
  radioGagaParticleVertexShader,
  type RadioGagaParticleShaderUniforms
} from "./radioGagaParticleShader";
import type { RadioGagaParticleTargets } from "./radioGagaParticleTargets";
import type {
  RadioGagaFrame,
  RadioGagaFrameRef,
  RadioGagaQualityProfile,
  RadioGagaSceneMotionRef
} from "./types";

const RADIO_POSITION = new Vector3(0.18, -0.32, 0);
const RADIO_SCALE = 3.14;
const RADIO_START_PITCH = -Math.PI / 6;
const ESP32_POSITION = new Vector3(-0.46, -0.1, 0.06);
const ESP32_ROTATION_Y = -2.04;
const ESP32_SCALE = 1.58 * 0.92;
const TAU = Math.PI * 2;

interface RadioGagaParticleFieldProps {
  active: boolean;
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  motionRef?: RadioGagaSceneMotionRef;
  pointSize: number;
  quality: RadioGagaQualityProfile;
  reducedMotion: boolean;
  targets: RadioGagaParticleTargets;
}

interface Bounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

interface ColorTargets {
  radio: Float32Array;
  proofOne: Float32Array;
  proofTwo: Float32Array;
  esp32: Float32Array;
  home: Float32Array;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

function random01(index: number, salt: number) {
  let value = Math.imul(index + 1, 0x9e3779b1) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  return ((value ^ (value >>> 15)) >>> 0) / 4_294_967_296;
}

function boundsFor(points: Float32Array): Bounds {
  const bounds: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY
  };

  for (let offset = 0; offset < points.length; offset += 3) {
    bounds.minX = Math.min(bounds.minX, points[offset]);
    bounds.minY = Math.min(bounds.minY, points[offset + 1]);
    bounds.minZ = Math.min(bounds.minZ, points[offset + 2]);
    bounds.maxX = Math.max(bounds.maxX, points[offset]);
    bounds.maxY = Math.max(bounds.maxY, points[offset + 1]);
    bounds.maxZ = Math.max(bounds.maxZ, points[offset + 2]);
  }

  if (!Number.isFinite(bounds.minX)) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
  }
  return bounds;
}

function normalized(value: number, min: number, max: number) {
  return clamp01((value - min) / Math.max(max - min, 0.0001));
}

function setColor(target: Float32Array, offset: number, r: number, g: number, b: number, noise: number) {
  target[offset] = clamp01(r + noise);
  target[offset + 1] = clamp01(g + noise);
  target[offset + 2] = clamp01(b + noise);
}

function createColorTargets(targets: RadioGagaParticleTargets): ColorTargets {
  const count = targets.radio.length / 3;
  const colors: ColorTargets = {
    radio: new Float32Array(targets.radio.length),
    proofOne: new Float32Array(targets.radio.length),
    proofTwo: new Float32Array(targets.radio.length),
    esp32: new Float32Array(targets.radio.length),
    home: new Float32Array(targets.radio.length)
  };
  const radioBounds = boundsFor(targets.radio);
  const espBounds = boundsFor(targets.esp32);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const noise = (random01(index, 0x1b873593) - 0.5) * 0.05;
    const radioX = normalized(targets.radio[offset], radioBounds.minX, radioBounds.maxX);
    const radioY = normalized(targets.radio[offset + 1], radioBounds.minY, radioBounds.maxY);
    const radioZ = normalized(targets.radio[offset + 2], radioBounds.minZ, radioBounds.maxZ);
    const radioShell = radioX < 0.08 || radioX > 0.92 || radioY < 0.08 || radioY > 0.92 || radioZ > 0.78;
    const radioPanel = radioX > 0.66 && radioY > 0.18 && radioY < 0.82;
    setColor(
      colors.radio,
      offset,
      radioShell ? 0.75 : radioPanel ? 0.77 : 0.38,
      radioShell ? 0.07 : radioPanel ? 0.69 : 0.39,
      radioShell ? 0.065 : radioPanel ? 0.62 : 0.37,
      noise
    );

    const proofOneLight = clamp01(targets.proofOne[offset + 2] / 0.018 + 0.5);
    const proofTwoLight = clamp01(targets.proofTwo[offset + 2] / 0.018 + 0.5);
    setColor(colors.proofOne, offset, 0.22 + proofOneLight * 0.76, 0.2 + proofOneLight * 0.72, 0.18 + proofOneLight * 0.66, noise * 0.35);
    setColor(colors.proofTwo, offset, 0.2 + proofTwoLight * 0.74, 0.22 + proofTwoLight * 0.72, 0.25 + proofTwoLight * 0.7, noise * 0.35);

    const espX = normalized(targets.esp32[offset], espBounds.minX, espBounds.maxX);
    const espY = normalized(targets.esp32[offset + 1], espBounds.minY, espBounds.maxY);
    const espZ = normalized(targets.esp32[offset + 2], espBounds.minZ, espBounds.maxZ);
    const espShell = espX < 0.1 || espX > 0.9 || espY < 0.1 || espY > 0.9;
    const espScreen = (espZ < 0.28 || espZ > 0.72) && espX > 0.18 && espX < 0.78 && espY > 0.2 && espY < 0.82;
    const espCore = espScreen && espX > 0.38 && espX < 0.58 && espY > 0.36 && espY < 0.62;
    setColor(
      colors.esp32,
      offset,
      espCore ? 0.42 : espScreen ? 0.14 : espShell ? 0.28 : 0.86,
      espCore ? 0.82 : espScreen ? 0.15 : espShell ? 0.29 : 0.86,
      espCore ? 0.88 : espScreen ? 0.15 : espShell ? 0.29 : 0.82,
      noise * 0.55
    );
    setColor(colors.home, offset, 0.92, 0.78, 0.58, noise * 0.45);
  }

  return colors;
}

function cubic(from: number, controlOne: number, controlTwo: number, to: number, progress: number) {
  const inverse = 1 - progress;
  return (
    from * inverse * inverse * inverse +
    controlOne * 3 * inverse * inverse * progress +
    controlTwo * 3 * inverse * progress * progress +
    to * progress * progress * progress
  );
}

export function RadioGagaParticleField({
  active,
  frame,
  frameRef,
  motionRef,
  pointSize,
  quality,
  reducedMotion,
  targets
}: RadioGagaParticleFieldProps) {
  const pointsRef = useRef<Points>(null);
  const colorTargets = useMemo(() => createColorTargets(targets), [targets]);
  const geometry = useMemo(() => {
    const nextGeometry = new BufferGeometry();
    nextGeometry.setAttribute("position", new BufferAttribute(new Float32Array(targets.radio), 3));
    nextGeometry.setAttribute("color", new BufferAttribute(new Float32Array(colorTargets.radio), 3));
    return nextGeometry;
  }, [colorTargets.radio, targets.radio]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        blending: NormalBlending,
        depthTest: true,
        depthWrite: true,
        fragmentShader: radioGagaParticleFragmentShader,
        transparent: true,
        uniforms: {
          uOpacity: { value: 0 },
          uPointSize: { value: pointSize }
        },
        vertexColors: true,
        vertexShader: radioGagaParticleVertexShader
      }),
    [pointSize]
  );
  const radioBounds = useMemo(() => boundsFor(targets.radio), [targets.radio]);
  const espBounds = useMemo(() => boundsFor(targets.esp32), [targets.esp32]);
  const metadata = useMemo(() => {
    const count = targets.radio.length / 3;
    const delay = new Float32Array(count);
    const lane = new Float32Array(count);
    const looseness = new Float32Array(count);
    const pathDelay = new Float32Array(count);
    const phase = new Float32Array(count);
    const speed = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      delay[index] = random01(index, 0x85ebca6b);
      lane[index] = random01(index, 0xc2b2ae35) - 0.5;
      looseness[index] = 0.018 + Math.pow(random01(index, 0x27d4eb2f), 1.45) * 0.055;
      pathDelay[index] = clamp01(random01(index, 0x165667b1) * 0.72 + delay[index] * 0.28);
      phase[index] = random01(index, 0xd3a2646c) * TAU;
      speed[index] = 1.5 + random01(index, 0xfd7046c5) * 2.5;
    }
    return { delay, lane, looseness, pathDelay, phase, speed };
  }, [targets.radio.length]);
  const scratch = useMemo(
    () => ({
      destination: new Vector3(),
      destinationCenter: new Vector3(),
      espMatrix: new Matrix4(),
      home: new Vector3(),
      path: new Vector3(),
      point: new Vector3(),
      proof: new Vector3(),
      quaternion: new Quaternion(),
      radioCenter: new Vector3(),
      radioMatrix: new Matrix4(),
      rotation: new Euler(),
      scale: new Vector3(),
      source: new Vector3(),
      translation: new Vector3()
    }),
    []
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const uniforms = material.uniforms as unknown as RadioGagaParticleShaderUniforms;
    if (!active || targets.radio.length === 0) {
      uniforms.uOpacity.value = 0;
      if (pointsRef.current) pointsRef.current.visible = false;
      return;
    }

    const nextFrame = frameRef?.current ?? frame;
    const positionAttribute = geometry.getAttribute("position") as BufferAttribute;
    const colorAttribute = geometry.getAttribute("color") as BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
    const colors = colorAttribute.array as Float32Array;
    const elapsed = reducedMotion ? 0 : clock.elapsedTime;
    const proofArrival = smooth(range(nextFrame.progress, 0.16, 0.32));
    const proofSwitchProgress = smooth(range(nextFrame.progress, 0.43, 0.54));
    const proofExitProgress = smooth(range(nextFrame.progress, 0.62, 0.72));
    const pathProgress = smooth(range(nextFrame.progress, 0.62, 0.82));
    const expandProgress = smooth(range(nextFrame.progress, 0.78, 0.89));
    const homeProgress = smooth(range(nextFrame.progress, 0.94, 1));
    const travelWindow = smooth(range(nextFrame.progress, 0.62, 0.8)) * (1 - smooth(range(nextFrame.progress, 0.88, 0.925)));
    const radioFront = smooth(range(nextFrame.progress, 0.045, 0.18));
    const parallaxStrength = radioFront * (1 - smooth(range(nextFrame.progress, 0.17, 0.225)));
    const rotationY = nextFrame.radioRotationY + (motionRef?.current.rotationY ?? 0) * parallaxStrength;
    const radioScale = nextFrame.radioScale * RADIO_SCALE;

    scratch.translation.set(RADIO_POSITION.x + rotationY * 0.38, RADIO_POSITION.y, RADIO_POSITION.z);
    scratch.rotation.set(lerp(RADIO_START_PITCH, 0, radioFront), rotationY, 0);
    scratch.quaternion.setFromEuler(scratch.rotation);
    scratch.scale.setScalar(radioScale);
    scratch.radioMatrix.compose(scratch.translation, scratch.quaternion, scratch.scale);
    scratch.translation.copy(ESP32_POSITION);
    scratch.rotation.set(0, ESP32_ROTATION_Y, 0);
    scratch.quaternion.setFromEuler(scratch.rotation);
    scratch.scale.setScalar(ESP32_SCALE);
    scratch.espMatrix.compose(scratch.translation, scratch.quaternion, scratch.scale);
    scratch.radioCenter
      .set((radioBounds.minX + radioBounds.maxX) * 0.5, (radioBounds.minY + radioBounds.maxY) * 0.5, (radioBounds.minZ + radioBounds.maxZ) * 0.5)
      .applyMatrix4(scratch.radioMatrix);
    scratch.destinationCenter
      .set((espBounds.minX + espBounds.maxX) * 0.5, (espBounds.minY + espBounds.maxY) * 0.5, (espBounds.minZ + espBounds.maxZ) * 0.5)
      .applyMatrix4(scratch.espMatrix);

    for (let index = 0; index < metadata.delay.length; index += 1) {
      const offset = index * 3;
      const collapse = smooth(clamp01(proofArrival * 1.1 - metadata.delay[index] * 0.08));
      const proofSwitch = smooth(clamp01(proofSwitchProgress * 1.08 - metadata.delay[index] * 0.06));
      const proofExit = smooth(clamp01(proofExitProgress * 1.12 - metadata.pathDelay[index] * 0.2));
      const expand = smooth(clamp01(expandProgress * 1.1 - metadata.pathDelay[index] * 0.1));
      const localPath = smooth(clamp01((pathProgress - metadata.pathDelay[index] * 0.52) / (0.48 + (1 - metadata.speed[index] / 4) * 0.38)));
      const phase = metadata.phase[index] + elapsed * metadata.speed[index] + localPath * Math.PI * 5.2;
      const travel = travelWindow * collapse * (1 - expand) * (0.42 + Math.sin(localPath * Math.PI) * 0.58);

      scratch.source.set(targets.radio[offset], targets.radio[offset + 1], targets.radio[offset + 2]).applyMatrix4(scratch.radioMatrix);
      scratch.destination.set(targets.esp32[offset], targets.esp32[offset + 1], targets.esp32[offset + 2]).applyMatrix4(scratch.espMatrix);
      scratch.home.set(targets.home[offset], targets.home[offset + 1], targets.home[offset + 2]).applyMatrix4(scratch.espMatrix);
      scratch.proof.set(
        RADIO_GAGA_PROOF_POSITION[0] + lerp(targets.proofOne[offset], targets.proofTwo[offset], proofSwitch),
        RADIO_GAGA_PROOF_POSITION[1] + lerp(targets.proofOne[offset + 1], targets.proofTwo[offset + 1], proofSwitch),
        RADIO_GAGA_PROOF_POSITION[2] + lerp(targets.proofOne[offset + 2], targets.proofTwo[offset + 2], proofSwitch)
      );
      scratch.path.set(
        cubic(scratch.proof.x, scratch.proof.x + 0.42, scratch.destinationCenter.x - 0.58, scratch.destinationCenter.x, localPath),
        cubic(scratch.proof.y, scratch.proof.y + 0.5, scratch.destinationCenter.y + 0.24, scratch.destinationCenter.y, localPath),
        cubic(scratch.proof.z, scratch.proof.z + 0.18, scratch.destinationCenter.z + 0.22, scratch.destinationCenter.z, localPath)
      );
      scratch.path.x += metadata.lane[index] * travel * (0.82 + metadata.looseness[index] * 6.4);
      scratch.path.y += Math.sin(phase) * travel * (0.18 + metadata.looseness[index] * 2.2);
      scratch.path.z += Math.cos(phase * 1.08) * travel * (0.15 + metadata.looseness[index] * 1.7);
      scratch.path.addScaledVector(scratch.destination, expand).addScaledVector(scratch.destinationCenter, -expand);
      scratch.point.copy(scratch.source).lerp(scratch.proof, collapse).lerp(scratch.path, proofExit).lerp(scratch.home, homeProgress);

      const surfaceFlow = reducedMotion ? 0 : nextFrame.particleTurbulence * metadata.looseness[index] * (1 - homeProgress);
      scratch.point.x += Math.sin(phase + scratch.point.y * 3.1) * surfaceFlow;
      scratch.point.y += Math.cos(phase * 0.83 + scratch.point.x * 2.7) * surfaceFlow * 0.74;
      scratch.point.z += Math.sin(phase * 1.17 + metadata.lane[index] * TAU) * surfaceFlow * 0.62;
      positions[offset] = scratch.point.x;
      positions[offset + 1] = scratch.point.y;
      positions[offset + 2] = scratch.point.z;

      const proofR = lerp(colorTargets.proofOne[offset], colorTargets.proofTwo[offset], proofSwitch);
      const proofG = lerp(colorTargets.proofOne[offset + 1], colorTargets.proofTwo[offset + 1], proofSwitch);
      const proofB = lerp(colorTargets.proofOne[offset + 2], colorTargets.proofTwo[offset + 2], proofSwitch);
      const flowColor = Math.max(expand, smooth(range(localPath, 0.42, 1)));
      colors[offset] = lerp(lerp(colorTargets.radio[offset], proofR, collapse), lerp(proofR, colorTargets.esp32[offset], flowColor), proofExit);
      colors[offset + 1] = lerp(lerp(colorTargets.radio[offset + 1], proofG, collapse), lerp(proofG, colorTargets.esp32[offset + 1], flowColor), proofExit);
      colors[offset + 2] = lerp(lerp(colorTargets.radio[offset + 2], proofB, collapse), lerp(proofB, colorTargets.esp32[offset + 2], flowColor), proofExit);
      colors[offset] = lerp(colors[offset], colorTargets.home[offset], homeProgress);
      colors[offset + 1] = lerp(colors[offset + 1], colorTargets.home[offset + 1], homeProgress);
      colors[offset + 2] = lerp(colors[offset + 2], colorTargets.home[offset + 2], homeProgress);
    }

    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    material.depthWrite = nextFrame.progress < 0.91;
    const proofReadability = proofArrival * (1 - proofExitProgress);
    const proofSuppression = smooth(range(nextFrame.progress, 0.245, 0.3)) * (1 - smooth(range(nextFrame.progress, 0.69, 0.75)));
    const proofParticleOpacity = 1 - proofSuppression;
    uniforms.uPointSize.value = pointSize * (1 + proofReadability * proofParticleOpacity * (quality.tier === "low" ? 0.28 : 0.62));
    uniforms.uOpacity.value = nextFrame.particleOpacity * proofParticleOpacity * (quality.tier === "low" ? 0.9 : 1);
    if (pointsRef.current) pointsRef.current.visible = uniforms.uOpacity.value > 0.01;
  });

  if (targets.radio.length === 0) {
    return null;
  }

  return <points ref={pointsRef} geometry={geometry} material={material} renderOrder={4} frustumCulled={false} />;
}
