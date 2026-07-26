export type MiraLithChapterAvailability = "published" | "preview";

export type MiraLithKnownChapter = {
  index: "01" | "02" | "03" | "04" | "05" | "06" | "07";
  title: string;
  zh: string;
  en: string;
  href: "/" | "/radio-gaga" | "/coscroll" | "/artbreeze" | "/constellation" | "/client-works" | "/now-building";
  availability: MiraLithChapterAvailability;
};

export const miraLithChapterRegistry: readonly MiraLithKnownChapter[] = [
  {
    index: "01",
    title: "LuBirth",
    zh: "出生时刻的地月合影",
    en: "Birth-Time Earth-Moon Portrait",
    href: "/",
    availability: "published"
  },
  {
    index: "02",
    title: "Radio Gaga",
    zh: "照护",
    en: "Care",
    href: "/radio-gaga",
    availability: "published"
  },
  {
    index: "03",
    title: "CoScroll",
    zh: "赛博转经筒",
    en: "Devotion",
    href: "/coscroll",
    availability: "published"
  },
  {
    index: "04",
    title: "ArtBreeze",
    zh: "艺息",
    en: "Art Flow",
    href: "/artbreeze",
    availability: "preview"
  },
  {
    index: "05",
    title: "Floating Constellation",
    zh: "群星项目",
    en: "Project Field",
    href: "/constellation",
    availability: "preview"
  },
  {
    index: "06",
    title: "Client Works",
    zh: "商业作品",
    en: "Commissioned Systems",
    href: "/client-works",
    availability: "preview"
  },
  {
    index: "07",
    title: "Now Building",
    zh: "主业与关于",
    en: "Work / About",
    href: "/now-building",
    availability: "preview"
  }
];

export const miraLithChapters = miraLithChapterRegistry;

export type MiraLithChapter = MiraLithKnownChapter;
export type MiraLithChapterIndex = MiraLithKnownChapter["index"];
export type PublishedMiraLithChapter = MiraLithKnownChapter & { availability: "published" };

export const publishedMiraLithChapters: readonly PublishedMiraLithChapter[] = miraLithChapterRegistry.filter(
  (chapter): chapter is PublishedMiraLithChapter => chapter.availability === "published"
);

export const publishedMiraLithChapterHrefs = Object.fromEntries(
  publishedMiraLithChapters.map((chapter) => [chapter.index, chapter.href])
) as Partial<Record<MiraLithChapterIndex, MiraLithKnownChapter["href"]>>;

export type MiraLithAccessResolution = {
  chapter: MiraLithKnownChapter | null;
  level: "unknown" | "known" | "published" | "preview";
  directEntryAllowed: boolean;
  coordinatorAllowed: boolean;
  visibleInNavigation: boolean;
  preloadAllowed: boolean;
};

export function normalizeMiraLithChapterHref(href: string) {
  let pathname: string;
  try {
    pathname = href.startsWith("/") ? href.split(/[?#]/, 1)[0] : new URL(href, "https://miralith.local").pathname;
  } catch {
    pathname = href.split(/[?#]/, 1)[0];
  }
  pathname ||= "/";
  return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function resolveMiraLithChapterAccess(
  href: string,
  context: { previewActive: boolean }
): MiraLithAccessResolution {
  const pathname = normalizeMiraLithChapterHref(href);
  const chapter = miraLithChapterRegistry.find((candidate) => candidate.href === pathname) ?? null;

  if (!chapter) {
    return {
      chapter: null,
      level: "unknown",
      directEntryAllowed: false,
      coordinatorAllowed: false,
      visibleInNavigation: false,
      preloadAllowed: false
    };
  }

  const accessible = chapter.availability === "published" || context.previewActive;
  return {
    chapter,
    level: chapter.availability === "published" ? "published" : accessible ? "preview" : "known",
    directEntryAllowed: true,
    coordinatorAllowed: accessible,
    visibleInNavigation: accessible,
    preloadAllowed: accessible
  };
}

export function getNextAccessibleMiraLithChapter(
  href: string,
  context: { previewActive: boolean }
): MiraLithKnownChapter | undefined {
  const pathname = normalizeMiraLithChapterHref(href);
  const currentIndex = miraLithChapterRegistry.findIndex((chapter) => chapter.href === pathname);
  const nextChapter = currentIndex >= 0 ? miraLithChapterRegistry[currentIndex + 1] : undefined;

  if (!nextChapter || !resolveMiraLithChapterAccess(nextChapter.href, context).coordinatorAllowed) {
    return undefined;
  }

  return nextChapter;
}

export function getPublishedMiraLithChapter(href: string) {
  const pathname = normalizeMiraLithChapterHref(href);
  return publishedMiraLithChapters.find((chapter) => chapter.href === pathname);
}

export function getNextPublishedChapter(href: string) {
  const pathname = normalizeMiraLithChapterHref(href);
  const currentIndex = publishedMiraLithChapters.findIndex((chapter) => chapter.href === pathname);
  return currentIndex >= 0 ? publishedMiraLithChapters[currentIndex + 1] : undefined;
}
