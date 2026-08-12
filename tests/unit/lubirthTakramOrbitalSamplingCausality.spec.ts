import { expect, test } from "@playwright/test";
import {
  parseTakramOrbitalStepScaleMode,
  resolveTakramOrbitalInitialStepMeters,
  resolveTakramOrbitalSamplingOutcome,
  resolveTakramOrbitalStepScale
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingCausality";

const progresses = [0, 0.06, 0.12, 0.18] as const;

function recoveredFrames(downstreamSignalObservable = true) {
  return progresses.map((progress) => ({
    downstreamSignalObservable,
    nativeSamplingIncreased: true,
    preTemporalSignalRecovered: true,
    progress,
    repeatNoiseExceeded: true,
    structuredRawSignalRecovered: true
  }));
}

test("parses only the two named orbital perspective-step arms", () => {
  expect(parseTakramOrbitalStepScaleMode("control")).toBe("control");
  expect(parseTakramOrbitalStepScaleMode("treatment")).toBe("treatment");
  expect(["1.01", "1.0001", "", null].map(parseTakramOrbitalStepScaleMode))
    .toEqual([null, null, null, null]);
  expect(resolveTakramOrbitalStepScale("control")).toBe(1.01);
  expect(resolveTakramOrbitalStepScale("treatment")).toBe(1.0001);
});

test("resolves the distance-dependent initial step for both arms", () => {
  const rayNearMeters = 3_578_429.408265641;
  expect(resolveTakramOrbitalInitialStepMeters({
    minStepSize: 50,
    perspectiveStepScale: resolveTakramOrbitalStepScale("control"),
    rayNearMeters
  })).toBeCloseTo(35_834.294082656445, 9);
  expect(resolveTakramOrbitalInitialStepMeters({
    minStepSize: 50,
    perspectiveStepScale: resolveTakramOrbitalStepScale("treatment"),
    rayNearMeters
  })).toBeCloseTo(407.8429408265247, 9);
});

test("classifies setup, confirmed, downstream, and unsupported outcomes", () => {
  expect(resolveTakramOrbitalSamplingOutcome({
    frames: [],
    setupPass: false
  })).toBe("ORBITAL_SAMPLING_SETUP_BLOCKED");
  expect(resolveTakramOrbitalSamplingOutcome({
    frames: recoveredFrames(),
    setupPass: true
  })).toBe("ORBITAL_SAMPLING_CAUSALITY_CONFIRMED");
  expect(resolveTakramOrbitalSamplingOutcome({
    frames: recoveredFrames(false),
    setupPass: true
  })).toBe("ORBITAL_SAMPLING_CAUSALITY_PARTIAL_DOWNSTREAM_BLOCKED");
  expect(resolveTakramOrbitalSamplingOutcome({
    frames: recoveredFrames().map((frame, index) => index === 2
      ? { ...frame, structuredRawSignalRecovered: false }
      : frame),
    setupPass: true
  })).toBe("ORBITAL_SAMPLING_CAUSALITY_NOT_SUPPORTED");
  expect(resolveTakramOrbitalSamplingOutcome({
    frames: recoveredFrames().slice(0, 3),
    setupPass: true
  })).toBe("ORBITAL_SAMPLING_CAUSALITY_NOT_SUPPORTED");
});
