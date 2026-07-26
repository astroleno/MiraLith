export const miraLithChapters = [
  {
    index: "01",
    title: "LuBirth",
    zh: "出生时刻的地月合影",
    en: "Birth-Time Earth-Moon Portrait"
  },
  {
    index: "02",
    title: "Radio Gaga",
    zh: "照护",
    en: "Care"
  },
  {
    index: "03",
    title: "CoScroll",
    zh: "赛博转经筒",
    en: "Devotion"
  },
  {
    index: "04",
    title: "ArtBreeze",
    zh: "艺息",
    en: "Art Flow"
  },
  {
    index: "05",
    title: "Floating Constellation",
    zh: "群星项目",
    en: "Project Field"
  },
  {
    index: "06",
    title: "Client Works",
    zh: "商业作品",
    en: "Commissioned Systems"
  },
  {
    index: "07",
    title: "Now Building",
    zh: "主业与关于",
    en: "Work / About"
  }
] as const;

export type MiraLithChapter = (typeof miraLithChapters)[number];
export type MiraLithChapterIndex = MiraLithChapter["index"];

export const publishedMiraLithChapterHrefs = {
  "01": "/",
  "02": "/radio-gaga",
  "03": "/coscroll"
} satisfies Partial<Record<MiraLithChapterIndex, string>>;

export type PublishedMiraLithChapter = MiraLithChapter & { href: string };

export const publishedMiraLithChapters: readonly PublishedMiraLithChapter[] = miraLithChapters.flatMap(
  (chapter) => {
    const href = publishedMiraLithChapterHrefs[chapter.index as keyof typeof publishedMiraLithChapterHrefs];
    return href ? [{ ...chapter, href }] : [];
  }
);

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

export function getPublishedMiraLithChapter(href: string) {
  const pathname = normalizeMiraLithChapterHref(href);
  return publishedMiraLithChapters.find((chapter) => chapter.href === pathname);
}

export function getNextPublishedChapter(href: string) {
  const pathname = normalizeMiraLithChapterHref(href);
  const currentIndex = publishedMiraLithChapters.findIndex((chapter) => chapter.href === pathname);
  return currentIndex >= 0 ? publishedMiraLithChapters[currentIndex + 1] : undefined;
}
