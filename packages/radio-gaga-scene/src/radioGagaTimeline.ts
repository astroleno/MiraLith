import type { RadioGagaFrame } from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

export function mapRadioGagaProgress(progressInput: number): RadioGagaFrame {
  const progress = clamp01(progressInput);
  const appear = smooth(range(progress, 0, 0.15));
  const voice = smooth(range(progress, 0.18, 0.34));
  const memory = smooth(range(progress, 0.48, 0.62));
  const core = smooth(range(progress, 0.82, 0.92));
  const settle = smooth(range(progress, 0.8, 1));
  const finalTextSettle = smooth(range(progress, 0.925, 1));
  const esp32Reveal = smooth(range(progress, 0.86, 0.925));
  const esp32SolidMotionProgress = smooth(range(progress, 0.925, 0.975));
  const radioToEsp32Progress = smooth(range(progress, 0.64, 0.84));
  const particleRise = smooth(range(progress, 0.105, 0.145));
  const particleFall = smooth(range(progress, 0.91, 0.955));
  const particlePeak = particleRise * (1 - particleFall);
  const particleTurbulencePeak =
    smooth(range(progress, 0.14, 0.26)) * (1 - smooth(range(progress, 0.84, 0.92)));
  const particleAttractorStrength = smooth(range(progress, 0.82, 0.9));
  const homeReturn = smooth(range(progress, 0.895, 0.93));
  const radioIntroOpacity = 1;
  const radioExit = smooth(range(progress, 0.115, 0.175));
  const titleIntroOpacity = lerp(0.94, 1, appear);
  const titleExit = smooth(range(progress, 0.055, 0.135));
  const voiceExit = smooth(range(progress, 0.36, 0.43));
  const voiceLineExit = smooth(range(progress, 0.4, 0.52));
  const memoryExit = smooth(range(progress, 0.72, 0.82));
  const coreCopy = smooth(range(progress, 0.78, 0.86));
  const coreFinalExit = smooth(range(progress, 0.92, 0.97));

  return {
    progress,
    radioOpacity: radioIntroOpacity * lerp(1, 0, radioExit) * lerp(1, 0, homeReturn),
    radioGhostOpacity: 0,
    radioScale: lerp(0.92, 0.98, appear) * lerp(1, 0.98, radioExit),
    radioRotationY: -1.57,
    esp32Opacity: lerp(0, 1, esp32Reveal) * lerp(1, 0, homeReturn),
    esp32SolidMotionProgress,
    coreLightIntensity: lerp(0, 1, esp32Reveal) * lerp(1, 0.015, homeReturn),
    radioToEsp32Progress,
    particleOpacity: particlePeak * lerp(1, 0.55, homeReturn),
    particleTurbulence: lerp(0.18, 1, particleTurbulencePeak) * lerp(1, 0.38, particleAttractorStrength),
    particleAttractorStrength,
    traceOpacity: 0,
    signatureMomentProgress: core,
    speakerGlow: lerp(0, 0.45, voice) + lerp(0, 0.2, memory) - lerp(0, 0.4, settle),
    voiceLinesOpacity: lerp(0, 0.84, voice) * lerp(1, 0.34, voiceLineExit) * lerp(1, 0.05, homeReturn) + lerp(0, 0.1, homeReturn),
    memoryLayerOpacity: lerp(0, 0.9, memory) * lerp(1, 0.02, memoryExit),
    titleOpacity: titleIntroOpacity * lerp(1, 0, titleExit),
    bodyOpacity: lerp(0, 1, voice) * lerp(1, 0, voiceExit),
    calloutOpacity: coreCopy * lerp(1, 0, coreFinalExit),
    finalLineOpacity: finalTextSettle,
    cameraZ: lerp(5.8, 5, smooth(range(progress, 0, 0.78))),
    backgroundWarmth: lerp(0.22, 0.58, memory) * lerp(1, 0.72, settle)
  };
}
