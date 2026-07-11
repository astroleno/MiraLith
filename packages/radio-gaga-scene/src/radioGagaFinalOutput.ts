const FINAL_OUTPUT_START = 0.925;
const FINAL_OUTPUT_END = 1;
const TYPE_PORTION = 0.7;
const EXIT_START = 0.84;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);

export const radioGagaFinalOutputs = [
  {
    source: "community gate",
    en: "Mom, the road by the community gate is closed tomorrow. Take the east gate instead.",
    zh: "妈，社区门口那条路明天施工，出门从东门绕一下。"
  },
  {
    source: "morning market",
    en: "Dad, use the north gate for the market this morning. The line is shorter, so it should take less effort.",
    zh: "爸，早上去菜场走北门，那边少排队，会省点力。"
  },
  {
    source: "weather shift",
    en: "It may cool down this afternoon. Put a jacket in your bag before you go out; I will check in later.",
    zh: "下午可能降温，出门前把外套放包里，我晚点再问你。"
  }
] as const;

export interface RadioGagaFinalOutputState {
  activeIndex: number;
  displayText: string;
  isComplete: boolean;
  progress: number;
  subtitleOpacity: number;
  visibleCount: number;
}

export function mapRadioGagaFinalOutput(progressInput: number): RadioGagaFinalOutputState {
  const progress = clamp01(progressInput);
  const sequenceProgress = range(progress, FINAL_OUTPUT_START, FINAL_OUTPUT_END);

  if (sequenceProgress <= 0) {
    return {
      activeIndex: -1,
      displayText: "",
      isComplete: false,
      progress: 0,
      subtitleOpacity: 0,
      visibleCount: 0
    };
  }

  const segmentCount = radioGagaFinalOutputs.length;
  const scaledProgress = Math.min(sequenceProgress * segmentCount, segmentCount - 0.0001);
  const activeIndex = Math.floor(scaledProgress);
  const segmentProgress = scaledProgress - activeIndex;
  const sourceText = radioGagaFinalOutputs[activeIndex]?.zh ?? "";
  const glyphs = Array.from(sourceText);
  const typedCount = Math.min(
    glyphs.length,
    Math.max(1, Math.ceil(glyphs.length * range(segmentProgress, 0, TYPE_PORTION)))
  );
  const exitOpacity =
    activeIndex === segmentCount - 1 ? 0 : smooth(range(segmentProgress, EXIT_START, 1));

  return {
    activeIndex,
    displayText: glyphs.slice(0, typedCount).join(""),
    isComplete: typedCount >= glyphs.length,
    progress: segmentProgress,
    subtitleOpacity: smooth(range(segmentProgress, 0, 0.1)) * (1 - exitOpacity),
    visibleCount: Math.min(segmentCount, activeIndex + 1)
  };
}
