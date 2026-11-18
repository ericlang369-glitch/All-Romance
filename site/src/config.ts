export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * 国内加速：图片 / 字体 / 照片走 jsDelivr（gcore 节点，按 git tag 固定版本）。
 * CDN 不通或 2.5 秒内连不上时，自动退回 GitHub Pages 本地路径（见 layout.tsx 的探测脚本与 kit.setSrc）。
 */
export const ASSET_CDN = process.env.NEXT_PUBLIC_ASSET_CDN || "";
export const ASSET_BASE = ASSET_CDN || BASE_PATH;
/** CDN 地址 → 本地地址；不是 CDN 地址时返回 null */
export function assetFallback(url: string): string | null {
  return ASSET_CDN && url.startsWith(ASSET_CDN) ? BASE_PATH + url.slice(ASSET_CDN.length) : null;
}

export const SHOW_LETTER = true;

export const PASSCODE = "0825";
export const DAY100_CODE = "1203";

// 2026-08-25 00:00:00 (Asia/Shanghai)
export const START_ISO = "2026-08-25T00:00:00+08:00";

export const CAMERA_LEVEL: 1 | 2 = 2;

export const PHOTOS = {
  /** 第 03 屏手写信原图：待补拍上传后填入文件名即可无缝切换 */
  letter: null as string | null,
  /** 第 05 屏 两张 1:1 真实复刻明信片 */
  p1: "p1-beijing-restored.webp",
  p2: "p2-shanghai19m-restored.webp",
  /** 第 06 屏 三张拍立得及彩蛋原图对照 */
  pailepai: "pailepai-flights.jpg",
  catRemake: "polaroid-cat-remake.webp",
  gdRemake: "polaroid-gd-remake.webp",
  catFull: "polaroid-cat-full.jpg",
  gdFull: "polaroid-gd-full.jpg",
};

export const TEXT = {
  opening: {
    enName: "ERIS,",
    zhName: "陈玺羽",
    dayTag: "第 100 天",
    lines: [
      "八月二十五日那天，我鼓起勇气问你，",
      "可不可以和我在一起；",
      "走过三千多个小时，今天交第一份答卷。",
    ],
    hint: "轻触 · 向下",
  },
  flower: {
    zhTitle: "那束花",
    enLeft: "kept by",
    enRight: "YOU",
    sub1: "表白信里我说，唯独不想让你成为转瞬即逝的风景；",
    sub2: "没想到是你先裱起那束花，把夏天和蝴蝶留在原地。",
    notePrefix: "落稳生墨 · ",
    noteHighlight: "轻触蝴蝶再泛微澜",
  },
  letter: {
    enTop: "Lines from YOU,",
    zhTitle: "你的信",
    enTail: "in the night —",
    sub1: "那天怕誓言太虚，我只敢连写四遍「我喜欢你」；",
    sub2: "收到你亲笔写下的回信，这一百天的答案便更笃定。",
    couplet: "谨付寸心，希垂尺素。",
    hint: "轻触信纸 · 放大细读",
  },
  birds: {
    zhTitle: "雁字回时",
    enLeft: "wings across",
    enRight: "THE NIGHT",
    sub1: "十月秋风，把两座城吹进同一封信：",
    sub2Prefix: "你在北京寄来",
    sub2Ice: "雁字",
    sub2Mid: "，我在上海驻足",
    sub2Gold: "飞鸟",
    sub2End: "，",
    sub3Prefix: "山海隔路，每片羽翼都飞向有你的",
    sub3Gold: "杭州",
    sub3End: "。",
    notePrefix: "珠纱三帧振翅 · ",
    noteIce: "穿雾越山",
    noteMid: "赴",
    noteGold: "你",
  },
  postcards: {
    zhTitle: "两张明信片",
    enLeft: "miles apart,",
    enRight: "TO YOU",
    routeCaption: "南锣鼓巷 10.26 → 19M 工坊",
    notePrefix: "双雁静泊蓝夜 · ",
    noteHighlight: "轻触放大细读真迹",
  },
  photos: {
    zhTitle: "我们",
    enLeft: "everyday",
    enRight: "ROMANCE",
    sub1: "这三千多个小时里，我们把日子过成了许多具体的画面；",
    sub2: "所谓用行动证明，大概就是把每个寻常日子，都和你过得有声有色。",
    badge: "长按相片",
    couplet1: "方寸相纸留住须臾，",
    couplet2: "而来日方长，我们慢慢写。",
    eggCatCaption: "小嘴抹了蜜ono",
    eggGdCaption: "霸道黑老大守护我～",
  },
  ending: {
    lineQuote: "I bought flowers thinking about you. I mean, I love you.",
    sinceDate: "自 2026.08.25",
    whisperNight: "轻触花束",
    endingMessage: "寸心如故，岁岁长相见。",
    endingPending: false,
    dayUnit: "DAYS TOGETHER",
  },
  /** 旧字段兼容占位 */
  end: "未完待续",
};
