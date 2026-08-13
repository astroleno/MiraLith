import type {
  TakramShaderInstrumentationAudit,
  TakramShaderInstrumentationInstallation
} from "./TakramSampleCountInstrumentation";

export interface TakramPrimaryMarchMaterial {
  defines: Record<string, unknown>;
  fragmentShader: string;
  needsUpdate: boolean;
}

const FUNCTION_ANCHOR = [
  "  const float rayStartTexelsPerPixel,",
  "  out float frontDepth,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec3 radianceIntegral = vec3(0.0);"
].join("\n");
const FUNCTION_INJECTION = [
  "  const float rayStartTexelsPerPixel,",
  "  out float frontDepth,",
  "  out ivec3 sampleCount,",
  "  out int primaryMarchLoopIterationCount,",
  "  out bool primaryMarchEntered,",
  "  out bool primaryMarchCapReached",
  ") {",
  "  primaryMarchEntered = true;",
  "  primaryMarchLoopIterationCount = 0;",
  "  primaryMarchCapReached = false;",
  "  bool primaryMarchTerminatedBeforeCap = false;",
  "  vec3 radianceIntegral = vec3(0.0);"
].join("\n");
const LOOP_ANCHOR = "  for (int i = 0; i < maxIterationCount; ++i) {";
const TERMINATION_BREAK = "      break; // Termination";
const EARLY_TERMINATION_BREAK = "      break; // Early termination";
const PRIMARY_LOOP_TERMINATION_ANCHOR = [
  LOOP_ANCHOR,
  "    if (rayDistance > maxRayDistance) {",
  TERMINATION_BREAK,
  "    }"
].join("\n");
const PRIMARY_LOOP_TERMINATION_INJECTION = [
  LOOP_ANCHOR,
  "    primaryMarchLoopIterationCount += 1;",
  "    if (rayDistance > maxRayDistance) {",
  "      primaryMarchTerminatedBeforeCap = true;",
  TERMINATION_BREAK,
  "    }"
].join("\n");
const EARLY_TERMINATION_BREAK_INJECTION = [
  "      primaryMarchTerminatedBeforeCap = true;",
  EARLY_TERMINATION_BREAK
].join("\n");
const CAP_ANCHOR = [
  "  // The final product of 5.9.1 and we'll evaluate this in aerial perspective.",
  "  frontDepth = transmittanceSum > 0.0 ? weightedDistanceSum / transmittanceSum : -1.0;"
].join("\n");
const CAP_INJECTION = [
  "  primaryMarchCapReached = primaryMarchEntered &&",
  "    primaryMarchLoopIterationCount == maxIterationCount &&",
  "    !primaryMarchTerminatedBeforeCap;",
  "",
  CAP_ANCHOR
].join("\n");
const MAIN_STATE_ANCHOR = "  bool hitClouds = false;";
const MAIN_STATE_INJECTION = [
  MAIN_STATE_ANCHOR,
  "  vec4 primaryMarchDebug = vec4(0.0);",
  "  float marchedFrontDepth = -1.0;",
  "  int primaryMarchLoopIterationCount = 0;",
  "  bool primaryMarchEntered = false;",
  "  bool primaryMarchCapReached = false;"
].join("\n");
const CALL_ANCHOR = [
  "    float marchedFrontDepth;",
  "    ivec3 sampleCount = ivec3(0);",
  "    color = marchClouds(",
  "      rayOrigin,",
  "      rayDirection,",
  "      rayNearFar,",
  "      cosTheta,",
  "      stbn,",
  "      pow(2.0, mipLevel),",
  "      marchedFrontDepth,",
  "      sampleCount",
  "    );"
].join("\n");
const CALL_INJECTION = [
  "    ivec3 sampleCount = ivec3(0);",
  "    color = marchClouds(",
  "      rayOrigin,",
  "      rayDirection,",
  "      rayNearFar,",
  "      cosTheta,",
  "      stbn,",
  "      pow(2.0, mipLevel),",
  "      marchedFrontDepth,",
  "      sampleCount,",
  "      primaryMarchLoopIterationCount,",
  "      primaryMarchEntered,",
  "      primaryMarchCapReached",
  "    );"
].join("\n");
const DEBUG_OUTPUT_ANCHOR = "  #ifdef DEBUG_SHOW_FRONT_DEPTH";
const DEBUG_OUTPUT_INJECTION = [
  "  #ifdef DEBUG_SHOW_PRIMARY_MARCH",
  "  primaryMarchDebug = vec4(float(primaryMarchLoopIterationCount), primaryMarchEntered ? 1.0 : 0.0, primaryMarchCapReached ? 1.0 : 0.0, marchedFrontDepth >= 0.0 ? 1.0 : 0.0);",
  "  outputColor = primaryMarchDebug;",
  "  outputDepthVelocity = vec3(0.0);",
  "  #ifdef SHADOW_LENGTH",
  "  outputShadowLength = 0.0;",
  "  #endif // SHADOW_LENGTH",
  "  return;",
  "  #endif // DEBUG_SHOW_PRIMARY_MARCH",
  "",
  DEBUG_OUTPUT_ANCHOR
].join("\n");

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

export function installTakramPrimaryMarchInstrumentation(
  material: TakramPrimaryMarchMaterial
): TakramShaderInstrumentationInstallation {
  const originalShader = material.fragmentShader;
  const originalDefinePresent = Object.prototype.hasOwnProperty.call(
    material.defines,
    "DEBUG_SHOW_PRIMARY_MARCH"
  );
  const originalDefine = material.defines.DEBUG_SHOW_PRIMARY_MARCH;
  const anchorCounts = {
    caller: countExact(originalShader, CALL_ANCHOR),
    earlyBreak: countExact(originalShader, TERMINATION_BREAK) +
      countExact(originalShader, EARLY_TERMINATION_BREAK),
    functionEntry: countExact(originalShader, FUNCTION_ANCHOR),
    loopBody: countExact(originalShader, LOOP_ANCHOR),
    primaryDebugOutput: countExact(originalShader, DEBUG_OUTPUT_ANCHOR)
  };
  requireOne("primary-march function entry", anchorCounts.functionEntry);
  requireOne("primary-march loop body", anchorCounts.loopBody);
  requireOne("primary-march termination break", countExact(
    originalShader,
    PRIMARY_LOOP_TERMINATION_ANCHOR
  ));
  requireOne("primary-march early-termination break", countExact(
    originalShader,
    EARLY_TERMINATION_BREAK
  ));
  requireOne("primary-march caller", anchorCounts.caller);
  requireOne("primary-march debug output", anchorCounts.primaryDebugOutput);
  requireOne("primary-march main state", countExact(
    originalShader,
    MAIN_STATE_ANCHOR
  ));
  requireOne("primary-march cap", countExact(originalShader, CAP_ANCHOR));

  const replacements = [
    [FUNCTION_ANCHOR, FUNCTION_INJECTION],
    [PRIMARY_LOOP_TERMINATION_ANCHOR, PRIMARY_LOOP_TERMINATION_INJECTION],
    [EARLY_TERMINATION_BREAK, EARLY_TERMINATION_BREAK_INJECTION],
    [CAP_ANCHOR, CAP_INJECTION],
    [MAIN_STATE_ANCHOR, MAIN_STATE_INJECTION],
    [CALL_ANCHOR, CALL_INJECTION],
    [DEBUG_OUTPUT_ANCHOR, DEBUG_OUTPUT_INJECTION]
  ] as const;
  const injectedShader = replacements.reduce(
    (source, [anchor, replacement]) => source.replace(anchor, replacement),
    originalShader
  );
  const audit: TakramShaderInstrumentationAudit = Object.freeze({
    injectedSourceFnv1a64: hashFnv1a64(injectedShader),
    instrumentationFnv1a64: hashFnv1a64(JSON.stringify(replacements)),
    sourceAnchorCounts: Object.freeze(anchorCounts),
    upstreamSourceFnv1a64: hashFnv1a64(originalShader)
  });

  material.fragmentShader = injectedShader;
  material.defines.DEBUG_SHOW_PRIMARY_MARCH = "1";
  material.needsUpdate = true;
  return {
    audit,
    restore: () => {
      material.fragmentShader = originalShader;
      if (originalDefinePresent) {
        material.defines.DEBUG_SHOW_PRIMARY_MARCH = originalDefine;
      } else {
        delete material.defines.DEBUG_SHOW_PRIMARY_MARCH;
      }
      material.needsUpdate = true;
      return Object.freeze({
        restoredSourceFnv1a64: hashFnv1a64(material.fragmentShader)
      });
    }
  };
}
