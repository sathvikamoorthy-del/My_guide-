// Free queries (REQ-264 / WI-015). The allowance is one global value in `settings` (WI-015 q3); the queries a user used are
// counted per tenant (q2) through the multi-tenant module's wrapper, so nothing here can read or write another tenant's rows.
import { Db, asExecutor } from '../db/client';
import { TenantScope, createTenantDb } from '../tenancy/tenantDb';

export const DEFAULT_FREE_QUERY_ALLOWANCE = 2;
export const ALLOWANCE_SETTING_KEY = 'free_query_allowance';

export const FREE_QUERY_TABLES = {
  free_query_uses: ['query_id', 'user_id', 'used_at']
};

/** Returns a function that gives the free-query data access of one tenant. */
export function freeQueriesStore(db: Db) {
  return createTenantDb(asExecutor(db), { tables: FREE_QUERY_TABLES });
}

/** The free-query allowance: the stored setting when it is a whole number of 0 or more, otherwise the default of 2. */
export async function getAllowance(db: Db): Promise<number> {
  const rows = (await asExecutor(db).execute('SELECT value FROM settings WHERE key = ?', [ALLOWANCE_SETTING_KEY])).rows;
  const raw = rows.length ? String(rows[0].value).trim() : '';
  return /^\d{1,9}$/.test(raw) ? Number(raw) : DEFAULT_FREE_QUERY_ALLOWANCE;
}

/** How many free queries the user has used in this tenant. */
export async function countUsed(scope: TenantScope, userId: string): Promise<number> {
  return (await scope.select('free_query_uses', { user_id: requireId(userId, 'user') })).length;
}

export interface FreeQueryBalance { remaining: number; allowance: number; used: number }

/** The user's balance in this tenant; `remaining` is never negative (REQ-264 criterion 8). */
export async function getBalance(db: Db, scope: TenantScope, userId: string): Promise<FreeQueryBalance> {
  const [allowance, used] = await Promise.all([getAllowance(db), countUsed(scope, userId)]);
  return { remaining: Math.max(allowance - used, 0), allowance, used };
}

export type RecordResult = { recorded: true } | { recorded: false; reason: 'already-recorded' | 'no-free-queries-left' };

/**
 * Records that one of the user's queries used a free query. Call it ONLY when a signed-in user's query ends with a completed
 * action plan (REQ-264 q1); never for guests, unresolved or abandoned queries. Safe to call twice for the same query: a query
 * is counted at most once. When no free query is left nothing is recorded, so `used` counts free queries only.
 */
export async function recordFreeQueryUse(db: Db, scope: TenantScope, userId: string, queryId: string, now: () => Date = () => new Date()): Promise<RecordResult> {
  requireId(userId, 'user');
  requireId(queryId, 'query');
  if ((await scope.select('free_query_uses', { query_id: queryId }, { limit: 1 })).length) return { recorded: false, reason: 'already-recorded' };
  if ((await getBalance(db, scope, userId)).remaining <= 0) return { recorded: false, reason: 'no-free-queries-left' };
  try {
    await scope.insert('free_query_uses', { query_id: queryId, user_id: userId, used_at: now().toISOString() });
  } catch (err) {
    // a concurrent call recorded the same query first
    if (/UNIQUE constraint failed/i.test(String((err as Error)?.message ?? err))) return { recorded: false, reason: 'already-recorded' };
    throw err;
  }
  return { recorded: true };
}

function requireId(id: unknown, what: string): string {
  if (typeof id !== 'string' || !id) throw new Error(`a ${what} id is required`);
  return id;
}
