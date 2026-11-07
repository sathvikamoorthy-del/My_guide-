// POST /reports (REQ-169): a signed-in user reports that an answer or a source is incorrect, outdated, missing details,
// has a broken link, or has another problem. Only creation: no list, read, edit or delete endpoints.
import { Request, Response, Router } from 'express';
import { requireAuth } from '../auth/authMiddleware';
import { Db } from '../db/client';
import { wrapAsync } from '../http/app';
import { DuplicateOpenReport, createReport, findOpenReport, reportsStore, targetExists } from './reportsStore';
import { validateReport } from './validateReport';

interface ReportRequest extends Request { auth?: { userId: string }; tenantId?: string }

export async function postReport(req: ReportRequest, res: Response) {
  const userId = req.auth?.userId;
  const tenantId = req.tenantId;
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (!tenantId) { res.status(401).json({ error: 'tenant-required' }); return; }

  const v = validateReport(req.body);
  if (!v.ok) { res.status(400).json({ error: 'invalid-request', fields: v.fields }); return; }

  const db = req.app.get('db') as Db | undefined;
  if (!db) throw new Error('no database: the database provider is not registered');
  const scope = reportsStore(db)(tenantId);

  if (!(await targetExists(scope, v.value.targetType, v.value.targetId))) { res.status(404).json({ error: 'target-not-found' }); return; }

  const existing = await findOpenReport(scope, userId, v.value.targetType, v.value.targetId);
  if (existing) { res.status(409).json({ error: 'duplicate-open-report', reportId: existing }); return; }

  try {
    const created = await createReport(scope, userId, v.value);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof DuplicateOpenReport) { res.status(409).json({ error: 'duplicate-open-report', reportId: err.reportId }); return; }
    throw err;
  }
}

// Registered in the routes glue.
export const reportsRoute = {
  id: 'reports',
  mount(router: Router) {
    router.post('/reports', requireAuth as any, wrapAsync(postReport as any));
  }
};
