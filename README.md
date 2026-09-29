# 砖芯 AI

网站源码仓库。线上网站：https://zhuanxinai.com ，目前部署在腾讯云 CloudBase；推送到 GitHub 不会自动更新线上服务。

## 当前版本

- 手机验证码、密码登录，以及学生姓名与账号数据隔离。
- 我的课程：按数学、物理、化学及初一、初二、初三筛选已发布课程。
- 管理后台：课程草稿、发布、回收站、素材库与学习情况。
- React + TypeScript + Vinext/Vite；腾讯云部署使用 Node.js，生产数据库通过 CloudBase PostgreSQL HTTPS RPC 访问。
- 已保留 AI 辅导接口；是否调用真实模型取决于服务端配置，不代表已启用。

本仓库仅保存程序、静态资源及数据库结构，不包含学生数据、上传的视频、运行数据库或云服务密钥。服务端密钥须通过部署环境变量配置，不能写入代码。

推荐使用 Node.js 24。安装依赖后可运行 `npm run dev`，构建使用 `npm run build`。本地与生产认证、数据库及云资源需要分别配置；本地运行不会复制线上学生数据。

## 历史设计与开发说明

以下为项目早期文档，部分匿名登录、D1 和课程范围描述已被当前版本替代；部署时以现有代码及云端配置为准。

# 砖芯 AI · 初一数学 MVP

一个可以学习知识点、看视频、做题、自动判题、查看进度和订正错题的网站。当前对齐人教版（2024）七年级上册正文知识点及两项综合实践，包含 6 章、41 节课、205 道原创基础练习。每节有视频引用、要点、例题和 5 道题。七下与其他年级尚未加入；本版是基础学习课程，不等同于完整教材讲授或教师审核后的题库。

## 先体验

点击“开始学习” → 观看视频（可展开知识要点）→ 输入答案 → 查看解析 → 完成本轮 → 到错题本订正 → 查看学习进度。

- 支持整数、小数、负数、分数及全角数字。例如 `−3`、`0.5`、`1/2`。
- 支持单项选择，概念与代数式可直接选择选项；旧数值题的 ID 和答案保持不变。
- 标准答案在服务端，提交后才返回判题和解析。
- 学习数据保存在 SQLite/D1，刷新页面仍然保留。
- 当前用匿名 Cookie 标识学习者，没有学生姓名、手机号或注册表单。清除 Cookie、换浏览器或换设备后不能自动找回之前的身份。Cookie 有效期为 180 天，访问时续期。
- 错题答对后标记为“已订正”，保留历史；再次答错会重新进入“待复习”。
- AI Tutor 的 DeepSeek 接口和对话区已实现；配置服务端密钥并启用后才会调用真实模型，详见 `docs/AI接入指南.md`。“给我一点提示”仍是免费固定课程提示。

## 技术栈：每个工具负责什么

| 层         | 选择                                           | 作用                                   |
| ---------- | ---------------------------------------------- | -------------------------------------- |
| 页面       | React + TypeScript                             | 组织页面组件，用类型检查减少字段错误   |
| 全栈框架   | Vinext（使用 Next.js 风格的 App Router）+ Vite | 运行页面和服务端 API，并生成部署产物   |
| 界面       | CSS / Tailwind + Shadcn / Base UI + Lucide     | 统一样式，复用无障碍页签、进度条和图标 |
| 服务端     | TypeScript + Cloudflare Workers                | 校验输入、判题、读写记录               |
| 数据库     | 本地 SQLite / 托管 D1                          | 保存真实答题历史                       |
| 数据库迁移 | Drizzle Kit                                    | 用可追踪的 SQL 文件建立或升级数据表    |
| 测试       | Node 内置测试器 + HTTP 集成检查                | 验证判题、掌握度、数据库保存与隔离     |

第一版只维护一套 TypeScript 全栈，避免一开始同时维护 Python 后端和前端两个服务。你正在学的变量、条件、函数和数据结构仍然完全适用。以后需要独立算法服务时，可以再增加 Python，而不必重写当前页面。

Vinext 当前使用测试版，适合此 MVP；正式扩大服务前，应评估框架稳定性以及中国用户的访问速度。依赖具体版本以 package.json 和 package-lock.json 为准。

## 本地运行（Windows）

在本项目文件夹打开 PowerShell。推荐 Node.js 24 LTS；测试命令需要支持直接执行 TypeScript 的 Node 版本。

首次准备：

```powershell
npm ci
npm run db:setup
npm run dev
```

打开终端显示的 Local 地址，通常是 http://localhost:3000。保持终端运行，修改代码后页面会自动更新。按 Ctrl+C 停止服务。

以后再次运行只需 `npm run dev`。增加数据库结构后，先运行 `npm run db:generate`，检查生成的 SQL，再运行 `npm run db:setup`。

`db:setup` 只操作本地数据库，不修改线上记录。数据库文件在被 Git 忽略的 `.wrangler/state/` 内；保留该目录才能保留本地记录。线上 D1 和本地数据库是两个独立环境，数据不会自动互相复制。

本地默认无需 API 密钥、Cloudflare 账号或付费模型。首次安装依赖需要网络。

## 项目目录

```text
math-garden/
├─ app/
│  ├─ page.tsx                 网站入口，加载学习界面
│  ├─ layout.tsx               页面标题、语言和全局样式入口
│  ├─ globals.css              配色、间距、手机布局
│  └─ api/learning/route.ts     GET 读取记录；POST 判题并保存
├─ components/
│  ├─ learning-app.tsx         学习路径、练习、错题本、进度视图
│  └─ ui/                     可复用界面组件
├─ lib/
│  ├─ curriculum.ts            单元、知识点、讲解、例子、提示
│  ├─ grading.ts               数值解析与判题规则
│  ├─ progress.ts              基础掌握度算法和共享类型
│  └─ utils.ts                 界面工具函数
├─ server/
│  ├─ questions.ts             服务端题库和标准答案
│  └─ tutor-contract.ts        未来 AI Tutor 的类型约定
├─ db/
│  ├─ schema.ts                答题记录表结构
│  ├─ index.ts                 D1 访问入口
│  ├─ env.d.ts                 数据库绑定类型
│  └─ setup.mjs                本地数据库初始化命令
├─ drizzle/                    SQL 迁移及版本元数据
├─ tests/
│  ├─ core.test.mjs            判题、题库完整性、掌握度检查
│  └─ api.mjs                  真实接口与数据库流程检查
├─ docs/入门与扩展.md           按学习顺序读代码、动手修改
├─ public/favicon.svg          网站图标
├─ .openai/hosting.json         Sites 标识与逻辑数据库绑定
├─ wrangler.local.json         本地 D1 配置（占位 ID，不是线上凭据）
├─ vite.config.ts              开发、打包与 Workers 配置
├─ package.json                依赖与运行命令
└─ package-lock.json           锁定依赖，保证可重复安装
```

## 数据怎么流动

```text
学生输入答案
  → 页面 POST /api/learning
  → 服务端验证学习身份、来源、题目和数值格式
  → 查服务端标准答案，执行判题
  → 用预编译 SQL 保存答题记录
  → 返回正误、正确答案和解析
  → 页面重新读取记录，更新错题本和掌握度
```

`attempts` 表每行是一条答题记录：自增编号、匿名学习身份、请求编号、题目编号、提交答案、正误、时间。

数据库里保留完整答题历史；知识点掌握度取每道题最近一次结果。重复网络请求使用相同请求编号，数据库唯一索引保证不会重复记分。不同学习者查询时都以各自的匿名身份过滤。

## 掌握度规则

掌握度 = 最近一次答对的不同题目数 ÷ 该知识点题目总数。

- 没做题：未开始。
- 还没做完所有不同题目：学习中。
- 完成全部题目，并达到 80%：基础掌握。
- 完成全部题目，但低于 80%：需复习。

例如 5 道题只做对 1 道，该知识点为 20%；重复答对这一道仍然为 20%。4 道题答对但第 5 道尚未尝试时，数值为 80%，状态仍为“学习中”。

这是透明的基础指标，不是科学验证过的能力诊断。页面中的“已练习题目”按不同题目计数，“累计答题次数”和正确率包含重复练习。所有日期统计使用北京时间。

## 检查命令

```powershell
npm test
npm run typecheck
npm run build
```

保持开发服务运行，在另一个终端运行：

```powershell
npm run test:api
```

集成检查会创建新的匿名测试身份，仅写入本地测试记录，不混入浏览器里的学习身份。

生产模式本地检查：完成 build 后先停止开发服务，再运行 `npm start`，打开实际显示的地址。云端发布使用 Sites：保存精确代码版本，打包 Workers 产物和迁移，再发布到已确认的访问范围。不能把只含 HTML 的静态压缩包用来部署当前带数据库的版本。

## 本期边界

当前没有完整账号、跨设备同步、教师后台、课程编辑器、付费或完整 K12 课程。已有 DeepSeek AI 对话，需服务端密钥和启用开关。七上基础内容已按指定教材整理，仍应请数学教师审校；数值与选择题自动判题不代替完整解题过程评价。

下一步的教学重点：先打开 lib/curriculum.ts 修改一段讲解，观察页面变化；再阅读 docs/入门与扩展.md，理解一次完整答题请求。

## 视频讲解（2026-09-10）

每个知识点现在对应一节视频：左侧观看，右侧练习；手机上先显示视频，再显示练习。课程列表显示真实视频时长。原来的概念、例子保留在“本节知识要点”中。

- `lib/lesson-videos.ts`：知识点到视频的映射，包含作者、标题、时长、BVID、分集与 CID。
- `components/video-lesson.tsx`：官方播放器、来源链接、重新加载和知识要点。
- `docs/视频来源.md`：所选视频与核验说明。

视频通过 Bilibili 官方外链播放器提供，不下载、不转存视频文件。默认关闭自动播放和弹幕，支持播放器的全屏功能；播放器加载失败或平台要求登录时，可以使用“在 B 站观看”。观看视频不会直接增加掌握度，掌握度仍来自答题。

今后添加知识点时，需要同步填写视频映射；`npm test` 会检查是否遗漏。分集必须填写实际 CID，不要只依靠标题中的“第几课”，以免播放错误章节。

## 七上内容维护

2026-09-11 已将绝对值完整教学流程接入原课程页 `/?lesson=absolute`：五题课后练习后自动分析、最多两题追问、两题补练、独立检查和七天复习；AI 根据真实阶段与作答摘要提供引导。仍为本地审校预览，其余课保留原流程。新增迁移 0004。完整交付范围、启动与检查方式见 [教学流程实施与验收](docs/journey/实施与验收.md)。

2026-09-11 新增学习证据开发预览：`/evidence`。本地 `.dev.vars` 设置 `EVIDENCE_MODE=preview` 并执行 `npm run db:setup` 后启动。验收命令为 `npm run test:evidence-api`；内容仍待教师审校。完整范围与待办见 [学习证据交接与验收](docs/evidence/交接与验收.md)。

- `lib/upper-lessons.ts`：新增 32 节课的原创要点、例题、提示和教材小节号。
- `server/upper-bank.ts`：新增 160 道题及解析；可选的 `options` 表示单项选择，标准答案为从 1 开始的选项序号，只在服务端保存。
- `lib/upper-videos.ts`：新增课程的视频引用，分集经过元数据核对。同一专题视频可用于几节相关课程；实践课用基础复习视频配合本站操作区。
- `components/lesson-visual.tsx`：几何 SVG 图示、角度滑块、二进制拆分与简化跑道计算。
- `docs/七上课程对照.md`：章节对应关系及内容范围。

原来的 9 节课和 45 道题保留 ID，仅调整章节归属。升级不清除答题记录，也不改变已答题的标准答案；新增课程初始为“未开始”。

## 问砖芯 AI｜边看边问（Phase A）

所有 41 节视频课都可展开课程 Tutor。支持连续聊天、刷新恢复、回到本课继续、删除聊天，以及“换种说法 / 举个例子 / 画图解释 / 出题检查”。

v0.1 交互：点击视频标题旁的“沉浸学习”会一步放大视频并直接展开 Tutor，无需预先点击“问砖芯 AI”。桌面使用 380px 半透明浮窗，手机沉浸模式使用横向视频与右侧浮窗。竖屏手机通过 CSS 旋转整个学习容器实现横向页面，设备转横后自动恢复正常方向，不依赖系统屏幕旋转锁定权限。点击浮窗右上角的最小化按钮可缩为视频内的“问砖芯 AI”悬浮按钮，点击它重新展开；点击“退出沉浸”恢复页面。普通页直接点击“问砖芯 AI”也会同时进入沉浸并打开聊天；聊天内容不会因收起或退出而清空。

采用 `position: fixed; inset: 0` 的页面级沉浸模式，不调用原生 Fullscreen API。Tutor 是自己视频容器内与 iframe 同级的覆盖元素，不注入 Bilibili；进入/退出模式及开关/发送都不移动、卸载或更改 iframe 的 key。焦点在砖芯 AI界面时，Esc 先最小化聊天，再退出沉浸。

- 服务端根据课程与视频资源重建上下文；绝对值明确映射 S05。第一版不读取视频时间戳或字幕。
- 使用新增增量迁移 `0005_course_tutor.sql`，只新增 `tutor_conversations`、`tutor_messages` 及索引。运行 `npm run db:setup` 应用到本地 D1；旧迁移保持原样。
- 聊天不写作答、帮助记录、Learning Evidence 或 Student Model，不推进 Journey。自测明确提示“本次自测暂不计入正式掌握状态”，仅提供参考答案。原题目 Tutor 保持原来的记录语义。
- `requestId` 与消息内容绑定；重复请求不重复生成或扣额度。处理状态为 `pending / completed / failed / unknown`；超时或中断不会自动重新调用模型。
- 复用原 DeepSeek 开关和服务端密钥。模型未启用、额度不足或调用失败时明确展示课程材料回退。S05 数轴和自测使用受控内容；其他图示只接受结构化步骤数据。

本地启动：在本仓库执行 `npm run db:setup`，然后执行 `npm run dev -- --host localhost --port 3000`，访问 `http://localhost:3000/?lesson=absolute` 或 `/?lesson=number-line`。

验证命令：

```powershell
npm test
npm run test:course-tutor
npm run typecheck
npm run build
# 保持本地服务运行：
npm run test:api
npm run test:evidence-api
npm run test:journey-api
npm run test:course-tutor-api
```

API 回归及可重复 UI 验收使用 `EVIDENCE_MODE=preview`、`AI_TUTOR_ENABLED=false` 的本地测试服务。可创建独立、被 Git 忽略的 `.dev.vars.phase-a-qa`（不要覆盖原 `.dev.vars`），写入这两项后，在 PowerShell 设置 `$env:CLOUDFLARE_ENV='phase-a-qa'`，运行 `node node_modules/vite/bin/vite.js --host localhost --port 3001 --strictPort`。测试终端设置 `$env:TEST_BASE_URL='http://localhost:3001'`。这两个开发服务使用同一本地 D1；测试创建独立匿名身份。

UI 验收执行 `npm run test:course-tutor-ui`，使用已有 Playwright 和 Chrome。若 Playwright 不在项目依赖中，通过 `PLAYWRIGHT_MODULE` 指向现有运行时的 `playwright/index.mjs`；通过 `COURSE_TUTOR_QA_OUTPUT_DIR` 指定仓库外截图目录（本机放在 D 盘）。该测试不下载依赖，覆盖真实 HTTP/D1、桌面与窄屏、刷新恢复、同请求重试、课程/学习者隔离、删除和视频实例稳定性。

设置 `$env:VERIFY_BILIBILI_PLAYBACK='true'` 可加入真实 Bilibili 播放检查：测试浏览器静音播放，测量进入/退出沉浸、展开/最小化、发送后的播放时间，确认持续前进且不重置。该项需要能访问 Bilibili 视频资源。
