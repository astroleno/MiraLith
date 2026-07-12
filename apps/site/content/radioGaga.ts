export const radioGagaCopy = {
  eyebrow: "02 — Care",
  title: "radioGAGA",
  subtitleEn: "A familiar radio shape for sending useful local updates home in my voice",
  subtitleZh: "把附近发生的事，变成家里听得懂的一句提醒",
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
  finalEn: "A small machine for staying close.",
  finalZh: "一台让距离变近的小机器。"
} as const;

export const radioGagaBroadcastStages = [
  {
    count: "01 / 05",
    stageEn: "Tuning old radio",
    stageZh: "调入旧收音机",
    stepEn: "tune the familiar signal",
    stepZh: "让旧收音机找到今天的频道",
    readoutKicker: "care band · local 88.5",
    readoutTitle: "熟悉的信号，开始收听",
    readoutDetail: "附近的新闻、天气与社区通知进入同一条照护频道。"
  },
  {
    count: "02 / 05",
    stageEn: "Reading local updates",
    stageZh: "读取本地消息",
    stepEn: "choose what matters today",
    stepZh: "只筛今天真正有用的事",
    readoutKicker: "signal scan · local updates",
    readoutTitle: "筛出今天真的要回家的消息",
    readoutDetail: "新闻、天气、社区通知先被挑成爸妈今天用得上的几件事。"
  },
  {
    count: "03 / 05",
    stageEn: "Writing family script",
    stageZh: "写成家常话",
    stepEn: "rewrite one family sentence",
    stepZh: "改成一句家里听得懂的话",
    readoutKicker: "voice edit · family script",
    readoutTitle: "写成我会说出口的节目稿",
    readoutDetail: "不是新闻摘要，而是像我在家里聊天时会说的一段话。"
  },
  {
    count: "04 / 05",
    stageEn: "Sending to ESP32",
    stageZh: "送进 ESP32",
    stepEn: "materialize the care device",
    stepZh: "让信号汇成照护设备",
    readoutKicker: "transmitting · esp32",
    readoutTitle: "ESP32 正在接收",
    readoutDetail: "粒子完全汇入设备后，模型才显现、转正，并准备播出。"
  },
  {
    count: "05 / 05",
    stageEn: "Playing at home",
    stageZh: "在家里播出",
    stepEn: "play it at home in my voice",
    stepZh: "在家里用我的声音播出",
    readoutKicker: "on air · family channel",
    readoutTitle: "一句提醒，回到家里",
    readoutDetail: "设备一次只播出一句家里能够立刻听懂的提醒。"
  }
] as const;
