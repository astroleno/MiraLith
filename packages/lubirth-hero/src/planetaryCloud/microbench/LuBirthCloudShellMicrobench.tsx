"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { mapOpeningProgress } from "@miralith/visual-core";
import {
  ClampToEdgeWrapping,
  Color,
  DepthFormat,
  DepthTexture,
  DirectionalLight,
  DoubleSide,
  Euler,
  Group,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer
} from "three";
import {
  TAKRAM_BOTTOM_RADIUS_M,
  buildLuBirthWorldToEcef,
  raySphereIntervalGeneral,
  resolveCloudShellWorldSegment
} from "../planetaryCloudMath";
import { DEFAULT_LUBIRTH_SUN_DIRECTION } from "../../constants";
import {
  CLOUD_SHELL_BASE_ALTITUDE_M,
  CLOUD_SHELL_MICROBENCH_CASES,
  CLOUD_SHELL_MICROBENCH_RESOLUTION_SCALE,
  CLOUD_SHELL_MICROBENCH_VALID_GPU_SAMPLES,
  CLOUD_SHELL_MICROBENCH_WARMUP_FRAMES,
  CLOUD_SHELL_THICKNESS_M,
  type CloudShellMicrobenchCaseId
} from "./cloudShellMicrobenchContract";
import {
  CLOUD_SHELL_COMPOSITE_FRAGMENT_SHADER,
  CLOUD_SHELL_FULLSCREEN_VERTEX_SHADER,
  CLOUD_SHELL_OUTPUT_FRAGMENT_SHADER,
  CLOUD_SHELL_RESOLVE_FRAGMENT_SHADER,
  createCloudShellRaymarchFragmentShader
} from "./cloudShellMicrobenchShader";
import {
  CloudShellMicrobenchProfiler,
  summarizeCloudShellGpuFrames,
  type CloudShellMicrobenchGpuFrame
} from "./CloudShellMicrobenchProfiler";

const EARTH_DAY_SRC = "/assets/lubirth/textures/earth-day-nasa-lite-4k.webp";
export const CLOUD_SHELL_MICROBENCH_V3_SRC =
  "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png";

export type CloudShellMicrobenchDebugMode = "raw" | "cloud" | "earth" | "density";
export type CloudShellMicrobenchTransformScenario = "identity" | "enlarged" | "reduced";
export type CloudShellMicrobenchOccluderMode = "none" | "front" | "middle" | "behind";

export interface CloudShellMicrobenchTelemetry {
  active: boolean;
  cameraMatrixWorld: number[];
  cameraPosition: [number, number, number];
  caseId: CloudShellMicrobenchCaseId;
  coordinateGate: "PASS" | "FAIL";
  hdrColorGate: "PASS" | "FAIL";
  debugMode: CloudShellMicrobenchDebugMode;
  earthMatrixWorld: number[];
  earthUniformScale: number;
  gammaGate: "PASS" | "FAIL";
  frameId: number;
  gpu: {
    invalidFrames: number;
    p50Ms: number | null;
    p95Ms: number | null;
    sampleCount: number;
    supported: boolean;
  };
  incrementalRtPeakBytes: number;
  measurementState: "awaiting-visual-review" | "warming" | "sampling" | "complete" | "timer-unavailable";
  occluderMode: CloudShellMicrobenchOccluderMode;
  progress: number;
  renderScale: number;
  resolvedSize: [number, number];
  sourceTexture: typeof CLOUD_SHELL_MICROBENCH_V3_SRC;
  showSceneDepthClamp: boolean;
  transformScenario: CloudShellMicrobenchTransformScenario;
}

declare global {
  interface Window {
    __MiraLithLuBirthCloudMicrobench?: CloudShellMicrobenchTelemetry;
  }
}

export interface LuBirthCloudShellMicrobenchProps {
  caseId: CloudShellMicrobenchCaseId;
  debugMode: CloudShellMicrobenchDebugMode;
  measure?: boolean;
  occluderMode?: CloudShellMicrobenchOccluderMode;
  progress: number;
  showSceneDepthClamp?: boolean;
  transformScenario?: CloudShellMicrobenchTransformScenario;
  visualGateConfirmed?: boolean;
  onTelemetry?: (telemetry: CloudShellMicrobenchTelemetry) => void;
}

interface PipelineTargets {
  cloudAccumulation: WebGLRenderTarget;
  cloudResolve: WebGLRenderTarget;
  composite: WebGLRenderTarget;
  opaque: WebGLRenderTarget;
}

interface Pipeline {
  cloudAccumulationScene: Scene;
  cloudCompositeScene: Scene;
  cloudRaymarchMaterial: ShaderMaterial;
  cloudResolveScene: Scene;
  cloudResolveMaterial: ShaderMaterial;
  compositeMaterial: ShaderMaterial;
  earthMesh: Mesh<SphereGeometry, MeshStandardMaterial>;
  earthGroup: Group;
  earthMaterial: MeshStandardMaterial;
  earthScene: Scene;
  earthTexture: Texture;
  frameId: number;
  fullscreenCamera: OrthographicCamera;
  fullscreenGeometry: PlaneGeometry;
  gammaColorPass: boolean;
  gpuFrames: CloudShellMicrobenchGpuFrame[];
  hdrColorPass: boolean;
  outputScene: Scene;
  outputMaterial: ShaderMaterial;
  profiler: CloudShellMicrobenchProfiler | null;
  probeOccluder: Mesh<PlaneGeometry, MeshBasicMaterial>;
  probeOccluderMaterial: MeshBasicMaterial;
  resolvedHeight: number;
  resolvedWidth: number;
  targets: PipelineTargets | null;
  weatherReady: boolean;
  weatherTexture: Texture;
}

const scratchDrawSize = new Vector2();
const scratchEcefRayDirection = new Vector3();
const scratchEcefRayOrigin = new Vector3();
const scratchEarthPosition = new Vector3();
const scratchSunDirectionWorld = new Vector3(...DEFAULT_LUBIRTH_SUN_DIRECTION).normalize();
const scratchSunDirectionEcef = new Vector3();
const scratchCameraPosition = new Vector3();
const scratchCameraTarget = new Vector3();
const scratchCameraDirection = new Vector3();
const scratchEarthQuaternion = new Quaternion();
const scratchEarthEuler = new Euler();
const scratchEarthMatrix = new Matrix4();
const scratchWorldToEcefLinear = new Matrix3();

function clampProgress(value: number) {
  return Math.max(0, Math.min(0.18, Number.isFinite(value) ? value : 0));
}

function debugModeValue(debugMode: CloudShellMicrobenchDebugMode) {
  if (debugMode === "cloud") return 1;
  if (debugMode === "earth") return 2;
  if (debugMode === "density") return 3;
  return 0;
}

function createLinearRenderTarget(width: number, height: number, withDepth = false) {
  const target = new WebGLRenderTarget(width, height, {
    depthBuffer: withDepth,
    format: RGBAFormat,
    magFilter: LinearFilter,
    minFilter: LinearFilter,
    stencilBuffer: false,
    type: HalfFloatType
  });
  target.texture.colorSpace = NoColorSpace;
  if (withDepth) {
    target.depthTexture = new DepthTexture(width, height, UnsignedIntType);
    target.depthTexture.format = DepthFormat;
  }
  return target;
}

function disposeTargets(targets: PipelineTargets | null) {
  targets?.opaque.dispose();
  targets?.cloudAccumulation.dispose();
  targets?.cloudResolve.dispose();
  targets?.composite.dispose();
}

function createFullscreenScene(geometry: PlaneGeometry, material: ShaderMaterial) {
  const scene = new Scene();
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return scene;
}

function createPipeline(renderer: WebGLRenderer, caseId: CloudShellMicrobenchCaseId): Pipeline {
  const loader = new TextureLoader();
  let pipeline: Pipeline | null = null;
  let weatherReady = false;
  const fullscreenGeometry = new PlaneGeometry(2, 2);
  const earthScene = new Scene();
  const earthGroup = new Group();
  const earthMaterial = new MeshStandardMaterial({ color: "#8ba3b8", metalness: 0.02, roughness: 0.93 });
  const earthMesh = new Mesh(new SphereGeometry(1, 192, 128), earthMaterial);
  earthGroup.add(earthMesh);
  earthScene.add(earthGroup);
  const sunlight = new DirectionalLight("#fff0d8", 2.4);
  earthScene.add(sunlight, sunlight.target);
  const probeOccluderMaterial = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    side: DoubleSide
  });
  const probeOccluder = new Mesh(new PlaneGeometry(2.4, 2.4), probeOccluderMaterial);
  probeOccluder.frustumCulled = false;
  probeOccluder.visible = false;
  earthScene.add(probeOccluder);

  const caseConfig = CLOUD_SHELL_MICROBENCH_CASES[caseId];
  const weatherTexture = loader.load(CLOUD_SHELL_MICROBENCH_V3_SRC, (texture) => {
    texture.colorSpace = NoColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    weatherReady = true;
    if (pipeline) {
      pipeline.weatherReady = true;
    }
  });
  weatherTexture.colorSpace = NoColorSpace;
  weatherTexture.wrapS = RepeatWrapping;
  weatherTexture.wrapT = ClampToEdgeWrapping;
  weatherTexture.magFilter = LinearFilter;
  weatherTexture.minFilter = LinearMipmapLinearFilter;
  weatherTexture.needsUpdate = true;

  const earthTexture = loader.load(EARTH_DAY_SRC);
  earthTexture.colorSpace = SRGBColorSpace;
  earthTexture.minFilter = LinearMipmapLinearFilter;
  earthTexture.magFilter = LinearFilter;
  earthMaterial.map = earthTexture;
  earthMaterial.needsUpdate = true;

  const cloudRaymarchMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: createCloudShellRaymarchFragmentShader(caseConfig),
    toneMapped: false,
    uniforms: {
      cameraMatrixWorld: { value: new Matrix4() },
      cameraWorldPosition: { value: new Vector3() },
      densityScale: { value: 0.000065 },
      innerRadiusEcef: { value: TAKRAM_BOTTOM_RADIUS_M },
      inverseProjection: { value: new Matrix4() },
      sceneDepth: { value: null },
      shellBaseRadiusEcef: { value: TAKRAM_BOTTOM_RADIUS_M + CLOUD_SHELL_BASE_ALTITUDE_M },
      shellThicknessEcef: { value: CLOUD_SHELL_THICKNESS_M },
      showSceneDepthClamp: { value: false },
      sunDirectionEcef: { value: new Vector3() },
      weatherTexture: { value: weatherTexture },
      worldToEcef: { value: new Matrix4() }
    },
    vertexShader: CLOUD_SHELL_FULLSCREEN_VERTEX_SHADER
  });
  const resolveMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: CLOUD_SHELL_RESOLVE_FRAGMENT_SHADER,
    toneMapped: false,
    uniforms: { inputBuffer: { value: null } },
    vertexShader: CLOUD_SHELL_FULLSCREEN_VERTEX_SHADER
  });
  const compositeMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: CLOUD_SHELL_COMPOSITE_FRAGMENT_SHADER,
    toneMapped: false,
    uniforms: {
      cloudBuffer: { value: null },
      sceneColor: { value: null }
    },
    vertexShader: CLOUD_SHELL_FULLSCREEN_VERTEX_SHADER
  });
  const outputMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: CLOUD_SHELL_OUTPUT_FRAGMENT_SHADER,
    toneMapped: false,
    uniforms: {
      cloudBuffer: { value: null },
      compositeBuffer: { value: null },
      debugMode: { value: 0 },
      sceneColor: { value: null }
    },
    vertexShader: CLOUD_SHELL_FULLSCREEN_VERTEX_SHADER
  });

  pipeline = {
    cloudAccumulationScene: createFullscreenScene(fullscreenGeometry, cloudRaymarchMaterial),
    cloudCompositeScene: createFullscreenScene(fullscreenGeometry, compositeMaterial),
    cloudRaymarchMaterial,
    cloudResolveScene: createFullscreenScene(fullscreenGeometry, resolveMaterial),
    cloudResolveMaterial: resolveMaterial,
    compositeMaterial,
    earthGroup,
    earthMaterial,
    earthMesh,
    earthScene,
    earthTexture,
    frameId: 0,
    fullscreenCamera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    fullscreenGeometry,
    gammaColorPass: false,
    gpuFrames: [],
    hdrColorPass: false,
    outputScene: createFullscreenScene(fullscreenGeometry, outputMaterial),
    outputMaterial,
    profiler: renderer.capabilities.isWebGL2
      ? new CloudShellMicrobenchProfiler(renderer.getContext() as WebGL2RenderingContext)
      : null,
    probeOccluder,
    probeOccluderMaterial,
    resolvedHeight: 0,
    resolvedWidth: 0,
    targets: null,
    weatherReady,
    weatherTexture
  };
  return pipeline;
}

function resizePipeline(pipeline: Pipeline, width: number, height: number) {
  if (pipeline.resolvedWidth === width && pipeline.resolvedHeight === height && pipeline.targets) {
    return;
  }

  disposeTargets(pipeline.targets);
  const cloudWidth = Math.max(1, Math.round(width * CLOUD_SHELL_MICROBENCH_RESOLUTION_SCALE));
  const cloudHeight = Math.max(1, Math.round(height * CLOUD_SHELL_MICROBENCH_RESOLUTION_SCALE));
  const opaque = createLinearRenderTarget(width, height, true);
  const cloudAccumulation = createLinearRenderTarget(cloudWidth, cloudHeight);
  const cloudResolve = createLinearRenderTarget(cloudWidth, cloudHeight);
  const composite = createLinearRenderTarget(width, height);
  pipeline.targets = { cloudAccumulation, cloudResolve, composite, opaque };
  pipeline.resolvedWidth = width;
  pipeline.resolvedHeight = height;
  pipeline.cloudRaymarchMaterial.uniforms.sceneDepth.value = opaque.depthTexture;
  pipeline.compositeMaterial.uniforms.sceneColor.value = opaque.texture;
  pipeline.compositeMaterial.uniforms.cloudBuffer.value = cloudResolve.texture;
  pipeline.outputMaterial.uniforms.sceneColor.value = opaque.texture;
  pipeline.outputMaterial.uniforms.cloudBuffer.value = cloudResolve.texture;
  pipeline.outputMaterial.uniforms.compositeBuffer.value = composite.texture;
}

function estimateRtPeakBytes(width: number, height: number) {
  const halfWidth = Math.max(1, Math.round(width * CLOUD_SHELL_MICROBENCH_RESOLUTION_SCALE));
  const halfHeight = Math.max(1, Math.round(height * CLOUD_SHELL_MICROBENCH_RESOLUTION_SCALE));
  const rgba16f = (targetWidth: number, targetHeight: number) => targetWidth * targetHeight * 8;
  const depth24 = width * height * 4;
  return rgba16f(width, height) + depth24 +
    rgba16f(halfWidth, halfHeight) * 2 +
    rgba16f(width, height) +
    4 * 8;
}

function decodeFloat16(value: number) {
  const sign = (value & 0x8000) === 0 ? 1 : -1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) {
    return sign * fraction * 2 ** -24;
  }
  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Infinity : Number.NaN;
  }
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
}

function runHdrProbe(renderer: WebGLRenderer, orthographicCamera: OrthographicCamera) {
  const target = createLinearRenderTarget(4, 1);
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float value = vUv.x < 0.25 ? 0.25 : vUv.x < 0.5 ? 1.0 : vUv.x < 0.75 ? 4.0 : 16.0;
        gl_FragColor = vec4(vec3(value), 1.0);
      }
    `,
    toneMapped: false,
    vertexShader: CLOUD_SHELL_FULLSCREEN_VERTEX_SHADER
  });
  const scene = createFullscreenScene(new PlaneGeometry(2, 2), material);
  // A HalfFloatType attachment must be read as raw 16-bit half-float words.
  // Supplying Float32Array makes WebGL reject the read and would incorrectly
  // turn a supported RGBA16F path into a capability failure.
  const pixels = new Uint16Array(16);
  try {
    renderer.setRenderTarget(target);
    renderer.clear(true, true, true);
    renderer.render(scene, orthographicCamera);
    renderer.readRenderTargetPixels(target, 0, 0, 4, 1, pixels);
    return decodeFloat16(pixels[8]) > 1 && decodeFloat16(pixels[12]) > 1;
  } catch {
    return false;
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    material.dispose();
    scene.children.forEach((child) => {
      const mesh = child as Mesh;
      if (mesh.geometry instanceof PlaneGeometry) {
        mesh.geometry.dispose();
      }
    });
  }
}

function runGammaProbe(renderer: WebGLRenderer, orthographicCamera: OrthographicCamera) {
  const target = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    format: RGBAFormat,
    magFilter: LinearFilter,
    minFilter: LinearFilter,
    stencilBuffer: false,
    type: UnsignedByteType
  });
  // Match the final backbuffer's output contract rather than allowing the
  // intermediate target to silently remain linear.
  target.texture.colorSpace = SRGBColorSpace;
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: /* glsl */ `
      void main() {
        gl_FragColor = vec4(vec3(0.18), 1.0);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
    vertexShader: CLOUD_SHELL_FULLSCREEN_VERTEX_SHADER
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = createFullscreenScene(geometry, material);
  const pixels = new Uint8Array(4);
  try {
    renderer.setRenderTarget(target);
    renderer.clear(true, true, true);
    renderer.render(scene, orthographicCamera);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixels);
    const expectedSrgb = Math.round(255 * 1.055 * 0.18 ** (1 / 2.4) - 255 * 0.055);
    return Math.abs(pixels[0] - expectedSrgb) <= 2 &&
      Math.abs(pixels[1] - expectedSrgb) <= 2 &&
      Math.abs(pixels[2] - expectedSrgb) <= 2;
  } catch {
    return false;
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    material.dispose();
    geometry.dispose();
  }
}

function updateEarthAndCamera(
  pipeline: Pipeline,
  camera: PerspectiveCamera,
  progress: number,
  scenario: CloudShellMicrobenchTransformScenario
) {
  const phase = clampProgress(progress) / 0.18;
  if (scenario === "identity") {
    scratchEarthPosition.set(0, 0, 0);
    scratchEarthQuaternion.identity();
    pipeline.earthGroup.scale.setScalar(1);
    scratchCameraTarget.copy(scratchEarthPosition);
    scratchCameraPosition.copy(scratchCameraTarget).add(new Vector3(
      -0.72 + phase * 0.64,
      1.15 - phase * 0.5,
      7.1 - phase * 1.25
    ));
  } else if (scenario === "reduced") {
    scratchEarthPosition.set(-3 + phase * 0.24, 0.4 - phase * 0.08, 2 - phase * 0.3);
    scratchEarthQuaternion.setFromAxisAngle(new Vector3(0.38, 0.77, 0.51).normalize(), 0.55 + phase * 0.22);
    pipeline.earthGroup.scale.setScalar(0.6);
    scratchCameraTarget.copy(scratchEarthPosition);
    scratchCameraPosition.copy(scratchCameraTarget).add(new Vector3(
      -0.72 + phase * 0.64,
      1.15 - phase * 0.5,
      4.8 - phase * 0.7
    ));
  } else {
    // This is the exact isolated form of EarthMoonScene's opening frame:
    // same mapOpeningProgress camera, Earth transform, FOV, and home-lite
    // world light direction, without mounting the production scene or any
    // of its atmosphere/bloom/cloud render owners.
    const openingFrame = mapOpeningProgress(clampProgress(progress));
    scratchEarthPosition.set(openingFrame.earthX, openingFrame.earthY, 0);
    scratchEarthEuler.set(
      openingFrame.earthPitchDeg * Math.PI / 180,
      openingFrame.earthYawDeg * Math.PI / 180,
      0,
      "YXZ"
    );
    scratchEarthQuaternion.setFromEuler(scratchEarthEuler);
    pipeline.earthGroup.scale.setScalar(openingFrame.earthScale);
    scratchCameraPosition.set(
      Math.sin(openingFrame.cameraAzimuth) * openingFrame.cameraDistance,
      Math.sin(openingFrame.cameraElevation) * openingFrame.cameraDistance,
      Math.cos(openingFrame.cameraAzimuth) * openingFrame.cameraDistance
    );
    scratchCameraTarget.set(0, openingFrame.cameraLookAtY, 0);
  }
  pipeline.earthGroup.position.copy(scratchEarthPosition);
  pipeline.earthGroup.quaternion.copy(scratchEarthQuaternion);
  pipeline.earthGroup.updateMatrixWorld(true);
  scratchEarthMatrix.copy(pipeline.earthGroup.matrixWorld);
  camera.fov = 45;
  camera.near = 0.01;
  camera.far = 100;
  camera.position.copy(scratchCameraPosition);
  camera.lookAt(scratchCameraTarget);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  scratchSunDirectionWorld.set(...DEFAULT_LUBIRTH_SUN_DIRECTION)
    .applyQuaternion(scratchEarthQuaternion)
    .normalize();
}

function updateDepthProbeOccluder(
  pipeline: Pipeline,
  camera: PerspectiveCamera,
  worldToEcef: Matrix4 | null,
  occluderMode: CloudShellMicrobenchOccluderMode
) {
  const occluder = pipeline.probeOccluder;
  if (occluderMode === "none" || !worldToEcef) {
    occluder.visible = false;
    return;
  }

  // The production opening deliberately frames the Earth off the camera's
  // forward axis. Trace the probe through the Earth center, not through the
  // optical axis, so front/middle/behind remain a meaningful cloud interval.
  scratchCameraDirection.copy(pipeline.earthGroup.position).sub(camera.position).normalize();
  scratchEcefRayOrigin.copy(camera.position).applyMatrix4(worldToEcef);
  scratchEcefRayDirection.copy(scratchCameraDirection).applyMatrix3(
    scratchWorldToEcefLinear.setFromMatrix4(worldToEcef)
  );
  const outerInterval = raySphereIntervalGeneral(
    scratchEcefRayOrigin,
    scratchEcefRayDirection,
    TAKRAM_BOTTOM_RADIUS_M + CLOUD_SHELL_BASE_ALTITUDE_M + CLOUD_SHELL_THICKNESS_M
  );
  const innerInterval = raySphereIntervalGeneral(
    scratchEcefRayOrigin,
    scratchEcefRayDirection,
    TAKRAM_BOTTOM_RADIUS_M
  );
  if (!outerInterval) {
    occluder.visible = false;
    return;
  }

  const cloudSegment = resolveCloudShellWorldSegment(outerInterval, innerInterval);
  if (!cloudSegment) {
    occluder.visible = false;
    return;
  }
  const { enter: cloudEnter, exit: cloudExit } = cloudSegment;
  if (!Number.isFinite(cloudEnter) || !Number.isFinite(cloudExit) || cloudExit <= cloudEnter) {
    occluder.visible = false;
    return;
  }

  const cloudLength = cloudExit - cloudEnter;
  const distance = occluderMode === "front"
    ? Math.max(0.01, cloudEnter - Math.max(0.12, cloudLength * 4))
    : occluderMode === "middle"
      // The V3 vertical profile is intentionally concentrated below the
      // minimum 0.35 cloud top. Place the middle probe after its leading
      // clear upper band so it cuts a real, non-zero part of the shell.
      ? cloudEnter + cloudLength * 0.8
      : cloudExit + Math.max(0.12, cloudLength * 4);
  const viewportSpan = 2 * distance * Math.tan(camera.fov * Math.PI / 360) *
    Math.max(1, camera.aspect) * 1.2;
  occluder.visible = true;
  occluder.scale.setScalar(Math.max(1, viewportSpan / 2.4));
  occluder.position.copy(camera.position).addScaledVector(scratchCameraDirection, distance);
  occluder.lookAt(camera.position);
  occluder.updateMatrixWorld(true);
}

function renderStage(
  pipeline: Pipeline,
  shouldMeasure: boolean,
  stage: "densityAndLightRaymarch" | "resolve" | "cloudComposite",
  render: () => void
) {
  const profiler = pipeline.profiler;
  const began = shouldMeasure && profiler?.begin(pipeline.frameId, stage);
  render();
  if (began) {
    profiler?.end();
  }
}

export function LuBirthCloudShellMicrobench({
  caseId,
  debugMode,
  measure = false,
  occluderMode = "none",
  progress,
  showSceneDepthClamp = false,
  transformScenario = "enlarged",
  visualGateConfirmed = false,
  onTelemetry
}: LuBirthCloudShellMicrobenchProps) {
  const { camera, gl } = useThree();
  const pipelineRef = useRef<Pipeline | null>(null);
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;
  const previousRendererStateRef = useRef<{
    autoClear: boolean;
    clearAlpha: number;
    clearColor: Color;
    outputColorSpace: typeof gl.outputColorSpace;
    toneMapping: typeof gl.toneMapping;
    toneMappingExposure: number;
  } | null>(null);

  useEffect(() => {
    previousRendererStateRef.current = {
      autoClear: gl.autoClear,
      clearAlpha: gl.getClearAlpha(),
      clearColor: gl.getClearColor(new Color()),
      outputColorSpace: gl.outputColorSpace,
      toneMapping: gl.toneMapping,
      toneMappingExposure: gl.toneMappingExposure
    };
    gl.autoClear = false;
    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = 1;
    gl.outputColorSpace = SRGBColorSpace;
    const pipeline = createPipeline(gl, caseId);
    pipelineRef.current = pipeline;

    return () => {
      pipelineRef.current = null;
      disposeTargets(pipeline.targets);
      pipeline.profiler?.dispose();
      pipeline.cloudRaymarchMaterial.dispose();
      pipeline.cloudResolveMaterial.dispose();
      pipeline.compositeMaterial.dispose();
      pipeline.outputMaterial.dispose();
      pipeline.earthMaterial.dispose();
      pipeline.probeOccluderMaterial.dispose();
      pipeline.earthMesh.geometry.dispose();
      pipeline.probeOccluder.geometry.dispose();
      pipeline.fullscreenGeometry.dispose();
      pipeline.weatherTexture.dispose();
      pipeline.earthTexture.dispose();
      const previous = previousRendererStateRef.current;
      if (previous) {
        gl.autoClear = previous.autoClear;
        gl.setClearColor(previous.clearColor, previous.clearAlpha);
        gl.outputColorSpace = previous.outputColorSpace;
        gl.toneMapping = previous.toneMapping;
        gl.toneMappingExposure = previous.toneMappingExposure;
      }
    };
  }, [caseId, gl]);

  useFrame(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline || !(camera instanceof PerspectiveCamera)) {
      return;
    }

    gl.getDrawingBufferSize(scratchDrawSize);
    const width = Math.max(1, Math.round(scratchDrawSize.x));
    const height = Math.max(1, Math.round(scratchDrawSize.y));
    resizePipeline(pipeline, width, height);
    const targets = pipeline.targets;
    if (!targets) {
      return;
    }

    pipeline.frameId += 1;
    updateEarthAndCamera(pipeline, camera, progress, transformScenario);
    const bridge = buildLuBirthWorldToEcef(scratchEarthMatrix, 1);
    const coordinatePass = bridge.valid && bridge.worldToEcef !== null;

    const sunlight = pipeline.earthScene.children.find((child) => child instanceof DirectionalLight) as DirectionalLight;
    sunlight.position.copy(scratchCameraTarget).addScaledVector(scratchSunDirectionWorld, 12);
    sunlight.target.position.copy(scratchCameraTarget);
    sunlight.target.updateMatrixWorld(true);

    if (bridge.worldToEcef) {
      pipeline.cloudRaymarchMaterial.uniforms.worldToEcef.value.copy(bridge.worldToEcef);
      pipeline.cloudRaymarchMaterial.uniforms.cameraWorldPosition.value.copy(camera.getWorldPosition(scratchCameraPosition));
      pipeline.cloudRaymarchMaterial.uniforms.cameraMatrixWorld.value.copy(camera.matrixWorld);
      pipeline.cloudRaymarchMaterial.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
      scratchSunDirectionEcef.copy(scratchSunDirectionWorld).transformDirection(bridge.worldToEcef);
      pipeline.cloudRaymarchMaterial.uniforms.sunDirectionEcef.value.copy(scratchSunDirectionEcef);
    }
    updateDepthProbeOccluder(pipeline, camera, bridge.worldToEcef, occluderMode);
    pipeline.outputMaterial.uniforms.debugMode.value = debugModeValue(debugMode);
    pipeline.cloudRaymarchMaterial.uniforms.showSceneDepthClamp.value = showSceneDepthClamp;

    const shouldMeasure = Boolean(
      measure && visualGateConfirmed && pipeline.profiler?.supported &&
      pipeline.frameId > CLOUD_SHELL_MICROBENCH_WARMUP_FRAMES &&
      pipeline.gpuFrames.length < CLOUD_SHELL_MICROBENCH_VALID_GPU_SAMPLES
    );

    gl.setRenderTarget(targets.opaque);
    gl.setClearColor(new Color("#02040a"), 1);
    gl.clear(true, true, true);
    gl.render(pipeline.earthScene, camera);

    gl.setRenderTarget(targets.cloudAccumulation);
    gl.setClearColor(new Color(0, 0, 0), 1);
    gl.clear(true, true, true);
    renderStage(pipeline, shouldMeasure, "densityAndLightRaymarch", () => {
      gl.render(pipeline.cloudAccumulationScene, pipeline.fullscreenCamera);
    });

    pipeline.cloudResolveMaterial.uniforms.inputBuffer.value = targets.cloudAccumulation.texture;
    gl.setRenderTarget(targets.cloudResolve);
    gl.clear(true, true, true);
    renderStage(pipeline, shouldMeasure, "resolve", () => {
      gl.render(pipeline.cloudResolveScene, pipeline.fullscreenCamera);
    });

    gl.setRenderTarget(targets.composite);
    gl.clear(true, true, true);
    renderStage(pipeline, shouldMeasure, "cloudComposite", () => {
      gl.render(pipeline.cloudCompositeScene, pipeline.fullscreenCamera);
    });

    gl.setRenderTarget(null);
    gl.clear(true, true, true);
    gl.render(pipeline.outputScene, pipeline.fullscreenCamera);

    if (pipeline.frameId === 1) {
      pipeline.hdrColorPass = runHdrProbe(gl, pipeline.fullscreenCamera);
      pipeline.gammaColorPass = runGammaProbe(gl, pipeline.fullscreenCamera);
    }
    for (const frame of pipeline.profiler?.poll() ?? []) {
      if (frame.frameId > CLOUD_SHELL_MICROBENCH_WARMUP_FRAMES) {
        pipeline.gpuFrames.push(frame);
      }
    }

    if (pipeline.frameId % 8 === 0 || (pipeline.weatherReady && pipeline.frameId < 8)) {
      const summary = summarizeCloudShellGpuFrames(pipeline.gpuFrames);
      const measurementState = !visualGateConfirmed
        ? "awaiting-visual-review"
        : !pipeline.profiler?.supported
          ? "timer-unavailable"
          : pipeline.gpuFrames.length >= CLOUD_SHELL_MICROBENCH_VALID_GPU_SAMPLES
            ? "complete"
            : pipeline.frameId <= CLOUD_SHELL_MICROBENCH_WARMUP_FRAMES
              ? "warming"
              : "sampling";
      const telemetry: CloudShellMicrobenchTelemetry = {
        active: pipeline.weatherReady && coordinatePass,
        cameraMatrixWorld: camera.matrixWorld.elements.slice(),
        cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
        caseId,
        coordinateGate: coordinatePass ? "PASS" : "FAIL",
        debugMode,
        earthMatrixWorld: scratchEarthMatrix.elements.slice(),
        earthUniformScale: pipeline.earthGroup.scale.x,
        frameId: pipeline.frameId,
        gammaGate: pipeline.gammaColorPass ? "PASS" : "FAIL",
        gpu: {
          invalidFrames: summary.invalidFrameCount,
          p50Ms: summary.p50Ms ?? null,
          p95Ms: summary.p95Ms ?? null,
          sampleCount: summary.sampleCount,
          supported: Boolean(pipeline.profiler?.supported)
        },
        hdrColorGate: pipeline.hdrColorPass && pipeline.gammaColorPass ? "PASS" : "FAIL",
        incrementalRtPeakBytes: estimateRtPeakBytes(width, height),
        measurementState,
        occluderMode,
        progress: clampProgress(progress),
        renderScale: CLOUD_SHELL_MICROBENCH_RESOLUTION_SCALE,
        resolvedSize: [width, height],
        sourceTexture: CLOUD_SHELL_MICROBENCH_V3_SRC,
        showSceneDepthClamp,
        transformScenario
      };
      window.__MiraLithLuBirthCloudMicrobench = telemetry;
      onTelemetryRef.current?.(telemetry);
    }
  }, 1);

  return null;
}
