import { expect, test } from "@playwright/test";

const modulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramPrimaryMarchInstrumentation";

const FUNCTION_ANCHOR = [
  "  const float rayStartTexelsPerPixel,",
  "  out float frontDepth,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec3 radianceIntegral = vec3(0.0);"
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

function createShader() {
  return [
    FUNCTION_ANCHOR,
    "  for (int i = 0; i < maxIterationCount; ++i) {",
    "    if (rayDistance > maxRayDistance) {",
    "      break; // Termination",
    "    }",
    "    if (transmittanceIntegral <= minTransmittance) {",
    "      break; // Early termination",
    "    }",
    "  }",
    "  // The final product of 5.9.1 and we'll evaluate this in aerial perspective.",
    "  frontDepth = transmittanceSum > 0.0 ? weightedDistanceSum / transmittanceSum : -1.0;",
    "void main() {",
    "  bool hitClouds = false;",
    "  if (!intersectsGround && !intersectsScene) {",
    CALL_ANCHOR,
    "  }",
    "  #ifdef DEBUG_SHOW_FRONT_DEPTH",
    "  outputColor = vec4(turbo(frontDepth / maxRayDistance), 1.0);",
    "  #endif // DEBUG_SHOW_FRONT_DEPTH",
    "}"
  ].join("\n");
}

test("injects direct primary-march entry loop cap and hit telemetry", async () => {
  const { installTakramPrimaryMarchInstrumentation } = await import(modulePath);
  const originalShader = createShader();
  const material = {
    defines: { EXISTING: "yes" },
    fragmentShader: originalShader,
    needsUpdate: false
  };

  const installation = installTakramPrimaryMarchInstrumentation(material);
  expect(material.defines).toEqual({ EXISTING: "yes", DEBUG_SHOW_PRIMARY_MARCH: "1" });
  expect(material.fragmentShader).toContain(
    "vec4 primaryMarchDebug = vec4(0.0);"
  );
  expect(material.fragmentShader).toContain(
    "primaryMarchEntered = true;"
  );
  expect(material.fragmentShader).toContain(
    "primaryMarchLoopIterationCount += 1;"
  );
  expect(material.fragmentShader.match(
    /primaryMarchTerminatedBeforeCap = true;/g
  )).toHaveLength(2);
  expect(material.fragmentShader).toContain(
    "primaryMarchLoopIterationCount == maxIterationCount"
  );
  expect(material.fragmentShader).toContain(
    "!primaryMarchTerminatedBeforeCap"
  );
  expect(material.fragmentShader).toContain(
    "vec4(float(primaryMarchLoopIterationCount), primaryMarchEntered ? 1.0 : 0.0, primaryMarchCapReached ? 1.0 : 0.0, marchedFrontDepth >= 0.0 ? 1.0 : 0.0)"
  );
  expect(material.fragmentShader.match(/#ifdef DEBUG_SHOW_PRIMARY_MARCH/g))
    .toHaveLength(1);
  expect(installation.audit.sourceAnchorCounts).toEqual({
    caller: 1,
    earlyBreak: 2,
    functionEntry: 1,
    loopBody: 1,
    primaryDebugOutput: 1
  });
  expect(installation.audit.upstreamSourceFnv1a64).toMatch(
    /^fnv1a-64:[0-9a-f]{16}$/
  );
  expect(installation.audit.injectedSourceFnv1a64).not.toBe(
    installation.audit.upstreamSourceFnv1a64
  );
  expect(installation.audit.instrumentationFnv1a64).toMatch(
    /^fnv1a-64:[0-9a-f]{16}$/
  );

  const restored = installation.restore();
  expect(material.fragmentShader).toBe(originalShader);
  expect(material.defines).toEqual({ EXISTING: "yes" });
  expect(restored.restoredSourceFnv1a64).toBe(
    installation.audit.upstreamSourceFnv1a64
  );
});

test("rejects absent or duplicated primary-march anchors", async () => {
  const { installTakramPrimaryMarchInstrumentation } = await import(modulePath);
  const absent = {
    defines: {},
    fragmentShader: createShader().replace(FUNCTION_ANCHOR, "missing"),
    needsUpdate: false
  };
  expect(() => installTakramPrimaryMarchInstrumentation(absent))
    .toThrow("primary-march function entry anchor count was 0; expected 1");

  const duplicated = {
    defines: {},
    fragmentShader: createShader().replace(
      "  for (int i = 0; i < maxIterationCount; ++i) {",
      [
        "  for (int i = 0; i < maxIterationCount; ++i) {",
        "  for (int i = 0; i < maxIterationCount; ++i) {"
      ].join("\n")
    ),
    needsUpdate: false
  };
  expect(() => installTakramPrimaryMarchInstrumentation(duplicated))
    .toThrow("primary-march loop body anchor count was 2; expected 1");
});

test("instruments only the primary termination when shadow length shares the break", async () => {
  const { installTakramPrimaryMarchInstrumentation } = await import(modulePath);
  const originalShader = [
    createShader(),
    "void marchShadowLength() {",
    "  for (int i = 0; i < maxShadowLengthIterationCount; ++i) {",
    "    if (rayDistance > maxRayDistance) {",
    "      break; // Termination",
    "    }",
    "  }",
    "}"
  ].join("\n");
  const material = {
    defines: {},
    fragmentShader: originalShader,
    needsUpdate: false
  };

  const installation = installTakramPrimaryMarchInstrumentation(material);
  expect(material.fragmentShader.match(
    /primaryMarchTerminatedBeforeCap = true;/g
  )).toHaveLength(2);
  expect(material.fragmentShader).toContain(
    "  for (int i = 0; i < maxShadowLengthIterationCount; ++i) {\n" +
    "    if (rayDistance > maxRayDistance) {\n" +
    "      break; // Termination"
  );
  expect(installation.restore().restoredSourceFnv1a64)
    .toBe(installation.audit.upstreamSourceFnv1a64);
  expect(material.fragmentShader).toBe(originalShader);
});
