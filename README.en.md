# Zhuanxin AI (砖芯 AI)

[简体中文](README.md) | English

Source repository for https://zhuanxinai.com. The live website runs on Tencent CloudBase; pushing to GitHub does not automatically update the live service.

## Current version

- Phone verification code and password login, student names, and account-isolated data.
- My Courses: filter published courses by mathematics, physics, or chemistry and Grade 7, Grade 8, or Grade 9.
- Administration: course drafts, publishing, recycle bin, media library, and learning activity.
- React + TypeScript + Vinext/Vite; production uses Node.js on Tencent Cloud and accesses CloudBase PostgreSQL through HTTPS RPC.
- AI tutoring interfaces are included. Real model calls depend on server configuration; inclusion does not mean activation.

This repository contains code, static assets, and database structure, not student data, uploaded videos, runtime databases, or cloud keys. Configure server keys through deployment environment variables, never in source code.

Node.js 24 is recommended. After installing dependencies, use `npm run dev` for development and `npm run build` to build. Configure local and production authentication, databases, and cloud resources separately. Local execution does not copy production student data.

## Historical design and development notes

The following documentation describes earlier versions. Some anonymous-login, D1, and course-coverage descriptions have been superseded. Use current code and cloud configuration as the deployment reference.

# Zhuanxin AI · Grade 7 Mathematics MVP

A website for studying concepts, watching videos, answering questions, automatic grading, progress tracking, and correcting mistakes. This version follows the main concepts and two integrated practice activities in the 2024 People's Education Press Grade 7 first-semester textbook: 6 chapters, 41 lessons, and 205 original basic exercises. Each lesson includes video references, key points, examples, and five questions. Second-semester and other-grade content has not yet been added in this version. This foundational course is not complete textbook instruction or a teacher-reviewed question bank.

## Try it first

Select “Start learning” → watch the video (expand key points if needed) → enter an answer → read the explanation → finish the round → correct mistakes in the mistake notebook → check progress.

- Supports integers, decimals, negatives, fractions, and full-width digits, such as `−3`, `0.5`, and `1/2`.
- Supports single-choice concept and algebraic-expression questions. Existing numerical question IDs and answers remain unchanged.
- Reference answers stay on the server. Grading and explanations return only after submission.
- SQLite/D1 preserves learning records across page refreshes.
- This historical version uses anonymous cookies without student names, phone numbers, or registration forms. Clearing cookies or changing browsers/devices does not automatically restore the previous identity. Cookies last 180 days and renew on visits.
- Correctly answered mistakes become “Corrected,” preserving history. A later incorrect answer returns them to “Needs review.”
- The DeepSeek interface and AI Tutor panel are implemented. Real calls require a server key and activation; see `docs/AI接入指南.md`. “Give me a hint” still uses free, fixed course hints.

## Technology: what each tool does

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Pages | React + TypeScript | Organize components and reduce field errors with types |
| Full-stack framework | Vinext (Next.js-style App Router) + Vite | Run pages/APIs and generate deployment artifacts |
| Interface | CSS / Tailwind + Shadcn / Base UI + Lucide | Consistent styling, accessible tabs, progress bars, and icons |
| Server | TypeScript + Cloudflare Workers | Validate input, grade answers, and read/write records |
| Database | Local SQLite / hosted D1 | Preserve actual answer history |
| Migrations | Drizzle Kit | Create/upgrade tables with versioned SQL |
| Tests | Node test runner + HTTP integration checks | Verify grading, mastery, persistence, and isolation |

The first version maintains one TypeScript stack rather than separate Python backend and frontend services. Variables, conditions, functions, and data structures you are learning still apply. An independent Python algorithm service can be added later without rewriting the pages.

Vinext uses a beta version in this MVP. Evaluate stability and access speed for Chinese users before expanding the service. Exact versions are in package.json and package-lock.json.

## Running locally (Windows)

Open PowerShell in the project folder. Node.js 24 LTS is recommended; tests require direct TypeScript execution support.

Initial setup:

```powershell
npm ci
npm run db:setup
npm run dev
```

Open the Local address printed in the terminal, usually http://localhost:3000. Keep the terminal running for automatic updates after code changes. Ctrl+C stops the service.

Subsequent runs only need `npm run dev`. After adding database structure, run `npm run db:generate`, review the SQL, then run `npm run db:setup`.

`db:setup` only changes the local database, not production records. In this historical setup, files are in Git-ignored `.wrangler/state/`; preserve that directory to retain local records. Production D1 and the local database are independent and do not automatically copy data.

This historical local setup needs no API key, Cloudflare account, or paid model by default. Initial dependency installation requires network access.

## Project layout

```text
math-garden/
├─ app/
│  ├─ page.tsx                 Entry point loading the learning interface
│  ├─ layout.tsx               Title, language, and global style entry
│  ├─ globals.css              Colors, spacing, and mobile layout
│  └─ api/learning/route.ts     GET records; POST grading and persistence
├─ components/
│  ├─ learning-app.tsx         Learning path, practice, mistakes, progress
│  └─ ui/                     Reusable UI components
├─ lib/
│  ├─ curriculum.ts            Units, concepts, explanations, examples, hints
│  ├─ grading.ts               Numerical parsing and grading rules
│  ├─ progress.ts              Basic mastery algorithm and shared types
│  └─ utils.ts                 UI helpers
├─ server/
│  ├─ questions.ts             Server question bank and reference answers
│  └─ tutor-contract.ts        Future AI Tutor type contracts
├─ db/
│  ├─ schema.ts                Answer record schema
│  ├─ index.ts                 D1 access entry
│  ├─ env.d.ts                 Database binding types
│  └─ setup.mjs                Local database initialization
├─ drizzle/                    SQL migrations and version metadata
├─ tests/
│  ├─ core.test.mjs            Grading, question integrity, mastery checks
│  └─ api.mjs                  Real API and database workflow checks
├─ docs/入门与扩展.md           Guided code reading and modification
├─ public/favicon.svg          Website icon
├─ .openai/hosting.json         Sites identifier and logical DB binding
├─ wrangler.local.json         Local D1 config (placeholder, not credentials)
├─ vite.config.ts              Development, build, and Workers config
├─ package.json                Dependencies and commands
└─ package-lock.json           Locked dependencies for reproducibility
```

## Data flow

```text
Student enters an answer
  → Page sends POST /api/learning
  → Server validates learner identity, origin, question, and numerical format
  → Server checks the reference answer and grades the response
  → Prepared SQL saves the attempt
  → Returns correctness, the correct answer, and explanation
  → Page reloads records and updates mistakes and mastery
```

Each `attempts` row contains an auto-incrementing ID, anonymous learner identity, request ID, question ID, submitted answer, correctness, and timestamp.

Full answer history is preserved. Concept mastery uses each question's latest result. Repeated network requests share a request ID; a unique database index prevents duplicate scoring. Queries filter by each learner's anonymous identity.

## Mastery rules

Mastery = distinct questions whose latest answer is correct ÷ total questions for that concept.

- No questions attempted: Not started.
- Some distinct questions unattempted: In progress.
- All attempted, at least 80%: Basic mastery.
- All attempted, below 80%: Needs review.

One correct answer out of five gives 20%; repeating the same correct answer still gives 20%. Four correct answers with the fifth unattempted gives 80% but remains “In progress.”

This is a transparent basic indicator, not a scientifically validated ability diagnosis. “Questions practiced” counts distinct questions; total attempts and accuracy include repeats. Date statistics use Beijing time.

## Check commands

```powershell
npm test
npm run typecheck
npm run build
```

Keep the development server running and use another terminal:

```powershell
npm run test:api
```

Integration checks create new anonymous test identities and write only local test records, separate from the browser's learner identity.

For local production-mode checks, stop the development server after building, run `npm start`, and open the printed address. The historical publishing workflow uses Sites: preserve the precise code version, package Workers artifacts and migrations, then publish to the confirmed audience. An HTML-only static archive cannot deploy this database-backed version.

## Scope of this phase

At this historical stage, there were no complete accounts, cross-device synchronization, teacher dashboard, course editor, payments, or complete K–12 curriculum. DeepSeek chat requires a server key and activation switch. Grade 7 first-semester basics follow the specified textbook but still need mathematics-teacher review. Numerical and single-choice automatic grading does not replace evaluation of a full solution.

Suggested next steps: edit an explanation in lib/curriculum.ts and observe the page, then read docs/入门与扩展.md to understand an entire answer-submission request.

## Video explanations (2026-09-10)

Each concept has a video: watch on the left and practice on the right; phones show video before exercises. Lists display actual durations. Original concepts and examples remain under “Key points for this lesson.”

- `lib/lesson-videos.ts`: concept/video mappings with author, title, duration, BVID, episode, and CID.
- `components/video-lesson.tsx`: official player, source link, reload control, and key points.
- `docs/视频来源.md`: selected videos and verification notes.

Videos use Bilibili's official embedded player without downloading or rehosting files. Autoplay and bullet comments default to off; player fullscreen is supported. If playback fails or login is required, use “Watch on Bilibili.” Watching does not directly increase mastery; answers determine mastery.

Add video mappings when adding concepts; `npm test` detects omissions. Episodes must use their actual CID, not just lesson numbers in titles, to avoid the wrong chapter playing.

## Maintaining Grade 7 first-semester content

On 2026-09-11, the absolute-value learning flow was integrated at `/?lesson=absolute`: analysis after five practice questions, up to two follow-up questions, two remedial exercises, an independent check, and a seven-day review. AI uses the actual stage and answer summary. This remained a local review preview; other lessons kept their original flow. Migration 0004 was added. See [Learning journey implementation and acceptance](docs/journey/实施与验收.md) for scope, startup, and checks.

On 2026-09-11, learning-evidence development preview `/evidence` was added. Set `EVIDENCE_MODE=preview` in local `.dev.vars`, run `npm run db:setup`, then start. Acceptance uses `npm run test:evidence-api`; content still needs teacher review. See [Learning evidence handoff and acceptance](docs/evidence/交接与验收.md) for scope and remaining work.

- `lib/upper-lessons.ts`: original key points, examples, hints, and textbook subsection numbers for 32 new lessons.
- `server/upper-bank.ts`: 160 new questions and explanations. Optional `options` denotes single-choice; reference answers are one-based option indexes stored only on the server.
- `lib/upper-videos.ts`: new video references with verified episode metadata. One topic video may serve related lessons; practical lessons combine basic review videos and on-site activities.
- `components/lesson-visual.tsx`: SVG geometry, angle sliders, binary decomposition, and simplified running-track calculations.
- `docs/七上课程对照.md`: chapter mappings and content coverage.

The original nine lessons and 45 questions retain IDs; only chapter assignments change. Upgrading does not erase attempts or alter reference answers for previously answered questions. New lessons start as “Not started.”

## Ask Zhuanxin AI | Ask while watching (Phase A)

All 41 video lessons can expand the course Tutor. Supports continuous chat, refresh restoration, returning to the lesson, deleting chats, and “Rephrase / Give an example / Explain with a diagram / Test me.”

Version 0.1: “Immersive learning” beside the video title enlarges video and opens Tutor in one step, without first selecting “Ask Zhuanxin AI.” Desktop uses a 380px translucent floating panel; mobile uses landscape video and a right-side panel. Portrait phones use CSS to rotate the whole learning container; turning the device landscape restores normal orientation without system rotation-lock permissions. The top-right minimize button collapses chat into an in-video “Ask Zhuanxin AI” button; selecting it reopens chat. “Exit immersive mode” restores the page. Selecting “Ask Zhuanxin AI” on the normal page also enters immersive mode and opens chat. Minimizing/exiting does not clear messages.

Page-level immersion uses `position: fixed; inset: 0`, not native Fullscreen API. Tutor is an overlay alongside the iframe in the site's own video container, not injected into Bilibili. Entering/exiting, opening/closing, and sending do not move, unmount, or change the iframe key. With focus in Zhuanxin AI, Esc first minimizes chat, then exits immersion.

- Server rebuilds context from course and video resources; absolute value explicitly maps to S05. Version one does not read timestamps or subtitles.
- Incremental `0005_course_tutor.sql` adds only `tutor_conversations`, `tutor_messages`, and indexes. `npm run db:setup` applies it to local D1; old migrations remain unchanged.
- Chat does not write attempts, help records, Learning Evidence, or Student Model, and does not advance Journey. Self-tests explicitly state they do not yet count toward official mastery, providing reference answers only. The original question Tutor preserves its recording semantics.
- `requestId` binds to message content; retries do not regenerate or charge quota again. States: `pending / completed / failed / unknown`. Timeouts/interruptions do not automatically recall the model.
- Reuses the DeepSeek switch and server key. Disabled models, insufficient quota, or failed calls explicitly fall back to course materials. S05 number lines and self-tests use controlled content; other diagrams accept only structured step data.

Local startup: `npm run db:setup`, then `npm run dev -- --host localhost --port 3000`; visit `http://localhost:3000/?lesson=absolute` or `/?lesson=number-line`.

Verification:

```powershell
npm test
npm run test:course-tutor
npm run typecheck
npm run build
# Keep the local service running:
npm run test:api
npm run test:evidence-api
npm run test:journey-api
npm run test:course-tutor-api
```

API regression and repeatable UI acceptance use local `EVIDENCE_MODE=preview` and `AI_TUTOR_ENABLED=false`. Create Git-ignored `.dev.vars.phase-a-qa` without overwriting `.dev.vars`, add both settings, set `$env:CLOUDFLARE_ENV='phase-a-qa'` in PowerShell, and run `node node_modules/vite/bin/vite.js --host localhost --port 3001 --strictPort`. In the test terminal, set `$env:TEST_BASE_URL='http://localhost:3001'`. Both development services use the same local D1; tests create separate anonymous identities.

UI acceptance uses `npm run test:course-tutor-ui` with existing Playwright and Chrome. If Playwright is not a project dependency, point `PLAYWRIGHT_MODULE` to the existing runtime's `playwright/index.mjs`; set `COURSE_TUTOR_QA_OUTPUT_DIR` to a screenshot directory outside the repository (drive D on the original machine). Tests do not download dependencies and cover real HTTP/D1, desktop/narrow screens, refresh restoration, same-request retries, course/learner isolation, deletion, and video-instance stability.

Set `$env:VERIFY_BILIBILI_PLAYBACK='true'` to include real Bilibili playback checks: the browser plays muted video, measuring playback time after entering/exiting immersion, expanding/minimizing, and sending messages to verify continued progress without reset. Requires access to Bilibili video resources.
