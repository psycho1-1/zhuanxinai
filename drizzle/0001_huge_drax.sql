CREATE TABLE `tutor_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`used` integer NOT NULL
);
