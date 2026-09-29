CREATE TABLE `evidence_baselines` (
	`learner` text PRIMARY KEY NOT NULL,
	`model_version` text NOT NULL,
	`through_seq` integer NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evidence_commands` (
	`learner` text NOT NULL,
	`command_id` text NOT NULL,
	`hash` text NOT NULL,
	`response` text DEFAULT '{}' NOT NULL,
	`guard` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`learner`, `command_id`),
	CONSTRAINT "evidence_command_guard" CHECK("evidence_commands"."guard" = 1)
);
--> statement-breakpoint
CREATE TABLE `evidence_deletions` (
	`learner` text PRIMARY KEY NOT NULL,
	`requested_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `evidence_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner` text NOT NULL,
	`command_id` text NOT NULL,
	`kind` text NOT NULL,
	`topic` text NOT NULL,
	`presentation_id` text,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_learner_seq` ON `evidence_events` (`learner`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_command_kind` ON `evidence_events` (`learner`,`command_id`,`kind`);--> statement-breakpoint
CREATE TABLE `evidence_presentations` (
	`id` text PRIMARY KEY NOT NULL,
	`learner` text NOT NULL,
	`item_id` text NOT NULL,
	`item_version` integer NOT NULL,
	`topic` text NOT NULL,
	`purpose` text NOT NULL,
	`family_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`assistance` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_presentations_learner` ON `evidence_presentations` (`learner`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_presentations_active` ON `evidence_presentations` (`learner`) WHERE "evidence_presentations"."status" = 'active';--> statement-breakpoint
CREATE TABLE `evidence_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_hash` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_profiles_recovery_hash_unique` ON `evidence_profiles` (`recovery_hash`);--> statement-breakpoint
CREATE TABLE `evidence_snapshots` (
	`learner` text PRIMARY KEY NOT NULL,
	`model_version` text NOT NULL,
	`through_seq` integer NOT NULL,
	`summary` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tutor_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`learner` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tutor_reservations_created` ON `tutor_reservations` (`created_at`);