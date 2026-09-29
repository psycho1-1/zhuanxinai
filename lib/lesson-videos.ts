import type { Lesson } from './curriculum';
import { upperVideos } from './upper-videos.ts';

export type LessonVideo = {
  bvid: string;
  cid: number;
  page: number;
  title: string;
  author: string;
  durationSeconds: number;
  focus: string;
};

// 只保存公开视频的引用信息；视频文件由 B 站官方播放器加载。
// 2026-09-10 核对公开元数据、分集 CID 及付费/分享状态。
export const lessonVideos: Record<Lesson['id'], LessonVideo> = {
  ...upperVideos,
  'number-line': {
    bvid: 'BV1vy4y1E7dB',
    cid: 298186025,
    page: 1,
    title: 'P2 初中数学|七年级上册第二讲|数轴、相反数',
    author: 'Evan陈住气',
    durationSeconds: 1393,
    focus: '本节重点：认识数轴的三要素，理解相反数，并在数轴上比较大小。',
  },
  absolute: {
    bvid: 'BV1PazvYjE22',
    cid: 39652360679,
    page: 8,
    title: '8知识点5绝对值',
    author: '心云老师',
    durationSeconds: 1039,
    focus: '本节重点：用到原点的距离理解绝对值，分清绝对值符号内外的负号。',
  },
  operations: {
    bvid: 'BV1PazvYjE22',
    cid: 39652426075,
    page: 22,
    title: '22知识点10有理数的四则混合运算',
    author: '心云老师',
    durationSeconds: 616,
    focus: '本节重点：先判断正负号，再按先乘除、后加减的顺序计算。',
  },
  expression: {
    bvid: 'BV1ji8uzyE43',
    cid: 31245405902,
    page: 1,
    title: '初一数学 3.2 代数式的值 概念+课堂练习',
    author: '胡老师初中数学',
    durationSeconds: 1042,
    focus: '本节重点：把字母换成给定的数，代入负数时加括号，再按顺序求值。',
  },
  'like-terms': {
    bvid: 'BV1h7bXzXEKe',
    cid: 31272862516,
    page: 1,
    title: '初一数学 4.2 合并同类项 概念+课堂练习',
    author: '胡老师初中数学',
    durationSeconds: 817,
    focus:
      '本节重点：先判断是不是同类项，合并时只改变系数，字母与指数保持不变。',
  },
  solve: {
    bvid: 'BV1U3tJz9EfY',
    cid: 31494440708,
    page: 1,
    title: '初一数学 5.2 解一元一次方程（1） 概念+课堂练习',
    author: '胡老师初中数学',
    durationSeconds: 526,
    focus: '本节重点：利用等式的性质求出未知数，解出后再代回原方程检验。',
  },
  'word-problems': {
    bvid: 'BV1yatqzPE14',
    cid: 31544118805,
    page: 1,
    title: '初一数学 5.3 实际问题与一元一次方程1',
    author: '胡老师初中数学',
    durationSeconds: 811,
    focus: '本节重点：设未知数、找等量关系、列方程，并检查结果是否符合实际。',
  },
  segments: {
    bvid: 'BV1UkCvBXEqy',
    cid: 34063254302,
    page: 1,
    title: '初一数学上册 6.2.2.1线段的比较与运算',
    author: '胡老师初中数学',
    durationSeconds: 566,
    focus:
      '本节视频讲线段的比较与运算。观看后，结合下方知识要点中的中点例子完成练习。',
  },
  angles: {
    bvid: 'BV1NHUhBJEUs',
    cid: 34275528603,
    page: 1,
    title: '初一数学上册 6.3.3 余角和补角',
    author: '胡老师初中数学',
    durationSeconds: 877,
    focus: '本节视频重点讲余角与补角；角的大小和角平分线可在下方知识要点回顾。',
  },
};

export function sourceUrl(video: LessonVideo): string {
  const url = new URL(`https://www.bilibili.com/video/${video.bvid}/`);
  if (video.page > 1) url.searchParams.set('p', String(video.page));
  return url.toString();
}

export function embedUrl(video: LessonVideo): string {
  const url = new URL('https://player.bilibili.com/player.html');
  url.search = new URLSearchParams({
    bvid: video.bvid,
    cid: String(video.cid),
    p: String(video.page),
    autoplay: '0',
    danmaku: '0',
    poster: '1',
  }).toString();
  return url.toString();
}

export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
