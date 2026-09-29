import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PostgresD1 } from './postgres';

type Row = Record<string, unknown>;
type Statement = ReturnType<DatabaseSync['prepare']>;

export type D1Result<T = Row> = {
  results: T[];
  success: true;
  meta: { changes: number; last_row_id: number };
};

class D1Statement {
  private readonly statement: Statement;
  private values: unknown[] = [];

  constructor(sql: string, db: DatabaseSync) {
    this.statement = db.prepare(sql);
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  all<T extends Row = Row>(): D1Result<T> {
    const results = this.statement.all(...(this.values as any[])) as T[];
    return { results, success: true, meta: { changes: 0, last_row_id: 0 } };
  }

  first<T extends Row = Row>(): T | null {
    return (this.statement.get(...(this.values as any[])) as T | undefined) ?? null;
  }

  run(): D1Result {
    const result = this.statement.run(...(this.values as any[]));
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }

  execute(): D1Result {
    return this.statement.columns().length ? this.all() : this.run();
  }
}

class LocalD1 {
  private readonly db: DatabaseSync;

  constructor() {
    const path = resolve(process.env.ZHIXU_DB_PATH ?? '.runtime/zhixu.sqlite');
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.applyMigrations();
  }

  prepare(sql: string) {
    return new D1Statement(sql, this.db);
  }

  async batch(statements: D1Statement[]) {
    this.db.exec('BEGIN');
    try {
      const results = statements.map((statement) => statement.execute());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private applyMigrations() {
    const migrationDir = resolve('drizzle');
    if (!existsSync(migrationDir)) return;
    this.db.exec('CREATE TABLE IF NOT EXISTS _zhixu_migrations (name TEXT PRIMARY KEY)');
    for (const file of readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort()) {
      if (this.db.prepare('SELECT name FROM _zhixu_migrations WHERE name = ?').get(file)) continue;
      const sql = readFileSync(resolve(migrationDir, file), 'utf8');
      this.db.exec('BEGIN IMMEDIATE');
      try {
        for (const statement of sql.split(/--> statement-breakpoint/g).map((value) => value.trim()).filter(Boolean)) {
          // Earlier releases applied migrations without a ledger. Preserve their data.
          const addColumn = statement.match(/^ALTER TABLE `([^`]+)` ADD `([^`]+)`/i);
          if (addColumn && this.db.prepare(`PRAGMA table_info("${addColumn[1]}")`).all().some((column) => column.name === addColumn[2])) continue;
          this.db.exec(statement.replace(/^CREATE (TABLE|UNIQUE INDEX|INDEX) /i, 'CREATE $1 IF NOT EXISTS '));
        }
        this.db.prepare('INSERT INTO _zhixu_migrations (name) VALUES (?)').run(file);
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }
  }
}

export const env = {
  DB: process.env.ZHIXU_DATABASE === 'cloudbase' ? new PostgresD1() : new LocalD1(),
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  AI_TUTOR_ENABLED: process.env.AI_TUTOR_ENABLED,
  AI_TUTOR_MODEL: process.env.AI_TUTOR_MODEL,
};
