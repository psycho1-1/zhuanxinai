import draft from './content-draft.json' with { type: 'json' };
import type {
  EvidenceItem,
  EvidencePublicItem,
  Topic,
} from '../../lib/evidence-contract.ts';
export const catalog = draft as unknown as {
  skills: { id: string; title: string; observableTask: string }[];
  items: EvidenceItem[];
  interventions: {
    topic: Topic;
    id: string;
    title: string;
    text: string;
    alternateText: string;
  }[];
  review: { status: string; reviewedBy: string[] };
};
export const CONTENT_VERSION = 'rational-draft-1';
export const items = catalog.items;
export function getItem(id: string, version = 1) {
  return items.find((i) => i.id === id && i.version === version);
}
export function publicItem(i: EvidenceItem): EvidencePublicItem {
  const {
    answer: _answer,
    explanation: _explanation,
    hint: _hint,
    errorMap: _errorMap,
    ...safe
  } = i;
  return safe;
}
export const assessment = (purpose: string) =>
  ['pretest', 'immediate', 'delayed'].includes(purpose);
export function ready(request: Request, config: { EVIDENCE_MODE?: string }) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(request.url).hostname,
  );
  return (
    (config.EVIDENCE_MODE === 'preview' && local) ||
    (config.EVIDENCE_MODE === 'pilot' &&
      catalog.review.status === 'approved' &&
      catalog.review.reviewedBy.length >= 2)
  );
}
