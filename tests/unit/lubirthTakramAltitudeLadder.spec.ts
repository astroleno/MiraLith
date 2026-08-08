import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
test("altitude ladder instrumentation matches the pinned native shader contract", async () => {
  const {
    installTakramAltitudeLadderInstrumentation,
    setTakramAltitudeLadderShaderMode,
    TAKRAM_ALTITUDE_LADDER_SHADER_MODES
  } = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramAltitudeLadderInstrumentation"
  );
  const shader = readFileSync(
    "packages/lubirth-hero/node_modules/@takram/three-clouds/src/shaders/clouds.frag",
    "utf8"
  );
  const material = {
    fragmentShader: shader,
    needsUpdate: false,
    uniforms: {}
  };

  installTakramAltitudeLadderInstrumentation(material);
  expect(material.fragmentShader).toContain("uniform int altitudeLadderMode;");
  expect(material.fragmentShader).toContain("ladderPrimarySampleCountLocal += 1.0;");
  expect(material.fragmentShader).toContain("ladderPrimarySampleCount / 500.0");
  expect(material.fragmentShader).toContain("out float ladderDensitySum");
  expect(material.fragmentShader).toContain("out float ladderRawTransmittance");
  expect(material.fragmentShader).toContain("vec4(color.rgb, ladderRawTransmittance)");
  expect(material.fragmentShader).toContain("ladderDensitySumLocal += media.scattering;");
  expect(material.needsUpdate).toBe(true);

  setTakramAltitudeLadderShaderMode(
    material,
    TAKRAM_ALTITUDE_LADDER_SHADER_MODES.density
  );
  expect(material.uniforms.altitudeLadderMode?.value).toBe(1);
  installTakramAltitudeLadderInstrumentation(material);
  expect(material.fragmentShader.match(/uniform int altitudeLadderMode;/g)).toHaveLength(1);
});

test("altitude ladder readback reports density and optical signal separately", async () => {
  const {
    summarizeTakramAltitudeLadderDensity,
    summarizeTakramAltitudeLadderRadiance
  } = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramAltitudeLadderReadback"
  );
  const density = summarizeTakramAltitudeLadderDensity({
    values: Float32Array.from([
      0.052, 0.12, 0.8, 0.2,
      0.104, 0.24, 0.4, 0.1,
      0, 0, 0, 0
    ]),
    width: 3,
    height: 1,
    precision: "half-float"
  });
  expect(density.shellIntervalLengthMeters).toBeCloseTo(78_000, -2);
  expect(density.validPrimarySampleCount).toBeCloseTo(90, 4);
  expect(density.maxDensity).toBeCloseTo(0.8, 5);
  expect(density.averageDensity).toBeCloseTo(0.15, 4);

  const radiance = summarizeTakramAltitudeLadderRadiance({
    values: Float32Array.from([
      0.2, 0.3, 0.4, 0.5,
      0.4, 0.2, 0.1, 0.25
    ]),
    width: 2,
    height: 1,
    precision: "half-float"
  });
  expect(radiance.averageTransmittance).toBeCloseTo(0.375, 4);
  expect(radiance.accumulatedOpticalDepth).toBeCloseTo(
    (-Math.log(0.5) - Math.log(0.25)) / 2,
    4
  );
  expect(radiance.averageLuma).toBeGreaterThan(0);
});
