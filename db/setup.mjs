import { spawnSync } from 'node:child_process';
// 使用本地数据库；这条命令不会修改线上学习记录。
const result = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    'wrangler.local.json',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      WRANGLER_WRITE_LOGS: 'false',
      WRANGLER_LOG_PATH: '.wrangler/logs',
      MINIFLARE_REGISTRY_PATH: '.wrangler/registry',
    },
  },
);
process.exit(result.status ?? 1);
