import { questions } from '../questions.ts';
import { items as existingItems } from '../evidence/catalog.ts';
import type { JourneyTarget } from '../../lib/journey-contract.ts';
export type FlowItem = {
  id: string;
  prompt: string;
  answer: number;
  family: string;
  hint: string;
  explanation: string;
  options?: string[];
  errors?: Record<string, JourneyTarget>;
};
const homework = questions
  .filter((q) => q.lessonId === 'absolute')
  .map(
    (q, i): FlowItem => ({
      ...q,
      family: [
        'abs.direct-literal',
        'abs.direct-literal',
        'abs.sum',
        'abs.outer-negative',
        'abs.direct-literal',
      ][i],
      hint:
        i === 3
          ? '先算绝对值符号里面的一步，再看看符号外还有什么。'
          : '先想一想，到原点的距离是多少。',
      errors: [
        { '-8': 'distance' },
        {},
        { '-1': 'sum', '1': 'sum' },
        { '6': 'outer' },
        { '-0.5': 'fraction' },
      ][i] as Record<string, JourneyTarget>,
    }),
  );
const extra: FlowItem[] = [
  {
    id: 'jx-distance-probe',
    prompt: '数轴上，点 A 在 −5。A 到原点的距离是多少？',
    answer: 5,
    family: 'abs.origin-distance',
    hint: '位置可以在左边，距离表示相隔几格。',
    explanation: '−5 表示位置在原点左边；到原点相隔 5 个单位，距离为 5。',
    errors: { '-5': 'distance' },
  },
  {
    id: 'jx-notation-probe',
    prompt: '|−4| 表示哪一个量？',
    answer: 2,
    options: ['点 −4 的位置', '点 −4 到原点的距离', '点 −4 左边的点'],
    family: 'abs.definition-choice',
    hint: '绝对值描述的是距离。',
    explanation: '|−4| 表示点 −4 到原点的距离。',
    errors: { '1': 'distance' },
  },
  {
    id: 'jx-outer-probe',
    prompt: '在 −|−7| 中，先算 |−7|，这一步的结果是多少？',
    answer: 7,
    family: 'abs.direct-literal',
    hint: '先只看绝对值符号内的 −7。',
    explanation: '|−7|=7，外面的负号留到下一步处理。',
    errors: { '-7': 'distance' },
  },
  {
    id: 'jx-outer-scope-probe',
    prompt: '如果 |−7| 已经算成 7，那么 −|−7| 最后等于多少？',
    answer: -7,
    family: 'abs.outer-negative',
    hint: '将 |−7| 整体替换成 7，外面的负号仍保留。',
    explanation: '外面的负号保留，所以 −|−7|=−7。',
    errors: { '7': 'outer' },
  },
  {
    id: 'jx-sum-probe',
    prompt: '在 |−4|+|1| 中，只计算 |−4|，结果是多少？',
    answer: 4,
    family: 'abs.direct-literal',
    hint: '先计算每一部分的绝对值。',
    explanation: '|−4|=4，再计算另一个绝对值。',
    errors: { '-4': 'distance' },
  },
  {
    id: 'jx-sum-step-probe',
    prompt: '已知 |−4|=4，|1|=1，那么 |−4|+|1| 等于多少？',
    answer: 5,
    family: 'abs.sum',
    hint: '把两部分结果相加。',
    explanation: '两部分分别为 4 和 1，4+1=5。',
    errors: { '3': 'sum' },
  },
  {
    id: 'jx-fraction-probe',
    prompt: '数轴上，−1/2 到原点的距离是多少？',
    answer: 0.5,
    family: 'abs.origin-distance',
    hint: '原点左边半格到原点，相隔多远？',
    explanation: '相隔半个单位，距离是 1/2，也就是 0.5。',
    errors: { '-0.5': 'distance' },
  },
  {
    id: 'jx-fraction-notation-probe',
    prompt: '0.5 和 1/2 表示同一个数吗？',
    answer: 1,
    options: ['是', '不是'],
    family: 'number.fraction-decimal',
    hint: '一半也可以写成零点五。',
    explanation: '1÷2=0.5，两种写法表示同一个数。',
  },
  {
    id: 'jx-distance-practice-1',
    prompt: '点 B 在数轴的 −6 处。B 到原点的距离是多少？',
    answer: 6,
    family: 'abs.origin-distance',
    hint: '数一数到原点相隔几个单位。',
    explanation: '位置是 −6，到原点的距离是 6。',
  },
  {
    id: 'jx-distance-practice-2',
    prompt: '|−9| 等于多少？',
    answer: 9,
    family: 'abs.direct-literal',
    hint: '−9 到原点的距离是多少？',
    explanation: '−9 到原点的距离是 9，所以 |−9|=9。',
  },
  {
    id: 'jx-outer-practice-1',
    prompt: '−|−3| 等于多少？',
    answer: -3,
    family: 'abs.outer-negative',
    hint: '先算 |−3|=3，再保留外面的负号。',
    explanation: '−|−3|=−3，绝对值符号外的负号没有消失。',
  },
  {
    id: 'jx-outer-practice-2',
    prompt: '−|5| 等于多少？',
    answer: -5,
    family: 'abs.outer-negative',
    hint: '先算 |5|，再处理前面的负号。',
    explanation: '|5|=5，所以 −|5|=−5。',
  },
  {
    id: 'jx-sum-practice-1',
    prompt: '|−6|+|1| 等于多少？',
    answer: 7,
    family: 'abs.sum',
    hint: '先分别算两个绝对值，再相加。',
    explanation: '6+1=7。',
  },
  {
    id: 'jx-sum-practice-2',
    prompt: '|−2|+|−5| 等于多少？',
    answer: 7,
    family: 'abs.sum',
    hint: '两个绝对值都是到原点的距离。',
    explanation: '|−2|=2，|−5|=5，2+5=7。',
  },
  {
    id: 'jx-fraction-practice-1',
    prompt: '|−1/4| 等于多少？',
    answer: 0.25,
    family: 'abs.direct-literal',
    hint: '距离是四分之一个单位，可以写成 1/4。',
    explanation: '|−1/4|=1/4=0.25。',
  },
  {
    id: 'jx-fraction-practice-2',
    prompt: '|−0.75| 等于多少？',
    answer: 0.75,
    family: 'abs.direct-literal',
    hint: '小数的位置也有到原点的距离。',
    explanation: '|−0.75|=0.75。',
  },
  // These reserved structures are never selected for diagnosis or remediation.
  {
    id: 'zx-absolute-immediate-03',
    prompt: '一个负数的绝对值是 6，这个数是多少？',
    answer: -6,
    family: 'abs.inverse-signed',
    hint: '想一想到原点相距 6 的位置，哪一个在负方向？',
    explanation: '这个数是 −6。',
  },
  {
    id: 'zx-absolute-immediate-04',
    prompt: '比较 |−8| 和 |5|，哪一个更大？',
    answer: 1,
    options: ['|−8| 更大', '|5| 更大', '一样大'],
    family: 'abs.compare-magnitudes',
    hint: '分别想两个距离，再比较。',
    explanation: '8 大于 5，所以 |−8| 更大。',
  },
  {
    id: 'jx-verify-zero',
    prompt: '绝对值等于 0 的数，一共有几个？',
    answer: 1,
    family: 'abs.zero-solution-count',
    hint: '到原点距离为零的位置有几个？',
    explanation: '只有 0 的绝对值为 0，共一个数。',
  },
  {
    id: 'zx-absolute-delayed-03',
    prompt: '一个负数的绝对值是 9，这个数是多少？',
    answer: -9,
    family: 'abs.inverse-signed',
    hint: '想一想到原点距离为 9 的负数。',
    explanation: '这个数是 −9。',
  },
  {
    id: 'zx-absolute-delayed-04',
    prompt: '比较 |−3| 和 |−10|，哪一个更大？',
    answer: 2,
    options: ['|−3| 更大', '|−10| 更大', '一样大'],
    family: 'abs.compare-magnitudes',
    hint: '分别比较到原点的两个距离。',
    explanation: '10 大于 3，所以 |−10| 更大。',
  },
  {
    id: 'jx-review-zero',
    prompt: '绝对值为 0 的正数，一共有几个？',
    answer: 0,
    family: 'abs.zero-solution-count',
    hint: '先找到绝对值为零的数，再判断它是不是正数。',
    explanation: '只有 0 的绝对值为零，0 不是正数，因此是 0 个。',
  },
];
// Shared assessment IDs always use the existing canonical version.
export const flowItems = [
  ...homework,
  ...extra.map((q) => {
    const old = existingItems.find((i) => i.id === q.id);
    return old
      ? {
          ...q,
          prompt: old.prompt,
          answer: old.answer,
          options: old.options,
          hint: old.hint,
          explanation: old.explanation,
          family: old.familyId,
        }
      : q;
  }),
];
export const homeworkIds = homework.map((q) => q.id);
export const verificationIds = [
  'zx-absolute-immediate-03',
  'zx-absolute-immediate-04',
  'jx-verify-zero',
];
export const reviewIds = [
  'zx-absolute-delayed-03',
  'zx-absolute-delayed-04',
  'jx-review-zero',
];
export const itemById = (id: string) => {
  const q = flowItems.find((q) => q.id === id);
  if (!q) throw new Error('CONTENT_UNAVAILABLE');
  return q;
};
export const probes: Record<JourneyTarget, string[]> = {
  distance: ['jx-distance-probe', 'jx-notation-probe'],
  outer: ['jx-outer-probe', 'jx-outer-scope-probe'],
  sum: ['jx-sum-probe', 'jx-sum-step-probe'],
  fraction: ['jx-fraction-probe', 'jx-fraction-notation-probe'],
  uncertain: ['jx-distance-probe', 'jx-notation-probe'],
  independent: [],
};
export const remedies: Record<JourneyTarget, string[]> = {
  distance: ['jx-distance-practice-1', 'jx-distance-practice-2'],
  outer: ['jx-outer-practice-1', 'jx-outer-practice-2'],
  sum: ['jx-sum-practice-1', 'jx-sum-practice-2'],
  fraction: ['jx-fraction-practice-1', 'jx-fraction-practice-2'],
  uncertain: ['jx-distance-practice-1', 'jx-distance-practice-2'],
  independent: [],
};
export const cards: Record<
  JourneyTarget,
  { title: string; text: string; alternate: string }
> = {
  distance: {
    title: '分清位置与距离',
    text: '−5 是数轴上的位置，表示在原点左边 5 格。距离回答“相隔多远”，所以是 5。绝对值表示到原点的距离。',
    alternate:
      '把原点想成家，往左走 5 格，你离家仍是 5 格。左右决定位置的符号，走了多远用距离表示。',
  },
  outer: {
    title: '看清负号在里面还是外面',
    text: '先把绝对值当成一个整体：|−6|=6。再看整体外面的负号，−|−6|=−6。外面的负号要留到下一步。',
    alternate:
      '把 |−6| 暂时记成一个方框。方框算出 6 后，原式是“负的方框”，所以是 −6。',
  },
  sum: {
    title: '先分别求距离，再相加',
    text: '|−3|+|2| 要分成两步：先求两个绝对值，得到 3 和 2；再计算 3+2。',
    alternate:
      '先在每个绝对值下写出结果，再把原来的加号抄下来。不要把绝对值里面的负号直接拿出来相加。',
  },
  fraction: {
    title: '分数和小数也表示距离',
    text: '−1/2 在原点左边半格，到原点的距离是 1/2，也就是 0.5。因此 |−1/2|=1/2。',
    alternate:
      '把一个单位平均分成两格，半个单位就是一格。到原点相隔半个单位，可以写成 1/2 或 0.5。',
  },
  uncertain: {
    title: '先从一个小步骤开始',
    text: '目前还不能确定卡在哪一步。先分别看数轴上的位置和到原点的距离，再看绝对值符号的含义。',
    alternate:
      '先找原点，再数相隔几个单位。我们只看这一小步，暂时不做复杂计算。',
  },
  independent: {
    title: '用新题检查理解',
    text: '课后练习已完成，接下来换几种表达方式，先自己试一试。',
    alternate: '可以在纸上画数轴，先写出自己的想法。',
  },
};
