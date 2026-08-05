"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import type { CoScrollAnchorResidueConfig } from "./types";

interface CoScrollAnchorResidueProps {
  source: THREE.Object3D;
  sourceScale: number;
  anchorGroup: RefObject<THREE.Group | null>;
  active: boolean;
  paused: boolean;
  reducedMotion: boolean;
  viewport: "desktop" | "mobile";
  config: CoScrollAnchorResidueConfig;
  particleizationRef: RefObject<number>;
  renderOrder: number;
}

interface ParticleSourceEntry {
  matrix: THREE.Matrix4;
  normalMatrix: THREE.Matrix3;
  sampler: MeshSurfaceSampler;
  start: number;
}

interface MeshSurfaceSamplerWithRandomGenerator extends MeshSurfaceSampler {
  setRandomGenerator: (random: () => number) => MeshSurfaceSampler;
}

interface AnchorResidueLayer {
  material: THREE.ShaderMaterial;
  points: THREE.Points;
}

interface AnchorResidueResources {
  conversion: AnchorResidueLayer;
  history: AnchorResidueLayer[];
  ringCenter: THREE.Vector3;
  ringRadius: number;
  ringThickness: number;
  root: THREE.Group;
  dispose: () => void;
}

interface AnchorResidueSnapshot {
  quaternion: THREE.Quaternion;
  position: THREE.Vector3;
  scale: THREE.Vector3;
  yaw: number;
  age: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoothstep = (min: number, max: number, value: number) => {
  const normalized = clamp((value - min) / (max - min), 0, 1);
  return normalized * normalized * (3 - normalized * 2);
};

// CP0.1 separates stable geometry from the frame that the local review proxy actually starts
// on. n=359 supplies the measured centre/radius/line-width fixture; the proxy begins at n=355.
// With the screen convention used below (positive = clockwise), its open-arc centre moves from
// 222° at n=359 back to 154.5° at n=355. Keeping this signed offset is what prevents a 67.5°
// gap jump at the web → video ownership change.
const ARTBREEZE_GEOMETRY_GAP_CENTER_DEGREES = 222;
const ARTBREEZE_PROXY_START_GAP_CENTER_DEGREES = 154.5;
const ARTBREEZE_PROXY_PHASE_OFFSET = THREE.MathUtils.degToRad(
  ARTBREEZE_PROXY_START_GAP_CENTER_DEGREES - ARTBREEZE_GEOMETRY_GAP_CENTER_DEGREES
);
// The film measurement itself is #F3832F. This local review layer uses additive point blending,
// so its display-space calibration must start lower in green and slightly higher in red; the
// final browser-frame measurement, rather than this shader input, is the comparison datum.
const ARTBREEZE_REVIEW_RING_COLOR = "#d8512c";
// The current source-match camera renders the `空` anchor at twice the CP0.1 source-raster
// height. Apply this calibration to every n=359 screen measurement together: centre offset,
// radius, and stroke thickness. This keeps the measured geometry intact at the ArtBreeze
// letterboxed raster scale instead of merely preserving its numeric values in local space.
const SOURCE_MATCH_TO_ARTBREEZE_RASTER_SCALE = 0.5;
// The 30fps proof projects the current source-match `空` mesh centre to a slightly different
// screen origin than CP0.1's still capture. These are *projection calibration* values, not
// replacement source facts: together with the raster scale above they resolve to the measured
// n=359 circle centre at the live review viewport.
const SOURCE_MATCH_RING_CENTER_CALIBRATION = { x: 10.12, y: 0.18 };

function createDeterministicRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function createParticleGeometry(source: THREE.Object3D, sourceScale: number, particleCount: number) {
  // This clone is a sampling fixture only. The source GLB remains opaque while particles are
  // sampled from the same physical surface and inherit its real 3D orientation.
  const samplingRoot = source.clone(true);
  samplingRoot.position.set(0, 0, 0);
  samplingRoot.quaternion.identity();
  samplingRoot.scale.setScalar(sourceScale);
  samplingRoot.updateMatrixWorld(true);

  const entries: ParticleSourceEntry[] = [];
  let sourceSurfaceWeight = 0;
  samplingRoot.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.BufferGeometry)) {
      return;
    }

    const position = child.geometry.getAttribute("position");
    if (!position || position.count === 0) {
      return;
    }

    const sourceFaceCount = Math.floor((child.geometry.index?.count ?? position.count) / 3);
    if (sourceFaceCount === 0) {
      return;
    }

    entries.push({
      sampler: (new MeshSurfaceSampler(child) as MeshSurfaceSamplerWithRandomGenerator)
        .setRandomGenerator(createDeterministicRandom(entries.length + 1))
        .build(),
      matrix: child.matrixWorld.clone(),
      normalMatrix: new THREE.Matrix3().getNormalMatrix(child.matrixWorld),
      start: sourceSurfaceWeight
    });
    sourceSurfaceWeight += sourceFaceCount;
  });

  const geometry = new THREE.BufferGeometry();
  if (sourceSurfaceWeight === 0) {
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    return geometry;
  }

  const positions = new Float32Array(particleCount * 3);
  const normals = new Float32Array(particleCount * 3);
  const ringAngles = new Float32Array(particleCount);
  const ringBands = new Float32Array(particleCount);
  const seeds = new Float32Array(particleCount);
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let entryIndex = 0;

  for (let index = 0; index < particleCount; index += 1) {
    // Golden-ratio placement gives a non-striping, deterministic sampling pattern. Surface
    // normals let the conversion begin at the view-facing silhouette before it moves inward.
    const distribution = (index * 0.6180339887498949 + 0.5) % 1;
    const sourceIndex = Math.min(
      sourceSurfaceWeight - 1,
      Math.floor(distribution * sourceSurfaceWeight)
    );
    while (entryIndex < entries.length - 1 && sourceIndex >= entries[entryIndex + 1].start) {
      entryIndex += 1;
    }

    const entry = entries[entryIndex];
    entry.sampler.sample(point, normal);
    point.applyMatrix4(entry.matrix);
    normal.applyMatrix3(entry.normalMatrix).normalize();
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;
    normals[index * 3] = normal.x;
    normals[index * 3 + 1] = normal.y;
    normals[index * 3 + 2] = normal.z;
    const seed = (index * 0.7548776662466927 + 0.173) % 1;
    // n=359 supplies the stable geometry fixture: gap centre 222° clockwise in screen
    // coordinates, width 80°. The runtime phase applies the signed n=355 offset before the
    // local proxy takes ownership. Points are distributed only along the remaining open arc,
    // never as a generic spinner.
    const gapCenter = THREE.MathUtils.degToRad(ARTBREEZE_GEOMETRY_GAP_CENTER_DEGREES);
    const gapHalf = THREE.MathUtils.degToRad(40);
    ringAngles[index] = gapCenter + gapHalf + seed * (Math.PI * 2 - gapHalf * 2);
    ringBands[index] = (index * 0.414213562373095 + 0.31) % 1;
    seeds[index] = seed;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aNormal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("aRingAngle", new THREE.BufferAttribute(ringAngles, 1));
  geometry.setAttribute("aRingBand", new THREE.BufferAttribute(ringBands, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createParticleMaterial(color: string, viewport: "desktop" | "mobile") {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uConversion: { value: 0 },
      uDensity: { value: 0 },
      uDirection: { value: -1 },
      uOpacity: { value: 0 },
      uParticleization: { value: 0 },
      uPointSize: { value: viewport === "mobile" ? 1.7 : 2.35 },
      uRingCenter: { value: new THREE.Vector3() },
      uRingColor: { value: new THREE.Color(ARTBREEZE_REVIEW_RING_COLOR) },
      uRingPhase: { value: 0 },
      uRingProgress: { value: 0 },
      uRingWarmth: { value: 0 },
      uRingRadius: { value: 0 },
      uRingThickness: { value: 0 },
      uScatter: { value: 0 }
    },
    vertexShader: `
      attribute vec3 aNormal;
      attribute float aRingAngle;
      attribute float aRingBand;
      attribute float aSeed;
      uniform float uDirection;
      uniform float uPointSize;
      uniform float uRingPhase;
      uniform float uRingProgress;
      uniform float uRingWarmth;
      uniform float uRingRadius;
      uniform float uRingThickness;
      uniform vec3 uRingCenter;
      uniform float uScatter;
      varying float vEdge;
      varying float vRingProgress;
      varying float vRingWarmth;
      varying float vSeed;

      void main() {
        vSeed = aSeed;
        vec3 radial = vec3(position.x, 0.0, position.z);
        float radialLength = max(length(radial), 0.0001);
        vec3 tangent = vec3(radial.z, 0.0, -radial.x) / radialLength;
        float distribution = mix(0.28, 1.0, fract(aSeed * 17.31));
        float helicalOffset = sin(position.y * 4.7 + aSeed * 31.0) * 0.18;
        vec3 driftedPosition = position + tangent * (uDirection * uScatter * distribution);
        driftedPosition += normalize(vec3(radial.x, position.y * 0.2, radial.z)) * (uScatter * 0.24 * distribution);
        driftedPosition.y += helicalOffset * uScatter;

        // The blue particles, not the GLB, settle into the measured n=359 open-ring
        // fixture. +angle maps to clockwise motion in screen coordinates (screen Y is down).
        float ringRadius = uRingRadius + (aRingBand - 0.5) * uRingThickness;
        float ringAngle = aRingAngle + uRingPhase;
        vec3 ringPosition = uRingCenter + vec3(
          cos(ringAngle) * ringRadius,
          -sin(ringAngle) * ringRadius,
          0.0
        );
        vec3 finalPosition = mix(driftedPosition, ringPosition, uRingProgress);

        vec4 viewPosition = modelViewMatrix * vec4(finalPosition, 1.0);
        vec3 viewNormal = normalize(normalMatrix * aNormal);
        vEdge = 1.0 - abs(dot(viewNormal, normalize(-viewPosition.xyz)));
        vRingProgress = uRingProgress;
        vRingWarmth = uRingWarmth;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = uPointSize * mix(0.76, 1.2, aSeed);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uConversion;
      uniform float uDensity;
      uniform float uOpacity;
      uniform float uParticleization;
      uniform vec3 uRingColor;
      varying float vEdge;
      varying float vRingProgress;
      varying float vRingWarmth;
      varying float vSeed;

      float hash(float value) {
        return fract(sin(value * 91.231) * 43758.5453123);
      }

      void main() {
        float grain = hash(vSeed);
        if (uConversion > 0.5) {
          float edgeFirstThreshold = mix(0.9, 0.08, pow(clamp(vEdge, 0.0, 1.0), 0.72));
          edgeFirstThreshold += (grain - 0.5) * 0.24;
          if (uParticleization < clamp(edgeFirstThreshold, 0.025, 0.975)) discard;
        } else if (grain > uDensity) {
          discard;
        }

        float radius = length(gl_PointCoord - vec2(0.5));
        float shape = 1.0 - smoothstep(0.12, 0.5, radius);
        float shimmer = mix(0.7, 1.0, hash(vSeed * 2.7 + 0.41));
        float alpha = shape * shimmer * uOpacity;
        // Warm only at the very end, immediately before a real ArtBreeze ring would take over.
        // Until then this remains the requested cold-blue particle conversion.
        vec3 outputColor = mix(uColor, uRingColor, vRingWarmth);
        gl_FragColor = vec4(outputColor, alpha);
      }
    `,
    transparent: true,
    // The point layer is composited after the opaque source geometry. It is never a rotating
    // screen plane; every point shares the historical/current source quaternion.
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

function createResources({
  source,
  sourceScale,
  particleCount,
  color,
  historySlots,
  renderOrder,
  viewport
}: {
  source: THREE.Object3D;
  sourceScale: number;
  particleCount: number;
  color: string;
  historySlots: number;
  renderOrder: number;
  viewport: "desktop" | "mobile";
}): AnchorResidueResources | null {
  const geometry = createParticleGeometry(source, sourceScale, particleCount);
  if (geometry.getAttribute("position").count === 0) {
    geometry.dispose();
    return null;
  }

  const root = new THREE.Group();
  root.renderOrder = renderOrder;
  const history = Array.from({ length: historySlots }, (_unused, index) => {
    const material = createParticleMaterial(color, viewport);
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    points.frustumCulled = false;
    points.renderOrder = renderOrder + index;
    root.add(points);
    return { material, points };
  });
  const conversionMaterial = createParticleMaterial(color, viewport);
  const conversionPoints = new THREE.Points(geometry, conversionMaterial);
  conversionPoints.visible = false;
  conversionPoints.frustumCulled = false;
  conversionPoints.renderOrder = renderOrder + historySlots + 2;
  root.add(conversionPoints);

  const sourceBounds = geometry.boundingBox;
  if (!sourceBounds) {
    geometry.dispose();
    history.forEach(({ material }) => material.dispose());
    conversionMaterial.dispose();
    return null;
  }

  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const sourceHeight = Math.max(sourceSize.y, 0.001);
  // CP0.1 target geometry: n=359 circle centre ≈ (949.67, 556.25), outer radius 53.30px and
  // line width 8.04px. The source-match anchor's current screen projection is twice the source
  // raster height, and its mesh origin is offset from the CP0.1 still's glyph centre; the two
  // calibrations below carry those source facts into the live review coordinate system.
  const ringCenter = sourceCenter.clone().add(new THREE.Vector3(
    -sourceHeight * (SOURCE_MATCH_RING_CENTER_CALIBRATION.x / 365) * SOURCE_MATCH_TO_ARTBREEZE_RASTER_SCALE,
    -sourceHeight * (SOURCE_MATCH_RING_CENTER_CALIBRATION.y / 365) * SOURCE_MATCH_TO_ARTBREEZE_RASTER_SCALE,
    0
  ));
  const ringRadius = sourceHeight * (53.3 / 365) * SOURCE_MATCH_TO_ARTBREEZE_RASTER_SCALE;
  const ringThickness = sourceHeight * (8.04 / 365) * SOURCE_MATCH_TO_ARTBREEZE_RASTER_SCALE;

  return {
    conversion: { material: conversionMaterial, points: conversionPoints },
    history,
    ringCenter,
    ringRadius,
    ringThickness,
    root,
    dispose: () => {
      geometry.dispose();
      history.forEach(({ material }) => material.dispose());
      conversionMaterial.dispose();
    }
  };
}

/**
 * Blue particles sampled from the anchor itself. Historical layers establish rotational residue;
 * the conversion layer takes over as the opaque source material performs its matching fragment
 * cutout. Both use actual source quaternions and the same negative yaw direction.
 */
export function CoScrollAnchorResidue({
  source,
  sourceScale,
  anchorGroup,
  active,
  paused,
  reducedMotion,
  viewport,
  config,
  particleizationRef,
  renderOrder
}: CoScrollAnchorResidueProps) {
  const particleCount = clamp(
    Math.round(config.particleCount ?? (viewport === "mobile" ? 720 : 2_100)),
    256,
    3_200
  );
  const historySeconds = clamp(config.historySeconds ?? 0.68, 0.16, 0.9);
  const intensity = clamp(config.intensity ?? 0.78, 0, 1);
  const color = config.color ?? "#168fe8";
  const historySlots = viewport === "mobile" ? 7 : 11;
  const resources = useMemo(
    () => createResources({
      source,
      sourceScale,
      particleCount,
      color,
      historySlots,
      renderOrder,
      viewport
    }),
    [color, historySlots, particleCount, renderOrder, source, sourceScale, viewport]
  );
  const snapshotHistoryRef = useRef<AnchorResidueSnapshot[]>([]);
  const snapshotElapsedRef = useRef(0);
  const previousYawRef = useRef<number | null>(null);
  const directionRef = useRef(-1);
  const ringPhaseRef = useRef(0);
  const ringHandoffElapsedRef = useRef(0);
  const ringReachedHandoffRef = useRef(false);
  const ringHandoffReportedRef = useRef(false);
  const identityQuaternion = useMemo(() => new THREE.Quaternion(), []);

  useEffect(() => {
    snapshotHistoryRef.current = [];
    snapshotElapsedRef.current = 0;
    previousYawRef.current = null;
    directionRef.current = -1;
    ringPhaseRef.current = 0;
    ringHandoffElapsedRef.current = 0;
    ringReachedHandoffRef.current = false;
    ringHandoffReportedRef.current = false;
    return () => resources?.dispose();
  }, [resources]);

  useFrame((_state, delta) => {
    if (!resources) {
      return;
    }

    const anchor = anchorGroup.current;
    if (!active || paused || reducedMotion || intensity === 0 || !anchor) {
      resources.root.visible = false;
      [...resources.history, resources.conversion].forEach(({ points }) => {
        points.visible = false;
      });
      snapshotHistoryRef.current = [];
      snapshotElapsedRef.current = 0;
      return;
    }

    resources.root.visible = true;
    // The first 56% is a rotating, opaque-to-particle conversion. Only after the glyph has
    // completely dissolved may its blue particles leave that real yaw and collect into a ring.
    const bridgeProgress = clamp(particleizationRef.current ?? config.particleization ?? 0, 0, 1);
    const dissolveProgress = clamp(bridgeProgress / 0.56, 0, 1);
    const ringRawProgress = clamp((bridgeProgress - 0.56) / 0.4, 0, 1);
    // Form the complete blue circle before warming it, so the blue particles read as a real
    // reassembly instead of a hard swap to an orange loading icon.
    const ringProgress = smoothstep(0, 0.72, ringRawProgress);
    // `ringProgress` has already reached 1 by 0.72. Keep that complete blue ring through 0.82,
    // then make warmth an independent, deliberately slower second state.
    const ringWarmth = smoothstep(0.82, 0.985, ringRawProgress);
    const previousYaw = previousYawRef.current;
    if (previousYaw !== null) {
      const yawDelta = anchor.rotation.y - previousYaw;
      if (Math.abs(yawDelta) > 0.000001) {
        directionRef.current = Math.sign(yawDelta);
      }
    }
    previousYawRef.current = anchor.rotation.y;

    const boundedDelta = Math.min(delta, 0.08);
    if (ringRawProgress < 1) {
      // The phase completes exactly two turns at the first coherent handoff frame. Its baseline
      // is n=355 — the actual proxy first frame — while n=359 remains the geometry fixture.
      // Positive screen angle is clockwise; the source GLB remains on its negative 3D yaw.
      ringHandoffElapsedRef.current = 0;
      ringReachedHandoffRef.current = false;
      ringHandoffReportedRef.current = false;
      ringPhaseRef.current = ARTBREEZE_PROXY_PHASE_OFFSET + Math.PI * 2 * (
        2 * ringRawProgress + 0.48 * ringRawProgress * (1 - ringRawProgress)
      );
    } else if (!ringReachedHandoffRef.current) {
      // Render one exact n=355-phase handoff frame before the retained target spin starts.
      ringReachedHandoffRef.current = true;
      ringPhaseRef.current = ARTBREEZE_PROXY_PHASE_OFFSET + Math.PI * 4;
    } else {
      // After that exact alignment, retain the observed ArtBreeze clockwise target speed.
      ringHandoffElapsedRef.current += boundedDelta;
      ringPhaseRef.current = ARTBREEZE_PROXY_PHASE_OFFSET
        + Math.PI * 4
        + ringHandoffElapsedRef.current * THREE.MathUtils.degToRad(396.4);
    }
    // The preview owner change is emitted by the layer that has just rendered the exact n=355
    // phase. Emitting it one frame earlier from the rotating GLB would expose an interpolated
    // phase at the cut boundary.
    if (ringRawProgress >= 1 && !ringHandoffReportedRef.current) {
      ringHandoffReportedRef.current = true;
      config.onReviewHandoff?.();
    }
    const snapshots = snapshotHistoryRef.current;
    snapshots.forEach((snapshot) => {
      snapshot.age += boundedDelta;
    });
    while (snapshots.length > 0 && snapshots[0].age > historySeconds) {
      snapshots.shift();
    }

    const sampleInterval = historySeconds / Math.max(1, resources.history.length + 1);
    snapshotElapsedRef.current += boundedDelta;
    if (snapshots.length === 0 || snapshotElapsedRef.current >= sampleInterval) {
      snapshots.push({
        quaternion: anchor.quaternion.clone(),
        position: anchor.position.clone(),
        scale: anchor.scale.clone(),
        yaw: anchor.rotation.y,
        age: 0
      });
      snapshotElapsedRef.current %= sampleInterval;
    }

    const newestFirst = snapshots.slice().reverse();
    const minimumLag = sampleInterval * 1.35;
    resources.history.forEach(({ material, points }, index) => {
      const snapshot = newestFirst[index];
      if (!snapshot || snapshot.age < minimumLag) {
        points.visible = false;
        return;
      }

      const ageRatio = clamp(snapshot.age / historySeconds, 0, 1);
      const envelope = Math.sin(Math.PI * clamp((ageRatio - 0.08) / 0.84, 0, 1));
      const angularSpeed = anchor.quaternion.angleTo(snapshot.quaternion) / Math.max(snapshot.age, 0.001);
      const motionEnergy = clamp((angularSpeed - 0.22) / 0.78, 0, 1);
      const strength = intensity
        * (1 - bridgeProgress * 0.48)
        * (1 - ringProgress)
        * (0.08 + motionEnergy * 0.92)
        * (0.2 + envelope * 0.6);
      const direction = Math.sign(anchor.rotation.y - snapshot.yaw) || directionRef.current;

      points.visible = strength > 0.012;
      points.quaternion.copy(snapshot.quaternion);
      points.position.copy(snapshot.position);
      points.scale.copy(snapshot.scale);
      material.uniforms.uConversion.value = 0;
      material.uniforms.uDensity.value = clamp(0.035 + envelope * 0.05 + motionEnergy * 0.22, 0.035, 0.34);
      material.uniforms.uDirection.value = direction;
      material.uniforms.uOpacity.value = strength;
      material.uniforms.uParticleization.value = 0;
      material.uniforms.uPointSize.value = (viewport === "mobile" ? 1.7 : 2.35) + motionEnergy * 1.4;
      material.uniforms.uRingProgress.value = 0;
      material.uniforms.uRingWarmth.value = 0;
      material.uniforms.uScatter.value = (0.006 + motionEnergy * 0.48) * envelope * (0.42 + ageRatio * 0.58);
    });

    const conversion = resources.conversion;
    const conversionStrength = smoothstep(0.015, 0.2, dissolveProgress);
    conversion.points.visible = conversionStrength > 0;
    // The GLB keeps this quaternion throughout its visible lifetime. Once there is no glyph
    // left, its particles can flatten into the ArtBreeze-aligned ring fixture instead.
    conversion.points.quaternion.copy(anchor.quaternion).slerp(identityQuaternion, ringProgress);
    conversion.points.position.copy(anchor.position);
    conversion.points.scale.copy(anchor.scale);
    conversion.material.uniforms.uConversion.value = 1;
    conversion.material.uniforms.uDensity.value = 1;
    conversion.material.uniforms.uDirection.value = directionRef.current;
    conversion.material.uniforms.uOpacity.value = intensity
      * (0.38 + conversionStrength * 0.62)
      // Keep the low-saturation source-jade ring bright enough to inherit the glyph's luminous
      // outer shell rather than reading as a dim, saturated neon trace.
      * (1 - ringProgress * 0.7);
    conversion.material.uniforms.uParticleization.value = dissolveProgress;
    conversion.material.uniforms.uPointSize.value = (viewport === "mobile" ? 2.4 : 3.15) + dissolveProgress * 1.55;
    conversion.material.uniforms.uRingCenter.value.copy(resources.ringCenter);
    conversion.material.uniforms.uRingPhase.value = ringPhaseRef.current;
    conversion.material.uniforms.uRingProgress.value = ringProgress;
    conversion.material.uniforms.uRingWarmth.value = ringWarmth;
    conversion.material.uniforms.uRingRadius.value = resources.ringRadius;
    conversion.material.uniforms.uRingThickness.value = resources.ringThickness;
    conversion.material.uniforms.uScatter.value = Math.pow(dissolveProgress, 1.28) * 0.86 * (1 - ringProgress);
  }, -0.5);

  return resources ? <primitive object={resources.root} /> : null;
}
