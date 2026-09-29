export type Topic = 'absolute' | 'addition' | 'subtraction';
export type Purpose =
  | 'diagnostic'
  | 'practice'
  | 'pretest'
  | 'immediate'
  | 'delayed';
export type EvidenceItem = {
  id: string;
  version: number;
  topic: Topic;
  skillId: string;
  purpose: Purpose;
  familyId: string;
  prompt: string;
  answer: number;
  options?: string[];
  explanation: string;
  hint: string;
  errorMap?: Record<string, string>;
};
export type EvidencePublicItem = Omit<
  EvidenceItem,
  'answer' | 'explanation' | 'hint' | 'errorMap'
>;
export const topicTitles: Record<Topic, string> = {
  absolute: '绝对值',
  addition: '异号加法',
  subtraction: '减去负数',
};
export const purposeTitles: Record<Purpose, string> = {
  diagnostic: '理解检查',
  practice: '补救练习',
  pretest: '学习前检验',
  immediate: '独立新题',
  delayed: '七天复测',
};
export const MODEL_VERSION = 'evidence-rules-1';
export const DAY = 86400000;
export type Observation = {
  seq: number;
  learner: string;
  command_id: string;
  kind: string;
  topic: string;
  presentation_id: string | null;
  payload: string;
  created_at: number;
};
export type Sample = {
  itemId: string;
  familyId: string;
  correct: boolean;
  at: number;
  seq: number;
  purpose: Purpose;
};
export type TopicSummary = {
  seenItems: string[];
  taughtFamilies: string[];
  diagnostics: number;
  answered: number;
  assisted: number;
  candidates: Record<
    string,
    {
      support: number[];
      counter: number[];
      status: 'candidate' | 'supported' | 'inconclusive' | 'dismissed';
    }
  >;
  recent: Sample[];
  delayed: Sample[];
  independentAt: number | null;
  contradiction: boolean;
  dismissed: boolean;
};
export type EvidenceSummary = {
  topics: Record<Topic, TopicSummary>;
  throughSeq: number;
  modelVersion: string;
};
export type SkillEvidence = {
  topic: Topic;
  title: string;
  status: '未评估' | '正在练习' | '独立通过' | '待复核' | '延迟通过';
  reviewDue: number | null;
  independentAt: number | null;
  independentCount: number;
  assistedCount: number;
  evidence: string;
  hypotheses: TopicSummary['candidates'];
};
