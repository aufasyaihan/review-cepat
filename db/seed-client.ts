import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as relations from './relations';
import * as schema from './schema';

/** Direct connection for scripts (seed, migrations). Use getDb() in app code. */
const pool = mysql.createPool(process.env.DATABASE_URL ?? '');

export const db = drizzle(pool, { schema: { ...schema, ...relations }, mode: 'default' });
