import { expect, test } from "@playwright/test";
import {
  nextRevisionFromValidatedSnapshot,
  parseChapterReturnSnapshot,
  readChapterReturnSnapshot,
  writeChapterReturnSnapshot
} from "../../apps/site/components/chapter-transition/chapterRouteState";
import {
  CHAPTER_RETURN_SNAPSHOT_VERSION,
  MAX_CHAPTER_RETURN_REVISION,
  type ChapterReturnSnapshot,
  type ChapterRouteStateManifest
} from "../../apps/site/components/chapter-transition/chapterRouteStateTypes";

const buildScope = "a".repeat(64);

const manifest = {
  pathname: "/artbreeze",
  stopIds: ["entry", "await-send", "answer-tail"],
  segmentIds: ["opening", "prompt", "answer"],
  mediaIds: [
    "artbreeze-first-sequence",
    "artbreeze-cycle",
    "artbreeze-prompt",
    "artbreeze-answer"
  ],
  routeState: {
    answerSubmitted: { kind: "boolean" },
    answerMode: { kind: "enum", values: ["waiting", "answered"] },
    answerWeight: { kind: "number", min: 0, max: 10 }
  },
  mediaTailSeconds: {
    "artbreeze-prompt": 18.53
  }
} as const satisfies ChapterRouteStateManifest;

const context = {
  pathname: "/artbreeze",
  buildScope,
  manifest
} as const;

function semanticSnapshot(
  overrides: Partial<ChapterReturnSnapshot> = {}
): ChapterReturnSnapshot {
  return {
    schema: CHAPTER_RETURN_SNAPSHOT_VERSION,
    buildScope,
    pathname: "/artbreeze",
    revision: 20,
    scrollY: 720,
    routeProgress: null,
    terminalState: false,
    semantic: {
      kind: "semantic",
      semanticStop: "await-send",
      segmentId: "prompt",
      segmentProgress: 0.6,
      narrativeProgress: 0.4,
      completedMediaIds: ["artbreeze-first-sequence", "artbreeze-cycle"],
      skippedMediaIds: ["artbreeze-answer"],
      activeMedia: {
        id: "artbreeze-prompt",
        playbackState: "playing",
        timeSeconds: 24
      },
      gateReleased: true,
      mutePreference: true,
      routeState: {
        answerSubmitted: false,
        answerMode: "waiting",
        answerWeight: 4
      }
    },
    timestamp: 1_754_678_900_000,
    ...overrides
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    value(key: string) {
      return values.get(key) ?? null;
    }
  };
}

test("parses a complete semantic snapshot without collapsing independent media outcomes", () => {
  const parsed = parseChapterReturnSnapshot(semanticSnapshot(), context);

  expect(parsed).not.toBeNull();
  expect(parsed?.semantic).toMatchObject({
    completedMediaIds: ["artbreeze-first-sequence", "artbreeze-cycle"],
    skippedMediaIds: ["artbreeze-answer"],
    activeMedia: {
      id: "artbreeze-prompt",
      playbackState: "paused-ready",
      timeSeconds: 18.53
    },
    gateReleased: true,
    routeState: {
      answerSubmitted: false,
      answerMode: "waiting",
      answerWeight: 4
    }
  });
});

test("rejects schema, build, pathname, manifest identity, and unknown-key drift", () => {
  const candidates = [
    { ...semanticSnapshot(), schema: "chapter-return-v1" },
    { ...semanticSnapshot(), buildScope: "b".repeat(64) },
    { ...semanticSnapshot(), pathname: "/constellation" },
    { ...semanticSnapshot(), mediaUrl: "https://example.invalid/video.mp4" },
    {
      ...semanticSnapshot(),
      semantic: { ...semanticSnapshot().semantic, semanticStop: "unknown-stop" }
    },
    {
      ...semanticSnapshot(),
      semantic: { ...semanticSnapshot().semantic, segmentId: "unknown-segment" }
    },
    {
      ...semanticSnapshot(),
      semantic: {
        ...semanticSnapshot().semantic,
        routeState: { answerSubmitted: false, answerMode: "waiting", answerWeight: 4, href: "/x" }
      }
    },
    {
      ...semanticSnapshot(),
      semantic: {
        ...semanticSnapshot().semantic,
        routeState: { answerSubmitted: false, answerMode: "arbitrary", answerWeight: 4 }
      }
    },
    {
      ...semanticSnapshot(),
      semantic: {
        ...semanticSnapshot().semantic,
        routeState: { answerSubmitted: false, answerMode: "waiting", answerWeight: 11 }
      }
    }
  ];

  for (const candidate of candidates) {
    expect(parseChapterReturnSnapshot(candidate, context)).toBeNull();
  }
  expect(parseChapterReturnSnapshot(semanticSnapshot(), {
    ...context,
    manifest: { ...manifest, pathname: "/constellation" }
  })).toBeNull();
});

test("requires finite normalized progress and a bounded revision", () => {
  for (const value of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    const snapshot = semanticSnapshot();
    if (snapshot.semantic.kind !== "semantic") {
      throw new Error("semantic fixture drifted");
    }
    expect(parseChapterReturnSnapshot({
      ...snapshot,
      semantic: { ...snapshot.semantic, segmentProgress: value }
    }, context)).toBeNull();
    expect(parseChapterReturnSnapshot({
      ...snapshot,
      semantic: { ...snapshot.semantic, narrativeProgress: value }
    }, context)).toBeNull();
  }

  for (const revision of [0, -1, 1.5, MAX_CHAPTER_RETURN_REVISION, Number.MAX_SAFE_INTEGER]) {
    expect(parseChapterReturnSnapshot(semanticSnapshot({ revision }), context)).toBeNull();
  }
});

test("enforces unique disjoint outcomes and keeps active media independent", () => {
  const base = semanticSnapshot();
  if (base.semantic.kind !== "semantic") {
    throw new Error("semantic fixture drifted");
  }
  const invalidSemantics = [
    { ...base.semantic, completedMediaIds: ["artbreeze-cycle", "artbreeze-cycle"] },
    { ...base.semantic, skippedMediaIds: ["artbreeze-answer", "artbreeze-answer"] },
    { ...base.semantic, skippedMediaIds: ["artbreeze-cycle"] },
    { ...base.semantic, completedMediaIds: ["unknown-media"] },
    { ...base.semantic, completedMediaIds: ["artbreeze-prompt"] },
    { ...base.semantic, activeMedia: { ...base.semantic.activeMedia!, id: "unknown-media" } }
  ];

  for (const semantic of invalidSemantics) {
    expect(parseChapterReturnSnapshot({ ...base, semantic }, context)).toBeNull();
  }
});

test("accepts a released replay only after clearing the replayed media outcome", () => {
  const replay = semanticSnapshot();
  if (replay.semantic.kind !== "semantic") {
    throw new Error("semantic fixture drifted");
  }
  const parsed = parseChapterReturnSnapshot(replay, context);
  expect(parsed?.semantic).toMatchObject({
    gateReleased: true,
    activeMedia: { id: "artbreeze-prompt", playbackState: "paused-ready" }
  });

  expect(parseChapterReturnSnapshot({
    ...replay,
    semantic: {
      ...replay.semantic,
      completedMediaIds: [...replay.semantic.completedMediaIds, "artbreeze-prompt"]
    }
  }, context)).toBeNull();
  expect(parseChapterReturnSnapshot({
    ...replay,
    semantic: {
      ...replay.semantic,
      skippedMediaIds: [...replay.semantic.skippedMediaIds, "artbreeze-prompt"]
    }
  }, context)).toBeNull();
});

test("clamps finite active time while leaving completed and skipped outcomes unchanged", () => {
  const base = semanticSnapshot();
  if (base.semantic.kind !== "semantic" || !base.semantic.activeMedia) {
    throw new Error("active semantic fixture drifted");
  }
  const belowZero = parseChapterReturnSnapshot({
    ...base,
    semantic: {
      ...base.semantic,
      activeMedia: { ...base.semantic.activeMedia, timeSeconds: -3 }
    }
  }, context);

  expect(belowZero?.semantic).toMatchObject({
    completedMediaIds: base.semantic.completedMediaIds,
    skippedMediaIds: base.semantic.skippedMediaIds,
    activeMedia: { timeSeconds: 0 }
  });
  expect(parseChapterReturnSnapshot({
    ...base,
    semantic: {
      ...base.semantic,
      activeMedia: { ...base.semantic.activeMedia, timeSeconds: Number.NaN }
    }
  }, context)).toBeNull();
});

test("continues normal revisions and resets before the exclusive saturation limit", () => {
  expect(nextRevisionFromValidatedSnapshot(null)).toEqual({ revision: 1, resetStorage: false });
  expect(nextRevisionFromValidatedSnapshot(semanticSnapshot())).toEqual({
    revision: 21,
    resetStorage: false
  });
  expect(nextRevisionFromValidatedSnapshot(semanticSnapshot({
    revision: MAX_CHAPTER_RETURN_REVISION - 1
  }))).toEqual({ revision: 1, resetStorage: true });
});

test("prevents stale writes but replaces malformed over-limit storage with revision one", () => {
  const key = "chapter-return:/artbreeze";
  const newer = semanticSnapshot({ revision: 21 });
  const storage = memoryStorage({ [key]: JSON.stringify(newer) });

  expect(writeChapterReturnSnapshot(
    storage,
    key,
    semanticSnapshot(),
    context,
    { revision: 20, resetStorage: false }
  )).toBe("stale");
  expect(JSON.parse(storage.value(key)).revision).toBe(21);

  storage.setItem(key, JSON.stringify({ ...newer, revision: MAX_CHAPTER_RETURN_REVISION }));
  const revisionOne = semanticSnapshot({ revision: 1 });
  expect(writeChapterReturnSnapshot(
    storage,
    key,
    revisionOne,
    context,
    { revision: 1, resetStorage: false }
  )).toBe("written");
  expect(readChapterReturnSnapshot(storage, key, context)?.revision).toBe(1);
});

test("uses guarded get, set, and saturation removal boundaries", () => {
  const key = "chapter-return:/artbreeze";
  const revisionOne = semanticSnapshot({ revision: 1 });
  const throwingGet = {
    getItem() {
      throw new Error("get unavailable");
    }
  };
  expect(readChapterReturnSnapshot(throwingGet, key, context)).toBeNull();
  expect(writeChapterReturnSnapshot({
    ...throwingGet,
    setItem() {},
    removeItem() {}
  }, key, revisionOne, context, { revision: 1, resetStorage: false })).toBe("unavailable");

  expect(writeChapterReturnSnapshot({
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("set unavailable");
    },
    removeItem() {}
  }, key, revisionOne, context, { revision: 1, resetStorage: false })).toBe("unavailable");

  let setCalls = 0;
  expect(writeChapterReturnSnapshot({
    getItem() {
      return JSON.stringify(semanticSnapshot({ revision: MAX_CHAPTER_RETURN_REVISION - 1 }));
    },
    setItem() {
      setCalls += 1;
    },
    removeItem() {
      throw new Error("remove unavailable");
    }
  }, key, revisionOne, context, { revision: 1, resetStorage: true })).toBe("unavailable");
  expect(setCalls).toBe(0);

  const order: string[] = [];
  expect(writeChapterReturnSnapshot({
    getItem() {
      return null;
    },
    setItem() {
      order.push("set");
    },
    removeItem() {
      order.push("remove");
    }
  }, key, revisionOne, context, { revision: 1, resetStorage: true })).toBe("written");
  expect(order).toEqual(["remove", "set"]);
});

test("normalizes restricted legacy snapshots and rejects them on post-CoScroll routes", () => {
  const legacy = {
    pathname: "/coscroll",
    scrollY: 840,
    routeProgress: 0.72,
    terminalState: true,
    timestamp: 1_754_678_900_000
  };
  const legacyContext = { pathname: "/coscroll", buildScope };

  expect(parseChapterReturnSnapshot(legacy, legacyContext)).toEqual({
    schema: CHAPTER_RETURN_SNAPSHOT_VERSION,
    buildScope,
    pathname: "/coscroll",
    revision: 1,
    scrollY: 840,
    routeProgress: 0.72,
    terminalState: true,
    semantic: {
      kind: "legacy-progress",
      routeProgress: 0.72,
      terminalState: true
    },
    timestamp: 1_754_678_900_000
  });
  expect(parseChapterReturnSnapshot({ ...legacy, pathname: "/artbreeze" }, {
    pathname: "/artbreeze",
    buildScope
  })).toBeNull();
  expect(parseChapterReturnSnapshot({ ...legacy, href: "/injected" }, legacyContext)).toBeNull();
});

test("accepts versioned legacy state only for 01 to 03 and requires a valid build scope", () => {
  const legacyV2: ChapterReturnSnapshot = {
    ...semanticSnapshot({ pathname: "/radio-gaga", routeProgress: 0.5, terminalState: true }),
    semantic: { kind: "legacy-progress", routeProgress: 0.5, terminalState: true }
  };

  expect(parseChapterReturnSnapshot(legacyV2, {
    pathname: "/radio-gaga",
    buildScope
  })).toEqual(legacyV2);
  expect(parseChapterReturnSnapshot(semanticSnapshot(), {
    pathname: "/artbreeze",
    buildScope
  })).toBeNull();
  expect(parseChapterReturnSnapshot(semanticSnapshot(), {
    ...context,
    buildScope: "dirty"
  })).toBeNull();
});

test("fails closed for accessors, active proxies, symbols, and non-enumerable keys", () => {
  const accessor = semanticSnapshot() as unknown as Record<string, unknown>;
  Object.defineProperty(accessor, "revision", {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error("hostile revision getter");
    }
  });
  const symbolExtended = { ...semanticSnapshot(), [Symbol("href")]: "/injected" };
  const nonEnumerable = { ...semanticSnapshot() } as Record<string, unknown>;
  Object.defineProperty(nonEnumerable, "href", {
    enumerable: false,
    value: "/injected"
  });
  let getTrapCalls = 0;
  const activeProxy = new Proxy(semanticSnapshot(), {
    get(target, property, receiver) {
      getTrapCalls += 1;
      return Reflect.get(target, property, receiver);
    }
  });

  expect(parseChapterReturnSnapshot(accessor, context)).toBeNull();
  expect(parseChapterReturnSnapshot(symbolExtended, context)).toBeNull();
  expect(parseChapterReturnSnapshot(nonEnumerable, context)).toBeNull();
  expect(parseChapterReturnSnapshot(activeProxy, context)).not.toBeNull();
  expect(getTrapCalls).toBe(0);
});

test("snapshots a nested semantic proxy exactly once before validation", () => {
  const snapshot = semanticSnapshot();
  const semantic = snapshot.semantic;
  let segmentProgressDescriptorReads = 0;
  const semanticProxy = new Proxy(semantic, {
    getOwnPropertyDescriptor(target, property) {
      if (property === "segmentProgress") {
        segmentProgressDescriptorReads += 1;
      }
      return Reflect.getOwnPropertyDescriptor(target, property);
    }
  });

  expect(parseChapterReturnSnapshot({ ...snapshot, semantic: semanticProxy }, context)).not.toBeNull();
  expect(segmentProgressDescriptorReads).toBe(1);
});

test("writes only the sanitized snapshot without reading the source proxy again", () => {
  const key = "chapter-return:/artbreeze";
  const storage = memoryStorage();
  let getTrapCalls = 0;
  const source = new Proxy(semanticSnapshot({ revision: 1 }), {
    get(target, property, receiver) {
      getTrapCalls += 1;
      if (property === "revision") {
        throw new Error("source proxy was read after validation");
      }
      return Reflect.get(target, property, receiver);
    }
  });

  expect(() => writeChapterReturnSnapshot(
    storage,
    key,
    source,
    context,
    { revision: 1, resetStorage: false }
  )).not.toThrow();
  expect(readChapterReturnSnapshot(storage, key, context)?.revision).toBe(1);
  expect(getTrapCalls).toBe(0);
});

test("round-trips an allowlisted prototype-sensitive route-state field", () => {
  const key = "chapter-return:/artbreeze";
  const storage = memoryStorage();
  const prototypeSensitiveManifest = {
    ...manifest,
    routeState: {
      ...manifest.routeState,
      ["__proto__"]: { kind: "enum", values: ["preserved"] }
    }
  } as const satisfies ChapterRouteStateManifest;
  const prototypeSensitiveContext = {
    ...context,
    manifest: prototypeSensitiveManifest
  };
  const source = semanticSnapshot();
  if (source.semantic.kind !== "semantic") {
    throw new Error("semantic fixture drifted");
  }
  const candidate: ChapterReturnSnapshot = {
    ...source,
    semantic: {
      ...source.semantic,
      routeState: {
        ...source.semantic.routeState,
        ["__proto__"]: "preserved"
      }
    }
  };
  const parsed = parseChapterReturnSnapshot(candidate, prototypeSensitiveContext);

  expect(parsed).not.toBeNull();
  if (!parsed || parsed.semantic.kind !== "semantic") {
    throw new Error("prototype-sensitive snapshot did not parse as semantic");
  }
  expect(Object.hasOwn(parsed.semantic.routeState, "__proto__")).toBe(true);
  expect(writeChapterReturnSnapshot(
    storage,
    key,
    candidate,
    prototypeSensitiveContext,
    { revision: 20, resetStorage: false }
  )).toBe("written");
  expect(readChapterReturnSnapshot(storage, key, prototypeSensitiveContext)).toEqual(parsed);
});
