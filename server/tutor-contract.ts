/** 未来 AI Tutor 的服务端契约。仅定义类型，本期没有模型调用。 */
export type TutorContext = {
  lessonId: string;
  questionId: string;
  concept: string;
  question: string;
  attempts: { answer: string; correct: boolean }[];
  hintLevel: 1 | 2 | 3;
};
export type TutorReply = {
  guidingQuestion: string;
  hint: string;
  source: 'model' | 'lesson';
};
export interface TutorProvider {
  getHint(context: TutorContext): Promise<TutorReply>;
}
