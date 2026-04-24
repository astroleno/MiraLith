"use client";

import { Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3
} from "three";
import {
  getRuntimeOpeningProgress,
  mapOpeningProgress,
} from "@miralith/visual-core";
import type { EarthMoonSceneProps } from "./types";
import { createEarthTexture, createMoonTexture } from "./textures";

const cameraTarget = new Vector3(0, 0.04, 0);
const nextCameraPosition = new Vector3();
const earthTargetPosition = new Vector3();
const moonTargetPosition = new Vector3();
const moonTargetScale = new Vector3();

export function EarthMoonScene({ mode, composition, quality, reducedMotion, paused, onSceneReady }: EarthMoonSceneProps) {
  const earthGroup = useRef<Group>(null);
  const earth = useRef<Mesh>(null);
  const moon = useRef<Mesh>(null);
  const auroraNorth = useRef<Mesh>(null);
  const auroraSouth = useRef<Mesh>(null);
  const { camera, viewport } = useThree();

  const earthTexture = useMemo(() => createEarthTexture(quality.tier === "high" ? 1024 : 512), [quality.tier]);
  const moonTexture = useMemo(() => createMoonTexture(quality.tier === "high" ? 512 : 256), [quality.tier]);

  const earthMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        map: earthTexture,
        roughness: 0.84,
        metalness: 0.08,
        emissive: new Color("#07131d"),
        emissiveIntensity: 0.22
      }),
    [earthTexture]
  );

  const moonMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        map: moonTexture,
        roughness: 0.92,
        metalness: 0,
        emissive: new Color("#2c2a24"),
        emissiveIntensity: 0.16
      }),
    [moonTexture]
  );

  const atmosphereMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#9fc8d2",
        transparent: true,
        opacity: composition.atmosphere.enabled
          ? quality.tier === "low"
            ? 0.08
            : composition.atmosphere.intensity
          : 0,
        blending: AdditiveBlending,
        side: BackSide,
        depthWrite: false
      }),
    [composition.atmosphere.enabled, composition.atmosphere.intensity, quality.tier]
  );

  const auroraMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#76a99b",
        transparent: true,
        opacity: quality.aurora && composition.aurora.enabled ? composition.aurora.intensity : 0,
        blending: AdditiveBlending,
        depthWrite: false
      }),
    [composition.aurora.enabled, composition.aurora.intensity, quality.aurora]
  );

  const lightColor = useMemo(
    () => new Color(composition.light.color[0], composition.light.color[1], composition.light.color[2]),
    [composition.light.color]
  );

  useEffect(() => {
    onSceneReady?.();
  }, [onSceneReady]);

  useFrame((state, delta) => {
    const progress = getRuntimeOpeningProgress(mode === "window" || mode === "expanded" ? 1 : 0);
    const frame = mapOpeningProgress(mode === "expanded" ? 1 : progress);
    const narrowViewport = viewport.width < 6;
    const compactViewport = viewport.width >= 6 && viewport.width < 9;
    const viewportShift = narrowViewport ? 0.82 : compactViewport ? 0.32 : 0;
    const viewportScale = narrowViewport ? 0.72 : compactViewport ? 0.86 : 1;

    nextCameraPosition.set(
      Math.sin(frame.cameraAzimuth) * frame.cameraDistance,
      frame.cameraElevation * frame.cameraDistance,
      Math.cos(frame.cameraAzimuth) * frame.cameraDistance
    );
    camera.position.lerp(nextCameraPosition, reducedMotion ? 0.18 : 0.075);
    camera.lookAt(cameraTarget);

    if (earthGroup.current) {
      const expandedBoost = mode === "expanded" ? 0.22 : 0;
      const earthScale = (frame.earthScale + expandedBoost) * viewportScale;
      earthTargetPosition.set(frame.earthX + viewportShift, -0.1, 0);
      earthGroup.current.position.lerp(earthTargetPosition, 0.08);
      earthGroup.current.scale.lerp(
        new Vector3(earthScale, earthScale, earthScale),
        0.08
      );
    }

    if (earth.current && !paused) {
      earth.current.rotation.y +=
        (reducedMotion ? 0.004 : MathUtils.degToRad(composition.earth.rotationSpeedDegPerSec)) * delta;
      earth.current.rotation.x = -0.12;
    }

    if (moon.current) {
      const moonX = narrowViewport ? -0.95 : frame.moonX + viewportShift * 0.18;
      moonTargetPosition.set(moonX, frame.moonY, -0.2);
      moon.current.position.lerp(moonTargetPosition, 0.08);
      const moonScale = mode === "expanded" ? 1.12 : 1;
      moon.current.scale.lerp(moonTargetScale.set(moonScale, moonScale, moonScale), 0.08);
      if (!paused && !reducedMotion) {
        moon.current.rotation.y += delta * 0.018;
      }
    }

    if (auroraNorth.current && auroraSouth.current && !paused && !reducedMotion) {
      auroraNorth.current.rotation.z += delta * composition.aurora.noiseSpeed;
      auroraSouth.current.rotation.z -= delta * composition.aurora.noiseSpeed * 0.8;
      const pulse = 0.65 + Math.sin(state.clock.elapsedTime * 0.8) * 0.18;
      auroraNorth.current.scale.setScalar(pulse);
      auroraSouth.current.scale.setScalar(0.78 + pulse * 0.22);
    }
  });

  return (
    <>
      <color attach="background" args={["#080a10"]} />
      <ambientLight intensity={composition.light.ambientIntensity} color="#d9e2e4" />
      <directionalLight
        position={composition.light.fixedSunDir}
        intensity={composition.light.intensity}
        color={lightColor}
      />
      <pointLight position={[-3.2, -1.2, 2.4]} intensity={0.55} color="#76a99b" />

      {quality.stars > 0 ? (
        <Stars radius={42} depth={26} count={quality.stars} factor={2.4} saturation={0} fade speed={0.18} />
      ) : null}

      <group ref={earthGroup}>
        <mesh ref={earth} material={earthMaterial}>
          <sphereGeometry args={[composition.earth.radius, quality.segments, quality.segments]} />
        </mesh>
        <mesh material={atmosphereMaterial} scale={1.055}>
          <sphereGeometry args={[composition.earth.radius, quality.segments, quality.segments]} />
        </mesh>
        <mesh rotation={[Math.PI / 2.12, 0.18, -0.5]}>
          <torusGeometry args={[composition.earth.radius * 1.04, 0.006, 8, 160]} />
          <meshBasicMaterial
            color="#c4a35f"
            transparent
            opacity={composition.atmosphere.karmanGlow ? composition.atmosphere.nearStrength : 0}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh ref={auroraNorth} position={[0.08, composition.earth.radius * 0.62, 0.1]} rotation={[1.28, 0.1, 0.2]}>
          <torusGeometry args={[composition.earth.radius * 0.54, 0.012, 10, 120]} />
          <primitive object={auroraMaterial} attach="material" />
        </mesh>
        <mesh ref={auroraSouth} position={[-0.08, -composition.earth.radius * 0.6, -0.05]} rotation={[1.82, -0.2, -0.1]}>
          <torusGeometry args={[composition.earth.radius * 0.48, 0.01, 10, 120]} />
          <primitive object={auroraMaterial.clone()} attach="material" />
        </mesh>
      </group>

      {composition.moon.visible ? (
        <mesh ref={moon} material={moonMaterial}>
          <sphereGeometry args={[composition.moon.radius, quality.segments, quality.segments]} />
        </mesh>
      ) : null}
    </>
  );
}
