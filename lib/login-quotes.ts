export const LOGIN_QUOTES = [
  ['付诸行动，', '就是好的开始。'],
  ['不必等准备完美，', '先迈出第一步。'],
  ['把想法变成行动，', '让今天有所不同。'],
  ['慢一点也没关系，', '向前就有意义。'],
  ['每一次认真，', '都在靠近想去的地方。'],
  ['答案未必立刻出现，', '探索本身就有价值。'],
  ['从能做到的小事开始，', '让改变慢慢发生。'],
  ['为好奇留一点空间，', '为行动留一点时间。'],
];

export function nextQuoteIndex(previous: number, random = Math.random()) {
  const count = LOGIN_QUOTES.length;
  if (!Number.isInteger(previous) || previous < 0 || previous >= count)
    return Math.floor(random * count);
  return (previous + 1 + Math.floor(random * (count - 1))) % count;
}
