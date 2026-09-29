// CloudBase's shared PostgreSQL tier is accessed through its HTTPS RPC gateway.
// The RPC is granted only to service_role; this key must never reach the browser.
export function postgresSQL(sql: string, values: unknown[] = []) {
  sql = sql.replace(/date\(created_at, '\+8 hours'\)/g, "to_char(created_at::timestamptz AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')")
    .replace(/date\('now', '\+8 hours', '-6 days'\)/g, "to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai') - INTERVAL '6 days', 'YYYY-MM-DD')")
    .replace(/date\('now', '\+8 hours'\)/g, "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')");
  sql = sql.replace(/\bAS ([a-z]\w*[A-Z]\w*)/g, 'AS "$1"').replace(/\bMAX\(COALESCE\(/gi, 'GREATEST(COALESCE(')
    .replace(/\bMAX\((legacy_through|assistance|\?),/gi, 'GREATEST($1,')
    .replace(/\bjson_object\(/gi, 'json_build_object(')
    .replace(/CAST\(strftime\('%s',created_at\) AS INTEGER\)/gi, 'EXTRACT(EPOCH FROM created_at::timestamptz)::bigint');
  if (/^\s*INSERT OR IGNORE /i.test(sql)) sql = sql.replace(/INSERT OR IGNORE /i, 'INSERT ') + ' ON CONFLICT DO NOTHING';
  if (/^\s*(INSERT|UPDATE|DELETE)\s/i.test(sql) && !/\bRETURNING\b/i.test(sql)) sql += ' RETURNING *';
  let index = 0;
  let output = '';
  for (let i = 0; i < sql.length;) {
    if (sql[i] === "'" || sql[i] === '"' || sql[i] === '`') {
      const quote = sql[i++];
      let token = quote === '`' ? '"' : quote;
      while (i < sql.length) {
        const c = sql[i++]; token += c === '`' && quote === '`' ? '"' : c;
        if (c === quote) {
          if (sql[i] === quote) { token += sql[i++]; continue; }
          break;
        }
      }
      output += token;
    } else if (sql[i] === '?') {
      if (index >= values.length) throw new Error('Missing SQL parameter');
      const value = values[index++];
      if (value === null) output += 'NULL';
      else if (typeof value === 'string') output += `E'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'::text`;
      else if (typeof value === 'number' && Number.isFinite(value)) output += `${value}::${Number.isInteger(value) ? 'bigint' : 'double precision'}`;
      else throw new Error('Unsupported SQL parameter');
      i++;
    } else {
      const word = sql.slice(i).match(/^[A-Za-z_][A-Za-z_0-9]*/)?.[0];
      if (word) {
        output += word.toLowerCase() === 'window' ? '"window"' : word;
        i += word.length;
      } else output += sql[i++];
    }
  }
  if (index !== values.length) throw new Error('Extra SQL parameters');
  return output;
}

export class PostgresD1 {
  prepare(sql: string) { return new PostgresStatement(this, sql); }
  async batch(statements: PostgresStatement[]) {
    return this.execute(statements.map(s => postgresSQL(s.sql, s.values)));
  }
  async execute(statements: string[]) {
    const key = process.env.CLOUDBASE_SERVER_KEY ?? process.env.CLOUDBASE_APIKEY;
    if (!key) throw new Error('Cloud database credential is not configured');
    const response = await fetch('https://zhixu-math-test-d2fi7r0hc6ae5fdb.api.tcloudbasegateway.com/v1/rdb/rest/rpc/zhixu_batch', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ statements }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as {code?: string};
      // Do not log SQL/parameters: they can contain private learning records.
      throw new Error(`Cloud database request failed (${response.status}; ${error.code ?? 'unknown'})`);
    }
    return await response.json() as Array<{ results: Record<string, any>[]; success: true; meta: { changes: number; last_row_id: number } }>;
  }
}
class PostgresStatement {
  values: unknown[] = [];
  constructor(public db: PostgresD1, public sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async all() { return (await this.db.execute([postgresSQL(this.sql, this.values)]))[0]; }
  async first() { return (await this.all()).results[0] ?? null; }
  async run() { return this.all(); }
}
