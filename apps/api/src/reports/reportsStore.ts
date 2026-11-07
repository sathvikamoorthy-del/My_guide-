// Tenant-scoped data access for reports (REQ-169). Every statement goes through the multi-tenant module's wrapper, so it is
// always limited to one tenant; nothing here can read or write another tenant's rows.
import crypto from 'crypto';
import { Db, asExecutor } from '../db/client';
import { TenantScope, createTenantDb } from '../tenancy/tenantDb';
import { ReportInput, TargetType } from './validateReport';

export const REPORT_TABLES = {
  answers: ['id'],
  sources: ['id'],
  reports: ['id', 'reporter_user_id', 'target_type', 'target_id', 'problem_type', 'description', 'status', 'created_at']
};

const TARGET_TABLE: Record<TargetType, 'answers' | 'sources'> = { answer: 'answers', source: 'sources' };

export class DuplicateOpenReport extends Error {
  constructor(public reportId: string | undefined) {
    super('an open report by this user on this target already exists');
    this.name = 'DuplicateOpenReport';
  }
}

/** Returns a function that gives the data access of one tenant. */
export function reportsStore(db: Db) {
  return createTenantDb(asExecutor(db), { tables: REPORT_TABLES });
}

export async function targetExists(scope: TenantScope, targetType: TargetType, targetId: string): Promise<boolean> {
  return (await scope.select(TARGET_TABLE[targetType], { id: targetId }, { limit: 1 })).length > 0;
}

export async function findOpenReport(scope: TenantScope, userId: string, targetType: TargetType, targetId: string): Promise<string | undefined> {
  const rows = await scope.select('reports', { reporter_user_id: userId, target_type: targetType, target_id: targetId, status: 'open' }, { limit: 1 });
  return rows.length ? String(rows[0].id) : undefined;
}

export interface CreatedReport { id: string; status: 'open' }

/** Stores a new open report. A concurrent duplicate (caught by the unique index) becomes a DuplicateOpenReport. */
export async function createReport(scope: TenantScope, userId: string, input: ReportInput, now: () => Date = () => new Date()): Promise<CreatedReport> {
  const id = crypto.randomUUID();
  try {
    await scope.insert('reports', {
      id,
      reporter_user_id: userId,
      target_type: input.targetType,
      target_id: input.targetId,
      problem_type: input.problemType,
      description: input.description,
      status: 'open',
      created_at: now().toISOString()
    });
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(String((err as Error)?.message ?? err))) {
      throw new DuplicateOpenReport(await findOpenReport(scope, userId, input.targetType, input.targetId));
    }
    throw err;
  }
  return { id, status: 'open' };
}

/**
 * Deletes every report the user made in this tenant; returns how many. For the personal-data deletion flow (REQ-169
 * criterion 14, WI-007 q2): call it for each tenant of the user. Not exposed over HTTP.
 */
export async function deleteReportsByUser(scope: TenantScope, userId: string): Promise<number> {
  if (typeof userId !== 'string' || !userId) throw new Error('a user id is required');
  return scope.remove('reports', { reporter_user_id: userId });
}
