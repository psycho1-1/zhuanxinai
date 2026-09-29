import review from './review.json' with { type: 'json' };
import { JOURNEY_VERSION } from '../../lib/journey-contract.ts';
import { ready } from '../evidence/catalog.ts';
export function journeyReady(
  request: Request,
  config: { EVIDENCE_MODE?: string },
) {
  return (
    ready(request, config) &&
    (config.EVIDENCE_MODE === 'preview' ||
      (review.version === JOURNEY_VERSION &&
        review.status === 'approved' &&
        new Set((review.reviewedBy as string[]).filter((name) => name.trim())).size >= 2))
  );
}
