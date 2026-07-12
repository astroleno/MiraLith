import type { CoScrollTimelineConfig } from "./types";
import { DEFAULT_COSCROLL_TIMELINE } from "./defaultTimeline";

export const SOURCE_COSCROLL_REVIEW_TIME = 10.2;

export const SOURCE_COSCROLL_EXCERPT_TIMELINE: CoScrollTimelineConfig = {
  duration: 48,
  easing: "linear",
  anchorCues: [
    { anchor: "观", start: 0, end: 24 },
    { anchor: "空", start: 24, end: 48 }
  ],
  lyricSegments: [
    { id: "source-famous-01", text: "观自在菩萨", start: 0, end: 6, layer: "back", emphasis: "normal" },
    { id: "source-famous-02", text: "行深般若波罗蜜多时", start: 6, end: 13, layer: "back", emphasis: "normal" },
    { id: "source-famous-03", text: "照见五蕴皆空", start: 13, end: 20, layer: "front", emphasis: "bright" },
    { id: "source-famous-04", text: "度一切苦厄", start: 20, end: 27, layer: "back", emphasis: "bright" },
    { id: "source-famous-05", text: "舍利子", start: 27, end: 35, layer: "back", emphasis: "normal" },
    { id: "source-famous-06", text: "色不异空", start: 35, end: 48, layer: "front", emphasis: "bright" }
  ]
};

export const SOURCE_COSCROLL_TIMELINE: CoScrollTimelineConfig = {
  duration: DEFAULT_COSCROLL_TIMELINE.duration,
  easing: "linear",
  anchorCues: [
    { anchor: "观", start: 11.84, end: 28.87 },
    { anchor: "空", start: 28.87, end: 36.79 },
    { anchor: "苦", start: 36.79, end: 52.53 },
    { anchor: "色", start: 52.53, end: 94.09 },
    { anchor: "法", start: 94.09, end: 98.88 },
    { anchor: "生", start: 98.88, end: 106.77 },
    { anchor: "无", start: 106.77, end: 140.5 },
    { anchor: "死", start: 140.5, end: 147.05 },
    { anchor: "道", start: 147.05, end: 194.1 },
    { anchor: "心", start: 194.1, end: 221.27 },
    { anchor: "悟", start: 221.27, end: 239.06 },
    { anchor: "明", start: 239.06, end: 247.59 },
    { anchor: "真", start: 247.59, end: 287.91 },
    { anchor: "道", start: 287.91, end: 322.62 },
    { anchor: "圆", start: 322.62, end: 348.83 },
    { anchor: "心", start: 348.83, end: DEFAULT_COSCROLL_TIMELINE.duration }
  ],
  lyricSegments: DEFAULT_COSCROLL_TIMELINE.lyricSegments
};
