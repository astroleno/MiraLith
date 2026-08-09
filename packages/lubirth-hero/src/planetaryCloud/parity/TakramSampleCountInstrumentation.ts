interface TakramSampleCountMaterial {
  fragmentShader: string;
  needsUpdate: boolean;
}

const OUT_PARAMETER = [
  "  const float jitter,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec4 density = weather.density;"
].join("\n");
const INOUT_PARAMETER = [
  "  const float jitter,",
  "  inout ivec3 sampleCount",
  ") {",
  "  vec4 density = weather.density;"
].join("\n");
const OPAQUE_DEBUG_OUTPUT =
  "outputColor = vec4(vec3(sampleCount) / vec3(500.0, 5.0, 5.0), 1.0);";
const HIT_MASK_DEBUG_OUTPUT =
  "outputColor = vec4(vec3(sampleCount) / vec3(500.0, 5.0, 5.0), step(0.0, marchedFrontDepth));";

/**
 * The upstream debug overload declares sampleCount as `out`, which discards
 * the primary-ray count accumulated by marchClouds before sampleMedia runs.
 * This capture-only patch preserves that state without changing production
 * shader features or renderer parameters.
 */
export function installTakramSampleCountInstrumentation(
  material: TakramSampleCountMaterial
) {
  const originalShader = material.fragmentShader;
  const firstMatch = originalShader.indexOf(OUT_PARAMETER);
  if (firstMatch < 0 || originalShader.indexOf(OUT_PARAMETER, firstMatch + 1) >= 0) {
    throw new Error("Takram sample-count debug signature drifted from the audited source.");
  }
  const outputMatch = originalShader.indexOf(OPAQUE_DEBUG_OUTPUT);
  if (outputMatch < 0 || originalShader.indexOf(OPAQUE_DEBUG_OUTPUT, outputMatch + 1) >= 0) {
    throw new Error("Takram sample-count debug output drifted from the audited source.");
  }
  material.fragmentShader = originalShader
    .replace(OUT_PARAMETER, INOUT_PARAMETER)
    .replace(OPAQUE_DEBUG_OUTPUT, HIT_MASK_DEBUG_OUTPUT);
  material.needsUpdate = true;
  return () => {
    material.fragmentShader = originalShader;
    material.needsUpdate = true;
  };
}
