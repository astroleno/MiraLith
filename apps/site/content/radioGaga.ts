export const radioGagaCopy = {
  eyebrow: "02 — Care",
  title: "radioGAGA",
  subtitleEn: "A radio of local news, family memory, and my own voice",
  subtitleZh: "一台装着本地新闻、父母记忆与我自己声音的收音机",
  introEn: [
    "Technology is not displayed as power here.",
    "It becomes a warmer way to speak with my parents."
  ],
  introZh: [
    "技术在这里不是能力的炫耀，",
    "而是一种更温柔地与父母说话的方法。"
  ],
  voiceEn: [
    "I filter local news through my own perspective,",
    "then let it return home in my voice."
  ],
  voiceZh: [
    "我以自己的视角筛选本地新闻，",
    "再让它以我的声音回到家中。"
  ],
  memoryEn: [
    "It does not simply read the news.",
    "It translates the news into a daily language my parents can hold."
  ],
  memoryZh: [
    "它不是把新闻读出来，",
    "而是把新闻翻译成父母能够接住的日常。"
  ],
  homeLineEn: "Mom, the road by the community gate is closed tomorrow. Take the other way out.",
  homeLineZh: "妈，社区门口那条路明天施工，出门绕一下。",
  coreTitleEn: "Inside, a small core of care",
  coreTitleZh: "内里，是一颗照护的核心",
  coreBodyEn: [
    "ESP32 is not the protagonist.",
    "It is only the path that lets a voice arrive."
  ],
  coreBodyZh: [
    "ESP32 不是主角。",
    "它只是让声音抵达家人的方法。"
  ],
  finalEn: "A small machine for staying close.",
  finalZh: "一台让距离变近的小机器。"
} as const;

export const radioGagaProcessSteps = [
  { en: "local news", zh: "本地新闻" },
  { en: "I choose what matters", zh: "我替他们筛一遍" },
  { en: "say it plainly", zh: "说成家常话" },
  { en: "my voice", zh: "我的声音" },
  { en: "parents' radio", zh: "爸妈家的收音机" }
] as const;

export const radioGagaStages = [
  { count: "01 / 05", en: "Old radio", zh: "旧收音机" },
  { count: "02 / 05", en: "Voice", zh: "我的声音" },
  { count: "03 / 05", en: "Memory", zh: "父母能接住的日常" },
  { count: "04 / 05", en: "Core", zh: "照护的核心" },
  { count: "05 / 05", en: "Home", zh: "回到家里" }
] as const;
