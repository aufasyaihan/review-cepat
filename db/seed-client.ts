import { closeDb, getDb } from './index';

/** Shared database client for short-lived seed scripts. */
export const db = getDb();

export { closeDb };
