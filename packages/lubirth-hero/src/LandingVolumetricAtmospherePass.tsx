"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Camera,
  DepthFormat,
  DepthTexture,
  LinearFilter,
  Matrix4,
  Mesh,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Group
} from "three";
import type { RefObject } from "react";
import type { QualityProfile } from "@miralith/visual-core";
import type { LandingAtmosphereLook, LandingComposition } from "./types";
import { VOLUMETRIC_ATMOSPHERE_FRAGMENT_SHADER } from "./volumetricAtmosphericScatteringShader";

/**
 * Adapted from BarthPaleologue/volumetric-atmospheric-scattering.
 * Upstream license: Apache-2.0.
 * Upstream NOTICE: Copyright 2021 Barthélemy Paléologue.
 *
 * The original BabylonJS post-process uses screen color + depth + camera rays
 * to ray-march Rayleigh, Mie, and ozone scattering through a planet atmosphere.
 * This port keeps that algorithmic structure and swaps Babylon PostProcess /
 * DepthRenderer plumbing for a Three WebGLRenderTarget + DepthTexture pass.
 */

interface LandingVolumetricAtmospherePassProps {
  composition: LandingComposition;
  earthRef: RefObject<Group | null>;
  quality: QualityProfile;
  sceneLightDirection: Vector3;
  look?: LandingAtmosphereLook;
  emphasis?: boolean;
}

interface VolumetricSampleBudget {
  opticalDepthPoints: number;
  pointsFromCamera: number;
}

declare global {
  interface Window {
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
    __MiraLithLuBirthVolumetricAtmosphereQuality?: string;
  }
}

const PHYSICAL_PLANET_RADIUS_METERS = 6000e3;
const PHYSICAL_ATMOSPHERE_RADIUS_METERS = 6100e3;
const ATMOSPHERE_RADIUS_RATIO = PHYSICAL_ATMOSPHERE_RADIUS_METERS / PHYSICAL_PLANET_RADIUS_METERS;
const REFERENCE_LOOK_ATMOSPHERE_RADIUS_RATIO = 1.0185;
const tmpPlanetPosition = new Vector3();
const tmpScale = new Vector3();
const tmpSunPosition = new Vector3();
const tmpSceneCameraPosition = new Vector3();
const tmpInverseView = new Matrix4();

function resolveSampleBudget(quality: QualityProfile): VolumetricSampleBudget {
  if (quality.tier === "high") {
    return { pointsFromCamera: 16, opticalDepthPoints: 8 };
  }

  return { pointsFromCamera: 8, opticalDepthPoints: 4 };
}

function createRenderTarget() {
  const renderTarget = new WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    format: RGBAFormat,
    magFilter: LinearFilter,
    minFilter: LinearFilter
  });
  renderTarget.texture.name = "LuBirth volumetric atmosphere scene color";
  renderTarget.depthTexture = new DepthTexture(1, 1);
  renderTarget.depthTexture.name = "LuBirth volumetric atmosphere depth";
  renderTarget.depthTexture.format = DepthFormat;
  renderTarget.depthTexture.type = UnsignedIntType;
  renderTarget.depthTexture.magFilter = NearestFilter;
  renderTarget.depthTexture.minFilter = NearestFilter;

  return renderTarget;
}

function createAtmosphereMaterial(budget: VolumetricSampleBudget) {
  return new ShaderMaterial({
    name: "LuBirthVolumetricAtmosphereMaterial",
    defines: {
      OPTICAL_DEPTH_POINTS: String(budget.opticalDepthPoints),
      POINTS_FROM_CAMERA: String(budget.pointsFromCamera)
    },
    uniforms: {
      textureSampler: { value: null },
      depthSampler: { value: null },
      resolution: { value: new Vector2(1, 1) },
      sunPosition: { value: new Vector3(1, 0, 0) },
      sceneCameraPosition: { value: new Vector3() },
      inverseProjection: { value: new Matrix4() },
      inverseView: { value: new Matrix4() },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 90 },
      planetPosition: { value: new Vector3() },
      planetRadius: { value: 1 },
      atmosphereRadius: { value: 1.0167 },
      rayleighHeight: { value: 8e3 },
      rayleighCoeffs: { value: new Vector3(5.8e-6, 13.5e-6, 33.1e-6) },
      mieHeight: { value: 1.2e3 },
      mieCoeffs: { value: new Vector3(3.9e-6, 3.9e-6, 3.9e-6) },
      mieAsymmetry: { value: 0.8 },
      ozoneHeight: { value: 25e3 },
      ozoneCoeffs: { value: new Vector3(0.6e-6, 1.8e-6, 0.085e-6) },
      ozoneFalloff: { value: 5e3 },
      sunIntensity: { value: 20 },
      atmosphereStrength: { value: 1 }
    },
    vertexShader: `
      varying vec2 vUV;

      void main() {
        vUV = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: VOLUMETRIC_ATMOSPHERE_FRAGMENT_SHADER,
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
}

function updatePhysicalScaleUniforms(
  material: ShaderMaterial,
  planetRadius: number,
  composition: LandingComposition,
  look: LandingAtmosphereLook,
  emphasis: boolean
) {
  const worldUnitsPerMeter = planetRadius / PHYSICAL_PLANET_RADIUS_METERS;
  const safeScale = Math.max(worldUnitsPerMeter, 1e-9);
  const referenceLook = look === "reference";

  material.uniforms.planetRadius.value = planetRadius;
  material.uniforms.atmosphereRadius.value =
    planetRadius * (referenceLook ? REFERENCE_LOOK_ATMOSPHERE_RADIUS_RATIO : ATMOSPHERE_RADIUS_RATIO);
  material.uniforms.rayleighHeight.value = (referenceLook ? 8.4e3 : 8e3) * safeScale;
  material.uniforms.mieHeight.value = 1.2e3 * safeScale;
  material.uniforms.ozoneHeight.value = 25e3 * safeScale;
  material.uniforms.ozoneFalloff.value = 5e3 * safeScale;
  material.uniforms.rayleighCoeffs.value.set(
    5.8e-6 / safeScale,
    13.5e-6 / safeScale,
    (referenceLook ? 48.0e-6 : 33.1e-6) / safeScale
  );
  material.uniforms.mieCoeffs.value.setScalar((referenceLook ? 0.045e-6 : 3.9e-6) / safeScale);
  material.uniforms.ozoneCoeffs.value.set(0.6e-6 / safeScale, 1.8e-6 / safeScale, 0.085e-6 / safeScale);
  material.uniforms.mieAsymmetry.value = referenceLook ? 0.38 : 0.8;
  material.uniforms.sunIntensity.value = referenceLook
    ? (emphasis ? 16 : 8.5) * Math.max(composition.atmosphere.intensity, 0)
    : (emphasis ? 18 : 14) * Math.max(composition.atmosphere.intensity, 0);
  material.uniforms.atmosphereStrength.value = composition.atmosphere.enabled ? 1 : 0;
}

function cameraRange(camera: Camera) {
  const ranged = camera as Camera & { far?: number; near?: number };
  return {
    far: typeof ranged.far === "number" ? ranged.far : 90,
    near: typeof ranged.near === "number" ? ranged.near : 0.1
  };
}

export function LandingVolumetricAtmospherePass({
  composition,
  earthRef,
  quality,
  sceneLightDirection,
  look = "lubirth",
  emphasis = false
}: LandingVolumetricAtmospherePassProps) {
  const { camera, gl, scene, size } = useThree();
  const budget = useMemo(() => resolveSampleBudget(quality), [quality]);
  const { fullscreenCamera, fullscreenScene, material, renderTarget } = useMemo(() => {
    const nextRenderTarget = createRenderTarget();
    const nextMaterial = createAtmosphereMaterial(budget);
    nextMaterial.uniforms.textureSampler.value = nextRenderTarget.texture;
    nextMaterial.uniforms.depthSampler.value = nextRenderTarget.depthTexture;

    const nextScene = new Scene();
    const nextCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new Mesh(new PlaneGeometry(2, 2), nextMaterial);
    quad.frustumCulled = false;
    nextScene.add(quad);

    return {
      fullscreenCamera: nextCamera,
      fullscreenScene: nextScene,
      material: nextMaterial,
      renderTarget: nextRenderTarget
    };
  }, [budget]);

  useEffect(() => {
    return () => {
      material.dispose();
      renderTarget.dispose();
      renderTarget.depthTexture?.dispose();
      const quad = fullscreenScene.children[0] as Mesh | undefined;
      quad?.geometry.dispose();
    };
  }, [fullscreenScene, material, renderTarget]);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    const width = Math.max(1, Math.floor(size.width * pixelRatio));
    const height = Math.max(1, Math.floor(size.height * pixelRatio));
    renderTarget.setSize(width, height);
    material.uniforms.resolution.value.set(width, height);
  }, [gl, material, renderTarget, size.height, size.width]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthVolumetricAtmosphereActive = true;
    window.__MiraLithLuBirthVolumetricAtmosphereQuality =
      `${quality.tier}:${budget.pointsFromCamera}/${budget.opticalDepthPoints}`;

    return () => {
      window.__MiraLithLuBirthVolumetricAtmosphereActive = false;
    };
  }, [budget.opticalDepthPoints, budget.pointsFromCamera, quality.tier]);

  useFrame(() => {
    const earth = earthRef.current;
    if (!earth) {
      return;
    }

    earth.updateMatrixWorld();
    camera.updateMatrixWorld();
    camera.getWorldPosition(tmpSceneCameraPosition);
    earth.getWorldPosition(tmpPlanetPosition);
    earth.getWorldScale(tmpScale);
    tmpSunPosition
      .copy(tmpPlanetPosition)
      .addScaledVector(sceneLightDirection, Math.max(tmpScale.x, tmpScale.y, tmpScale.z) * 32);
    tmpInverseView.copy(camera.matrixWorld);

    const range = cameraRange(camera);
    const planetRadius = composition.earth.radius * Math.max(tmpScale.x, tmpScale.y, tmpScale.z);

    material.uniforms.sunPosition.value.copy(tmpSunPosition);
    material.uniforms.sceneCameraPosition.value.copy(tmpSceneCameraPosition);
    material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    material.uniforms.inverseView.value.copy(tmpInverseView);
    material.uniforms.cameraNear.value = range.near;
    material.uniforms.cameraFar.value = range.far;
    material.uniforms.planetPosition.value.copy(tmpPlanetPosition);
    updatePhysicalScaleUniforms(material, planetRadius, composition, look, emphasis);

    const previousAutoClear = gl.autoClear;

    gl.autoClear = true;
    gl.setRenderTarget(renderTarget);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.autoClear = previousAutoClear;
    gl.render(fullscreenScene, fullscreenCamera);
  }, 1);

  return null;
}
