import type { RadioGagaFrame } from "./types";

export type RadioGagaCopyMode = "desktop" | "compact";

export interface RadioGagaCopyFrame {
  titleOpacity: number;
  voiceOpacity: number;
  memoryOpacity: number;
  finalOpacity: number;
  titleRailOpacity: number;
  copyScrimOpacity: number;
  instrumentOpacity: number;
  stageOpacities: readonly [number, number, number, number, number];
  dialOpacities: readonly [number, number, number, number, number];
  tunerPosition: number;
  tunerScanOpacity: number;
}

export interface RadioGagaChoreographyFrame {
  progress: number;
  scene: RadioGagaFrame;
  copy: RadioGagaCopyFrame;
}

export const RADIO_GAGA_TIMELINE = {
  reading: {
    enterStart: 0.18,
    enterEnd: 0.23,
    exitStart: 0.35,
    exitEnd: 0.39
  },
  familyScript: {
    enterStart: 0.5,
    enterEnd: 0.55,
    exitStart: 0.67,
    exitEnd: 0.71
  },
  instrument: {
    enterStart: 0.14,
    enterEnd: 0.18,
    exitStart: 0.985,
    exitEnd: 0.996
  },
  handoff: {
    start: 0.72,
    end: 0.8
  },
  coreCopy: {
    enterStart: 0.8,
    enterEnd: 0.83,
    exitStart: 0.88,
    exitEnd: 0.915
  },
  finale: {
    particleAbsorbStart: 0.895,
    particleAbsorbEnd: 0.925,
    revealStart: 0.895,
    revealEnd: 0.925,
    frontLockStart: 0.925,
    frontLockEnd: 0.95,
    outputStart: 0.955,
    outputEnd: 0.985,
    closingLineStart: 0.988,
    closingLineEnd: 0.998
  }
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;
const phase = (
  progress: number,
  enterStart: number,
  enterEnd: number,
  exitStart: number,
  exitEnd: number
) => smooth(range(progress, enterStart, enterEnd)) * (1 - smooth(range(progress, exitStart, exitEnd)));

const radioGagaTuningSequence = [1, 2, 3, 4, 5, 4, 3] as const;

function getRadioGagaTuningSignal(progress: number) {
  const tuningProgress = range(progress, 0.48, 0.58);
  const segmentCount = radioGagaTuningSequence.length - 1;
  const scaledProgress = tuningProgress * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress));
  const segmentProgress = smooth(scaledProgress - segmentIndex);
  const fromChannel = radioGagaTuningSequence[segmentIndex] ?? 3;
  const toChannel = radioGagaTuningSequence[segmentIndex + 1] ?? fromChannel;
  const channel = lerp(fromChannel, toChannel, segmentProgress);
  const signalPresence = smooth(range(progress, 0.49, 0.54)) * (1 - smooth(range(progress, 0.68, 0.76)));
  const boosts = [1, 2, 3, 4, 5].map((dial) => {
    const distance = Math.abs(channel - dial);
    return smooth(1 - clamp01(distance)) * signalPresence;
  }) as [number, number, number, number, number];

  return {
    boosts,
    position: (channel - 1) / 4,
    scanOpacity: signalPresence * (1 - smooth(range(progress, 0.62, 0.7)) * 0.42)
  };
}

function mapRadioGagaSceneProgress(progress: number): RadioGagaFrame {
  const appear = smooth(range(progress, 0, 0.15));
  const voice = smooth(range(progress, 0.18, 0.32));
  const memory = smooth(range(progress, RADIO_GAGA_TIMELINE.familyScript.enterStart, 0.62));
  const core = smooth(range(progress, RADIO_GAGA_TIMELINE.coreCopy.enterStart, RADIO_GAGA_TIMELINE.coreCopy.exitStart));
  const settle = smooth(range(progress, 0.8, 1));
  const finalTextSettle = smooth(
    range(progress, RADIO_GAGA_TIMELINE.finale.closingLineStart, RADIO_GAGA_TIMELINE.finale.closingLineEnd)
  );
  const esp32Reveal = smooth(
    range(progress, RADIO_GAGA_TIMELINE.finale.revealStart, RADIO_GAGA_TIMELINE.finale.revealEnd)
  );
  const esp32SolidMotionProgress = smooth(
    range(progress, RADIO_GAGA_TIMELINE.finale.frontLockStart, RADIO_GAGA_TIMELINE.finale.frontLockEnd)
  );
  const radioToEsp32Progress = smooth(range(progress, 0.64, 0.84));
  const particleRise = smooth(range(progress, 0.105, 0.145));
  const particleFall = smooth(
    range(progress, RADIO_GAGA_TIMELINE.finale.particleAbsorbStart, RADIO_GAGA_TIMELINE.finale.particleAbsorbEnd)
  );
  const particlePeak = particleRise * (1 - particleFall);
  const particleTurbulencePeak =
    smooth(range(progress, 0.14, 0.26)) * (1 - smooth(range(progress, 0.84, 0.92)));
  const particleAttractorStrength = smooth(range(progress, 0.8, 0.89));
  const homeReturn = smooth(
    range(progress, RADIO_GAGA_TIMELINE.finale.revealStart, RADIO_GAGA_TIMELINE.finale.frontLockEnd)
  );
  const radioIntroOpacity = 1;
  const radioExit = smooth(range(progress, 0.115, 0.175));
  const titleIntroOpacity = lerp(0.94, 1, appear);
  const titleExit = smooth(range(progress, 0.055, 0.135));
  const voiceExit = smooth(range(progress, RADIO_GAGA_TIMELINE.reading.exitStart, RADIO_GAGA_TIMELINE.reading.exitEnd));
  const voiceLineExit = smooth(range(progress, 0.37, 0.42));
  const memoryExit = smooth(
    range(progress, RADIO_GAGA_TIMELINE.familyScript.exitStart, RADIO_GAGA_TIMELINE.familyScript.exitEnd)
  );
  const coreCopy = smooth(
    range(progress, RADIO_GAGA_TIMELINE.coreCopy.enterStart, RADIO_GAGA_TIMELINE.coreCopy.enterEnd)
  );
  const coreFinalExit = smooth(
    range(progress, RADIO_GAGA_TIMELINE.coreCopy.exitStart, RADIO_GAGA_TIMELINE.coreCopy.exitEnd)
  );

  return {
    progress,
    radioOpacity: radioIntroOpacity * lerp(1, 0, radioExit) * lerp(1, 0, homeReturn),
    radioGhostOpacity: 0,
    radioScale: lerp(0.92, 0.98, appear) * lerp(1, 0.98, radioExit),
    radioRotationY: -1.57,
    esp32Opacity: esp32Reveal,
    esp32SolidMotionProgress,
    coreLightIntensity: lerp(0, 1, esp32Reveal),
    radioToEsp32Progress,
    particleOpacity: particlePeak,
    particleTurbulence: lerp(0.18, 1, particleTurbulencePeak) * lerp(1, 0.38, particleAttractorStrength),
    particleAttractorStrength,
    traceOpacity: 0,
    signatureMomentProgress: core,
    speakerGlow: lerp(0, 0.45, voice) + lerp(0, 0.2, memory) - lerp(0, 0.4, settle),
    voiceLinesOpacity:
      lerp(0, 0.84, voice) * lerp(1, 0, voiceLineExit) * lerp(1, 0, homeReturn),
    memoryLayerOpacity: lerp(0, 0.9, memory) * (1 - memoryExit),
    titleOpacity: titleIntroOpacity * lerp(1, 0, titleExit),
    bodyOpacity: lerp(0, 1, voice) * (1 - voiceExit),
    calloutOpacity: coreCopy * (1 - coreFinalExit),
    finalLineOpacity: finalTextSettle,
    cameraZ: lerp(5.8, 5, smooth(range(progress, 0, 0.78))),
    backgroundWarmth: lerp(0.22, 0.58, memory) * lerp(1, 0.72, settle)
  };
}

function mapRadioGagaCopyProgress(
  progress: number,
  scene: RadioGagaFrame,
  mode: RadioGagaCopyMode
): RadioGagaCopyFrame {
  const reading = RADIO_GAGA_TIMELINE.reading;
  const familyScript = RADIO_GAGA_TIMELINE.familyScript;
  const instrument = RADIO_GAGA_TIMELINE.instrument;
  const readingOpacity = phase(
    progress,
    reading.enterStart,
    reading.enterEnd,
    reading.exitStart,
    reading.exitEnd
  );
  const memoryOpacity = phase(
    progress,
    familyScript.enterStart,
    familyScript.enterEnd,
    familyScript.exitStart,
    familyScript.exitEnd
  );
  const instrumentOpacity = phase(
    progress,
    instrument.enterStart,
    instrument.enterEnd,
    instrument.exitStart,
    instrument.exitEnd
  );
  const tuningSignal = getRadioGagaTuningSignal(progress);
  const activeStageIndex = progress < 0.15
    ? 0
    : progress < 0.44
      ? 1
      : progress < 0.7
        ? 2
        : progress < 0.8975
          ? 3
          : 4;
  const stageOpacities: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  stageOpacities[activeStageIndex] = 1;
  const primaryPresence = Math.max(
    readingOpacity,
    memoryOpacity,
    scene.finalLineOpacity
  );
  const copyScrimOpacity = mode === "compact"
    ? Math.min(0.72, primaryPresence * 0.54 + instrumentOpacity * 0.24)
    : Math.min(0.34, primaryPresence * 0.24 + instrumentOpacity * 0.1);

  return {
    titleOpacity: scene.titleOpacity,
    voiceOpacity: readingOpacity,
    memoryOpacity,
    finalOpacity: scene.finalLineOpacity,
    titleRailOpacity: 1 - smooth(range(progress, 0.035, 0.095)),
    copyScrimOpacity,
    instrumentOpacity,
    stageOpacities,
    dialOpacities: tuningSignal.boosts,
    tunerPosition: tuningSignal.position,
    tunerScanOpacity: tuningSignal.scanOpacity
  };
}

export function mapRadioGagaChoreography(
  progressInput: number,
  mode: RadioGagaCopyMode = "desktop"
): RadioGagaChoreographyFrame {
  const progress = clamp01(progressInput);
  const scene = mapRadioGagaSceneProgress(progress);

  return {
    progress,
    scene,
    copy: mapRadioGagaCopyProgress(progress, scene, mode)
  };
}

export function mapRadioGagaProgress(progressInput: number): RadioGagaFrame {
  return mapRadioGagaSceneProgress(clamp01(progressInput));
}
