import {
  DAY,
  MODEL_VERSION,
  topicTitles,
  type EvidenceSummary,
  type Topic,
  type TopicSummary,
  type Observation,
  type Sample,
  type SkillEvidence,
} from '../../lib/evidence-contract.ts';
const topicBlank = (): TopicSummary => ({
  seenItems: [],
  taughtFamilies: [],
  diagnostics: 0,
  answered: 0,
  assisted: 0,
  candidates: {},
  recent: [],
  delayed: [],
  independentAt: null,
  contradiction: false,
  dismissed: false,
});
export const emptySummary = (): EvidenceSummary => ({
  modelVersion: MODEL_VERSION,
  throughSeq: 0,
  topics: {
    absolute: topicBlank(),
    addition: topicBlank(),
    subtraction: topicBlank(),
  },
});
export function foldEvents(
  base: EvidenceSummary,
  events: Observation[],
): EvidenceSummary {
  if (base.modelVersion !== MODEL_VERSION) throw new Error('BASELINE_VERSION');
  const s: EvidenceSummary = structuredClone(base);
  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    if (event.seq <= s.throughSeq) continue;
    s.throughSeq = event.seq;
    const t = s.topics[event.topic as Topic];
    if (!t) continue;
    const p = JSON.parse(event.payload);
    if (event.kind === 'issued') {
      if (!t.seenItems.includes(p.itemId)) t.seenItems.push(p.itemId);
      if (
        ['practice', 'diagnostic'].includes(p.purpose) &&
        !t.taughtFamilies.includes(p.familyId)
      )
        t.taughtFamilies.push(p.familyId);
    }
    if (event.kind === 'assistance' && !t.taughtFamilies.includes(p.familyId))
      t.taughtFamilies.push(p.familyId);
    if (event.kind === 'dismissed') {
      t.dismissed = true;
      for (const c of Object.values(t.candidates)) c.status = 'dismissed';
    }
    if (event.kind !== 'answered') continue;
    t.answered++;
    if (p.evidenceClass !== 'independent') t.assisted++;
    if (p.purpose === 'diagnostic') {
      t.diagnostics++;
      if (p.cause && !t.dismissed) {
        const c = t.candidates[p.cause] ?? {
          support: [],
          counter: [],
          status: 'candidate',
        };
        c.support = [...c.support, event.seq].slice(-3);
        c.status = c.support.length >= 2 ? 'supported' : 'candidate';
        t.candidates[p.cause] = c;
      }
      if (p.correct)
        for (const c of Object.values(t.candidates)) {
          c.counter = [...c.counter, event.seq].slice(-3);
          if (c.status !== 'dismissed') c.status = 'inconclusive';
        }
    }
    if (
      p.evidenceClass !== 'independent' ||
      !['pretest', 'immediate', 'delayed'].includes(p.purpose)
    )
      continue;
    const sample: Sample = {
      itemId: p.itemId,
      familyId: p.familyId,
      correct: p.correct,
      at: event.created_at,
      seq: event.seq,
      purpose: p.purpose,
    };
    if (!p.correct && t.independentAt) {
      t.contradiction = true;
      t.recent = [];
      t.delayed = [];
    }
    if (p.purpose === 'delayed') {
      if (t.independentAt && event.created_at >= t.independentAt + 7 * DAY)
        t.delayed = [...t.delayed, sample].slice(-2);
      if (
        t.delayed.length === 2 &&
        t.delayed.every((x) => x.correct) &&
        new Set(t.delayed.map((x) => x.familyId)).size >= 2
      )
        t.contradiction = false;
    } else {
      t.recent = [...t.recent, sample].slice(-3);
      if (
        t.recent.length === 3 &&
        t.recent.every((x) => x.correct) &&
        new Set(t.recent.map((x) => x.familyId)).size >= 2
      ) {
        if (!t.independentAt || t.contradiction) {
          t.independentAt = event.created_at;
          t.delayed = [];
        }
        t.contradiction = false;
      }
    }
  }
  return s;
}
export function skillStates(
  s: EvidenceSummary,
  now = Date.now(),
): SkillEvidence[] {
  return (Object.keys(topicTitles) as Topic[]).map((topic) => {
    const t = s.topics[topic];
    const delayed =
      !t.contradiction &&
      t.delayed.length === 2 &&
      t.delayed.every((x) => x.correct) &&
      new Set(t.delayed.map((x) => x.familyId)).size >= 2;
    const due = t.independentAt ? t.independentAt + 7 * DAY : null;
    const status = delayed
      ? '延迟通过'
      : t.independentAt
        ? t.contradiction || (due !== null && now >= due)
          ? '待复核'
          : '独立通过'
        : t.answered
          ? '正在练习'
          : '未评估';
    return {
      topic,
      title: topicTitles[topic],
      status,
      reviewDue: delayed ? null : due,
      independentAt: t.independentAt,
      independentCount: t.recent.length,
      assistedCount: t.assisted,
      evidence:
        status === '未评估'
          ? '还没有合适的作答证据。'
          : `最近保留 ${t.recent.length} 次独立检验；受助或熟悉题族表现 ${t.assisted} 次。跳过不算答错。`,
      hypotheses: t.candidates,
    };
  });
}
