CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner` text NOT NULL,
	`request_id` text NOT NULL,
	`question_id` text NOT NULL,
	`answer` text NOT NULL,
	`correct` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_learner_question` ON `attempts` (`learner`,`question_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attempts_learner_request` ON `attempts` (`learner`,`request_id`);