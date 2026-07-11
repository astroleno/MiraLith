export type HomeSceneId = "lubirth" | "radio-gaga" | "coscroll";

export interface HomeChapterPresence {
  near: boolean;
  active: boolean;
}

export interface HomeChapterRuntime extends HomeChapterPresence {
  id: HomeSceneId;
  progressRef: { current: number };
}

export interface HomeChapterDefinition {
  id: HomeSceneId;
  index: string;
  title: string;
  zh: string;
  en: string;
}
