"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MiraLithKnownChapter
} from "../../content/miraLithChapters";
import type {
  NormalizedPostCoScrollMediaItem,
  PostCoScrollMediaDiagnostic
} from "../../content/postCoScrollMedia";
import { useChapterTransitionDestination } from "../chapter-transition/ChapterTransitionProvider";
import type { ChapterDestinationResetContext } from "../chapter-transition/chapterTransitionTypes";
import { MiraLithChapterNavigation } from "../MiraLithChapterNavigation";

type PostCoScrollResolverStatus = "ready" | "degraded" | "disabled" | "invalid";
type PosterState = "pending" | "loaded" | "error" | "unavailable";

interface PostCoScrollRouteShellProps {
  chapter: MiraLithKnownChapter;
  resolverStatus: PostCoScrollResolverStatus;
  diagnostics: PostCoScrollMediaDiagnostic[];
  mediaItems: NormalizedPostCoScrollMediaItem[];
}

function routeIdForChapter(chapter: MiraLithKnownChapter) {
  return chapter.href === "/" ? "home" : chapter.href.slice(1);
}

function canPlayLocally(
  resolverStatus: PostCoScrollResolverStatus,
  item: NormalizedPostCoScrollMediaItem | undefined
) {
  return Boolean(
    resolverStatus === "ready" &&
      item?.availability === "ready" &&
      item.poster &&
      item.variants?.desktop
  );
}

export function PostCoScrollRouteShell({
  chapter,
  resolverStatus,
  diagnostics,
  mediaItems
}: PostCoScrollRouteShellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const routeId = routeIdForChapter(chapter);
  const selectedItem = useMemo(
    () => mediaItems.find((item) => item.availability === "ready") ?? mediaItems[0],
    [mediaItems]
  );
  const verifiedLocalItem = canPlayLocally(resolverStatus, selectedItem) ? selectedItem : undefined;
  const hasVerifiedPoster = Boolean(verifiedLocalItem?.poster);
  const [posterState, setPosterState] = useState<PosterState>(() =>
    hasVerifiedPoster ? "pending" : "unavailable"
  );
  const [posterGeneration, setPosterGeneration] = useState(0);
  const [forcedFallback, setForcedFallback] = useState(false);
  const [playbackRequested, setPlaybackRequested] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const resetEntry = useCallback(async (context: ChapterDestinationResetContext) => {
    const video = videoRef.current;
    video?.pause();
    if (video) {
      try {
        video.currentTime = 0;
      } catch {
        // A metadata race cannot make a route entry non-deterministic; the next explicit play starts at zero.
      }
    }
    setPlaybackRequested(false);
    setPlaybackError(null);
    setAudioEnabled(false);
    setForcedFallback(false);
    setPosterState(hasVerifiedPoster ? "pending" : "unavailable");
    setPosterGeneration((generation) => generation + 1);

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    if (context.signal.aborted) {
      return;
    }
  }, [hasVerifiedPoster]);

  const destinationControls = useMemo(() => ({
    resetEntry,
    forceFallback: () => {
      setForcedFallback(true);
    }
  }), [resetEntry]);
  const destination = useChapterTransitionDestination(chapter.href, destinationControls);

  const fallbackVisible =
    forcedFallback ||
    !verifiedLocalItem ||
    posterState === "error" ||
    posterState === "unavailable";

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
    if (!playbackRequested || !verifiedLocalItem?.variants?.desktop) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
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

  useEffect(() => () => {
    videoRef.current?.pause();
  }, []);

  const requestPlayback = () => {
    setPlaybackError(null);
    setPlaybackRequested(true);
  };
  const fallbackReason = selectedItem?.fallback.reason ?? "This chapter has no verified local media item yet.";

  return (
    <main
      className="post-coscroll-route-shell"
      data-post-coscroll-route={routeId}
      data-post-coscroll-resolver-status={resolverStatus}
      data-post-coscroll-media-id={selectedItem?.id ?? undefined}
      data-post-coscroll-fallback={fallbackVisible ? "true" : "false"}
      data-post-coscroll-poster-state={posterState}
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
            onLoad={() => setPosterState("loaded")}
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

      {verifiedLocalItem && !fallbackVisible && !playbackRequested ? (
        <button type="button" className="post-coscroll-route-shell__play" onClick={requestPlayback}>
          {chapter.href === "/artbreeze"
            ? "Play verified local ArtBreeze media"
            : `Play verified local ${chapter.title} media`}
        </button>
      ) : null}
      {verifiedLocalItem && playbackRequested && !audioEnabled ? (
        <button type="button" className="post-coscroll-route-shell__audio" onClick={() => setAudioEnabled(true)}>
          Enable sound
        </button>
      ) : null}

      <MiraLithChapterNavigation activeIndex={chapter.index} interactive terminal={false} />
    </main>
  );
}
