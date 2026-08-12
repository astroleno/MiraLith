"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MiraLithKnownChapter } from "../../content/miraLithChapters";
import type {
  NormalizedPostCoScrollMediaItem,
  PostCoScrollMediaDiagnostic
} from "../../content/postCoScrollMedia";
import { useChapterTransitionDestination } from "../chapter-transition/ChapterTransitionProvider";
import type {
  ChapterDestinationResetContext,
  ChapterPlaybackState,
  ChapterRouteStateManifest,
  ChapterSemanticRouteState
} from "../chapter-transition/chapterTransitionTypes";
import { MiraLithChapterNavigation } from "../MiraLithChapterNavigation";

type PostCoScrollResolverStatus = "ready" | "degraded" | "disabled" | "invalid";
type PosterState = "pending" | "loaded" | "error" | "unavailable";
type RouteSemanticStop = "entry" | "poster-ready" | "playing" | "media-tail";

interface PostCoScrollRouteShellProps {
  chapter: MiraLithKnownChapter;
  resolverStatus: PostCoScrollResolverStatus;
  diagnostics: PostCoScrollMediaDiagnostic[];
  mediaItems: NormalizedPostCoScrollMediaItem[];
}

interface SemanticFixtureState {
  semanticStop: RouteSemanticStop;
  selectedMediaId: string | null;
  playbackRequested: boolean;
  playbackState: ChapterPlaybackState;
  completedMediaIds: readonly string[];
  skippedMediaIds: readonly string[];
  gateReleased: boolean;
  audioEnabled: boolean;
}

const semanticProgress: Record<RouteSemanticStop, number> = {
  entry: 0,
  "poster-ready": 0.25,
  playing: 0.5,
  "media-tail": 1
};

function routeIdForChapter(chapter: MiraLithKnownChapter) {
  return chapter.href === "/" ? "home" : chapter.href.slice(1);
}

function canPlayLocally(
  resolverStatus: PostCoScrollResolverStatus,
  item: NormalizedPostCoScrollMediaItem | undefined
) {
  return Boolean(
    resolverStatus === "ready"
      && item?.availability === "ready"
      && item.poster
      && item.variants?.desktop
  );
}

function withoutMediaId(values: readonly string[], mediaId: string) {
  return values.filter((value) => value !== mediaId);
}

function withLatestMediaOutcome(values: readonly string[], mediaId: string) {
  return [...withoutMediaId(values, mediaId), mediaId];
}

export function PostCoScrollRouteShell({
  chapter,
  resolverStatus,
  diagnostics,
  mediaItems
}: PostCoScrollRouteShellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingRestoreTimeRef = useRef<number | null>(null);
  const autoplayRequestedRef = useRef(false);
  const suppressCaptureRef = useRef(false);
  const routeStateReadyRef = useRef(chapter.href !== "/artbreeze");
  const restoringMediaRef = useRef(false);
  const ignorePauseRef = useRef(false);
  const routeId = routeIdForChapter(chapter);
  const defaultItem = useMemo(
    () => mediaItems.find((item) => item.availability === "ready") ?? mediaItems[0],
    [mediaItems]
  );
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(defaultItem?.id ?? null);
  const selectedItem = useMemo(
    () => mediaItems.find((item) => item.id === selectedMediaId) ?? defaultItem,
    [defaultItem, mediaItems, selectedMediaId]
  );
  const verifiedLocalItem = canPlayLocally(resolverStatus, selectedItem) ? selectedItem : undefined;
  const hasVerifiedPoster = Boolean(verifiedLocalItem?.poster);
  const [posterState, setPosterState] = useState<PosterState>(() =>
    hasVerifiedPoster ? "pending" : "unavailable"
  );
  const [posterGeneration, setPosterGeneration] = useState(0);
  const [forcedFallback, setForcedFallback] = useState(false);
  const [playbackRequested, setPlaybackRequested] = useState(false);
  const [playbackState, setPlaybackState] = useState<ChapterPlaybackState>("ready");
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [semanticStop, setSemanticStop] = useState<RouteSemanticStop>("entry");
  const [completedMediaIds, setCompletedMediaIds] = useState<readonly string[]>([]);
  const [skippedMediaIds, setSkippedMediaIds] = useState<readonly string[]>([]);
  const [gateReleased, setGateReleased] = useState(false);
  const [routeStateReady, setRouteStateReady] = useState(chapter.href !== "/artbreeze");

  const routeStateManifest = useMemo<ChapterRouteStateManifest | undefined>(() => {
    if (chapter.href !== "/artbreeze") {
      return undefined;
    }
    const mediaTailSeconds = Object.fromEntries(mediaItems.flatMap((item) =>
      item.variants?.desktop
        ? [[item.id, item.variants.desktop.durationSeconds] as const]
        : []
    ));
    return {
      pathname: "/artbreeze",
      stopIds: ["entry", "poster-ready", "playing", "media-tail"],
      segmentIds: ["route-shell"],
      mediaIds: mediaItems.map((item) => item.id),
      routeState: {
        playbackRequested: { kind: "boolean" },
        audioEnabled: { kind: "boolean" }
      },
      mediaTailSeconds
    };
  }, [chapter.href, mediaItems]);

  const semanticStateRef = useRef<SemanticFixtureState>({
    semanticStop,
    selectedMediaId,
    playbackRequested,
    playbackState,
    completedMediaIds,
    skippedMediaIds,
    gateReleased,
    audioEnabled
  });
  useEffect(() => {
    semanticStateRef.current = {
      semanticStop,
      selectedMediaId,
      playbackRequested,
      playbackState,
      completedMediaIds,
      skippedMediaIds,
      gateReleased,
      audioEnabled
    };
  }, [
    audioEnabled,
    completedMediaIds,
    gateReleased,
    playbackRequested,
    playbackState,
    selectedMediaId,
    semanticStop,
    skippedMediaIds
  ]);

  const captureSemanticState = useCallback((): ChapterSemanticRouteState => {
    const state = semanticStateRef.current;
    const video = videoRef.current;
    const selectedId = state.selectedMediaId;
    const hasDurableOutcome = selectedId !== null && (
      state.completedMediaIds.includes(selectedId) || state.skippedMediaIds.includes(selectedId)
    );
    const activeMedia = selectedId === null || hasDurableOutcome
      ? null
      : state.playbackRequested
        ? {
            id: selectedId,
            playbackState: state.playbackState,
            timeSeconds: Number.isFinite(video?.currentTime)
              ? video?.currentTime ?? 0
              : pendingRestoreTimeRef.current ?? 0
          }
        : {
            id: selectedId,
            playbackState: "ready" as const,
            timeSeconds: 0
          };
    const progress = semanticProgress[state.semanticStop];
    return {
      kind: "semantic",
      semanticStop: state.semanticStop,
      segmentId: "route-shell",
      segmentProgress: progress,
      narrativeProgress: progress,
      completedMediaIds: [...state.completedMediaIds],
      skippedMediaIds: [...state.skippedMediaIds],
      activeMedia,
      gateReleased: state.gateReleased,
      mutePreference: !state.audioEnabled,
      routeState: {
        playbackRequested: state.playbackRequested,
        audioEnabled: state.audioEnabled
      }
    };
  }, []);

  const routeStateAdapter = useMemo(() => routeStateManifest
    ? { manifest: routeStateManifest, capture: captureSemanticState }
    : undefined, [captureSemanticState, routeStateManifest]);

  const markRouteStateReady = useCallback(() => {
    restoringMediaRef.current = false;
    suppressCaptureRef.current = false;
    routeStateReadyRef.current = true;
    setRouteStateReady(true);
  }, []);

  const resetEntry = useCallback(async (context: ChapterDestinationResetContext) => {
    suppressCaptureRef.current = true;
    routeStateReadyRef.current = false;
    setRouteStateReady(false);
    autoplayRequestedRef.current = false;
    ignorePauseRef.current = true;
    videoRef.current?.pause();
    ignorePauseRef.current = false;
    const restored = context.returnSnapshot?.semantic.kind === "semantic"
      ? context.returnSnapshot.semantic
      : null;
    const restoredActive = restored?.activeMedia ?? null;
    const restoredPlaybackRequested = restoredActive !== null
      && restoredActive.playbackState !== "ready";
    restoringMediaRef.current = restoredPlaybackRequested;
    const nextSelectedId = restoredActive?.id ?? defaultItem?.id ?? null;
    const restoredItem = mediaItems.find((item) => item.id === nextSelectedId);
    const restoredHasPoster = canPlayLocally(resolverStatus, restoredItem);

    pendingRestoreTimeRef.current = restoredPlaybackRequested
      ? restoredActive.timeSeconds
      : null;
    setSelectedMediaId(nextSelectedId);
    setPlaybackRequested(restoredPlaybackRequested);
    setPlaybackState(restoredPlaybackRequested ? "paused-ready" : "ready");
    setPlaybackError(null);
    setAudioEnabled(restored ? !restored.mutePreference : false);
    setCompletedMediaIds(restored ? [...restored.completedMediaIds] : []);
    setSkippedMediaIds(restored ? [...restored.skippedMediaIds] : []);
    setGateReleased(restored?.gateReleased ?? false);
    setSemanticStop(restored
      ? restoredPlaybackRequested
        ? "playing"
        : restored.semanticStop as RouteSemanticStop
      : "entry");
    setForcedFallback(false);
    setPosterState(restoredHasPoster ? "pending" : "unavailable");
    setPosterGeneration((generation) => generation + 1);

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    if (context.signal.aborted) {
      return;
    }
    if (!restoredPlaybackRequested) {
      markRouteStateReady();
    }
  }, [defaultItem?.id, markRouteStateReady, mediaItems, resolverStatus]);

  const destinationControls = useMemo(() => ({
    resetEntry,
    forceFallback: () => {
      setForcedFallback(true);
    },
    // eslint-disable-next-line react-hooks/refs -- this only carries the adapter callback; the ref is read later by Provider capture, never during render.
    ...(routeStateAdapter ? { routeState: routeStateAdapter } : {})
  }), [resetEntry, routeStateAdapter]);
  const destination = useChapterTransitionDestination(chapter.href, destinationControls);
  const captureRegisteredRouteState = destination.captureRouteState;

  const fallbackVisible =
    forcedFallback
    || !verifiedLocalItem
    || posterState === "error"
    || posterState === "unavailable";

  useEffect(() => {
    if (!destination.isTransitionTarget) {
      return;
    }
    if (fallbackVisible) {
      destination.reportFallbackReady();
    } else if (posterState === "loaded") {
      destination.reportVisualReady();
    } else {
      destination.reportVisualPending();
    }
  }, [destination, fallbackVisible, posterState]);

  useEffect(() => {
    if (!playbackRequested || !verifiedLocalItem?.variants?.desktop || !autoplayRequestedRef.current) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    autoplayRequestedRef.current = false;
    let active = true;
    void video.play().catch((error: unknown) => {
      if (active) {
        setPlaybackError(error instanceof Error ? error.message : "The verified local video could not start.");
      }
    });
    return () => {
      active = false;
      video.pause();
    };
  }, [playbackRequested, verifiedLocalItem?.variants?.desktop]);

  useEffect(() => {
    if (!routeStateAdapter || suppressCaptureRef.current || !routeStateReadyRef.current) {
      return;
    }
    captureRegisteredRouteState("semantic");
  }, [
    audioEnabled,
    completedMediaIds,
    captureRegisteredRouteState,
    gateReleased,
    playbackRequested,
    playbackState,
    routeStateAdapter,
    selectedMediaId,
    semanticStop,
    skippedMediaIds
  ]);

  useEffect(() => () => {
    videoRef.current?.pause();
  }, []);

  const requestPlayback = () => {
    const mediaId = selectedItem?.id;
    if (!mediaId) {
      return;
    }
    autoplayRequestedRef.current = true;
    pendingRestoreTimeRef.current = null;
    setPlaybackError(null);
    setCompletedMediaIds((values) => withoutMediaId(values, mediaId));
    setSkippedMediaIds((values) => withoutMediaId(values, mediaId));
    setPlaybackState("ready");
    setSemanticStop("playing");
    setPlaybackRequested(true);
  };

  const finishWithOutcome = (outcome: "completed" | "skipped") => {
    const mediaId = selectedItem?.id;
    if (!mediaId) {
      return;
    }
    autoplayRequestedRef.current = false;
    ignorePauseRef.current = true;
    videoRef.current?.pause();
    ignorePauseRef.current = false;
    pendingRestoreTimeRef.current = null;
    setPlaybackRequested(false);
    setPlaybackState("ready");
    setGateReleased(true);
    setSemanticStop("media-tail");
    if (outcome === "completed") {
      setSkippedMediaIds((values) => withoutMediaId(values, mediaId));
      setCompletedMediaIds((values) => withLatestMediaOutcome(values, mediaId));
    } else {
      setCompletedMediaIds((values) => withoutMediaId(values, mediaId));
      setSkippedMediaIds((values) => withLatestMediaOutcome(values, mediaId));
    }
  };

  const fallbackReason = selectedItem?.fallback.reason ?? "This chapter has no verified local media item yet.";
  const currentMediaCompleted = selectedItem ? completedMediaIds.includes(selectedItem.id) : false;
  const currentMediaSkipped = selectedItem ? skippedMediaIds.includes(selectedItem.id) : false;
  const isReplay = gateReleased && (currentMediaCompleted || currentMediaSkipped);

  return (
    <main
      className="post-coscroll-route-shell"
      data-post-coscroll-route={routeId}
      data-post-coscroll-resolver-status={resolverStatus}
      data-post-coscroll-media-id={selectedItem?.id ?? undefined}
      data-post-coscroll-fallback={fallbackVisible ? "true" : "false"}
      data-post-coscroll-poster-state={posterState}
      data-post-coscroll-semantic-stop={semanticStop}
      data-post-coscroll-completed-media={completedMediaIds.join(",")}
      data-post-coscroll-skipped-media={skippedMediaIds.join(",")}
      data-post-coscroll-active-media={playbackRequested ? selectedItem?.id ?? "" : ""}
      data-post-coscroll-playback-state={playbackRequested ? playbackState : ""}
      data-post-coscroll-gate-released={gateReleased ? "true" : "false"}
      data-post-coscroll-audio-enabled={audioEnabled ? "true" : "false"}
      data-chapter-focus-root
      tabIndex={-1}
      aria-label={`${chapter.title} preview route`}
    >
      <header className="post-coscroll-route-shell__identity">
        <p>{chapter.index}</p>
        <h1>{chapter.title}</h1>
        <span>{chapter.zh} / {chapter.en}</span>
      </header>

      <section className="post-coscroll-route-shell__media" aria-label={`${chapter.title} local media`}>
        {fallbackVisible ? (
          <div className="post-coscroll-route-shell__fallback" data-post-coscroll-fallback-content>
            <p>Verified local playback is not available for this route.</p>
            <span>{fallbackReason}</span>
          </div>
        ) : verifiedLocalItem?.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- the resolver verifies this exact local poster URL and SHA before rendering.
          <img
            key={posterGeneration}
            className="post-coscroll-route-shell__poster"
            src={verifiedLocalItem.poster.src}
            alt={`${chapter.title} verified local media poster`}
            onLoad={() => {
              setPosterState("loaded");
              const state = semanticStateRef.current;
              if (!state.playbackRequested && !state.gateReleased) {
                setSemanticStop("poster-ready");
              }
            }}
            onError={() => setPosterState("error")}
          />
        ) : null}

        {playbackRequested && verifiedLocalItem?.variants?.desktop ? (
          <video
            ref={videoRef}
            className="post-coscroll-route-shell__video"
            src={verifiedLocalItem.variants.desktop.src}
            poster={verifiedLocalItem.poster?.src}
            controls
            muted={!audioEnabled}
            playsInline
            preload="metadata"
            data-post-coscroll-local-video
            onLoadedMetadata={(event) => {
              const pendingTime = pendingRestoreTimeRef.current;
              if (pendingTime !== null) {
                const duration = Number.isFinite(event.currentTarget.duration)
                  ? event.currentTarget.duration
                  : pendingTime;
                const restoreTime = Math.min(Math.max(pendingTime, 0), duration);
                const needsSeek = Math.abs(event.currentTarget.currentTime - restoreTime) > 0.01;
                event.currentTarget.currentTime = restoreTime;
                event.currentTarget.pause();
                setPlaybackState("paused-ready");
                pendingRestoreTimeRef.current = null;
                if (!needsSeek) {
                  window.requestAnimationFrame(markRouteStateReady);
                }
              }
            }}
            onPlaying={() => setPlaybackState("playing")}
            onPause={() => {
              if (!ignorePauseRef.current && semanticStateRef.current.playbackRequested) {
                setPlaybackState("paused-ready");
              }
            }}
            onSeeked={() => {
              if (restoringMediaRef.current) {
                markRouteStateReady();
              } else if (!suppressCaptureRef.current && routeStateReadyRef.current) {
                captureRegisteredRouteState("semantic");
              }
            }}
            onTimeUpdate={() => {
              if (!suppressCaptureRef.current && routeStateReadyRef.current) {
                captureRegisteredRouteState("media-time");
              }
            }}
            onEnded={() => finishWithOutcome("completed")}
          />
        ) : null}
      </section>

      {diagnostics.length > 0 || playbackError ? (
        <section className="post-coscroll-route-shell__diagnostics" aria-label="Local media diagnostics">
          {playbackError ? <p>{playbackError}</p> : null}
          <ul>
            {diagnostics.map((diagnostic) => (
              <li key={`${diagnostic.code}:${diagnostic.mediaId ?? "route"}:${diagnostic.field ?? "status"}`}>
                {diagnostic.code}: {diagnostic.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {skippedMediaIds.length > 0 ? (
        <p data-post-coscroll-skipped-summary>
          Skipped local media: {skippedMediaIds.join(", ")}
        </p>
      ) : null}

      {verifiedLocalItem && !fallbackVisible && !playbackRequested ? (
        <button
          type="button"
          className="post-coscroll-route-shell__play"
          disabled={!routeStateReady}
          onClick={requestPlayback}
        >
          {isReplay
            ? "Replay verified local ArtBreeze media"
            : chapter.href === "/artbreeze"
              ? "Play verified local ArtBreeze media"
              : `Play verified local ${chapter.title} media`}
        </button>
      ) : null}
      {verifiedLocalItem && playbackRequested ? (
        <>
          <button
            type="button"
            className="post-coscroll-route-shell__audio"
            disabled={!routeStateReady}
            onClick={() => setAudioEnabled((enabled) => !enabled)}
          >
            {audioEnabled ? "Mute sound" : "Enable sound"}
          </button>
          <button type="button" disabled={!routeStateReady} onClick={() => finishWithOutcome("skipped")}>
            Skip verified local ArtBreeze media
          </button>
        </>
      ) : null}

      <MiraLithChapterNavigation activeIndex={chapter.index} interactive terminal={false} />
    </main>
  );
}
