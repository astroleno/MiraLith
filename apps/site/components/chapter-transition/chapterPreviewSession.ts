const PREVIEW_SESSION_STORAGE_KEY = "miralith:chapter-preview:v1";
const PREVIEW_HISTORY_KEY = "__miralithChapterPreview";
const PREVIEW_TOKEN = "post-coscroll-v1";

export interface ChapterPreviewSessionState {
  previewActive: boolean;
  scope: string | null;
}

interface StoredChapterPreviewSession {
  v: 1;
  token: typeof PREVIEW_TOKEN;
  scope: string;
}

interface ChapterPreviewHistoryMarker {
  v: 1;
  scope: string;
}

const inactivePreviewSession: ChapterPreviewSessionState = {
  previewActive: false,
  scope: null
};

function isChapterPreviewScope(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function publicPreviewScope() {
  const scope = process.env.NEXT_PUBLIC_MIRALITH_CHAPTER_PREVIEW_SCOPE;
  return isChapterPreviewScope(scope) ? scope : null;
}

function parseStoredPreviewSession(value: string | null): StoredChapterPreviewSession | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<StoredChapterPreviewSession>;
    return (
      parsed.v === 1 &&
      parsed.token === PREVIEW_TOKEN &&
      isChapterPreviewScope(parsed.scope)
    ) ? { v: 1, token: PREVIEW_TOKEN, scope: parsed.scope } : null;
  } catch {
    return null;
  }
}

function parsePreviewHistoryMarker(value: unknown): ChapterPreviewHistoryMarker | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const marker = (value as Record<string, unknown>)[PREVIEW_HISTORY_KEY] as Partial<ChapterPreviewHistoryMarker> | undefined;
  return marker?.v === 1 && isChapterPreviewScope(marker.scope) ? { v: 1, scope: marker.scope } : null;
}

function mergePreviewHistoryMarker(scope: string, url = window.location.href) {
  const currentState = window.history.state;
  const baseState = currentState && typeof currentState === "object" && !Array.isArray(currentState)
    ? currentState as Record<string, unknown>
    : {};
  window.history.replaceState({
    ...baseState,
    [PREVIEW_HISTORY_KEY]: { v: 1, scope }
  }, "", url);
}

function previewSessionForScope(scope: string | null): ChapterPreviewSessionState {
  if (!scope) {
    return inactivePreviewSession;
  }
  const stored = parseStoredPreviewSession(window.sessionStorage.getItem(PREVIEW_SESSION_STORAGE_KEY));
  const marker = parsePreviewHistoryMarker(window.history.state);
  if (stored?.scope !== scope || marker?.scope !== scope) {
    return inactivePreviewSession;
  }
  return { previewActive: true, scope };
}

function storedPreviewSessionMatchesScope(scope: string) {
  return parseStoredPreviewSession(window.sessionStorage.getItem(PREVIEW_SESSION_STORAGE_KEY))?.scope === scope;
}

export function bootstrapChapterPreviewSession(): ChapterPreviewSessionState {
  const scope = publicPreviewScope();
  const url = new URL(window.location.href);
  const previewTokens = url.searchParams.getAll("preview");

  if (!scope || previewTokens.length !== 1 || previewTokens[0] !== PREVIEW_TOKEN) {
    return previewSessionForScope(scope);
  }

  window.sessionStorage.setItem(PREVIEW_SESSION_STORAGE_KEY, JSON.stringify({
    v: 1,
    token: PREVIEW_TOKEN,
    scope
  } satisfies StoredChapterPreviewSession));
  url.searchParams.delete("preview");
  mergePreviewHistoryMarker(scope, `${url.pathname}${url.search}${url.hash}`);
  return { previewActive: true, scope };
}

export function revalidateChapterPreviewSession(): ChapterPreviewSessionState {
  return previewSessionForScope(publicPreviewScope());
}

export function markChapterPreviewHistoryEntry(scope: string) {
  try {
    if (!isChapterPreviewScope(scope) || publicPreviewScope() !== scope || !storedPreviewSessionMatchesScope(scope)) {
      return false;
    }
    mergePreviewHistoryMarker(scope);
    return true;
  } catch {
    return false;
  }
}
