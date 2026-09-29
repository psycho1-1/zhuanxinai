# Zhuanxin AI (砖芯 AI)

[简体中文](README.md) | English

Source code for the Zhuanxin AI learning platform.

**Website:** [zhuanxinai.com](https://zhuanxinai.com)

The live application runs on Tencent CloudBase. Pushing code to this repository does not automatically deploy it or change the live website.

## Features

- Sign in with a phone verification code or password.
- Set a student name and keep learning records separated by account.
- Browse published courses by subject—mathematics, physics, or chemistry—and school year: Grade 7, Grade 8, or Grade 9.
- Manage course drafts, publish courses, restore items from the recycle bin, and maintain a reusable media library.
- Study with videos, practice questions, answer explanations, progress tracking, and a mistake notebook.
- Review student learning activity in the administration interface.
- Use the existing AI tutoring integration when the required server-side configuration is enabled.

Course filters do not imply that content has been published for every subject and school year. The original Grade 7 mathematics material remains part of the project. AI integration code is included, but its presence does not mean a live model is enabled.

## Technology

| Area | Technology |
| --- | --- |
| Application | TypeScript and React |
| Framework and build | Vinext, Next.js-style App Router, and Vite |
| Interface | Tailwind CSS, Base UI/Shadcn components, and Lucide icons |
| Production runtime | Node.js on Tencent CloudBase |
| Production database adapter | CloudBase PostgreSQL through an HTTPS RPC endpoint |
| Local database support | SQLite and legacy D1 development tooling |
| Authentication | CloudBase authentication integration |
| Tests | Node.js test runner and API/UI checks |

The repository retains configuration from its original Cloudflare/Sites implementation. Refer to the current code and deployment environment when choosing a runtime. Dependency versions are recorded in `package.json` and `package-lock.json`.

## Local development

Use **Node.js 24** and npm. From the repository directory:

```sh
npm ci
npm run dev
```

Open the local address printed in the terminal. Authentication, database access, and cloud-backed features require configuration for the environment you are using. A fresh clone does not contain production credentials or student records.

For a production build:

```sh
npm run build
npm start
```

The included `Dockerfile` uses Node.js 24 and exposes port `8080` for the CloudBase deployment.

## Checks

```sh
npm run typecheck
npm test
npm run test:studio
npm run build
```

Additional API and UI checks are available under `tests/` and in the npm scripts. Integration checks may require a running local server and a configured test database. Run them against a separate test environment.

## Repository layout

| Path | Purpose |
| --- | --- |
| `app/` | Pages, layouts, and API routes |
| `components/` | Learning, login, administration, and shared UI components |
| `lib/` | Shared types, curriculum data, client helpers, and learning logic |
| `server/` | Authentication, grading, tutoring, and course-management services |
| `db/` | Database schema, runtime adapters, and setup tools |
| `drizzle/` | Database migrations |
| `public/` | Static branding assets |
| `tests/` | Unit, API, and UI checks |
| `docs/` | Development notes and feature documentation, primarily in Chinese |

## Data and configuration

This repository contains application code, static assets, and database structure. It does **not** contain student records, uploaded course videos, runtime databases, or cloud service credentials.

Keep server keys and model API keys in deployment environment variables or ignored local configuration files. Never expose server credentials in browser code. Configure local and production resources separately; cloning this repository does not copy production data.

Database migrations and application deployment are separate operational steps. Review migrations before applying them to a live database.

## Further documentation

- [Chinese README and historical development notes](README.md)
- [Course administration guide](docs/课程后台使用说明.md)
- [AI integration guide](docs/AI接入指南.md)
- [CloudBase deployment notes](docs/CloudBase部署说明.md)
- [Introduction and extension guide](docs/入门与扩展.md)

Some older documents describe the initial anonymous-login, D1-based mathematics MVP. Those sections are historical and may differ from the current account system and CloudBase deployment. This English README summarizes the current project rather than translating those historical sections verbatim.
