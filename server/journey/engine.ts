import { DAY } from '../../lib/evidence-contract.ts';
import {
  JOURNEY_VERSION,
  journeyTitles,
  type JourneyPhase,
  type JourneyState,
  type JourneyTarget,
  type JourneyView,
} from '../../lib/journey-contract.ts';
import { gradeAnswer, parseAnswer } from '../../lib/grading.ts';
import {
  cards,
  homeworkIds,
  itemById,
  probes,
  remedies,
  verificationIds,
  reviewIds,
} from './content.ts';
export function initialJourney(): JourneyState {
  return {
    version: JOURNEY_VERSION,
    sessionId: crypto.randomUUID(),
    revision: 0,
    phase: 'learn',
    currentId: null,
    observations: [],
    help: [],
    seen: [],
    taughtFamilies: [],
    target: 'uncertain',
    reason: '先理解绝对值与距离，再完成本课五道练习。',
    probes: [],
    remedies: [],
    verification: [],
    reviewItems: [],
    status: 'learning',
    reviewDue: null,
    ended: false,
    cycle: 0,
  };
}
const rows = (s: JourneyState, phase: JourneyPhase) =>
  s.observations.filter((o) => o.phase === phase);
export const answered = (s: JourneyState) =>
  !!s.currentId && s.observations.some((o) => o.itemId === s.currentId);
function issue(s: JourneyState, id: string, phase: JourneyPhase) {
  const repeat = s.seen.includes(id);
  s.phase = phase;
  s.currentId = id;
  s.help = [];
  s.seen.push(id);
  const family = itemById(id).family;
  if (
    (repeat || !['verify', 'review'].includes(phase)) &&
    !s.taughtFamilies.includes(family)
  )
    s.taughtFamilies.push(family);
}
function startChecks(s: JourneyState, phase: 'verify' | 'review') {
  const pool = phase === 'verify' ? verificationIds : reviewIds;
  const selected = pool.filter(
    (id) =>
      !s.seen.includes(id) && !s.taughtFamilies.includes(itemById(id).family),
  );
  if (selected.length < 3) {
    s.reason =
      '本轮没有足够的合适新题。你的练习已保存，可以继续课程，稍后再复核。';
    s.phase = 'complete';
    s.currentId = null;
    s.status = 'review-needed';
    s.reviewDue = null;
    s.ended = true;
    return;
  }
  if (phase === 'verify') s.verification = selected;
  else s.reviewItems = selected;
  issue(s, selected[0], phase);
}
function analyze(s: JourneyState) {
  const h = rows(s, 'homework'),
    wrong = h.filter((o) => o.correct !== true);
  if (!wrong.length) {
    s.target = 'independent';
    s.reason = h.some((o) => o.help.length)
      ? '五道课后题已经完成。你用过一些帮助，接下来先独立试几道新题。'
      : '五道课后题都答对了。换几种表达，看看能否自己完成。';
  } else {
    const priority: JourneyTarget[] = ['distance', 'outer', 'sum', 'fraction'];
    s.target =
      priority.find((c) => wrong.some((o) => o.cause === c)) ?? 'uncertain';
    const matched = wrong.filter((o) => o.cause === s.target);
    s.reason =
      s.target === 'uncertain'
        ? `五道题中有 ${wrong.length} 道尚未完成或答错，目前还不能确定原因。我们先检查一个小步骤。`
        : `${matched.map((o) => `第 ${homeworkIds.indexOf(o.itemId) + 1} 题`).join('、')}的作答需要再检查“${cards[s.target].title}”。这是待确认的线索，先用一道小题看看。`;
  }
  s.probes = [...probes[s.target]];
  s.remedies = [...remedies[s.target]];
  s.phase = 'analysis';
  s.currentId = null;
}
export type JourneyAction =
  | 'continue'
  | 'answer'
  | 'skip'
  | 'dismiss'
  | 'pause'
  | 'review';
export function advance(
  input: JourneyState,
  action: JourneyAction,
  answer?: string,
  now = Date.now(),
): JourneyState {
  const s = structuredClone(input);
  if (s.version !== JOURNEY_VERSION) throw new Error('FLOW_VERSION');
  if (action === 'pause') {
    s.ended = true;
    return s;
  }
  if (action === 'review') {
    if (
      s.phase !== 'complete' ||
      s.reviewDue === null ||
      now < s.reviewDue ||
      s.status === 'delayed'
    )
      throw new Error('REVIEW_NOT_DUE');
    s.cycle++;
    s.ended = false;
    startChecks(s, 'review');
    return s;
  }
  if (action === 'dismiss') {
    if (!['analysis', 'diagnose', 'remedy'].includes(s.phase))
      throw new Error('INVALID_STEP');
    s.reason =
      '已记录你的反馈，不再沿用这个错误候选。先独立试几道新题，或者返回课程。';
    s.target = 'independent';
    startChecks(s, 'verify');
    return s;
  }
  if (action === 'answer' || action === 'skip') {
    if (!s.currentId || answered(s)) throw new Error('ALREADY_ANSWERED');
    const q = itemById(s.currentId),
      graded = action === 'skip' ? null : gradeAnswer(answer ?? '', q.answer);
    if (graded && !graded.valid) throw new Error('INVALID_ANSWER');
    if (
      action === 'answer' &&
      q.options &&
      !q.options.some((_, i) => answer === String(i + 1))
    )
      throw new Error('INVALID_ANSWER');
    const cause =
      action === 'skip' || graded?.correct
        ? null
        : (q.errors?.[String(parseAnswer(answer ?? ''))] ??
          (s.phase === 'homework' && q.id === 'absolute-3'
            ? 'sum'
            : s.phase === 'homework' && q.id === 'absolute-5'
              ? 'fraction'
              : null));
    s.observations.push({
      itemId: q.id,
      phase: s.phase,
      correct: graded?.correct ?? null,
      help: [...s.help],
      cause,
      at: now,
      independent:
        action === 'answer' &&
        ['verify', 'review'].includes(s.phase) &&
        !s.help.length &&
        !s.taughtFamilies.includes(q.family),
    });
    if (s.phase === 'homework' && rows(s, 'homework').length === 5) analyze(s);
    return s;
  }
  if (action !== 'continue') throw new Error('INVALID_STEP');
  s.ended = false;
  if (s.phase === 'learn') {
    issue(s, homeworkIds[0], 'homework');
    return s;
  }
  if (s.phase === 'analysis') {
    if (s.target === 'independent') startChecks(s, 'verify');
    else issue(s, s.probes[0], 'diagnose');
    return s;
  }
  if (s.phase === 'complete') return s;
  if (!answered(s)) throw new Error('ANSWER_FIRST');
  if (s.phase === 'homework') {
    issue(s, homeworkIds[rows(s, 'homework').length], 'homework');
    return s;
  }
  if (s.phase === 'diagnose') {
    const d = rows(s, 'diagnose');
    // A first probe about magnitude may show that a more basic distance step is missing.
    if (
      d.length === 1 &&
      d[0].cause === 'distance' &&
      s.target !== 'distance'
    ) {
      s.target = 'distance';
      s.probes = [d[0].itemId, 'jx-notation-probe'];
      s.remedies = [...remedies.distance];
      s.reason =
        '刚才这一步也把距离写成了负数。先把位置与距离分开，再看原来的题目。';
    }
    if (d.length < 2) {
      issue(s, s.probes[d.length], 'diagnose');
      return s;
    }
    if (d.every((o) => o.correct === true && o.help.length === 0)) {
      s.reason =
        '这两步都能自己完成，目前不支持原来的错误候选。直接用新题再检查。';
      startChecks(s, 'verify');
    } else {
      if (d.every((o) => o.correct === false))
        s.reason = '刚才两次小检查都需要帮助。先练同一个小步骤，再用新题检查。';
      issue(s, s.remedies[0], 'remedy');
    }
    return s;
  }
  if (s.phase === 'remedy') {
    const n = rows(s, 'remedy').length;
    if (n < 2) issue(s, s.remedies[n], 'remedy');
    else startChecks(s, 'verify');
    return s;
  }
  const phase = s.phase as 'verify' | 'review',
    checked = rows(s, phase),
    list = phase === 'verify' ? s.verification : s.reviewItems;
  if (checked.length < list.length) {
    issue(s, list[checked.length], phase);
    return s;
  }
  const passed =
    checked.length >= 3 &&
    checked.every((o) => o.correct === true && o.independent) &&
    new Set(checked.map((o) => itemById(o.itemId).family)).size >= 2;
  s.status = passed
    ? phase === 'review' && s.status === 'independent'
      ? 'delayed'
      : 'independent'
    : 'review-needed';
  s.reviewDue = phase === 'verify' ? now + 7 * DAY : null;
  s.phase = 'complete';
  s.currentId = null;
  s.ended = true;
  s.reason = passed
    ? '这轮新题都能独立完成。今天的学习先到这里，之后再检查是否还记得。'
    : '本轮练习已保存，还有一些步骤需要复核。今天不再追加题目，可以回看讲解或稍后请老师帮助。';
  return s;
}
export function addHelp(input: JourneyState, kind: string): JourneyState {
  const s = structuredClone(input);
  if (kind === 'tutor-intro')
    s.narrated = [...new Set([...(s.narrated ?? []), `${s.phase}:${s.cycle}`])];
  if (s.currentId) {
    if (!answered(s) && !s.help.includes(kind)) s.help.push(kind);
    const family = itemById(s.currentId).family;
    if (!s.taughtFamilies.includes(family)) s.taughtFamilies.push(family);
  }
  return s;
}
export function view(s: JourneyState, providerAvailable = false): JourneyView {
  const q = s.currentId ? itemById(s.currentId) : null,
    o = s.observations.find((o) => o.itemId === s.currentId),
    h = rows(s, 'homework');
  const phaseRows = rows(s, s.phase),
    total =
      s.phase === 'homework'
        ? 5
        : s.phase === 'diagnose' || s.phase === 'remedy'
          ? 2
          : 3;
  let note = s.reason;
  if (s.phase === 'learn')
    note =
      '先看视频或知识要点，已经理解也可以直接做题。做完五道课后题，我会结合这一组作答安排下一步。';
  if (s.phase === 'remedy') note = cards[s.target].text;
  if (s.phase === 'verify' || s.phase === 'review')
    note = '先自己想一想。需要帮助时仍然可以提问，这次会记为受助练习。';
  if (s.phase === 'complete' && s.status === 'delayed')
    note = '这次隔天的新题检查也完成了。接下来可以继续学习其他知识点。';
  return {
    available: true,
    sessionId: s.sessionId,
    revision: s.revision,
    phase: s.phase,
    phaseTitle: journeyTitles[s.phase],
    position: Math.min(total, phaseRows.length + (o ? 0 : 1)),
    total,
    current: q
      ? {
          id: q.id,
          prompt: q.prompt,
          ...(q.options ? { options: q.options } : {}),
        }
      : null,
    answered: !!o,
    feedback: o
      ? {
          correct: o.correct,
          text:
            o.correct === null
              ? '已跳过，不计为答错。'
              : ['verify', 'review'].includes(s.phase)
                ? '作答已保存，完成这一组后一起看结果。'
                : q!.explanation,
        }
      : null,
    reason: s.reason,
    teacherMessage: note,
    status: s.status,
    reviewDue: s.reviewDue,
    homework: {
      completed: h.length,
      correct: h.filter((o) => o.correct === true).length,
      helped: h.filter((o) => o.help.length > 0).length,
    },
    verification: {
      completed: rows(s, 'verify').length,
      independentCorrect: rows(s, 'verify').filter(
        (o) => o.correct === true && o.independent,
      ).length,
    },
    canContinue: !q || !!o,
    continueLabel:
      s.phase === 'learn'
        ? '开始课后练习'
        : s.phase === 'analysis'
          ? s.target === 'independent'
            ? '独立试一试'
            : '开始小检查'
          : phaseRows.length === total
            ? '看看下一步'
            : '下一道题',
    providerAvailable,
    canReview:
      s.phase === 'complete' &&
      s.reviewDue !== null &&
      Date.now() >= s.reviewDue &&
      s.status !== 'delayed',
  };
}
