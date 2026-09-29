import { env } from './runtime';
export function getDatabase(): D1Database {
  if (!env.DB) throw new Error('D1 binding unavailable');
  return env.DB as unknown as D1Database;
}
