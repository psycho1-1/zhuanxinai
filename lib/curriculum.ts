import { upperLessons } from './upper-lessons.ts';
// 学生可见课程。旧知识点与题目 ID 保持不变，保护已有学习记录。
export const chapters = [
  {
    id: 'rational',
    title: '有理数',
    description: '从数轴出发，认识正负数',
    symbol: '−3',
    color: 'green',
  },
  {
    id: 'arithmetic',
    title: '有理数的运算',
    description: '掌握符号、运算顺序与数的表示',
    symbol: 'aⁿ',
    color: 'blue',
  },
  {
    id: 'expressions',
    title: '代数式',
    description: '把数量关系写成式子',
    symbol: '3a',
    color: 'green',
  },
  {
    id: 'algebra',
    title: '整式的加减',
    description: '用字母表达规律',
    symbol: '2a',
    color: 'blue',
  },
  {
    id: 'equation',
    title: '一元一次方程',
    description: '让未知数变得清晰',
    symbol: 'x=?',
    color: 'orange',
  },
  {
    id: 'geometry',
    title: '几何图形初步',
    description: '发现线段与角的关系',
    symbol: '∠',
    color: 'purple',
  },
];
const originalLessons = [
  {
    id: 'number-line',
    chapterId: 'rational',
    title: '数轴与相反数',
    minutes: 6,
    concept:
      '数轴有原点、正方向和单位长度。越往右，数越大。只有符号不同的两个数互为相反数，0 的相反数还是 0。',
    example: '−4 的相反数是 4；−2 在 −5 的右边，所以 −2 > −5。',
    hint: '把数放到数轴上。相反数到原点的距离相同，方向相反。',
  },
  {
    id: 'absolute',
    chapterId: 'rational',
    title: '绝对值',
    minutes: 8,
    concept:
      '一个数的绝对值，是数轴上表示这个数的点到原点的距离。距离不能是负数，因此绝对值一定大于或等于 0。',
    example: '|−3| = 3，|3| = 3，|0| = 0。',
    hint: '先看绝对值符号里面的数，再想它到 0 的距离。注意符号外面的负号。',
  },
  {
    id: 'operations',
    chapterId: 'rational',
    title: '有理数的运算',
    minutes: 10,
    concept:
      '同号相加，取相同符号并把绝对值相加；异号相加，取绝对值较大的数的符号，再把绝对值相减。减去一个数，等于加上它的相反数。乘除先判断符号。',
    example: '−3 + 5 = 2；2 − (−4) = 6；(−2) × (−3) = 6。',
    hint: '先处理括号和符号。有乘除和加减时，先算乘除。',
  },
  {
    id: 'expression',
    chapterId: 'algebra',
    title: '代数式求值',
    minutes: 8,
    concept:
      '用字母表示数，可以把数量关系写成代数式。求值时把字母换成给定的数，再按照运算顺序计算。代入负数时要加括号。',
    example: '当 a = −2 时，3a + 5 = 3 × (−2) + 5 = −1。',
    hint: '先写出代入后的式子，再计算。2a 表示 2 × a。',
  },
  {
    id: 'like-terms',
    chapterId: 'algebra',
    title: '合并同类项',
    minutes: 8,
    concept:
      '所含字母相同，而且相同字母的指数也相同的项，叫作同类项。合并时只把系数相加，字母和指数保持不变。',
    example: '3a + 2a = (3 + 2)a = 5a；3a 与 3a² 不是同类项。',
    hint: '把字母部分看作相同的单位，只计算前面的系数。没有写出的系数是 1。',
  },
  {
    id: 'solve',
    chapterId: 'equation',
    title: '解一元一次方程',
    minutes: 10,
    concept:
      '等式两边加减同一个数，或乘除同一个非零数，等式仍然成立。解方程就是逐步把 x 单独留在一边。最后代回原方程检验。',
    example: '2x + 3 = 9 → 2x = 6 → x = 3。',
    hint: '每一步都对等式两边做相同的运算。先去掉常数项，再处理系数。',
  },
  {
    id: 'word-problems',
    chapterId: 'equation',
    title: '用方程解决问题',
    minutes: 10,
    concept:
      '先设未知数，找到题目中的相等关系，再列方程、解方程。最后检查结果的单位以及是否符合实际情境。',
    example: '3 本同价练习本共 12 元。设每本 x 元，3x = 12，所以 x = 4。',
    hint: '先找“总共”“相差”“倍数”这样的数量关系，再把它写成等式。',
  },
  {
    id: 'segments',
    chapterId: 'geometry',
    title: '线段与中点',
    minutes: 6,
    concept:
      '如果 B 在线段 AC 上，那么 AB + BC = AC。中点把线段分成相等的两段，因此每一段都是原线段长度的一半。',
    example: 'M 是 AB 的中点，AB = 10 cm，则 AM = MB = 5 cm。',
    hint: '先判断点的位置。如果是中点，两边的长度一定相等。',
  },
  {
    id: 'angles',
    chapterId: 'geometry',
    title: '角、余角与补角',
    minutes: 8,
    concept:
      '直角是 90°，平角是 180°。两个角的和等于 90°，它们互为余角；和等于 180°，它们互为补角。角平分线把一个角分成两个相等的角。',
    example: '30° 的余角是 60°，补角是 150°。',
    hint: '先确认题目说的是余角还是补角，再从 90 或 180 中减去已知角度。',
  },
] as const;
export type Lesson = {
  id: string;
  chapterId: string;
  section: string;
  title: string;
  minutes: number;
  concept: string;
  example: string;
  hint: string;
};
const originalSections: Record<string, string> = {
  'number-line': '1.2.2–1.2.3',
  absolute: '1.2.4',
  operations: '2.1–2.2 · 综合',
  expression: '3.2',
  'like-terms': '4.2',
  solve: '5.2 · 基础',
  'word-problems': '5.3 · 入门',
  segments: '6.2.2',
  angles: '6.3.3',
};
const order = [
  'signed-numbers',
  'rational-types',
  'number-line',
  'absolute',
  'compare-rationals',
  'addition',
  'subtraction',
  'multiplication',
  'division',
  'operations',
  'powers',
  'power-mixed',
  'scientific',
  'rounding',
  'number-bases',
  'algebra-model',
  'expression',
  'monomials',
  'polynomials',
  'like-terms',
  'remove-brackets',
  'polynomial-sum',
  'equation-concept',
  'equality',
  'solve',
  'equation-brackets',
  'equation-fractions',
  'word-problems',
  'applications-sales',
  'applications-travel',
  'applications-work',
  'solids',
  'nets',
  'views',
  'points-lines',
  'lines-rays',
  'segments',
  'angle-measure',
  'angle-calculation',
  'angles',
  'track-design',
];
export const lessons: Lesson[] = [
  ...originalLessons.map((lesson) => ({
    ...lesson,
    section: originalSections[lesson.id],
    chapterId:
      lesson.id === 'operations'
        ? 'arithmetic'
        : lesson.id === 'expression'
          ? 'expressions'
          : lesson.chapterId,
  })),
  ...upperLessons,
].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
export type PublicQuestion = {
  id: string;
  lessonId: string;
  prompt: string;
  unit?: string;
  options?: string[];
};

export function displayAnswer(
  question: Pick<PublicQuestion, 'options'>,
  answer: string | number,
) {
  const index = Number(answer) - 1;
  return question.options && Number.isInteger(index) && question.options[index]
    ? `${String.fromCharCode(65 + index)}. ${question.options[index]}`
    : String(answer);
}
