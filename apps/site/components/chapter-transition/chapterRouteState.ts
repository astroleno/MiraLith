import {
  CHAPTER_RETURN_SNAPSHOT_VERSION,
  MAX_CHAPTER_RETURN_REVISION,
  type ChapterActiveMediaState,
  type ChapterLegacyRouteState,
  type ChapterReturnRevisionPlan,
  type ChapterReturnSnapshot,
  type ChapterRouteStateManifest,
  type ChapterSemanticRouteState
} from "./chapterRouteStateTypes";

type DataRecord = Record<string, unknown>;
type SnapshotContext = {
  pathname: string;
  buildScope: string;
  manifest?: ChapterRouteStateManifest;
};

const BUILD_SCOPE_PATTERN = /^[0-9a-f]{64}$/;
const LEGACY_PATHNAMES = new Set(["/", "/radio-gaga", "/coscroll"]);
const SNAPSHOT_KEYS = [
  "schema",
  "buildScope",
  "pathname",
  "revision",
  "scrollY",
  "routeProgress",
  "terminalState",
  "semantic",
  "timestamp"
] as const;
const LEGACY_SNAPSHOT_KEYS = [
  "pathname",
  "scrollY",
  "routeProgress",
  "terminalState",
  "timestamp"
] as const;
const SEMANTIC_KEYS = [
  "kind",
  "semanticStop",
  "segmentId",
  "segmentProgress",
  "narrativeProgress",
  "completedMediaIds",
  "skippedMediaIds",
  "activeMedia",
  "gateReleased",
  "mutePreference",
  "routeState"
] as const;
const LEGACY_SEMANTIC_KEYS = ["kind", "routeProgress", "terminalState"] as const;
const ACTIVE_MEDIA_KEYS = ["id", "playbackState", "timeSeconds"] as const;

function snapshotDataRecord(value: unknown): DataRecord | null {
  try {
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const result: DataRecord = Object.create(null) as DataRecord;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        return null;
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor
        || descriptor.enumerable !== true
        || !("value" in descriptor)
        || descriptor.get !== undefined
        || descriptor.set !== undefined
      ) {
        return null;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function snapshotArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value)) {
      return null;
    }
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !("value" in lengthDescriptor)) {
      return null;
    }
    const length = lengthDescriptor.value;
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || keys[keys.length - 1] !== "length") {
      return null;
    }
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      if (keys[index] !== key) {
        return null;
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor
        || descriptor.enumerable !== true
        || !("value" in descriptor)
        || descriptor.get !== undefined
        || descriptor.set !== undefined
      ) {
        return null;
      }
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function hasExactKeys(record: DataRecord, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(record);
  return actualKeys.length === keys.length && keys.every((key) => Object.hasOwn(record, key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isValidRevision(value: unknown): value is number {
  return Number.isSafeInteger(value)
    && typeof value === "number"
    && value >= 1
    && value < MAX_CHAPTER_RETURN_REVISION;
}

function stringSet(values: readonly unknown[]): Set<string> | null {
  const result = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || result.has(value)) {
      return null;
    }
    result.add(value);
  }
  return result;
}

function readManifest(manifest: ChapterRouteStateManifest, pathname: string) {
  try {
    if (manifest.pathname !== pathname) {
      return null;
    }
    const stopIds = stringSet(manifest.stopIds);
    const segmentIds = stringSet(manifest.segmentIds);
    const mediaIds = stringSet(manifest.mediaIds);
    const routeState = snapshotDataRecord(manifest.routeState);
    if (!stopIds || !segmentIds || !mediaIds || !routeState) {
      return null;
    }
    const tails = manifest.mediaTailSeconds === undefined
      ? Object.create(null) as Record<string, number>
      : snapshotDataRecord(manifest.mediaTailSeconds);
    if (!tails) {
      return null;
    }
    for (const [id, tail] of Object.entries(tails)) {
      if (!mediaIds.has(id) || !isFiniteNumber(tail) || tail < 0) {
        return null;
      }
    }
    return { stopIds, segmentIds, mediaIds, routeState, tails };
  } catch {
    return null;
  }
}

function parseStringIdArray(value: unknown, allowed: Set<string>): readonly string[] | null {
  const values = snapshotArray(value);
  if (!values) {
    return null;
  }
  const parsed: string[] = [];
  const unique = new Set<string>();
  for (const entry of values) {
    if (typeof entry !== "string" || !allowed.has(entry) || unique.has(entry)) {
      return null;
    }
    unique.add(entry);
    parsed.push(entry);
  }
  return parsed;
}

function parseRouteState(
  value: unknown,
  descriptors: DataRecord
): Readonly<Record<string, string | number | boolean | null>> | null {
  const record = snapshotDataRecord(value);
  if (!record || !hasExactKeys(record, Object.keys(descriptors))) {
    return null;
  }
  const result = Object.create(null) as Record<string, string | number | boolean | null>;
  for (const [key, rawDescriptor] of Object.entries(descriptors)) {
    const descriptor = snapshotDataRecord(rawDescriptor);
    const fieldValue = record[key];
    if (!descriptor || typeof descriptor.kind !== "string") {
      return null;
    }
    if (descriptor.kind === "boolean") {
      if (!hasExactKeys(descriptor, ["kind"]) || typeof fieldValue !== "boolean") {
        return null;
      }
    } else if (descriptor.kind === "number") {
      if (
        !hasExactKeys(descriptor, ["kind", "min", "max"])
        || !isFiniteNumber(descriptor.min)
        || !isFiniteNumber(descriptor.max)
        || descriptor.min > descriptor.max
        || !isFiniteNumber(fieldValue)
        || fieldValue < descriptor.min
        || fieldValue > descriptor.max
      ) {
        return null;
      }
    } else if (descriptor.kind === "enum") {
      const enumValues = snapshotArray(descriptor.values);
      const allowedValues = enumValues ? stringSet(enumValues) : null;
      if (
        !hasExactKeys(descriptor, ["kind", "values"])
        || !allowedValues
        || typeof fieldValue !== "string"
        || !allowedValues.has(fieldValue)
      ) {
        return null;
      }
    } else {
      return null;
    }
    result[key] = fieldValue as string | number | boolean | null;
  }
  return Object.freeze(result);
}

function parseActiveMedia(
  value: unknown,
  mediaIds: Set<string>,
  tails: DataRecord
): ChapterActiveMediaState | null | undefined {
  if (value === null) {
    return null;
  }
  const record = snapshotDataRecord(value);
  if (!record || !hasExactKeys(record, ACTIVE_MEDIA_KEYS)) {
    return undefined;
  }
  if (
    typeof record.id !== "string"
    || !mediaIds.has(record.id)
    || (record.playbackState !== "ready"
      && record.playbackState !== "playing"
      && record.playbackState !== "paused-ready")
    || !isFiniteNumber(record.timeSeconds)
  ) {
    return undefined;
  }
  const tail = tails[record.id];
  const clampedTime = typeof tail === "number"
    ? Math.min(Math.max(record.timeSeconds, 0), tail)
    : Math.max(record.timeSeconds, 0);
  return {
    id: record.id,
    playbackState: record.playbackState === "playing" ? "paused-ready" : record.playbackState,
    timeSeconds: clampedTime
  };
}

function parseSemanticState(
  record: DataRecord,
  manifest: ChapterRouteStateManifest,
  pathname: string
): ChapterSemanticRouteState | null {
  const parsedManifest = readManifest(manifest, pathname);
  if (!hasExactKeys(record, SEMANTIC_KEYS) || !parsedManifest) {
    return null;
  }
  if (
    record.kind !== "semantic"
    || typeof record.semanticStop !== "string"
    || !parsedManifest.stopIds.has(record.semanticStop)
    || typeof record.segmentId !== "string"
    || !parsedManifest.segmentIds.has(record.segmentId)
    || !isFiniteNumber(record.segmentProgress)
    || record.segmentProgress < 0
    || record.segmentProgress > 1
    || !isFiniteNumber(record.narrativeProgress)
    || record.narrativeProgress < 0
    || record.narrativeProgress > 1
    || typeof record.gateReleased !== "boolean"
    || typeof record.mutePreference !== "boolean"
  ) {
    return null;
  }
  const completedMediaIds = parseStringIdArray(record.completedMediaIds, parsedManifest.mediaIds);
  const skippedMediaIds = parseStringIdArray(record.skippedMediaIds, parsedManifest.mediaIds);
  const activeMedia = parseActiveMedia(record.activeMedia, parsedManifest.mediaIds, parsedManifest.tails);
  const routeState = parseRouteState(record.routeState, parsedManifest.routeState);
  if (!completedMediaIds || !skippedMediaIds || activeMedia === undefined || !routeState) {
    return null;
  }
  const completed = new Set(completedMediaIds);
  if (
    skippedMediaIds.some((id) => completed.has(id))
    || (activeMedia !== null
      && (completed.has(activeMedia.id) || skippedMediaIds.includes(activeMedia.id)))
  ) {
    return null;
  }
  return {
    kind: "semantic",
    semanticStop: record.semanticStop,
    segmentId: record.segmentId,
    segmentProgress: record.segmentProgress,
    narrativeProgress: record.narrativeProgress,
    completedMediaIds,
    skippedMediaIds,
    activeMedia,
    gateReleased: record.gateReleased,
    mutePreference: record.mutePreference,
    routeState
  };
}

function parseLegacySemantic(
  record: DataRecord,
  routeProgress: number | null,
  terminalState: boolean
): ChapterLegacyRouteState | null {
  if (
    !hasExactKeys(record, LEGACY_SEMANTIC_KEYS)
    || record.kind !== "legacy-progress"
    || !isNullableFiniteNumber(record.routeProgress)
    || typeof record.terminalState !== "boolean"
    || !Object.is(record.routeProgress, routeProgress)
    || record.terminalState !== terminalState
  ) {
    return null;
  }
  return {
    kind: "legacy-progress",
    routeProgress: record.routeProgress,
    terminalState: record.terminalState
  };
}

function parseLegacySnapshot(
  record: DataRecord,
  context: SnapshotContext
): ChapterReturnSnapshot | null {
  if (
    !hasExactKeys(record, LEGACY_SNAPSHOT_KEYS)
    || !LEGACY_PATHNAMES.has(context.pathname)
    || record.pathname !== context.pathname
    || !isFiniteNumber(record.scrollY)
    || record.scrollY < 0
    || !isNullableFiniteNumber(record.routeProgress)
    || typeof record.terminalState !== "boolean"
    || !isFiniteNumber(record.timestamp)
  ) {
    return null;
  }
  return {
    schema: CHAPTER_RETURN_SNAPSHOT_VERSION,
    buildScope: context.buildScope,
    pathname: context.pathname,
    revision: 1,
    scrollY: record.scrollY,
    routeProgress: record.routeProgress,
    terminalState: record.terminalState,
    semantic: {
      kind: "legacy-progress",
      routeProgress: record.routeProgress,
      terminalState: record.terminalState
    },
    timestamp: record.timestamp
  };
}

export function parseChapterReturnSnapshot(
  value: unknown,
  context: SnapshotContext
): ChapterReturnSnapshot | null {
  try {
    if (!BUILD_SCOPE_PATTERN.test(context.buildScope)) {
      return null;
    }
    const record = snapshotDataRecord(value);
    if (!record) {
      return null;
    }
    if (!Object.hasOwn(record, "schema")) {
      return parseLegacySnapshot(record, context);
    }
    if (
      !hasExactKeys(record, SNAPSHOT_KEYS)
      || record.schema !== CHAPTER_RETURN_SNAPSHOT_VERSION
      || record.buildScope !== context.buildScope
      || record.pathname !== context.pathname
      || !isValidRevision(record.revision)
      || !isFiniteNumber(record.scrollY)
      || record.scrollY < 0
      || !isNullableFiniteNumber(record.routeProgress)
      || typeof record.terminalState !== "boolean"
      || !isFiniteNumber(record.timestamp)
    ) {
      return null;
    }
    const semanticRecord = snapshotDataRecord(record.semantic);
    if (!semanticRecord || typeof semanticRecord.kind !== "string") {
      return null;
    }
    let semantic: ChapterSemanticRouteState | ChapterLegacyRouteState | null;
    if (semanticRecord.kind === "semantic") {
      if (!context.manifest || record.routeProgress !== null || record.terminalState !== false) {
        return null;
      }
      semantic = parseSemanticState(semanticRecord, context.manifest, context.pathname);
    } else if (semanticRecord.kind === "legacy-progress" && LEGACY_PATHNAMES.has(context.pathname)) {
      semantic = parseLegacySemantic(semanticRecord, record.routeProgress, record.terminalState);
    } else {
      return null;
    }
    if (!semantic) {
      return null;
    }
    return {
      schema: CHAPTER_RETURN_SNAPSHOT_VERSION,
      buildScope: record.buildScope,
      pathname: record.pathname,
      revision: record.revision,
      scrollY: record.scrollY,
      routeProgress: record.routeProgress,
      terminalState: record.terminalState,
      semantic,
      timestamp: record.timestamp
    };
  } catch {
    return null;
  }
}

export function readChapterReturnSnapshot(
  storage: Pick<Storage, "getItem">,
  key: string,
  context: SnapshotContext
): ChapterReturnSnapshot | null {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : parseChapterReturnSnapshot(JSON.parse(raw), context);
  } catch {
    return null;
  }
}

export function writeChapterReturnSnapshot(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  key: string,
  snapshot: ChapterReturnSnapshot,
  context: SnapshotContext,
  revisionPlan: ChapterReturnRevisionPlan
): "written" | "stale" | "unavailable" {
  const parsed = parseChapterReturnSnapshot(snapshot, context);
  if (
    !parsed
    || !isValidRevision(revisionPlan.revision)
    || typeof revisionPlan.resetStorage !== "boolean"
    || parsed.revision !== revisionPlan.revision
    || (revisionPlan.resetStorage && revisionPlan.revision !== 1)
  ) {
    return "unavailable";
  }
  try {
    if (revisionPlan.resetStorage) {
      storage.removeItem(key);
    } else {
      const rawStored = storage.getItem(key);
      if (rawStored !== null) {
        let stored: ChapterReturnSnapshot | null = null;
        try {
          stored = parseChapterReturnSnapshot(JSON.parse(rawStored), context);
        } catch {
          stored = null;
        }
        if (stored && stored.revision >= parsed.revision) {
          return "stale";
        }
      }
    }
    storage.setItem(key, JSON.stringify(parsed));
    return "written";
  } catch {
    return "unavailable";
  }
}

export function nextRevisionFromValidatedSnapshot(
  snapshot: ChapterReturnSnapshot | null
): ChapterReturnRevisionPlan {
  if (!snapshot || !isValidRevision(snapshot.revision)) {
    return { revision: 1, resetStorage: false };
  }
  if (snapshot.revision + 1 >= MAX_CHAPTER_RETURN_REVISION) {
    return { revision: 1, resetStorage: true };
  }
  return { revision: snapshot.revision + 1, resetStorage: false };
}
