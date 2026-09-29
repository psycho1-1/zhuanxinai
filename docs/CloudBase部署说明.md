# CloudBase 测试部署

当前测试环境已经部署：

- 环境 ID：`zhixu-math-test-d2fi7r0hc6ae5fdb`
- 云托管服务：`zhixu-math`
- 公网地址：<https://zhixu-math-314991-12-1489669739.sh.run.tcloudbase.com/>
- 副本数：0–1，公开访问

## 重新部署

在项目目录执行：

```powershell
$env:USERPROFILE = '你的可写配置目录'
tcb login
tcb cloudrun deploy `
  --env-id zhixu-math-test-d2fi7r0hc6ae5fdb `
  --service-name zhixu-math `
  --source . `
  --port 8080 `
  --min-num 0 `
  --max-num 1 `
  --open-access-types PUBLIC `
  --wait
```

## 数据与 AI 说明

原项目使用 Cloudflare D1。为了在 CloudBase 云托管上先免费试运行，当前版本通过 `db/runtime.ts` 使用容器内 SQLite 文件，并保留了原有接口和答题逻辑。云托管容器重建时本地 SQLite 数据可能丢失；正式使用前应把这层适配到已创建的 CloudBase PostgreSQL，或配置持久化存储。

AI 家教需要在服务环境变量中设置 `DEEPSEEK_API_KEY`，并将 `AI_TUTOR_ENABLED` 设为 `true`；密钥不要写入源码或提交到仓库。
