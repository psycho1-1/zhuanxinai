BEGIN;
SET LOCAL search_path = zhixu, pg_catalog;
CREATE TABLE IF NOT EXISTS cms_admins (phone_hash text PRIMARY KEY NOT NULL, created_at bigint NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_courses (id text PRIMARY KEY NOT NULL, draft text NOT NULL, revision bigint NOT NULL DEFAULT 0, published_version text, archived bigint NOT NULL DEFAULT 0, updated_at bigint NOT NULL, updated_by text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_versions (id text PRIMARY KEY NOT NULL, course_id text NOT NULL, document text NOT NULL, created_at bigint NOT NULL, created_by text NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cms_versions_course ON cms_versions(course_id, created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_assets (id text PRIMARY KEY NOT NULL, name text NOT NULL, mime text NOT NULL, bytes bigint NOT NULL, object_path text NOT NULL, status text NOT NULL, created_at bigint NOT NULL, created_by text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_enrollments (learner text NOT NULL, course_id text NOT NULL, version_id text NOT NULL, last_segment text NOT NULL DEFAULT '', updated_at bigint NOT NULL, PRIMARY KEY(learner,course_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_progress (learner text NOT NULL, version_id text NOT NULL, segment_id text NOT NULL, seconds bigint NOT NULL DEFAULT 0, video_done bigint NOT NULL DEFAULT 0, completed bigint NOT NULL DEFAULT 0, skipped bigint NOT NULL DEFAULT 0, updated_at bigint NOT NULL, PRIMARY KEY(learner,version_id,segment_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_answers (id text NOT NULL, learner text NOT NULL, version_id text NOT NULL, segment_id text NOT NULL, question_id text NOT NULL, answer text NOT NULL, correct bigint, feedback text NOT NULL, source text NOT NULL, status text NOT NULL, created_at bigint NOT NULL, PRIMARY KEY(learner,id));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cms_answers_history ON cms_answers(learner,version_id,segment_id,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_limits (bucket text PRIMARY KEY NOT NULL, "window" bigint NOT NULL, used bigint NOT NULL);

REVOKE ALL ON zhixu.cms_admins, zhixu.cms_courses, zhixu.cms_versions, zhixu.cms_assets, zhixu.cms_enrollments, zhixu.cms_progress, zhixu.cms_answers, zhixu.cms_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON zhixu.cms_admins, zhixu.cms_courses, zhixu.cms_versions, zhixu.cms_assets, zhixu.cms_enrollments, zhixu.cms_progress, zhixu.cms_answers, zhixu.cms_limits TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types,created_at,updated_at) VALUES ('course-media','course-media',false,314572800,ARRAY['video/mp4','video/webm','image/png','image/jpeg','image/webp'],now(),now()) ON CONFLICT(id) DO NOTHING;
COMMIT;
