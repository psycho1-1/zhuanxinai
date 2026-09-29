CREATE TABLE `learning_journeys` (
	`learner` text NOT NULL,
	`lesson` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`learner`, `lesson`)
);
