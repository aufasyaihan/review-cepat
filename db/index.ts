import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as relations from './relations';
import * as schema from './schema';

let _pool: mysql.Pool | undefined;

/**
 * Lazily created connection pool. The pool is only opened when the returned
 * instance is actually queried, so importing this module never touches the
 * database (keeps `next build` and unit tests offline).
 */
function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL ?? '');
  }
  return _pool;
}

export function getDb() {
  return drizzle(getPool(), { schema: { ...schema, ...relations }, mode: 'default' });
}

export type Db = ReturnType<typeof getDb>;
export { relations, schema };
