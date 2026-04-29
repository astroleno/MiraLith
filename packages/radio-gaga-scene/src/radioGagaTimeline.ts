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
  const voice = smooth(range(progress, 0.15, 0.35));
  const memory = smooth(range(progress, 0.35, 0.55));
  const core = smooth(range(progress, 0.58, 0.82));
  const settle = smooth(range(progress, 0.8, 1));
  const shellReveal = smooth(range(progress, 0.56, 0.68));
  const esp32Reveal = smooth(range(progress, 0.6, 0.78));
  const radioIntroOpacity = lerp(0.82, 1, appear);
  const titleIntroOpacity = lerp(0.94, 1, appear);
  const titleExit = smooth(range(progress, 0.22, 0.42));
  const voiceExit = smooth(range(progress, 0.38, 0.5));
  const memoryExit = smooth(range(progress, 0.52, 0.63));
  const memoryCoreExit = smooth(range(progress, 0.56, 0.66));
  const coreCopy = smooth(range(progress, 0.62, 0.76));
  const coreFinalExit = smooth(range(progress, 0.8, 0.88));

  return {
    progress,
    radioOpacity: shellReveal > 0 ? lerp(1, 0.12, shellReveal) * lerp(1, 0.58, settle) : radioIntroOpacity,
    radioGhostOpacity: shellReveal > 0 ? lerp(0, 0.42, shellReveal) + lerp(0, 0.12, settle) : 0,
    radioScale: lerp(0.94, 1, appear),
    radioRotationY: lerp(-0.18, -0.24, voice),
    esp32Opacity: lerp(0, 1, esp32Reveal) * lerp(1, 0.68, settle),
    coreLightIntensity: lerp(0, 1, esp32Reveal) * lerp(1, 0.48, settle),
    signatureMomentProgress: core,
    speakerGlow: lerp(0, 0.45, voice) + lerp(0, 0.2, memory) - lerp(0, 0.4, settle),
    voiceLinesOpacity: lerp(0, 0.65, voice) * lerp(1, 0.38, settle),
    memoryLayerOpacity: lerp(0, 0.58, memory) * lerp(1, 0.08, memoryExit) * lerp(1, 0, memoryCoreExit),
    titleOpacity: titleIntroOpacity * lerp(1, 0, titleExit),
    bodyOpacity: lerp(0, 1, voice) * lerp(1, 0, voiceExit),
    calloutOpacity: coreCopy * lerp(1, 0, coreFinalExit),
    finalLineOpacity: settle,
    cameraZ: progress < 0.8
      ? lerp(5.2, 4.3, smooth(range(progress, 0, 0.8)))
      : lerp(4.3, 4.8, settle),
    backgroundWarmth: lerp(0.38, 0.9, memory) * lerp(1, 0.78, settle)
  };
}
