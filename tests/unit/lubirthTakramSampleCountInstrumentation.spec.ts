import { expect, test } from "@playwright/test";

test("preserves primary counts by changing only the debug sample parameter to inout", async () => {
  const instrumentation = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramSampleCountInstrumentation"
  );
  const originalShader = `
MediaSample sampleMedia(
  const WeatherSample weather,
  out ivec3 sampleCount
) {
  ++sampleCount.y;
}
`;
  const material = {
    fragmentShader: originalShader,
    needsUpdate: false
  };

  const restore = instrumentation.installTakramSampleCountInstrumentation(material);
  expect(material.fragmentShader).toContain("inout ivec3 sampleCount");
  expect(material.fragmentShader).not.toContain("  out ivec3 sampleCount");
  expect(material.needsUpdate).toBe(true);

  material.needsUpdate = false;
  restore();
  expect(material.fragmentShader).toBe(originalShader);
  expect(material.needsUpdate).toBe(true);
});
