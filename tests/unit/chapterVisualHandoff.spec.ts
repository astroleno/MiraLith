import { expect, test } from "@playwright/test";
import {
  chapterVisualHandoffCssVariables,
  parseChapterVisualHandoff,
  resolveChapterTransitionHandoff
} from "../../apps/site/components/chapter-transition/chapterVisualHandoff";

const liveRing = {
  version: "chapter-visual-handoff-v1",
  kind: "coscroll-ring",
  sourceHref: "/coscroll",
  targetHref: "/artbreeze",
  center: { x: 0.5, y: 0.5 },
  diameter: 0.11875,
  lineWidth: 0.00625,
  exitProgress: 1,
  angleRadians: 2.722713633111154,
  angularVelocityRadiansPerSecond: 6.918,
  direction: "clockwise",
  signalSource: "live"
} as const;

const fallbackRing = {
  version: "chapter-visual-handoff-v1",
  kind: "coscroll-ring",
  sourceHref: "/coscroll",
  targetHref: "/artbreeze",
  center: { x: 0.5, y: 0.5 },
  diameter: 0.11875,
  lineWidth: 0.00625,
  exitProgress: 1,
  gapPhaseRadians: 2.705260340591211,
  direction: "clockwise",
  signalSource: "fallback"
} as const;

const stars = {
  version: "chapter-visual-handoff-v1",
  kind: "focuence-stars",
  sourceHref: "/artbreeze",
  targetHref: "/constellation",
  collapseOrigin: { x: 0.42, y: 0.37 },
  seed: 0x7f4a7c15,
  collapsePhase: 0.75
} as const;

const water = {
  version: "chapter-visual-handoff-v1",
  kind: "cosmic-water",
  sourceHref: "/constellation",
  targetHref: "/client-works",
  highlightOrigin: { x: 0.61, y: 0.44 },
  radius: 0.28,
  ripplePhase: 0.35
} as const;

test("accepts the exact live and fallback CoScroll ring variants only on 03 to 04", () => {
  expect(parseChapterVisualHandoff(liveRing, "/coscroll", "/artbreeze")).toEqual(liveRing);
  expect(parseChapterVisualHandoff(fallbackRing, "/coscroll", "/artbreeze")).toEqual(fallbackRing);
  expect(parseChapterVisualHandoff(liveRing, "/artbreeze", "/constellation")).toBeNull();
  expect(parseChapterVisualHandoff(fallbackRing, "/coscroll", "/constellation")).toBeNull();
});

test("accepts seeded stars and bounded water only on their frozen edges", () => {
  expect(parseChapterVisualHandoff(stars, "/artbreeze", "/constellation")).toEqual(stars);
  expect(parseChapterVisualHandoff(water, "/constellation", "/client-works")).toEqual(water);
  expect(parseChapterVisualHandoff(stars, "/coscroll", "/artbreeze")).toBeNull();
  expect(parseChapterVisualHandoff(water, "/artbreeze", "/constellation")).toBeNull();
});

test("rejects schema drift, unknown keys, URL-like fields, and nested point extensions", () => {
  expect(parseChapterVisualHandoff(
    { ...liveRing, version: "chapter-visual-handoff-v0" },
    "/coscroll",
    "/artbreeze"
  )).toBeNull();
  expect(parseChapterVisualHandoff(
    { ...liveRing, mediaUrl: "https://example.invalid/video.mp4" },
    "/coscroll",
    "/artbreeze"
  )).toBeNull();
  expect(parseChapterVisualHandoff(
    { ...stars, collapseOrigin: { ...stars.collapseOrigin, href: "/injected" } },
    "/artbreeze",
    "/constellation"
  )).toBeNull();
  expect(parseChapterVisualHandoff(
    { ...water, arbitraryTransitionKind: "morph" },
    "/constellation",
    "/client-works"
  )).toBeNull();
});

test("fails closed without throwing for hostile getters and revoked proxies", () => {
  const throwingKind = { ...liveRing } as Record<string, unknown>;
  Object.defineProperty(throwingKind, "kind", {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error("hostile kind getter");
    }
  });

  const throwingCenter = { x: 0.5, y: 0.5 } as Record<string, unknown>;
  Object.defineProperty(throwingCenter, "x", {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error("hostile point getter");
    }
  });

  const revocable = Proxy.revocable({ ...liveRing }, {});
  revocable.revoke();

  for (const candidate of [
    throwingKind,
    { ...liveRing, center: throwingCenter },
    revocable.proxy
  ]) {
    let parsed: ReturnType<typeof parseChapterVisualHandoff> | undefined;
    expect(() => {
      parsed = parseChapterVisualHandoff(candidate, "/coscroll", "/artbreeze");
    }).not.toThrow();
    expect(parsed).toBeNull();
  }
});

test("snapshots active proxy descriptors without invoking their get traps", () => {
  let pointGetTrapCalls = 0;
  const proxiedCenter = new Proxy({ ...liveRing.center }, {
    get(target, property, receiver) {
      pointGetTrapCalls += 1;
      return Reflect.get(target, property, receiver);
    }
  });

  let rootGetTrapCalls = 0;
  let diameterGetTrapCalls = 0;
  const activeProxy = new Proxy({ ...liveRing, center: proxiedCenter }, {
    get(target, property, receiver) {
      rootGetTrapCalls += 1;
      if (property === "diameter") {
        diameterGetTrapCalls += 1;
        return diameterGetTrapCalls <= 4 ? liveRing.diameter : 2;
      }
      return Reflect.get(target, property, receiver);
    }
  });

  expect(parseChapterVisualHandoff(activeProxy, "/coscroll", "/artbreeze")).toEqual(liveRing);
  expect(rootGetTrapCalls).toBe(0);
  expect(pointGetTrapCalls).toBe(0);
});

test("uses only a sanitized handoff as the visual variant and degrades invalid input", () => {
  const untrusted = { ...liveRing, center: { ...liveRing.center } };
  const valid = resolveChapterTransitionHandoff(untrusted, "/coscroll", "/artbreeze");

  expect(valid).toMatchObject({ kind: "coscroll-ring", handoff: liveRing });
  expect(valid.handoff).not.toBe(untrusted);
  expect(resolveChapterTransitionHandoff(
    { ...liveRing, kind: "cosmic-water" },
    "/coscroll",
    "/artbreeze"
  )).toEqual({ kind: "direct", handoff: null });
});

test("rejects symbol and non-enumerable own keys", () => {
  const symbolExtended = {
    ...liveRing,
    [Symbol("mediaUrl")]: "https://example.invalid/video.mp4"
  };
  const nonEnumerableExtended = { ...liveRing } as Record<string, unknown>;
  Object.defineProperty(nonEnumerableExtended, "mediaUrl", {
    configurable: true,
    enumerable: false,
    value: "https://example.invalid/video.mp4"
  });

  expect(parseChapterVisualHandoff(symbolExtended, "/coscroll", "/artbreeze")).toBeNull();
  expect(parseChapterVisualHandoff(
    nonEnumerableExtended,
    "/coscroll",
    "/artbreeze"
  )).toBeNull();
});

test("rejects accessor descriptors even when their getters are benign", () => {
  const accessorPayload = { ...liveRing } as Record<string, unknown>;
  Object.defineProperty(accessorPayload, "angleRadians", {
    configurable: true,
    enumerable: true,
    get: () => liveRing.angleRadians
  });

  expect(parseChapterVisualHandoff(accessorPayload, "/coscroll", "/artbreeze")).toBeNull();
});

test("enforces the ring discriminant and all normalized geometry bounds", () => {
  const invalidRings = [
    { ...liveRing, gapPhaseRadians: fallbackRing.gapPhaseRadians },
    { ...fallbackRing, angleRadians: liveRing.angleRadians },
    { ...fallbackRing, angularVelocityRadiansPerSecond: liveRing.angularVelocityRadiansPerSecond },
    { ...liveRing, center: { x: -0.01, y: 0.5 } },
    { ...liveRing, center: { x: 0.5, y: 1.01 } },
    { ...liveRing, diameter: 0 },
    { ...liveRing, diameter: 1.01 },
    { ...liveRing, lineWidth: 0 },
    { ...liveRing, lineWidth: 0.251 },
    { ...liveRing, diameter: 0.1, lineWidth: 0.051 },
    { ...liveRing, exitProgress: -0.01 },
    { ...liveRing, exitProgress: 1.01 },
    { ...liveRing, angleRadians: Number.NaN },
    { ...liveRing, angularVelocityRadiansPerSecond: Number.POSITIVE_INFINITY },
    { ...fallbackRing, gapPhaseRadians: Number.NEGATIVE_INFINITY },
    { ...liveRing, direction: "counterclockwise" }
  ];

  for (const candidate of invalidRings) {
    expect(parseChapterVisualHandoff(candidate, "/coscroll", "/artbreeze")).toBeNull();
  }
});

test("enforces star seed and water radius and phase bounds", () => {
  const invalidStars = [
    { ...stars, collapseOrigin: { x: 1.01, y: 0.5 } },
    { ...stars, collapsePhase: -0.01 },
    { ...stars, collapsePhase: 1.01 },
    { ...stars, seed: -1 },
    { ...stars, seed: 1.5 },
    { ...stars, seed: 0x1_0000_0000 },
    { ...stars, seed: Number.NaN }
  ];
  const invalidWater = [
    { ...water, highlightOrigin: { x: 0.5, y: -0.01 } },
    { ...water, radius: 0 },
    { ...water, radius: 1.01 },
    { ...water, ripplePhase: -0.01 },
    { ...water, ripplePhase: 1.01 },
    { ...water, ripplePhase: Number.NaN }
  ];

  for (const candidate of invalidStars) {
    expect(parseChapterVisualHandoff(candidate, "/artbreeze", "/constellation")).toBeNull();
  }
  for (const candidate of invalidWater) {
    expect(parseChapterVisualHandoff(candidate, "/constellation", "/client-works")).toBeNull();
  }
});

test("copies and freezes both the payload and its nested normalized point", () => {
  const untrusted = {
    ...liveRing,
    center: { ...liveRing.center }
  };
  const parsed = parseChapterVisualHandoff(untrusted, "/coscroll", "/artbreeze");

  expect(parsed).not.toBe(untrusted);
  expect(parsed?.kind).toBe("coscroll-ring");
  if (!parsed || parsed.kind !== "coscroll-ring") {
    throw new Error("Expected a parsed CoScroll ring payload.");
  }
  expect(parsed.center).not.toBe(untrusted.center);
  expect(Object.isFrozen(parsed)).toBe(true);
  expect(Object.isFrozen(parsed.center)).toBe(true);

  untrusted.center.x = 0.9;
  expect(parsed.center.x).toBe(0.5);

  const untrustedStars = { ...stars, collapseOrigin: { ...stars.collapseOrigin } };
  const parsedStars = parseChapterVisualHandoff(untrustedStars, "/artbreeze", "/constellation");
  expect(parsedStars?.kind).toBe("focuence-stars");
  if (!parsedStars || parsedStars.kind !== "focuence-stars") {
    throw new Error("Expected a parsed Focuence stars payload.");
  }
  expect(parsedStars.collapseOrigin).not.toBe(untrustedStars.collapseOrigin);
  expect(Object.isFrozen(parsedStars.collapseOrigin)).toBe(true);

  const untrustedWater = { ...water, highlightOrigin: { ...water.highlightOrigin } };
  const parsedWater = parseChapterVisualHandoff(untrustedWater, "/constellation", "/client-works");
  expect(parsedWater?.kind).toBe("cosmic-water");
  if (!parsedWater || parsedWater.kind !== "cosmic-water") {
    throw new Error("Expected a parsed cosmic water payload.");
  }
  expect(parsedWater.highlightOrigin).not.toBe(untrustedWater.highlightOrigin);
  expect(Object.isFrozen(parsedWater.highlightOrigin)).toBe(true);
});

test("projects only stable allowlisted CSS variables for each handoff kind", () => {
  const parsedRing = parseChapterVisualHandoff(liveRing, "/coscroll", "/artbreeze");
  const parsedFallbackRing = parseChapterVisualHandoff(fallbackRing, "/coscroll", "/artbreeze");
  const parsedStars = parseChapterVisualHandoff(stars, "/artbreeze", "/constellation");
  const parsedWater = parseChapterVisualHandoff(water, "/constellation", "/client-works");

  expect(parsedRing && chapterVisualHandoffCssVariables(parsedRing)).toEqual({
    "--chapter-handoff-center-x": "50%",
    "--chapter-handoff-center-y": "50%",
    "--chapter-handoff-diameter": "11.875%",
    "--chapter-handoff-line-width": "0.625%",
    "--chapter-handoff-exit-progress": "1",
    "--chapter-handoff-angle": `${liveRing.angleRadians}rad`,
    "--chapter-handoff-angular-velocity": `${liveRing.angularVelocityRadiansPerSecond}rad/s`
  });
  expect(parsedFallbackRing && chapterVisualHandoffCssVariables(parsedFallbackRing)).toEqual({
    "--chapter-handoff-center-x": "50%",
    "--chapter-handoff-center-y": "50%",
    "--chapter-handoff-diameter": "11.875%",
    "--chapter-handoff-line-width": "0.625%",
    "--chapter-handoff-exit-progress": "1",
    "--chapter-handoff-gap-phase": `${fallbackRing.gapPhaseRadians}rad`
  });
  expect(parsedStars && chapterVisualHandoffCssVariables(parsedStars)).toEqual({
    "--chapter-handoff-collapse-origin-x": "42%",
    "--chapter-handoff-collapse-origin-y": "37%",
    "--chapter-handoff-seed": `${stars.seed}`,
    "--chapter-handoff-collapse-phase": `${stars.collapsePhase}`
  });
  expect(parsedWater && chapterVisualHandoffCssVariables(parsedWater)).toEqual({
    "--chapter-handoff-highlight-origin-x": "61%",
    "--chapter-handoff-highlight-origin-y": "44%",
    "--chapter-handoff-radius": "28%",
    "--chapter-handoff-ripple-phase": `${water.ripplePhase}`
  });
});
