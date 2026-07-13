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
