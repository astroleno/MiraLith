import { getPublishedMiraLithChapter } from "../../content/miraLithChapters";

interface ChapterRouterPrefetch {
  prefetch: (href: string) => void;
}

const targetPreloads = new Map<string, Promise<void>>();

export function preloadChapterTarget(router: ChapterRouterPrefetch, targetHref: string) {
  const chapter = getPublishedMiraLithChapter(targetHref);
  if (!chapter) {
    return Promise.resolve();
  }
  const cached = targetPreloads.get(chapter.href);
  if (cached) {
    return cached;
  }

  router.prefetch(chapter.href);
  const preload = chapter.href === "/radio-gaga"
    ? import("@miralith/radio-gaga-scene").then(({ preloadRadioGagaOpeningAssets }) => {
        preloadRadioGagaOpeningAssets();
      })
    : chapter.href === "/coscroll"
      ? import("@miralith/coscroll-scene").then(({ preloadCoScrollOpeningAssets }) =>
          preloadCoScrollOpeningAssets()
        )
      : Promise.resolve();
  const guardedPreload = preload.catch(() => undefined);
  targetPreloads.set(chapter.href, guardedPreload);
  return guardedPreload;
}
