import { expect, test } from "@playwright/test";

const modulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramSampleCountInstrumentation";

const SAMPLE_MEDIA_OUT_ANCHOR = [
  "  const float jitter,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec4 density = weather.density;"
].join("\n");
const MARCH_CLOUDS_OUT_ANCHOR = [
  "  const float rayStartTexelsPerPixel,",
  "  out float frontDepth,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec3 radianceIntegral = vec3(0.0);"
].join("\n");
const DEBUG_OUTPUT =
  "outputColor = vec4(vec3(sampleCount) / vec3(500.0, 5.0, 5.0), 1.0);";

function createShader() {
  return [
    SAMPLE_MEDIA_OUT_ANCHOR,
    MARCH_CLOUDS_OUT_ANCHOR,
    "ivec3 sampleCount = ivec3(0);",
    DEBUG_OUTPUT
  ].join("\n\n");
}

test("audits and repairs both sample-count parameter anchors", async () => {
  const {
    installAuditedTakramSampleCountInstrumentation,
    installTakramSampleCountInstrumentation
  } = await import(modulePath);
  const originalShader = createShader();
  const material = { fragmentShader: originalShader, needsUpdate: false };

  const installation = installAuditedTakramSampleCountInstrumentation(material);
  expect(material.fragmentShader).toContain(
    SAMPLE_MEDIA_OUT_ANCHOR.replace("out ivec3", "inout ivec3")
  );
  expect(material.fragmentShader).toContain(
    MARCH_CLOUDS_OUT_ANCHOR.replace("out ivec3", "inout ivec3")
  );
  expect(material.fragmentShader).toContain("ivec3 sampleCount = ivec3(0);");
  expect(material.fragmentShader).toContain(
    "step(0.0, marchedFrontDepth)"
  );
  expect(installation.audit.sourceAnchorCounts).toEqual({
    marchCloudsSampleCountParameter: 1,
    sampleMediaSampleCountParameter: 1,
    sampleCountDebugOutput: 1
  });
  expect(installation.audit.upstreamSourceFnv1a64).toMatch(
    /^fnv1a-64:[0-9a-f]{16}$/
  );
  expect(installation.audit.injectedSourceFnv1a64).not.toBe(
    installation.audit.upstreamSourceFnv1a64
  );

  const restored = installation.restore();
  expect(material.fragmentShader).toBe(originalShader);
  expect(restored.restoredSourceFnv1a64).toBe(
    installation.audit.upstreamSourceFnv1a64
  );

  material.needsUpdate = false;
  const restore = installTakramSampleCountInstrumentation(material);
  expect(typeof restore).toBe("function");
  restore();
  expect(material.fragmentShader).toBe(originalShader);
  expect(material.needsUpdate).toBe(true);
});

test("rejects partial or duplicated audited sample-count sources", async () => {
  const { installAuditedTakramSampleCountInstrumentation } = await import(
    modulePath
  );
  const incomplete = {
    fragmentShader: [SAMPLE_MEDIA_OUT_ANCHOR, DEBUG_OUTPUT].join("\n"),
    needsUpdate: false
  };
  expect(() => installAuditedTakramSampleCountInstrumentation(incomplete))
    .toThrow("marchClouds sample-count parameter anchor count was 0; expected 1");

  const duplicated = {
    fragmentShader: [
      SAMPLE_MEDIA_OUT_ANCHOR,
      SAMPLE_MEDIA_OUT_ANCHOR,
      MARCH_CLOUDS_OUT_ANCHOR,
      DEBUG_OUTPUT
    ].join("\n"),
    needsUpdate: false
  };
  expect(() => installAuditedTakramSampleCountInstrumentation(duplicated))
    .toThrow("sampleMedia sample-count parameter anchor count was 2; expected 1");
});
