import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  mapRadioGagaChoreography,
  mapRadioGagaProgress
} from "../../packages/radio-gaga-scene/src/radioGagaTimeline";
import {
  mapRadioGagaFinalOutput,
  radioGagaFinalOutputs
} from "../../packages/radio-gaga-scene/src/radioGagaFinalOutput";

test("radioGAGA keeps the particle handoff free of outgoing and incoming copy", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  const handoff = mapRadioGagaProgress(0.76);

  expect(handoff.memoryLayerOpacity, "family-script copy should be fully cleared").toBeLessThan(0.01);
  expect(handoff.calloutOpacity, "ESP32 copy should wait until the particle handoff settles").toBeLessThan(0.01);
});

test("radioGAGA reaches the front-facing lock before the final-output checkpoint", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  const preOutputFrame = mapRadioGagaProgress(0.952);

  expect(preOutputFrame.esp32SolidMotionProgress).toBe(1);
  expect(preOutputFrame.finalLineOpacity).toBe(0);
});

test("radioGAGA clears the particle shell before the ESP32 begins turning", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  const absorbingFrame = mapRadioGagaProgress(0.89);
  const turningFrame = mapRadioGagaProgress(0.93);

  expect(absorbingFrame.particleOpacity).toBeGreaterThan(0.05);
  expect(absorbingFrame.esp32SolidMotionProgress, "the solid model must hold its source pose while particles remain").toBe(0);
  expect(turningFrame.particleOpacity, "the particle shell must be gone before the turn begins").toBeLessThan(0.05);
  expect(turningFrame.esp32SolidMotionProgress).toBeGreaterThan(0);
});

test("radioGAGA keeps visible energy through the particle-to-solid crossfade", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  for (let progress = 0.885; progress <= 0.93; progress += 0.0025) {
    const frame = mapRadioGagaProgress(progress);
    const handoffEnergy = frame.particleOpacity + frame.esp32Opacity;

    expect(handoffEnergy, `handoff energy at ${progress.toFixed(4)}`).toBeGreaterThan(0.9);
  }
});

test("radioGAGA fades opaque GLB renders through a model composite layer", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The rendering-policy contract only needs one project.");

  const modelSource = readFileSync(
    resolve(process.cwd(), "packages/radio-gaga-scene/src/RadioGagaModel.tsx"),
    "utf8"
  );
  const sceneSource = readFileSync(
    resolve(process.cwd(), "packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx"),
    "utf8"
  );

  expect(modelSource).not.toContain("applyOpacity");
  expect(modelSource).not.toContain("material.opacity = nextOpacity");
  expect(sceneSource).toContain("RadioGagaModelComposite");
});

test("radioGAGA skips the offscreen model pass while its composite is invisible", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The rendering-policy contract only needs one project.");

  const compositeSource = readFileSync(
    resolve(process.cwd(), "packages/radio-gaga-scene/src/RadioGagaModelComposite.tsx"),
    "utf8"
  );
  const visibilityGate = compositeSource.indexOf("if (compositeOpacity <= MODEL_COMPOSITE_VISIBILITY_THRESHOLD)");
  const offscreenPass = compositeSource.indexOf("gl.setRenderTarget(renderTarget)");

  expect(visibilityGate, "the invisible composite should exit before binding the FBO").toBeGreaterThan(-1);
  expect(visibilityGate, "the visibility gate should precede the offscreen pass").toBeLessThan(offscreenPass);
  expect(compositeSource).toContain("compositeMaterial.visible = compositeOpacity > MODEL_COMPOSITE_VISIBILITY_THRESHOLD");
  expect(compositeSource).not.toContain("gl.clear(");
});

test("radioGAGA keeps one broadcast tuner present from reading through playback", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  const reading = mapRadioGagaChoreography(0.4).copy;
  const transmitting = mapRadioGagaChoreography(0.78).copy;
  const playback = mapRadioGagaChoreography(0.96).copy;

  expect(reading.instrumentOpacity).toBeGreaterThan(0.8);
  expect(transmitting.instrumentOpacity).toBeGreaterThan(0.8);
  expect(playback.instrumentOpacity).toBeGreaterThan(0.8);
});

test("radioGAGA keeps exactly one broadcast-stage label visible", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  for (let progress = 0; progress <= 1; progress += 0.0025) {
    const { stageOpacities } = mapRadioGagaChoreography(progress).copy;
    const visibleStages = stageOpacities.filter((opacity) => opacity > 0.01);

    expect(visibleStages, `visible stages at ${progress.toFixed(4)}`).toHaveLength(1);
    expect(
      Math.max(...stageOpacities),
      `strongest stage at ${progress.toFixed(4)}`
    ).toBeGreaterThanOrEqual(0.99);
  }
});

test("radioGAGA waits for the front lock before starting the final output", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  expect(mapRadioGagaFinalOutput(0.95).activeIndex).toBe(-1);
  expect(mapRadioGagaProgress(0.95).esp32SolidMotionProgress).toBe(1);
});

test("radioGAGA plays one featured reminder instead of accumulating transcript history", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  const output = mapRadioGagaFinalOutput(0.98);

  expect(output.activeIndex).toBe(2);
  expect(output.visibleCount).toBe(1);
});

test("radioGAGA reduced motion reveals the featured reminder without typewriter motion", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The timeline contract only needs one project.");

  const mapWithMotionPreference = mapRadioGagaFinalOutput as (
    progress: number,
    reducedMotion?: boolean
  ) => ReturnType<typeof mapRadioGagaFinalOutput>;
  const output = mapWithMotionPreference(0.96, true);

  expect(output.displayText).toBe(radioGagaFinalOutputs[2].zh);
  expect(output.isComplete).toBe(true);
});
