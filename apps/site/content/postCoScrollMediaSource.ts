export const POST_COSCROLL_MEDIA_SOURCE_SPEC_VERSION = 1 as const;

export type PostCoScrollAssetAvailability = "available" | "missing-required" | "pending";
export type PostCoScrollPlaybackMode = "scrub" | "autoplay" | "loop" | "frame-hold";

export interface PostCoScrollSourceSegment {
  startPTS: number;
  endPTSExclusive: number;
  firstFrameMd5: string;
  lastIncludedFrameMd5: string;
}

export interface PostCoScrollSourceMaster {
  id: string;
  workId: string;
  availability: PostCoScrollAssetAvailability;
  sourceFileLabel: string | null;
  alternateSourceFileLabels?: readonly string[];
  sourceSha256: string | null;
  sourceBytes: number | null;
  sourceTimeBase: string | null;
  sourceFrameRate: string | null;
  frameStepPTS: number | null;
  durationPTS: number | null;
  video: {
    codec: string | null;
    width: number | null;
    height: number | null;
  };
  audio: {
    codec: string | null;
    sampleRate: number | null;
    channels: number | null;
  };
}

export interface PostCoScrollMediaVariantIntent {
  width: number;
  maxHeight: number;
  container: "mp4";
  videoCodec: "h264";
  pixelFormat: "yuv420p";
  keyframeIntervalFrames: number;
  maxBytes: number;
}

export interface PostCoScrollMediaClipSource {
  id: string;
  workId: string;
  availability: PostCoScrollAssetAvailability;
  sourceId: string | null;
  sourceSegments: readonly PostCoScrollSourceSegment[];
  mode: PostCoScrollPlaybackMode;
  reviewLabel: string;
  poster: {
    kind: "source-frame" | "dossier";
    sourcePTS: number | null;
    maxBytes: number;
  };
  variants: {
    desktop: PostCoScrollMediaVariantIntent;
    mobile: PostCoScrollMediaVariantIntent;
  } | null;
  audio: {
    policy: "source-on-unlock" | "muted" | "none";
    fadeInSeconds?: number;
    fadeOutSeconds?: number;
  };
  fallback: {
    kind: "poster" | "dossier";
    dossierId: string;
    reason: string;
  };
  editorial?: {
    order: "B-ring-first-v9";
    omitSourceFrameRangeHalfOpen: readonly [number, number];
    webToFilmExposureFrames: number;
    returnTransitionFrames: number;
    restartSilenceSeconds: number;
    measuredRestartSilenceSeconds: number;
    sourceAudioFadeSeconds: number;
    filmOwnerStartsAtSourceFrame: number;
    domRingAfterHandoff: false;
  };
  excludedSourceSentinel?: {
    sourceFrame: number;
    pts: number;
    frameMd5: string;
    content: string;
  };
}

function variants(
  desktopMaxBytes: number,
  mobileMaxBytes: number,
  keyframeIntervalFrames: number
): PostCoScrollMediaClipSource["variants"] {
  return {
    desktop: {
      width: 1_920,
      maxHeight: 1_080,
      container: "mp4",
      videoCodec: "h264",
      pixelFormat: "yuv420p",
      keyframeIntervalFrames,
      maxBytes: desktopMaxBytes
    },
    mobile: {
      width: 960,
      maxHeight: 960,
      container: "mp4",
      videoCodec: "h264",
      pixelFormat: "yuv420p",
      keyframeIntervalFrames,
      maxBytes: mobileMaxBytes
    }
  };
}

const sources: readonly PostCoScrollSourceMaster[] = [
  {
    id: "artbreeze",
    workId: "artbreeze",
    availability: "available",
    sourceFileLabel: "artbreeze-full.MP4",
    sourceSha256: "0ab8f26484ad1fe0814df44ba849581c22b948e6d7f1c2d7f2d1c89adab6396d",
    sourceBytes: 79_951_624,
    sourceTimeBase: "1/90000",
    sourceFrameRate: "30/1",
    frameStepPTS: 3_000,
    durationPTS: 9_891_000,
    video: { codec: "hevc", width: 1_920, height: 1_080 },
    audio: { codec: "aac", sampleRate: 44_100, channels: 2 }
  },
  {
    id: "aescape",
    workId: "aescape",
    availability: "available",
    sourceFileLabel: "aescape-short.MP4",
    sourceSha256: "8aec2e53b483b70fc95cbe410a731799c9505f6651ad586c26bb68956930ed52",
    sourceBytes: 38_474_761,
    sourceTimeBase: "1/90000",
    sourceFrameRate: "30/1",
    frameStepPTS: 3_000,
    durationPTS: 2_232_000,
    video: { codec: "hevc", width: 3_840, height: 2_160 },
    audio: { codec: "aac", sampleRate: 44_100, channels: 2 }
  },
  {
    id: "focuence",
    workId: "focuence",
    availability: "available",
    sourceFileLabel: "focuence-short.MP4",
    sourceSha256: "42a63965ba81a65d03d339bceb8ac729e4aeae832e631b0772a07c90a0273145",
    sourceBytes: 31_364_001,
    sourceTimeBase: "1/90000",
    sourceFrameRate: "30/1",
    frameStepPTS: 3_000,
    durationPTS: 1_548_000,
    video: { codec: "hevc", width: 3_840, height: 2_174 },
    audio: { codec: "aac", sampleRate: 44_100, channels: 2 }
  },
  {
    id: "sonoscope",
    workId: "sonoscope",
    availability: "available",
    sourceFileLabel: "SonoScope-short.mp4",
    sourceSha256: "436e8b6561ecd0582d798d4a8de61baaa70c5cfd3d6fa80475cafe4f24ce351b",
    sourceBytes: 1_909_502,
    sourceTimeBase: "1/600",
    sourceFrameRate: "30/1",
    frameStepPTS: 20,
    durationPTS: 6_900,
    video: { codec: "h264", width: 1_264, height: 720 },
    audio: { codec: "aac", sampleRate: 44_100, channels: 1 }
  },
  {
    id: "sadine",
    workId: "sadine",
    availability: "available",
    sourceFileLabel: "sadine-full.mov",
    sourceSha256: "82e27acb52662e39cc7ee5287bb2c4f2571546334481b4284e5f6ca2f90c8094",
    sourceBytes: 47_897_613,
    sourceTimeBase: "1/15360",
    sourceFrameRate: "30/1",
    frameStepPTS: 512,
    durationPTS: 699_904,
    video: { codec: "hevc", width: 1_280, height: 720 },
    audio: { codec: "aac", sampleRate: 44_100, channels: 2 }
  },
  {
    id: "cosmic",
    workId: "cosmic-threshold",
    availability: "available",
    sourceFileLabel: "混剪-我们是宇宙感受自身的方式.MP4",
    sourceSha256: "da5c62d19b30ea932186537e65c132cbf103bcfdd57d33f2ad32dd95c8feec94",
    sourceBytes: 70_503_411,
    sourceTimeBase: "1/90000",
    sourceFrameRate: "30/1",
    frameStepPTS: 3_000,
    durationPTS: 8_037_000,
    video: { codec: "hevc", width: 1_920, height: 1_042 },
    audio: { codec: "aac", sampleRate: 48_000, channels: 2 }
  },
  {
    id: "dulwich",
    workId: "dulwich",
    availability: "available",
    sourceFileLabel: "dulwich-homepage-video-2026.mp4",
    sourceSha256: "a197358cf11b240ea8d9ed4cdf9cafa05d686d044eb523b64ac1b772045c17be",
    sourceBytes: 2_910_645,
    sourceTimeBase: "1/15360",
    sourceFrameRate: "30/1",
    frameStepPTS: 512,
    durationPTS: 257_536,
    video: { codec: "h264", width: 1_280, height: 720 },
    audio: { codec: "aac", sampleRate: 44_100, channels: 2 }
  },
  {
    id: "li",
    workId: "li",
    availability: "pending",
    sourceFileLabel: null,
    sourceSha256: null,
    sourceBytes: null,
    sourceTimeBase: null,
    sourceFrameRate: null,
    frameStepPTS: null,
    durationPTS: null,
    video: { codec: null, width: null, height: null },
    audio: { codec: null, sampleRate: null, channels: null }
  },
  {
    id: "ugcflow",
    workId: "ugcflow",
    availability: "pending",
    sourceFileLabel: null,
    sourceSha256: null,
    sourceBytes: null,
    sourceTimeBase: null,
    sourceFrameRate: null,
    frameStepPTS: null,
    durationPTS: null,
    video: { codec: null, width: null, height: null },
    audio: { codec: null, sampleRate: null, channels: null }
  }
];

const clips: readonly PostCoScrollMediaClipSource[] = [
  {
    id: "artbreeze-first-sequence",
    workId: "artbreeze",
    availability: "available",
    sourceId: "artbreeze",
    sourceSegments: [
      {
        startPTS: 1_065_000,
        endPTSExclusive: 1_668_000,
        firstFrameMd5: "9fb23e4d30cf5d743e46e7ad012a94ca",
        lastIncludedFrameMd5: "49301f8b7a26c5f371c0673252cbb59f"
      },
      {
        startPTS: 12_000,
        endPTSExclusive: 1_065_000,
        firstFrameMd5: "575222c1865ec8a9d036b416d1306f6f",
        lastIncludedFrameMd5: "63c8775a4e1ed3f714bb9adf48bd5484"
      }
    ],
    mode: "scrub",
    reviewLabel: "B ring-first: 11.833333–18.533333s → 0.133333–11.833333s",
    poster: { kind: "source-frame", sourcePTS: 1_065_000, maxBytes: 160_000 },
    variants: variants(8_000_000, 4_000_000, 15),
    audio: { policy: "source-on-unlock", fadeInSeconds: 0.012, fadeOutSeconds: 0.012 },
    fallback: {
      kind: "poster",
      dossierId: "artbreeze",
      reason: "Preserve the frozen n=355 ring as the diagnostic fallback."
    },
    editorial: {
      order: "B-ring-first-v9",
      omitSourceFrameRangeHalfOpen: [0, 4],
      webToFilmExposureFrames: 4,
      returnTransitionFrames: 4,
      restartSilenceSeconds: 0.1,
      measuredRestartSilenceSeconds: 0.105986,
      sourceAudioFadeSeconds: 0.012,
      filmOwnerStartsAtSourceFrame: 355,
      domRingAfterHandoff: false
    }
  },
  {
    id: "artbreeze-cycle",
    workId: "artbreeze",
    availability: "available",
    sourceId: "artbreeze",
    sourceSegments: [
      {
        startPTS: 1_668_000,
        endPTSExclusive: 2_760_000,
        firstFrameMd5: "66d11aca189adb1c38c634032d371a5f",
        lastIncludedFrameMd5: "3e46954860fe77a09a25b4c8bf713610"
      }
    ],
    mode: "scrub",
    reviewLabel: "18.533333–30.666667s — cycles and Sisyphus happiness",
    poster: { kind: "source-frame", sourcePTS: 1_668_000, maxBytes: 150_000 },
    variants: variants(5_000_000, 2_500_000, 15),
    audio: { policy: "muted" },
    fallback: { kind: "poster", dossierId: "artbreeze", reason: "Cycle opening frame." }
  },
  {
    id: "artbreeze-prompt",
    workId: "artbreeze",
    availability: "available",
    sourceId: "artbreeze",
    sourceSegments: [
      {
        startPTS: 2_760_000,
        endPTSExclusive: 4_527_000,
        firstFrameMd5: "d026d2d89d9ae3efb6847da39133038a",
        lastIncludedFrameMd5: "fb977370058e9b054fb2d2cda2b088a7"
      }
    ],
    mode: "scrub",
    reviewLabel: "30.666667–50.300000s — montage into completed prompt",
    poster: { kind: "source-frame", sourcePTS: 3_936_000, maxBytes: 150_000 },
    variants: variants(8_000_000, 3_500_000, 15),
    audio: { policy: "muted" },
    fallback: { kind: "poster", dossierId: "artbreeze", reason: "Completed prompt frame." }
  },
  {
    id: "artbreeze-send",
    workId: "artbreeze",
    availability: "available",
    sourceId: "artbreeze",
    sourceSegments: [
      {
        startPTS: 4_527_000,
        endPTSExclusive: 4_659_000,
        firstFrameMd5: "abf528e83f12e46006a536984e6d83d9",
        lastIncludedFrameMd5: "5031600c770522ed23f7e2e93e00b889"
      }
    ],
    mode: "autoplay",
    reviewLabel: "50.300000–51.766667s — click/Enter send action",
    poster: { kind: "source-frame", sourcePTS: 4_527_000, maxBytes: 130_000 },
    variants: variants(2_000_000, 1_000_000, 60),
    audio: { policy: "source-on-unlock" },
    fallback: { kind: "poster", dossierId: "artbreeze", reason: "Send-ready prompt." }
  },
  {
    id: "artbreeze-answer",
    workId: "artbreeze",
    availability: "available",
    sourceId: "artbreeze",
    sourceSegments: [
      {
        startPTS: 4_659_000,
        endPTSExclusive: 8_583_000,
        firstFrameMd5: "749a5a8ff8c82db3d4b7592bbe6f6f22",
        lastIncludedFrameMd5: "94d0029dab6de0e497ff961b4a879c9d"
      }
    ],
    mode: "autoplay",
    reviewLabel: "51.766667–95.366667s — waiting, answer, Starry Night",
    poster: { kind: "source-frame", sourcePTS: 4_659_000, maxBytes: 160_000 },
    variants: variants(18_000_000, 8_000_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: { kind: "poster", dossierId: "artbreeze", reason: "Answer opening frame." }
  },
  {
    id: "artbreeze-frame-hold",
    workId: "artbreeze",
    availability: "available",
    sourceId: "artbreeze",
    sourceSegments: [
      {
        startPTS: 8_580_000,
        endPTSExclusive: 8_583_000,
        firstFrameMd5: "94d0029dab6de0e497ff961b4a879c9d",
        lastIncludedFrameMd5: "94d0029dab6de0e497ff961b4a879c9d"
      }
    ],
    mode: "frame-hold",
    reviewLabel: "95.333333s — actual final included Starry Night frame",
    poster: { kind: "source-frame", sourcePTS: 8_580_000, maxBytes: 220_000 },
    variants: null,
    audio: { policy: "none" },
    fallback: { kind: "poster", dossierId: "artbreeze", reason: "The frame hold is itself a poster." }
  },
  {
    id: "aescape-scrub",
    workId: "aescape",
    availability: "available",
    sourceId: "aescape",
    sourceSegments: [
      {
        startPTS: 0,
        endPTSExclusive: 1_482_000,
        firstFrameMd5: "4ff8dc1ca329ee1f796830a574a8d795",
        lastIncludedFrameMd5: "a5b9a6e75b3e06b466f0e5139fcb8b67"
      }
    ],
    mode: "scrub",
    reviewLabel: "0.000000–16.466667s — landscape/window transformations",
    poster: { kind: "source-frame", sourcePTS: 0, maxBytes: 150_000 },
    variants: variants(6_000_000, 3_000_000, 15),
    audio: { policy: "muted" },
    fallback: { kind: "poster", dossierId: "aescape", reason: "Cloud-sea opening frame." }
  },
  {
    id: "aescape-showcase",
    workId: "aescape",
    availability: "available",
    sourceId: "aescape",
    sourceSegments: [
      {
        startPTS: 1_482_000,
        endPTSExclusive: 2_232_000,
        firstFrameMd5: "3da5e6676d268ec10be1bc5185e99674",
        lastIncludedFrameMd5: "8263cd45260578a0bcb1da6b994c673e"
      }
    ],
    mode: "autoplay",
    reviewLabel: "16.466667–24.800000s — real new-tab UI and brand close",
    poster: { kind: "source-frame", sourcePTS: 1_482_000, maxBytes: 150_000 },
    variants: variants(4_000_000, 2_000_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: { kind: "poster", dossierId: "aescape", reason: "Real new-tab UI frame." }
  },
  {
    id: "focuence-showcase",
    workId: "focuence",
    availability: "available",
    sourceId: "focuence",
    sourceSegments: [
      {
        startPTS: 0,
        endPTSExclusive: 1_548_000,
        firstFrameMd5: "fa591e1633f7d7a0a22504669b77f3ec",
        lastIncludedFrameMd5: "83f80367add9d87dff60d721d929e449"
      }
    ],
    mode: "autoplay",
    reviewLabel: "0.000000–17.200000s — horse, tabs, title",
    poster: { kind: "source-frame", sourcePTS: 0, maxBytes: 150_000 },
    variants: variants(8_000_000, 4_000_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: { kind: "poster", dossierId: "focuence", reason: "Night horse opening frame." }
  },
  {
    id: "sonoscope-showcase",
    workId: "sonoscope",
    availability: "available",
    sourceId: "sonoscope",
    sourceSegments: [
      {
        startPTS: 0,
        endPTSExclusive: 6_900,
        firstFrameMd5: "e72e4e9051c04bb4dc242e563d0d3d3a",
        lastIncludedFrameMd5: "21fbaafbc2ac98363941121c886ce772"
      }
    ],
    mode: "autoplay",
    reviewLabel: "0.000000–11.500000s — full SonoScope clip",
    poster: { kind: "source-frame", sourcePTS: 0, maxBytes: 140_000 },
    variants: variants(5_000_000, 2_500_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: { kind: "poster", dossierId: "sonoscope", reason: "SonoScope opening frame." }
  },
  {
    id: "sadine-loop",
    workId: "sadine",
    availability: "available",
    sourceId: "sadine",
    sourceSegments: [
      {
        startPTS: 368_640,
        endPTSExclusive: 552_960,
        firstFrameMd5: "4114b6cc778a88d955af24a83bf5f94f",
        lastIncludedFrameMd5: "2cb2e1c3321c8868b721651505e369e8"
      }
    ],
    mode: "loop",
    reviewLabel: "24.000000–36.000000s — stable central light and dense fish ring",
    poster: { kind: "source-frame", sourcePTS: 368_640, maxBytes: 140_000 },
    variants: variants(6_000_000, 3_000_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: { kind: "poster", dossierId: "sadine", reason: "Central-light fish frame." }
  },
  {
    id: "cosmic-threshold",
    workId: "cosmic-threshold",
    availability: "available",
    sourceId: "cosmic",
    sourceSegments: [
      {
        startPTS: 6_057_000,
        endPTSExclusive: 6_681_000,
        firstFrameMd5: "0667450186ab5a3b5ce6ad87e9604b13",
        lastIncludedFrameMd5: "883976454a19b26a4cc1aee70e28cfe9"
      }
    ],
    mode: "autoplay",
    reviewLabel: "67.300000–74.233333s — snow, broken face, eye; stop before pool",
    poster: { kind: "source-frame", sourcePTS: 6_678_000, maxBytes: 150_000 },
    variants: variants(5_000_000, 2_500_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: { kind: "poster", dossierId: "cosmic-threshold", reason: "Last included blue-eye frame." },
    excludedSourceSentinel: {
      sourceFrame: 2_229,
      pts: 6_687_000,
      frameMd5: "1c5a1273fd86147413419ff2757d6aed",
      content: "first-pool-frame"
    }
  },
  {
    id: "dulwich-film",
    workId: "dulwich",
    availability: "available",
    sourceId: "dulwich",
    sourceSegments: [
      {
        startPTS: 0,
        endPTSExclusive: 257_536,
        firstFrameMd5: "3d30ffbff1bf8d66cf7b5e148bd0f032",
        lastIncludedFrameMd5: "a485c10eb970552246a62f75eeaaea39"
      }
    ],
    mode: "autoplay",
    reviewLabel: "0.000000–16.766667s — complete 2026 homepage film",
    poster: { kind: "source-frame", sourcePTS: 0, maxBytes: 140_000 },
    variants: variants(12_000_000, 5_000_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: {
      kind: "poster",
      dossierId: "dulwich",
      reason: "Opening frame from the verified final film."
    }
  },
  {
    id: "li-delivery",
    workId: "li",
    availability: "pending",
    sourceId: "li",
    sourceSegments: [],
    mode: "autoplay",
    reviewLabel: "Pending final identity-site recording",
    poster: { kind: "dossier", sourcePTS: null, maxBytes: 140_000 },
    variants: variants(6_000_000, 3_000_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: {
      kind: "dossier",
      dossierId: "li",
      reason: "Final real recording has not entered the media directory."
    }
  },
  {
    id: "ugcflow-delivery",
    workId: "ugcflow",
    availability: "pending",
    sourceId: "ugcflow",
    sourceSegments: [],
    mode: "autoplay",
    reviewLabel: "Pending final UGCFlow system recording",
    poster: { kind: "dossier", sourcePTS: null, maxBytes: 140_000 },
    variants: variants(8_000_000, 4_000_000, 120),
    audio: { policy: "source-on-unlock" },
    fallback: {
      kind: "dossier",
      dossierId: "ugcflow",
      reason: "Final real recording has not entered the media directory."
    }
  }
];

export const POST_COSCROLL_MEDIA_SOURCE_SPEC = {
  kind: "miralith-post-coscroll-media-source",
  version: POST_COSCROLL_MEDIA_SOURCE_SPEC_VERSION,
  editorialFreeze: {
    version: "cp0.4-b-ring-first-v9-2026-07-25",
    sha256: "d906937cc0b885b12fc942f91ce50e9af919878142cead5c0b36d8bd648140a1",
    selectedLinearSha256:
      "803219d86089d0141db1694c760897b300555dfb9e4991adfe7bb9753e4b135e"
  },
  constraints: {
    productionCatalogMaxBytes: 160_000_000,
    assetKeyPrefix: "post-coscroll/",
    sourcePathsAreLabelsOnly: true,
    clipIntervalsAreHalfOpenPTS: true
  },
  sources,
  clips
} as const;

// SHA-256 of JSON.stringify(POST_COSCROLL_MEDIA_SOURCE_SPEC). The preparation
// and resolver scripts recompute this value before trusting any generated file.
export const POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256 =
  "0abfd288738e0197ccea9ec6808d3a23064e177c7a4d72e287cc4a3599b0ebbd" as const;
