CREATE TABLE cms_admins (phone_hash text PRIMARY KEY NOT NULL, created_at integer NOT NULL);
--> statement-breakpoint
CREATE TABLE cms_courses (id text PRIMARY KEY NOT NULL, draft text NOT NULL, revision integer NOT NULL DEFAULT 0, published_version text, archived integer NOT NULL DEFAULT 0, updated_at integer NOT NULL, updated_by text NOT NULL);
--> statement-breakpoint
CREATE TABLE cms_versions (id text PRIMARY KEY NOT NULL, course_id text NOT NULL, document text NOT NULL, created_at integer NOT NULL, created_by text NOT NULL);
--> statement-breakpoint
CREATE INDEX cms_versions_course ON cms_versions(course_id, created_at);
--> statement-breakpoint
CREATE TABLE cms_assets (id text PRIMARY KEY NOT NULL, name text NOT NULL, mime text NOT NULL, bytes integer NOT NULL, object_path text NOT NULL, status text NOT NULL, created_at integer NOT NULL, created_by text NOT NULL);
--> statement-breakpoint
CREATE TABLE cms_enrollments (learner text NOT NULL, course_id text NOT NULL, version_id text NOT NULL, last_segment text NOT NULL DEFAULT '', updated_at integer NOT NULL, PRIMARY KEY(learner,course_id));
--> statement-breakpoint
CREATE TABLE cms_progress (learner text NOT NULL, version_id text NOT NULL, segment_id text NOT NULL, seconds integer NOT NULL DEFAULT 0, video_done integer NOT NULL DEFAULT 0, completed integer NOT NULL DEFAULT 0, skipped integer NOT NULL DEFAULT 0, updated_at integer NOT NULL, PRIMARY KEY(learner,version_id,segment_id));
--> statement-breakpoint
CREATE TABLE cms_answers (id text NOT NULL, learner text NOT NULL, version_id text NOT NULL, segment_id text NOT NULL, question_id text NOT NULL, answer text NOT NULL, correct integer, feedback text NOT NULL, source text NOT NULL, status text NOT NULL, created_at integer NOT NULL, PRIMARY KEY(learner,id));
--> statement-breakpoint
CREATE INDEX cms_answers_history ON cms_answers(learner,version_id,segment_id,created_at);
--> statement-breakpoint
CREATE TABLE cms_limits (bucket text PRIMARY KEY NOT NULL, "window" integer NOT NULL, used integer NOT NULL);
