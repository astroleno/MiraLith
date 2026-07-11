export const radioGagaCopy = {
  eyebrow: "02 — Care",
  title: "radioGAGA",
  subtitleEn: "A familiar radio shape for sending useful local updates home in my voice",
  subtitleZh: "把附近发生的事，变成家里听得懂的一句提醒",
  introEn: [
    "Not another app to open,",
    "just the old radio already waiting at home."
  ],
  introZh: [
    "不用再打开一个 App，",
    "只是家里原本就在的那台收音机。"
  ],
  voiceEn: [
    "I sift the local noise down to what matters today,",
    "then rewrite it as something I would actually say."
  ],
  voiceZh: [
    "我把本地消息筛到今天真正有用的几件事，",
    "再改成我会亲口说出的家常话。"
  ],
  memoryEn: [
    "The radio asks what changed today.",
    "I tune the answer into a line my parents can hold."
  ],
  memoryZh: [
    "收音机问今天有什么新鲜事，",
    "我把答案调成爸妈能接住的一句话。"
  ],
  coreTitleEn: "The ESP32 plays it at home",
  coreTitleZh: "ESP32 把它播回家里",
  coreBodyEn: [
    "The old radio hands its signal to the ESP32.",
    "The device plays the reminder at home in my voice."
  ],
  coreBodyZh: [
    "旧收音机把筛好的消息交给 ESP32。",
    "这台设备在家里用我的声音把提醒播出来。"
  ],
  finalEn: "A small machine for staying close.",
  finalZh: "一台让距离变近的小机器。"
} as const;

export const radioGagaProcessSteps = [
  { en: "local updates arrive", zh: "本地新闻、天气和社区通知进来" },
  { en: "I choose what matters", zh: "我只挑和爸妈今天有关的事" },
  { en: "rewrite it as one family sentence", zh: "改成一句家里听得懂的话" },
  { en: "send it to the ESP32 care device", zh: "送进 ESP32 照护设备" },
  { en: "it plays at home in my voice", zh: "在家里用我的声音播出来" }
] as const;

export const radioGagaProofFrames = [
  {
    detail: "新闻、天气、社区通知先被挑成爸妈今天用得上的几件事。",
    image: "/img/website1.PNG",
    title: "筛出今天真的要回家的消息"
  },
  {
    detail: "不是新闻摘要，而是像我在家里聊天的一段话。",
    image: "/img/website2.png",
    title: "写成我会说出口的节目稿"
  }
] as const;

export const radioGagaStages = [
  { count: "01 / 05", en: "Tuning old radio", zh: "调入旧收音机" },
  { count: "02 / 05", en: "Reading local updates", zh: "读取本地消息" },
  { count: "03 / 05", en: "Writing family script", zh: "写成家常话" },
  { count: "04 / 05", en: "Sending to ESP32", zh: "送进 ESP32" },
  { count: "05 / 05", en: "Playing at home", zh: "在家里播出" }
] as const;

export const radioGagaSiteChapters = [
  {
    index: "01",
    title: "LuBirth",
    zh: "出生时刻的地月合影",
    en: "Birth-Time Earth-Moon Portrait",
    active: false
  },
  {
    index: "02",
    title: "Radio Gaga",
    zh: "照护",
    en: "Care",
    active: true
  },
  {
    index: "03",
    title: "CoScroll",
    zh: "赛博转经筒",
    en: "Devotion",
    active: false
  },
  {
    index: "04",
    title: "ArtBreeze",
    zh: "艺息",
    en: "Art Flow",
    active: false
  },
  {
    index: "05",
    title: "Floating Constellation",
    zh: "群星项目",
    en: "Project Field",
    active: false
  },
  {
    index: "06",
    title: "Client Works",
    zh: "商业作品",
    en: "Commissioned Systems",
    active: false
  },
  {
    index: "07",
    title: "Now Building",
    zh: "主业与关于",
    en: "Work / About",
    active: false
  }
] as const;
