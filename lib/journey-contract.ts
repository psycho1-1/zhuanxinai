export type JourneyPhase =
  | 'learn'
  | 'homework'
  | 'analysis'
  | 'diagnose'
  | 'remedy'
  | 'verify'
  | 'complete'
  | 'review';
export type JourneyTarget =
  | 'distance'
  | 'outer'
  | 'sum'
  | 'fraction'
  | 'uncertain'
  | 'independent';
export type JourneyObservation = {
  itemId: string;
  phase: JourneyPhase;
  correct: boolean | null;
  help: string[];
  cause: JourneyTarget | null;
  at: number;
  independent: boolean;
};
export type JourneyState = {
  sessionId: string;
  version: string;
  revision: number;
  phase: JourneyPhase;
  currentId: string | null;
  observations: JourneyObservation[];
  help: string[];
  seen: string[];
  taughtFamilies: string[];
  target: JourneyTarget;
  reason: string;
  probes: string[];
  remedies: string[];
  verification: string[];
  reviewItems: string[];
  status: 'learning' | 'independent' | 'review-needed' | 'delayed';
  reviewDue: number | null;
  ended: boolean;
  cycle: number;
  narrated?: string[];
};
export type JourneyView = {
  sessionId: string;
  available: true;
  revision: number;
  phase: JourneyPhase;
  phaseTitle: string;
  position: number;
  total: number;
  current: { id: string; prompt: string; options?: string[] } | null;
  answered: boolean;
  feedback: { correct: boolean | null; text: string } | null;
  reason: string;
  teacherMessage: string;
  status: JourneyState['status'];
  reviewDue: number | null;
  homework: { completed: number; correct: number; helped: number };
  verification: { completed: number; independentCorrect: number };
  canContinue: boolean;
  continueLabel: string;
  providerAvailable: boolean;
  canReview: boolean;
};
export const JOURNEY_VERSION = 'absolute-journey-draft-1';
export const journeyTitles: Record<JourneyPhase, string> = {
  learn: '学习这一课',
  homework: '课后练习',
  analysis: '看看下一步',
  diagnose: '再检查一小步',
  remedy: '针对性练习',
  verify: '独立试一试',
  complete: '本课学习小结',
  review: '七天后再试一试',
};
