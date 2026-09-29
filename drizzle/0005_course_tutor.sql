CREATE TABLE `tutor_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`learner` text NOT NULL,
	`lesson_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`context_version` text NOT NULL,
	`context_snapshot` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`pending_request_id` text,
	`pending_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_conversation_active` ON `tutor_conversations` (`learner`,`lesson_id`,`resource_id`) WHERE "tutor_conversations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE `tutor_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`learner` text NOT NULL,
	`conversation_id` text NOT NULL,
	`request_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`reply` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "course_message_role" CHECK("tutor_messages"."role" IN ('user','assistant')),
	CONSTRAINT "course_message_status" CHECK("tutor_messages"."status" IN ('pending','completed','failed','unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tutor_messages_id_unique` ON `tutor_messages` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_turn_role` ON `tutor_messages` (`conversation_id`,`request_id`,`role`);--> statement-breakpoint
CREATE INDEX `idx_course_messages` ON `tutor_messages` (`conversation_id`,`learner`,`seq`);