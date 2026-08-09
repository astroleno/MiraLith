import { expect, test } from "@playwright/test";

test("preserves primary counts by changing only the debug sample parameter to inout", async () => {
  const instrumentation = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramSampleCountInstrumentation"
  );
  const originalShader = `
vec4 marchClouds(
  out float frontDepth,
  out ivec3 sampleCount
) {
  return vec4(0.0);
}
MediaSample sampleMedia(
  const WeatherSample weather,
  const float jitter,
  out ivec3 sampleCount
) {
  vec4 density = weather.density;
  ++sampleCount.y;
}
#ifdef DEBUG_SHOW_SAMPLE_COUNT
outputColor = vec4(vec3(sampleCount) / vec3(500.0, 5.0, 5.0), 1.0);
#endif // DEBUG_SHOW_SAMPLE_COUNT
`;
  const material = {
    fragmentShader: originalShader,
    needsUpdate: false
  };

  const restore = instrumentation.installTakramSampleCountInstrumentation(material);
  expect(material.fragmentShader).toContain("inout ivec3 sampleCount");
  expect(material.fragmentShader).toContain("out float frontDepth,\n  out ivec3 sampleCount");
  expect(material.fragmentShader).toContain(
    "vec4(vec3(sampleCount) / vec3(500.0, 5.0, 5.0), step(0.0, marchedFrontDepth))"
  );
  expect(material.needsUpdate).toBe(true);

  material.needsUpdate = false;
  restore();
  expect(material.fragmentShader).toBe(originalShader);
  expect(material.needsUpdate).toBe(true);
});
