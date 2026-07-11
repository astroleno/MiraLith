"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Object3D,
  Points,
  PointsMaterial,
  Quaternion,
  SRGBColorSpace,
  Texture,
  Vector3
} from "three";
import type {
  RadioGagaFrame,
  RadioGagaFrameRef,
  RadioGagaQualityProfile,
  RadioGagaSceneMotionRef
} from "./types";

const RADIO_POSITION = new Vector3(0.18, -0.32, 0);
const RADIO_SCALE = 3.14;
const RADIO_START_PITCH = -Math.PI / 6;
const ESP32_START_POSITION = new Vector3(-0.46, -0.1, 0.06);
const ESP32_ROTATION_START_Y = -2.04;
const ESP32_SCALE = 1.58;
const ESP32_REVEAL_SCALE = 0.92;
const WEBSITE_PROOF_ASPECT = 2.15;
const WEBSITE_PROOF_WIDTH = 2.72;
const WEBSITE_PROOF_HEIGHT = WEBSITE_PROOF_WIDTH / WEBSITE_PROOF_ASPECT;
const WEBSITE_PROOF_POSITION = new Vector3(-0.16, 0.16, 0.2);
const WEBSITE_PROOF_ONE_POSITION = WEBSITE_PROOF_POSITION;
const WEBSITE_PROOF_TWO_POSITION = WEBSITE_PROOF_POSITION;

const HIDDEN_MODEL_MORPH_SVG_PATH = {
  data: "M 0 0 C 0.16 0.34 0.52 0.42 0.64 0.10 C 0.78 -0.14 0.91 -0.08 1 0",
  segments: [
    {
      end: 0.64,
      p0: { x: 0, y: 0 },
      p1: { x: 0.16, y: 0.34 },
      p2: { x: 0.52, y: 0.42 },
      p3: { x: 0.64, y: 0.1 },
      start: 0
    },
    {
      end: 1,
      p0: { x: 0.64, y: 0.1 },
      p1: { x: 0.78, y: -0.14 },
      p2: { x: 0.91, y: -0.08 },
      p3: { x: 1, y: 0 },
      start: 0.64
    }
  ]
} as const;

interface RadioGagaParticleTransitionProps {
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  motionRef?: RadioGagaSceneMotionRef;
  quality: RadioGagaQualityProfile;
  reducedMotion?: boolean;
  active: boolean;
}

interface ParticleSeed {
  clusterX: number;
  clusterY: number;
  clusterZ: number;
  delay: number;
  espB: number;
  espG: number;
  espLocalX: number;
  espLocalY: number;
  espLocalZ: number;
  espR: number;
  flowLane: number;
  looseness: number;
  pathDelay: number;
  pathSpeed: number;
  proof1B: number;
  proof1G: number;
  proof1LocalX: number;
  proof1LocalY: number;
  proof1LocalZ: number;
  proof1R: number;
  proof2B: number;
  proof2G: number;
  proof2LocalX: number;
  proof2LocalY: number;
  proof2LocalZ: number;
  proof2R: number;
  proofOrder: number;
  radioB: number;
  radioG: number;
  radioLocalX: number;
  radioLocalY: number;
  radioLocalZ: number;
  radioR: number;
  wavePhase: number;
  waveSpeed: number;
  turbulencePhase: number;
  turbulenceSpeed: number;
}

interface SurfaceColor {
  b: number;
  g: number;
  r: number;
  textureBacked?: boolean;
}

interface TextureColorReader {
  data: Uint8ClampedArray;
  flipY: boolean;
  height: number;
  matrix: number[];
  width: number;
}

interface SurfacePaint {
  baseB: number;
  baseG: number;
  baseR: number;
  reader: TextureColorReader | null;
}

interface SurfaceSampler {
  bounds: Box3;
  cumulativeAreas: Float32Array;
  paints: SurfacePaint[];
  totalArea: number;
  triangles: Float32Array;
  uvs: Float32Array;
}

interface TransformScratch {
  euler: Euler;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const wrap01 = (value: number) => ((value % 1) + 1) % 1;
const TAU = Math.PI * 2;

const RADIO_RED = { r: 0.72, g: 0.05, b: 0.055 };
const RADIO_DARK = { r: 0.36, g: 0.37, b: 0.35 };
const RADIO_PANEL = { r: 0.77, g: 0.69, b: 0.62 };
const RADIO_MARK = { r: 0.92, g: 0.9, b: 0.84 };
const ESP_SHELL = { r: 0.86, g: 0.86, b: 0.82 };
const ESP_SHADOW = { r: 0.24, g: 0.25, b: 0.25 };
const ESP_SCREEN = { r: 0.14, g: 0.15, b: 0.15 };
const ESP_CORE = { r: 0.42, g: 0.82, b: 0.88 };

function seededRandom(seed: number) {
  const value = Math.sin(seed * 127.1) * 43758.5453123;
  return value - Math.floor(value);
}

function colorWithNoise(color: SurfaceColor, index: number, lift = 0) {
  const noise = (seededRandom(index + 401) - 0.5) * 0.045 + lift;

  return {
    b: clamp01(color.b + noise),
    g: clamp01(color.g + noise),
    r: clamp01(color.r + noise),
    textureBacked: color.textureBacked
  };
}

function mixSurfaceColors(from: SurfaceColor, to: SurfaceColor, progress: number): SurfaceColor {
  const t = clamp01(progress);

  return {
    b: lerp(from.b, to.b, t),
    g: lerp(from.g, to.g, t),
    r: lerp(from.r, to.r, t),
    textureBacked: from.textureBacked || to.textureBacked
  };
}

function getParticleCount(quality: RadioGagaQualityProfile, reducedMotion?: boolean) {
  if (reducedMotion || quality.tier === "fallback") {
    return 0;
  }

  if (quality.tier === "high") {
    return 9000;
  }

  if (quality.tier === "medium") {
    return 5600;
  }

  return 2600;
}

function getParticleSize(quality: RadioGagaQualityProfile) {
  if (quality.tier === "high") {
    return 0.014;
  }

  if (quality.tier === "medium") {
    return 0.017;
  }

  return 0.023;
}

function getTextureReader(texture: Texture | null | undefined, cache: Map<string, TextureColorReader | null>) {
  if (!texture || typeof document === "undefined") {
    return null;
  }

  if (cache.has(texture.uuid)) {
    return cache.get(texture.uuid) ?? null;
  }

  const image = texture.image as
    | (CanvasImageSource & {
        height?: number;
        naturalHeight?: number;
        naturalWidth?: number;
        videoHeight?: number;
        videoWidth?: number;
        width?: number;
      })
    | undefined;
  const width = Number(image?.width ?? image?.naturalWidth ?? image?.videoWidth ?? 0);
  const height = Number(image?.height ?? image?.naturalHeight ?? image?.videoHeight ?? 0);

  if (!image || width <= 0 || height <= 0) {
    cache.set(texture.uuid, null);
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    cache.set(texture.uuid, null);
    return null;
  }

  try {
    context.drawImage(image, 0, 0, width, height);
    texture.updateMatrix();
    const reader = {
      data: context.getImageData(0, 0, width, height).data,
      flipY: texture.flipY,
      height,
      matrix: [...texture.matrix.elements],
      width
    };
    cache.set(texture.uuid, reader);
    return reader;
  } catch {
    cache.set(texture.uuid, null);
    return null;
  }
}

function getMaterialPaint(
  material: Material | null,
  materialCache: WeakMap<Material, SurfacePaint>,
  textureCache: Map<string, TextureColorReader | null>
) {
  if (!material) {
    return null;
  }

  const cached = materialCache.get(material);
  if (cached) {
    return cached;
  }

  const texturedMaterial = material as Material & { color?: Color; map?: Texture | null };
  const baseColor = texturedMaterial.color ?? new Color(1, 1, 1);
  const paint = {
    baseB: baseColor.b,
    baseG: baseColor.g,
    baseR: baseColor.r,
    reader: getTextureReader(texturedMaterial.map, textureCache)
  };

  materialCache.set(material, paint);
  return paint;
}

function resolveTriangleMaterial(material: Mesh["material"], groups: BufferGeometry["groups"], firstIndex: number) {
  if (!Array.isArray(material)) {
    return material ?? null;
  }

  const group = groups.find((candidate) => firstIndex >= candidate.start && firstIndex < candidate.start + candidate.count);
  return material[group?.materialIndex ?? 0] ?? material[0] ?? null;
}

function buildSurfaceSampler(scene: Object3D): SurfaceSampler | null {
  const bounds = new Box3();
  const triangles: number[] = [];
  const uvs: number[] = [];
  const cumulativeAreas: number[] = [];
  const paints: SurfacePaint[] = [];
  const materialCache = new WeakMap<Material, SurfacePaint>();
  const textureCache = new Map<string, TextureColorReader | null>();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  let totalArea = 0;

  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    const positionAttribute = child.geometry.getAttribute("position") as BufferAttribute | undefined;
    if (!positionAttribute) {
      return;
    }

    const uvAttribute = child.geometry.getAttribute("uv") as BufferAttribute | undefined;
    const indexAttribute = child.geometry.index;
    const triangleCount = indexAttribute ? Math.floor(indexAttribute.count / 3) : Math.floor(positionAttribute.count / 3);

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const firstIndex = triangleIndex * 3;
      const ia = indexAttribute ? indexAttribute.getX(firstIndex) : firstIndex;
      const ib = indexAttribute ? indexAttribute.getX(firstIndex + 1) : firstIndex + 1;
      const ic = indexAttribute ? indexAttribute.getX(firstIndex + 2) : firstIndex + 2;

      a.fromBufferAttribute(positionAttribute, ia).applyMatrix4(child.matrixWorld);
      b.fromBufferAttribute(positionAttribute, ib).applyMatrix4(child.matrixWorld);
      c.fromBufferAttribute(positionAttribute, ic).applyMatrix4(child.matrixWorld);

      const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
      if (area < 0.000001) {
        continue;
      }

      const material = resolveTriangleMaterial(child.material, child.geometry.groups, firstIndex);
      const paint = getMaterialPaint(material, materialCache, textureCache);

      triangles.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      if (uvAttribute) {
        uvs.push(
          uvAttribute.getX(ia),
          uvAttribute.getY(ia),
          uvAttribute.getX(ib),
          uvAttribute.getY(ib),
          uvAttribute.getX(ic),
          uvAttribute.getY(ic)
        );
      } else {
        uvs.push(0, 0, 0, 0, 0, 0);
      }
      paints.push(paint ?? { baseB: 1, baseG: 1, baseR: 1, reader: null });
      totalArea += area;
      cumulativeAreas.push(totalArea);
      bounds.expandByPoint(a);
      bounds.expandByPoint(b);
      bounds.expandByPoint(c);
    }
  });

  if (!triangles.length || totalArea <= 0) {
    return null;
  }

  return {
    bounds,
    cumulativeAreas: new Float32Array(cumulativeAreas),
    paints,
    totalArea,
    triangles: new Float32Array(triangles),
    uvs: new Float32Array(uvs)
  };
}

function pickTriangleIndex(sampler: SurfaceSampler, pick: number) {
  let low = 0;
  let high = sampler.cumulativeAreas.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sampler.cumulativeAreas[middle] < pick) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function samplePaintColor(paint: SurfacePaint, textureU: number, textureV: number, index: number) {
  let r = paint.baseR;
  let g = paint.baseG;
  let b = paint.baseB;

  if (paint.reader) {
    const matrix = paint.reader.matrix;
    const mappedU = matrix[0] * textureU + matrix[3] * textureV + matrix[6];
    const mappedV = matrix[1] * textureU + matrix[4] * textureV + matrix[7];
    const wrappedU = wrap01(mappedU);
    const wrappedV = wrap01(mappedV);
    const imageV = paint.reader.flipY ? wrappedV : 1 - wrappedV;
    const x = Math.min(paint.reader.width - 1, Math.max(0, Math.floor(wrappedU * paint.reader.width)));
    const y = Math.min(paint.reader.height - 1, Math.max(0, Math.floor(imageV * paint.reader.height)));
    const pixelOffset = (y * paint.reader.width + x) * 4;
    const alpha = paint.reader.data[pixelOffset + 3] / 255;

    if (alpha > 0.03) {
      r *= paint.reader.data[pixelOffset] / 255;
      g *= paint.reader.data[pixelOffset + 1] / 255;
      b *= paint.reader.data[pixelOffset + 2] / 255;
    }
  }

  return colorWithNoise({ b, g, r, textureBacked: Boolean(paint.reader) }, index, paint.reader ? 0.012 : 0.028);
}

function sampleProofTextureColor(reader: TextureColorReader | null, u: number, v: number, index: number) {
  if (!reader) {
    return colorWithNoise({ r: 0.74, g: 0.72, b: 0.66 }, index, 0.02);
  }

  const x = Math.min(reader.width - 1, Math.max(0, Math.floor(clamp01(u) * reader.width)));
  const y = Math.min(reader.height - 1, Math.max(0, Math.floor(clamp01(v) * reader.height)));
  const pixelOffset = (y * reader.width + x) * 4;
  const alpha = reader.data[pixelOffset + 3] / 255;
  const brightness = 0.94;
  const lift = 0.035;
  const r = alpha > 0.02 ? reader.data[pixelOffset] / 255 : 0.08;
  const g = alpha > 0.02 ? reader.data[pixelOffset + 1] / 255 : 0.08;
  const b = alpha > 0.02 ? reader.data[pixelOffset + 2] / 255 : 0.08;

  return colorWithNoise(
    {
      b: clamp01(b * brightness + lift),
      g: clamp01(g * brightness + lift),
      r: clamp01(r * brightness + lift),
      textureBacked: true
    },
    index,
    0.004
  );
}

function sampleSurfacePoint(sampler: SurfaceSampler, index: number, offset: number, target: Vector3) {
  const triangleIndex = pickTriangleIndex(sampler, seededRandom(index + offset) * sampler.totalArea);
  const triangleOffset = triangleIndex * 9;
  const uvOffset = triangleIndex * 6;
  let baryB = seededRandom(index + offset + 11);
  let baryC = seededRandom(index + offset + 17);

  if (baryB + baryC > 1) {
    baryB = 1 - baryB;
    baryC = 1 - baryC;
  }

  const baryA = 1 - baryB - baryC;
  const ax = sampler.triangles[triangleOffset];
  const ay = sampler.triangles[triangleOffset + 1];
  const az = sampler.triangles[triangleOffset + 2];
  const bx = sampler.triangles[triangleOffset + 3];
  const by = sampler.triangles[triangleOffset + 4];
  const bz = sampler.triangles[triangleOffset + 5];
  const cx = sampler.triangles[triangleOffset + 6];
  const cy = sampler.triangles[triangleOffset + 7];
  const cz = sampler.triangles[triangleOffset + 8];

  target.set(
    ax * baryA + bx * baryB + cx * baryC,
    ay * baryA + by * baryB + cy * baryC,
    az * baryA + bz * baryB + cz * baryC
  );

  const textureU =
    sampler.uvs[uvOffset] * baryA + sampler.uvs[uvOffset + 2] * baryB + sampler.uvs[uvOffset + 4] * baryC;
  const textureV =
    sampler.uvs[uvOffset + 1] * baryA + sampler.uvs[uvOffset + 3] * baryB + sampler.uvs[uvOffset + 5] * baryC;

  return samplePaintColor(sampler.paints[triangleIndex], textureU, textureV, index + offset);
}

function normalizedInBounds(value: number, min: number, max: number) {
  return clamp01((value - min) / Math.max(max - min, 0.0001));
}

function radioColorForPoint(point: Vector3, bounds: Box3, index: number) {
  const nx = normalizedInBounds(point.x, bounds.min.x, bounds.max.x);
  const ny = normalizedInBounds(point.y, bounds.min.y, bounds.max.y);
  const nz = normalizedInBounds(point.z, bounds.min.z, bounds.max.z);
  const isOuterShell = nx < 0.08 || nx > 0.92 || ny < 0.08 || ny > 0.92 || nz > 0.78;
  const isPanel = nx > 0.66 && ny > 0.18 && ny < 0.82;
  const isBadge = nx < 0.22 && ny < 0.26;
  const baseColor = isOuterShell ? RADIO_RED : isBadge ? RADIO_MARK : isPanel ? RADIO_PANEL : RADIO_DARK;

  return colorWithNoise(baseColor, index, isOuterShell ? 0.03 : isPanel ? 0.04 : 0.09);
}

function espColorForPoint(point: Vector3, bounds: Box3, index: number) {
  const nx = normalizedInBounds(point.x, bounds.min.x, bounds.max.x);
  const ny = normalizedInBounds(point.y, bounds.min.y, bounds.max.y);
  const nz = normalizedInBounds(point.z, bounds.min.z, bounds.max.z);
  const isOuterShell = nx < 0.1 || nx > 0.9 || ny < 0.1 || ny > 0.9;
  const isFrontLayer = nz < 0.28 || nz > 0.72;
  const isScreen = isFrontLayer && nx > 0.18 && nx < 0.78 && ny > 0.2 && ny < 0.82;
  const isPortraitCore = isScreen && nx > 0.38 && nx < 0.58 && ny > 0.36 && ny < 0.62;
  const baseColor = isOuterShell
    ? ESP_SHADOW
    : isPortraitCore
      ? ESP_CORE
      : isScreen
        ? ESP_SCREEN
        : seededRandom(index + 503) > 0.82
          ? ESP_SHADOW
          : ESP_SHELL;

  return colorWithNoise(baseColor, index, isPortraitCore ? 0.02 : 0.035);
}

function cubic(from: number, controlOne: number, controlTwo: number, to: number, progress: number) {
  const t = clamp01(progress);
  const inv = 1 - t;
  return (
    from * inv * inv * inv +
    controlOne * 3 * inv * inv * t +
    controlTwo * 3 * inv * t * t +
    to * t * t * t
  );
}

function sampleHiddenSvgTransitionPath(target: Vector3, source: Vector3, destination: Vector3, progress: number) {
  const t = clamp01(progress);
  const segment =
    t <= HIDDEN_MODEL_MORPH_SVG_PATH.segments[0].end
      ? HIDDEN_MODEL_MORPH_SVG_PATH.segments[0]
      : HIDDEN_MODEL_MORPH_SVG_PATH.segments[1];
  const localProgress = (t - segment.start) / Math.max(segment.end - segment.start, 0.0001);
  const pathX = cubic(segment.p0.x, segment.p1.x, segment.p2.x, segment.p3.x, localProgress);
  const pathY = cubic(segment.p0.y, segment.p1.y, segment.p2.y, segment.p3.y, localProgress);

  target.lerpVectors(source, destination, pathX);
  target.y += pathY;
  target.z += Math.sin(t * Math.PI) * 0.16;
}

function writeRadioMatrix(
  target: Matrix4,
  frame: RadioGagaFrame,
  scratch: TransformScratch,
  motionRef?: RadioGagaSceneMotionRef
) {
  const radioFrontProgress = smooth(range(frame.progress, 0.045, 0.18));
  const radioParallaxStrength = radioFrontProgress * (1 - smooth(range(frame.progress, 0.17, 0.225)));
  const radioParallaxY = (motionRef?.current.rotationY ?? 0) * radioParallaxStrength;
  const parallaxX = radioParallaxY * 0.38;
  const radioPitch = lerp(RADIO_START_PITCH, 0, radioFrontProgress);
  const scale = frame.radioScale * RADIO_SCALE;

  scratch.position.set(RADIO_POSITION.x + parallaxX, RADIO_POSITION.y, RADIO_POSITION.z);
  scratch.scale.setScalar(scale);
  scratch.euler.set(radioPitch, frame.radioRotationY + radioParallaxY, 0);
  scratch.quaternion.setFromEuler(scratch.euler);
  target.compose(scratch.position, scratch.quaternion, scratch.scale);
}

function writeEspStartMatrix(target: Matrix4, scratch: TransformScratch) {
  scratch.position.copy(ESP32_START_POSITION);
  scratch.scale.setScalar(ESP32_SCALE * ESP32_REVEAL_SCALE);
  scratch.euler.set(0, ESP32_ROTATION_START_Y, 0);
  scratch.quaternion.setFromEuler(scratch.euler);
  target.compose(scratch.position, scratch.quaternion, scratch.scale);
}

export function RadioGagaParticleTransition({
  frame,
  frameRef,
  motionRef,
  quality,
  reducedMotion = false,
  active
}: RadioGagaParticleTransitionProps) {
  const radio = useGLTF("/model/radio_gaga.glb");
  const esp32 = useGLTF("/model/xiaozhi_esp32.glb");
  const websiteTextures = useTexture(["/img/website1.PNG", "/img/website2.png"]) as Texture[];
  const pointsRef = useRef<Points>(null);
  const proofOneRef = useRef<Mesh>(null);
  const proofTwoRef = useRef<Mesh>(null);
  const particleCount = useMemo(() => getParticleCount(quality, reducedMotion), [quality, reducedMotion]);
  const radioSampler = useMemo(() => buildSurfaceSampler(radio.scene), [radio.scene]);
  const espSampler = useMemo(() => buildSurfaceSampler(esp32.scene), [esp32.scene]);
  const proofPlaneMaterials = useMemo(() => {
    websiteTextures.forEach((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
    });

    return websiteTextures.map((texture) => {
      const material = new MeshBasicMaterial({
        depthTest: true,
        depthWrite: false,
        map: texture,
        opacity: 0,
        toneMapped: false,
        transparent: true
      });
      return material;
    });
  }, [websiteTextures]);
  const websiteProofReaders = useMemo(() => {
    const textureCache = new Map<string, TextureColorReader | null>();

    return {
      first: getTextureReader(websiteTextures[0], textureCache),
      second: getTextureReader(websiteTextures[1], textureCache)
    };
  }, [websiteTextures]);
  const particleSeeds = useMemo<ParticleSeed[]>(() => {
    if (!radioSampler || !espSampler) {
      return [];
    }

    const radioPoint = new Vector3();
    const espPoint = new Vector3();
    const radioBoundsSize = radioSampler.bounds.getSize(new Vector3());
    const safeRadioWidth = Math.max(radioBoundsSize.x, 0.0001);
    const safeRadioHeight = Math.max(radioBoundsSize.y, 0.0001);
    const proofColumns = Math.max(1, Math.ceil(Math.sqrt(particleCount * WEBSITE_PROOF_ASPECT)));
    const proofRows = Math.max(1, Math.ceil(particleCount / proofColumns));

    return Array.from({ length: particleCount }, (_, index) => {
      const sampledRadioColor = sampleSurfacePoint(radioSampler, index, 1000, radioPoint);
      const sampledEspColor = sampleSurfacePoint(espSampler, index, 4000, espPoint);
      const espSemanticColor = espColorForPoint(espPoint, espSampler.bounds, index);
      const radioColor = sampledRadioColor.textureBacked
        ? sampledRadioColor
        : radioColorForPoint(radioPoint, radioSampler.bounds, index);
      const espColor = sampledEspColor.textureBacked
        ? mixSurfaceColors(sampledEspColor, espSemanticColor, 0.46)
        : espSemanticColor;
      const theta = seededRandom(index + 601) * Math.PI * 2;
      const zNormal = seededRandom(index + 607) * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - zNormal * zNormal));
      const clusterRadius = 0.018 + Math.pow(seededRandom(index + 613), 1.7) * 0.08;
      const radioXOrder = clamp01((radioPoint.x - radioSampler.bounds.min.x) / safeRadioWidth);
      const radioYOrder = clamp01((radioPoint.y - radioSampler.bounds.min.y) / safeRadioHeight);
      const randomDelay = seededRandom(index + 37);
      const proofColumn = index % proofColumns;
      const proofRow = Math.floor(index / proofColumns) % proofRows;
      const proofU = clamp01((proofColumn + 0.12 + seededRandom(index + 701) * 0.76) / proofColumns);
      const proofV = clamp01((proofRow + 0.12 + seededRandom(index + 709) * 0.76) / proofRows);
      const proof1Color = sampleProofTextureColor(websiteProofReaders.first, proofU, proofV, index + 7000);
      const proof2Color = sampleProofTextureColor(websiteProofReaders.second, proofU, proofV, index + 8000);
      const proofX = (proofU - 0.5) * WEBSITE_PROOF_WIDTH;
      const proofY = (0.5 - proofV) * WEBSITE_PROOF_HEIGHT;
      const proofDepth = (seededRandom(index + 719) - 0.5) * 0.018;
      const proofOrder = clamp01(proofU * 0.42 + proofV * 0.24 + randomDelay * 0.34);

      return {
        clusterX: Math.cos(theta) * radial * clusterRadius,
        clusterY: Math.sin(theta) * radial * clusterRadius,
        clusterZ: zNormal * clusterRadius * 0.72,
        delay: seededRandom(index + 7),
        espB: espColor.b,
        espG: espColor.g,
        espLocalX: espPoint.x,
        espLocalY: espPoint.y,
        espLocalZ: espPoint.z,
        espR: espColor.r,
        flowLane: seededRandom(index + 619),
        looseness: 0.018 + Math.pow(seededRandom(index + 11), 1.45) * 0.055,
        pathDelay: clamp01(radioXOrder * 0.42 + (1 - radioYOrder) * 0.2 + randomDelay * 0.38),
        pathSpeed: seededRandom(index + 653),
        proof1B: proof1Color.b,
        proof1G: proof1Color.g,
        proof1LocalX: proofX,
        proof1LocalY: proofY,
        proof1LocalZ: proofDepth,
        proof1R: proof1Color.r,
        proof2B: proof2Color.b,
        proof2G: proof2Color.g,
        proof2LocalX: proofX,
        proof2LocalY: proofY,
        proof2LocalZ: proofDepth,
        proof2R: proof2Color.r,
        proofOrder,
        radioB: radioColor.b,
        radioG: radioColor.g,
        radioLocalX: radioPoint.x,
        radioLocalY: radioPoint.y,
        radioLocalZ: radioPoint.z,
        radioR: radioColor.r,
        wavePhase: seededRandom(index + 631) * TAU,
        waveSpeed: 1.6 + seededRandom(index + 641) * 2.4,
        turbulencePhase: seededRandom(index + 17) * Math.PI * 2,
        turbulenceSpeed: 1.5 + seededRandom(index + 23) * 1.8
      };
    });
  }, [espSampler, particleCount, radioSampler, websiteProofReaders.first, websiteProofReaders.second]);

  const particleGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(particleSeeds.length * 3);
    const colors = new Float32Array(particleSeeds.length * 3);

    particleSeeds.forEach((seed, index) => {
      const i3 = index * 3;
      positions[i3] = seed.radioLocalX;
      positions[i3 + 1] = seed.radioLocalY;
      positions[i3 + 2] = seed.radioLocalZ;
      colors[i3] = seed.radioR;
      colors[i3 + 1] = seed.radioG;
      colors[i3 + 2] = seed.radioB;
    });

    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    return geometry;
  }, [particleSeeds]);

  const particleMaterial = useMemo(() => {
    const material = new PointsMaterial({
      blending: NormalBlending,
      depthTest: true,
      depthWrite: true,
      opacity: 0,
      size: getParticleSize(quality),
      sizeAttenuation: true,
      transparent: true,
      vertexColors: true
    });
    material.toneMapped = false;
    return material;
  }, [quality]);

  const scratch = useMemo(
    () => ({
      centerPath: new Vector3(),
      clusterOffset: new Vector3(),
      colorAttribute: null as BufferAttribute | null,
      destinationCenter: new Vector3(),
      espMatrix: new Matrix4(),
      flowPoint: new Vector3(),
      point: new Vector3(),
      proofCenter: new Vector3(),
      proofOffset: new Vector3(),
      proofPoint: new Vector3(),
      radioCenter: new Vector3(),
      radioMatrix: new Matrix4(),
      sourceLocal: new Vector3(),
      sourceOffset: new Vector3(),
      targetLocal: new Vector3(),
      targetOffset: new Vector3(),
      streamOffset: new Vector3(),
      transform: {
        euler: new Euler(),
        position: new Vector3(),
        quaternion: new Quaternion(),
        scale: new Vector3()
      }
    }),
    []
  );

  useEffect(
    () => () => {
      particleGeometry.dispose();
      particleMaterial.dispose();
      proofPlaneMaterials.forEach((material) => material.dispose());
    },
    [particleGeometry, particleMaterial, proofPlaneMaterials]
  );

  useFrame(({ clock }) => {
    const nextFrame = frameRef?.current ?? frame;
    const particleOpacity = active ? nextFrame.particleOpacity : 0;

    if (!particleSeeds.length || !radioSampler || !espSampler) {
      return;
    }

    const positionAttribute = particleGeometry.getAttribute("position") as BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
    const colorAttribute = particleGeometry.getAttribute("color") as BufferAttribute;
    const colors = colorAttribute.array as Float32Array;
    const elapsed = reducedMotion ? 0 : clock.elapsedTime;
    const proofArrivalProgress = smooth(range(nextFrame.progress, 0.16, 0.32));
    const proofSwitchProgress = smooth(range(nextFrame.progress, 0.43, 0.54));
    const proofExitProgress = smooth(range(nextFrame.progress, 0.62, 0.72));
    const pathProgress = smooth(range(nextFrame.progress, 0.62, 0.82));
    const expandProgress = smooth(range(nextFrame.progress, 0.78, 0.89));
    const turbulence = reducedMotion ? 0 : nextFrame.particleTurbulence;
    const travelWindow = smooth(range(nextFrame.progress, 0.62, 0.8)) * (1 - smooth(range(nextFrame.progress, 0.88, 0.925)));
    const streamUnpack = smooth(range(nextFrame.progress, 0.62, 0.78)) * (1 - smooth(range(nextFrame.progress, 0.9, 0.94)));
    const clusterCharge = smooth(range(nextFrame.progress, 0.2, 0.32)) * (1 - smooth(range(nextFrame.progress, 0.4, 0.56)));

    writeRadioMatrix(scratch.radioMatrix, nextFrame, scratch.transform, motionRef);
    writeEspStartMatrix(scratch.espMatrix, scratch.transform);
    radioSampler.bounds.getCenter(scratch.radioCenter).applyMatrix4(scratch.radioMatrix);
    espSampler.bounds.getCenter(scratch.destinationCenter).applyMatrix4(scratch.espMatrix);
    particleSeeds.forEach((seed, index) => {
      const delayedCollapse = smooth(clamp01(proofArrivalProgress * 1.1 - seed.proofOrder * 0.08));
      const proofSwitch = smooth(clamp01(proofSwitchProgress * 1.08 - seed.proofOrder * 0.06));
      const proofExit = smooth(clamp01(proofExitProgress * 1.12 - seed.pathDelay * 0.2));
      const delayedExpand = smooth(clamp01(expandProgress * 1.1 - seed.pathDelay * 0.1));
      const pathDuration = 0.48 + (1 - seed.pathSpeed) * 0.38;
      const localPathProgress = smooth(clamp01((pathProgress - seed.pathDelay * 0.52) / pathDuration));
      const particlePathProgress = lerp(localPathProgress, 1, delayedExpand * delayedExpand);
      const localTravelPulse = 0.42 + Math.sin(particlePathProgress * Math.PI) * 0.58;
      const swirlPhase = seed.turbulencePhase + elapsed * seed.turbulenceSpeed;
      const wavePhase = seed.wavePhase + elapsed * seed.waveSpeed + particlePathProgress * Math.PI * 5.2;
      const travelSerpent = travelWindow * delayedCollapse * (1 - delayedExpand) * localTravelPulse;
      const serpentCrest = Math.sin(particlePathProgress * Math.PI) * travelSerpent;
      const lane = seed.flowLane - 0.5;
      const ribbonPhase = wavePhase * 0.82 + seed.flowLane * TAU;
      const ribbonSpread = travelSerpent * (1.05 + seed.pathSpeed * 0.75);
      const proofShapeMotion = delayedCollapse * (1 - proofExit) * particleOpacity;
      const streamWeight = proofExit * (1 - delayedExpand) * streamUnpack;
      const sourceShapeMotion = (1 - delayedCollapse) * (1 - delayedExpand) * particleOpacity;
      const targetShapeMotion = delayedExpand * (1 - travelSerpent) * particleOpacity;
      const collapseWhorl = Math.sin(delayedCollapse * Math.PI) * (1 - proofExit) * (1 - delayedExpand);
      const expandCrest = Math.sin(delayedExpand * Math.PI) * delayedExpand * (1 - nextFrame.esp32SolidMotionProgress * 0.7);
      const source = scratch.sourceLocal
        .set(seed.radioLocalX, seed.radioLocalY, seed.radioLocalZ)
        .applyMatrix4(scratch.radioMatrix);
      const destination = scratch.targetLocal
        .set(seed.espLocalX, seed.espLocalY, seed.espLocalZ)
        .applyMatrix4(scratch.espMatrix);
      const i3 = index * 3;

      scratch.sourceOffset.subVectors(source, scratch.radioCenter);
      scratch.targetOffset.subVectors(destination, scratch.destinationCenter);
      scratch.proofCenter.lerpVectors(WEBSITE_PROOF_ONE_POSITION, WEBSITE_PROOF_TWO_POSITION, proofSwitch);
      scratch.proofPoint.set(
        lerp(
          WEBSITE_PROOF_ONE_POSITION.x + seed.proof1LocalX,
          WEBSITE_PROOF_TWO_POSITION.x + seed.proof2LocalX,
          proofSwitch
        ),
        lerp(
          WEBSITE_PROOF_ONE_POSITION.y + seed.proof1LocalY,
          WEBSITE_PROOF_TWO_POSITION.y + seed.proof2LocalY,
          proofSwitch
        ),
        lerp(
          WEBSITE_PROOF_ONE_POSITION.z + seed.proof1LocalZ,
          WEBSITE_PROOF_TWO_POSITION.z + seed.proof2LocalZ,
          proofSwitch
        )
      );
      scratch.proofOffset.subVectors(scratch.proofPoint, scratch.proofCenter);
      sampleHiddenSvgTransitionPath(
        scratch.centerPath,
        WEBSITE_PROOF_TWO_POSITION,
        scratch.destinationCenter,
        particlePathProgress
      );
      scratch.centerPath.x +=
        Math.sin(particlePathProgress * Math.PI * 2.4 + elapsed * (1.1 + seed.pathSpeed * 1.6) + seed.pathDelay * TAU) *
        travelSerpent *
        0.12;
      scratch.centerPath.y +=
        Math.sin(particlePathProgress * Math.PI * 3.2 + elapsed * (1.5 + seed.pathSpeed * 1.4) + seed.flowLane * TAU) *
        travelSerpent *
        0.32;
      scratch.centerPath.z +=
        Math.cos(particlePathProgress * Math.PI * 2.6 + elapsed * (1.2 + seed.pathSpeed * 1.5) + seed.delay * TAU) *
        travelSerpent *
        0.22;
      scratch.clusterOffset
        .set(seed.clusterX, seed.clusterY, seed.clusterZ)
        .multiplyScalar(1 + clusterCharge * 0.24 + Math.sin(swirlPhase * 1.17) * clusterCharge * 0.08);
      scratch.clusterOffset.x += lane * travelSerpent * 0.2;
      scratch.clusterOffset.y += Math.sin(wavePhase) * travelSerpent * 0.08;
      scratch.clusterOffset.z += Math.cos(wavePhase * 0.92) * travelSerpent * 0.06;
      scratch.clusterOffset.x += Math.sin(wavePhase * 0.43 + seed.delay * TAU) * serpentCrest * 0.05;
      scratch.clusterOffset.y += Math.sin(ribbonPhase) * serpentCrest * (0.035 + seed.looseness * 0.5);
      scratch.clusterOffset.z += Math.cos(ribbonPhase * 1.08) * serpentCrest * (0.03 + seed.looseness * 0.42);
      scratch.clusterOffset.y += Math.sin(wavePhase * 1.86 + seed.pathDelay * TAU) * travelSerpent * 0.032;
      scratch.clusterOffset.z += Math.cos(wavePhase * 1.64 + seed.delay * TAU) * travelSerpent * 0.028;
      scratch.streamOffset
        .set(
          lane * (0.82 + seed.looseness * 6.4) + Math.sin(ribbonPhase * 0.72) * (0.12 + seed.looseness * 0.95),
          Math.sin(ribbonPhase) * (0.18 + seed.looseness * 2.2) +
            Math.sin(wavePhase * 1.9 + seed.pathDelay * TAU) * (0.07 + seed.looseness * 0.45),
          Math.cos(ribbonPhase * 1.08) * (0.15 + seed.looseness * 1.7) +
            Math.cos(wavePhase * 1.55 + seed.delay * TAU) * (0.06 + seed.looseness * 0.4)
        )
        .multiplyScalar(ribbonSpread);
      scratch.flowPoint
        .copy(scratch.centerPath)
        .addScaledVector(
          scratch.proofOffset,
          Math.pow(1 - particlePathProgress, 1.65) * (1 - delayedExpand) * (1 - streamUnpack * 0.9)
        )
        .addScaledVector(scratch.streamOffset, streamWeight)
        .addScaledVector(scratch.targetOffset, delayedExpand);
      scratch.point.copy(source).lerp(scratch.proofPoint, delayedCollapse).lerp(scratch.flowPoint, proofExit);

      const sourceSurfacePhase =
        seed.wavePhase +
        elapsed * (1.2 + seed.waveSpeed * 0.32) +
        scratch.sourceOffset.x * 2.8 +
        scratch.sourceOffset.y * 4.1 +
        scratch.sourceOffset.z * 2.3;
      const targetSurfacePhase =
        seed.wavePhase +
        elapsed * (1.4 + seed.waveSpeed * 0.38) +
        scratch.targetOffset.x * 3.2 +
        scratch.targetOffset.y * 3.9 +
        scratch.targetOffset.z * 2.6;
      const proofSurfacePhase =
        seed.wavePhase +
        elapsed * (1.35 + seed.waveSpeed * 0.26) +
        seed.proof1LocalX * 5.8 +
        seed.proof1LocalY * 8.4;
      const sourceSurfaceFlow =
        sourceShapeMotion * (0.006 + seed.looseness * 0.12) * (0.8 + turbulence * 0.8);
      const proofSurfaceFlow = proofShapeMotion * (0.003 + seed.looseness * 0.055) * (0.8 + turbulence * 0.42);
      const targetSurfaceFlow =
        targetShapeMotion * (0.007 + seed.looseness * 0.1) * (0.9 + (1 - nextFrame.esp32Opacity) * 0.5);
      scratch.point.x +=
        Math.sin(sourceSurfacePhase) * sourceSurfaceFlow +
        Math.sin(proofSurfacePhase) * proofSurfaceFlow +
        Math.cos(targetSurfacePhase * 0.73 + seed.delay * TAU) * targetSurfaceFlow * 0.55;
      scratch.point.y +=
        Math.cos(sourceSurfacePhase * 0.83 + seed.delay * TAU) * sourceSurfaceFlow * 0.72 +
        Math.cos(proofSurfacePhase * 0.78 + seed.delay * TAU) * proofSurfaceFlow * 0.55 +
        Math.sin(targetSurfacePhase) * targetSurfaceFlow * 0.82;
      scratch.point.z +=
        Math.sin(sourceSurfacePhase * 1.19 + seed.pathDelay * TAU) * sourceSurfaceFlow * 0.6 +
        Math.sin(proofSurfacePhase * 1.13 + seed.flowLane * TAU) * proofSurfaceFlow * 0.42 +
        Math.cos(targetSurfacePhase * 1.17 + seed.flowLane * TAU) * targetSurfaceFlow * 0.64;

      scratch.point.x += Math.sin(swirlPhase + scratch.sourceOffset.y * 4.2) * collapseWhorl * seed.looseness * 1.02;
      scratch.point.y += Math.cos(swirlPhase * 0.86 + scratch.sourceOffset.x * 3.7) * collapseWhorl * seed.looseness * 0.72;
      scratch.point.z += Math.sin(swirlPhase * 1.14 + scratch.sourceOffset.z * 4.8) * collapseWhorl * seed.looseness * 0.54;
      scratch.point.x += Math.sin(wavePhase + scratch.targetOffset.y * 2.6) * expandCrest * 0.038;
      scratch.point.y += Math.cos(wavePhase * 0.9 + scratch.targetOffset.x * 2.2) * expandCrest * 0.048;
      scratch.point.z += Math.sin(wavePhase * 1.2 + scratch.targetOffset.x * 1.5) * expandCrest * 0.034;

      const looseness =
        (1 - delayedExpand) *
        (0.008 + seed.looseness * (0.2 + travelSerpent * 1.2 + clusterCharge * 0.48)) *
        turbulence;
      scratch.point.x += Math.cos(swirlPhase) * looseness;
      scratch.point.y += Math.sin(swirlPhase * 1.31) * looseness * 0.74;
      scratch.point.z += Math.sin(swirlPhase * 0.83) * looseness * 0.62;

      positions[i3] = scratch.point.x;
      positions[i3 + 1] = scratch.point.y;
      positions[i3 + 2] = scratch.point.z;
      const proofR = lerp(seed.proof1R, seed.proof2R, proofSwitch);
      const proofG = lerp(seed.proof1G, seed.proof2G, proofSwitch);
      const proofB = lerp(seed.proof1B, seed.proof2B, proofSwitch);
      const espColorProgress = Math.max(delayedExpand, smooth(range(particlePathProgress, 0.42, 1)));
      const heldR = lerp(seed.radioR, proofR, delayedCollapse);
      const heldG = lerp(seed.radioG, proofG, delayedCollapse);
      const heldB = lerp(seed.radioB, proofB, delayedCollapse);
      const flowR = lerp(proofR, seed.espR, espColorProgress);
      const flowG = lerp(proofG, seed.espG, espColorProgress);
      const flowB = lerp(proofB, seed.espB, espColorProgress);
      colors[i3] = lerp(heldR, flowR, proofExit);
      colors[i3 + 1] = lerp(heldG, flowG, proofExit);
      colors[i3 + 2] = lerp(heldB, flowB, proofExit);
    });

    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    particleMaterial.depthWrite = nextFrame.progress < 0.91;
    const proofReadability = proofArrivalProgress * (1 - proofExitProgress);
    const proofParticleSuppression =
      smooth(range(nextFrame.progress, 0.245, 0.3)) * (1 - smooth(range(nextFrame.progress, 0.69, 0.75)));
    const proofParticleOpacity = 1 - proofParticleSuppression;
    particleMaterial.size =
      getParticleSize(quality) *
      (1 + proofReadability * proofParticleOpacity * (quality.tier === "low" ? 0.28 : 0.62));
    particleMaterial.opacity = particleOpacity * proofParticleOpacity * (quality.tier === "low" ? 0.9 : 1);

    const proofPlaneOpacity =
      particleOpacity *
      smooth(range(nextFrame.progress, 0.3, 0.36)) *
      (1 - smooth(range(nextFrame.progress, 0.62, 0.7))) *
      0.92;
    const proofOneOpacity = proofPlaneOpacity * (1 - proofSwitchProgress);
    const proofTwoOpacity = proofPlaneOpacity * proofSwitchProgress;
    proofPlaneMaterials[0].opacity = proofOneOpacity;
    proofPlaneMaterials[1].opacity = proofTwoOpacity;

    if (pointsRef.current) {
      pointsRef.current.visible = particleMaterial.opacity > 0.01;
    }
    if (proofOneRef.current) {
      proofOneRef.current.visible = proofOneOpacity > 0.01;
    }
    if (proofTwoRef.current) {
      proofTwoRef.current.visible = proofTwoOpacity > 0.01;
    }
  });

  if (!active || !particleSeeds.length) {
    return null;
  }

  return (
    <>
      <mesh
        ref={proofOneRef}
        material={proofPlaneMaterials[0]}
        position={[WEBSITE_PROOF_ONE_POSITION.x, WEBSITE_PROOF_ONE_POSITION.y, WEBSITE_PROOF_ONE_POSITION.z - 0.018]}
        renderOrder={3}
        visible={false}
      >
        <planeGeometry args={[WEBSITE_PROOF_WIDTH, WEBSITE_PROOF_HEIGHT]} />
      </mesh>
      <mesh
        ref={proofTwoRef}
        material={proofPlaneMaterials[1]}
        position={[WEBSITE_PROOF_TWO_POSITION.x, WEBSITE_PROOF_TWO_POSITION.y, WEBSITE_PROOF_TWO_POSITION.z - 0.018]}
        renderOrder={3}
        visible={false}
      >
        <planeGeometry args={[WEBSITE_PROOF_WIDTH, WEBSITE_PROOF_HEIGHT]} />
      </mesh>
      <points
        ref={pointsRef}
        geometry={particleGeometry}
        material={particleMaterial}
        renderOrder={4}
        frustumCulled={false}
      />
    </>
  );
}
