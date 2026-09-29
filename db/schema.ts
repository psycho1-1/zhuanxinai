import {
  sqliteTable,
  integer,
  text,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const attempts = sqliteTable(
  'attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    learner: text('learner').notNull(),
    requestId: text('request_id').notNull(),
    questionId: text('question_id').notNull(),
    answer: text('answer').notNull(),
    correct: integer('correct').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_attempts_learner_question').on(
      table.learner,
      table.questionId,
      table.id,
    ),
    uniqueIndex('idx_attempts_learner_request').on(
      table.learner,
      table.requestId,
    ),
  ],
);

export const tutorLimits = sqliteTable('tutor_limits', {
  bucket: text('bucket').primaryKey(),
  window: integer('window').notNull(),
  used: integer('used').notNull(),
});

export const evidenceProfiles = sqliteTable('evidence_profiles', {
  studentName: text('student_name').notNull().default(''),
  id: text('id').primaryKey(),
  recoveryHash: text('recovery_hash').unique(),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
  legacyThrough: integer('legacy_through').notNull().default(0),
});
export const evidenceCommands = sqliteTable('evidence_commands', {
  learner: text('learner').notNull(), commandId: text('command_id').notNull(),
  hash: text('hash').notNull(), response: text('response').notNull().default('{}'),
  guard: integer('guard').notNull().default(1), createdAt: integer('created_at').notNull(),
}, (t) => [primaryKey({columns:[t.learner,t.commandId]}),check('evidence_command_guard',sql`${t.guard} = 1`)]);
export const evidencePresentations = sqliteTable('evidence_presentations', {
  id: text('id').primaryKey(), learner: text('learner').notNull(),
  itemId: text('item_id').notNull(), itemVersion: integer('item_version').notNull(),
  topic: text('topic').notNull(), purpose: text('purpose').notNull(), familyId: text('family_id').notNull(),
  status: text('status').notNull().default('active'), assistance: integer('assistance').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, t => [index('idx_presentations_learner').on(t.learner,t.createdAt),
  uniqueIndex('idx_presentations_active').on(t.learner).where(sql`${t.status} = 'active'`)]);
export const evidenceEvents = sqliteTable('evidence_events', {
  seq: integer('seq').primaryKey({autoIncrement:true}), learner: text('learner').notNull(),
  commandId: text('command_id').notNull(), kind: text('kind').notNull(),
  topic: text('topic').notNull(), presentationId: text('presentation_id'),
  payload: text('payload').notNull(), createdAt: integer('created_at').notNull(),
},t=>[index('idx_events_learner_seq').on(t.learner,t.seq),
  uniqueIndex('idx_events_command_kind').on(t.learner,t.commandId,t.kind)]);
export const evidenceSnapshots = sqliteTable('evidence_snapshots', {
  learner: text('learner').primaryKey(), modelVersion: text('model_version').notNull(),
  throughSeq: integer('through_seq').notNull(), summary: text('summary').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const evidenceBaselines = sqliteTable('evidence_baselines', {
  learner: text('learner').primaryKey(), modelVersion: text('model_version').notNull(),
  throughSeq: integer('through_seq').notNull(), summary: text('summary').notNull(), createdAt: integer('created_at').notNull(),
});
export const evidenceDeletions = sqliteTable('evidence_deletions', {
  learner: text('learner').primaryKey(), requestedAt: integer('requested_at').notNull(), completedAt: integer('completed_at'),
});
export const tutorReservations = sqliteTable('tutor_reservations', {
  id: text('id').primaryKey(), learner: text('learner').notNull(),
  status: text('status').notNull(), createdAt: integer('created_at').notNull(),
},t=>[index('idx_tutor_reservations_created').on(t.createdAt)]);

export const learningJourneys=sqliteTable('learning_journeys',{
  learner:text('learner').notNull(),lesson:text('lesson').notNull(),
  revision:integer('revision').notNull().default(0),state:text('state').notNull(),
  updatedAt:integer('updated_at').notNull(),
},t=>[primaryKey({columns:[t.learner,t.lesson]})]);

export const tutorConversations = sqliteTable('tutor_conversations', {
  id: text('id').primaryKey(), learner: text('learner').notNull(),
  lessonId: text('lesson_id').notNull(), resourceId: text('resource_id').notNull(),
  contextVersion: text('context_version').notNull(), contextSnapshot: text('context_snapshot').notNull(),
  revision: integer('revision').notNull().default(0),
  pendingRequestId: text('pending_request_id'), pendingAt: integer('pending_at'), deletedAt: integer('deleted_at'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [
  uniqueIndex('idx_course_conversation_active').on(t.learner,t.lessonId,t.resourceId).where(sql`${t.deletedAt} IS NULL`),
]);
export const tutorMessages = sqliteTable('tutor_messages', {
  seq: integer('seq').primaryKey({autoIncrement:true}), id: text('id').notNull().unique(),
  learner: text('learner').notNull(), conversationId: text('conversation_id').notNull(),
  requestId: text('request_id').notNull(), requestHash: text('request_hash').notNull(),
  role: text('role').notNull(), content: text('content').notNull(), action: text('action').notNull(),
  status: text('status').notNull(), reply: text('reply'), createdAt: integer('created_at').notNull(),
}, t => [
  uniqueIndex('idx_course_turn_role').on(t.conversationId,t.requestId,t.role),
  index('idx_course_messages').on(t.conversationId,t.learner,t.seq),
  check('course_message_role',sql`${t.role} IN ('user','assistant')`),
  check('course_message_status',sql`${t.status} IN ('pending','completed','failed','unknown')`),
]);
