// 仅接受一个数或分数；不用 eval，输入不会作为代码执行。
export function parseAnswer(raw: string): number | null {
  const normalized = raw
    .normalize('NFKC')
    .trim()
    .replace(/[−–]/g, '-');
  if (!normalized || normalized.length > 64) return null;
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  if (!new RegExp(`^${number}(?:\\s*/\\s*${number})?$`).test(normalized))
    return null;
  const parts = normalized.split('/').map(Number);
  if (parts.length === 2 && parts[1] === 0) return null;
  const value = parts.length === 2 ? parts[0] / parts[1] : parts[0];
  return Number.isFinite(value) && Math.abs(value) <= 1e12 ? value : null;
}
export function gradeAnswer(raw: string, expected: number) {
  const value = parseAnswer(raw);
  return {
    valid: value !== null,
    correct: value !== null && Math.abs(value - expected) < 1e-9,
  };
}
