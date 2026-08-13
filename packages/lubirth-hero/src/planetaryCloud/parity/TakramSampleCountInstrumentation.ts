export interface TakramSampleCountMaterial {
  fragmentShader: string;
  needsUpdate: boolean;
}

export interface TakramShaderInstrumentationAudit {
  readonly injectedSourceFnv1a64: string;
  readonly instrumentationFnv1a64: string;
  readonly sourceAnchorCounts: Readonly<Record<string, number>>;
  readonly upstreamSourceFnv1a64: string;
}

export interface TakramShaderInstrumentationInstallation {
  readonly audit: TakramShaderInstrumentationAudit;
  restore(): Readonly<{ restoredSourceFnv1a64: string }>;
}

const SAMPLE_MEDIA_OUT_ANCHOR = [
  "  const float jitter,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec4 density = weather.density;"
].join("\n");
const SAMPLE_MEDIA_INOUT_ANCHOR = SAMPLE_MEDIA_OUT_ANCHOR.replace(
  "out ivec3",
  "inout ivec3"
);
const MARCH_CLOUDS_OUT_ANCHOR = [
  "  const float rayStartTexelsPerPixel,",
  "  out float frontDepth,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec3 radianceIntegral = vec3(0.0);"
].join("\n");
const MARCH_CLOUDS_INOUT_ANCHOR = MARCH_CLOUDS_OUT_ANCHOR.replace(
  "out ivec3",
  "inout ivec3"
);
const OPAQUE_DEBUG_OUTPUT =
  "outputColor = vec4(vec3(sampleCount) / vec3(500.0, 5.0, 5.0), 1.0);";
const HIT_MASK_DEBUG_OUTPUT =
  "outputColor = vec4(vec3(sampleCount) / vec3(500.0, 5.0, 5.0), step(0.0, marchedFrontDepth));";

function hashFnv1a64(value: string): string {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `fnv1a-64:${hash.toString(16).padStart(16, "0")}`;
}

function countExact(source: string, anchor: string): number {
  return source.split(anchor).length - 1;
}

function requireOne(label: string, count: number): void {
  if (count !== 1) {
    throw new Error(`${label} anchor count was ${count}; expected 1`);
  }
}

export function installAuditedTakramSampleCountInstrumentation(
  material: TakramSampleCountMaterial
): TakramShaderInstrumentationInstallation {
  const originalShader = material.fragmentShader;
  const sourceAnchorCounts = {
    marchCloudsSampleCountParameter: countExact(
      originalShader,
      MARCH_CLOUDS_OUT_ANCHOR
    ),
    sampleMediaSampleCountParameter: countExact(
      originalShader,
      SAMPLE_MEDIA_OUT_ANCHOR
    ),
    sampleCountDebugOutput: countExact(originalShader, OPAQUE_DEBUG_OUTPUT)
  };
  requireOne(
    "marchClouds sample-count parameter",
    sourceAnchorCounts.marchCloudsSampleCountParameter
  );
  requireOne(
    "sampleMedia sample-count parameter",
    sourceAnchorCounts.sampleMediaSampleCountParameter
  );
  requireOne(
    "sample-count debug output",
    sourceAnchorCounts.sampleCountDebugOutput
  );

  const instrumentation = JSON.stringify([
    [MARCH_CLOUDS_OUT_ANCHOR, MARCH_CLOUDS_INOUT_ANCHOR],
    [SAMPLE_MEDIA_OUT_ANCHOR, SAMPLE_MEDIA_INOUT_ANCHOR],
    [OPAQUE_DEBUG_OUTPUT, HIT_MASK_DEBUG_OUTPUT]
  ]);
  const injectedShader = originalShader
    .replace(MARCH_CLOUDS_OUT_ANCHOR, MARCH_CLOUDS_INOUT_ANCHOR)
    .replace(SAMPLE_MEDIA_OUT_ANCHOR, SAMPLE_MEDIA_INOUT_ANCHOR)
    .replace(OPAQUE_DEBUG_OUTPUT, HIT_MASK_DEBUG_OUTPUT);
  const audit = Object.freeze({
    injectedSourceFnv1a64: hashFnv1a64(injectedShader),
    instrumentationFnv1a64: hashFnv1a64(instrumentation),
    sourceAnchorCounts: Object.freeze(sourceAnchorCounts),
    upstreamSourceFnv1a64: hashFnv1a64(originalShader)
  });

  material.fragmentShader = injectedShader;
  material.needsUpdate = true;
  return {
    audit,
    restore: () => {
      material.fragmentShader = originalShader;
      material.needsUpdate = true;
      return Object.freeze({
        restoredSourceFnv1a64: hashFnv1a64(material.fragmentShader)
      });
    }
  };
}

/** Historical callback API retained until the production pipeline migration. */
export function installTakramSampleCountInstrumentation(
  material: TakramSampleCountMaterial
): () => void {
  const installation = installAuditedTakramSampleCountInstrumentation(material);
  return () => {
    installation.restore();
  };
}
