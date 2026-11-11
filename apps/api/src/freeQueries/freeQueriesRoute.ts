// GET /me/free-queries (REQ-264 / WI-015): the signed-in user's free-query balance in their tenant. Read-only; the user and
// tenant come from the signed-in identity only, so nobody can read another user's balance.
import { Request, Response, Router } from 'express';
import { requireAuth } from '../auth/authMiddleware';
import { Db } from '../db/client';
import { wrapAsync } from '../http/app';
import { freeQueriesStore, getBalance } from './freeQueriesStore';

interface BalanceRequest extends Request { auth?: { userId: string }; tenantId?: string }

export async function getFreeQueries(req: BalanceRequest, res: Response) {
  // never cached: the global cache middleware would otherwise show a stale balance right after a free query is used
  res.setHeader('Cache-Control', 'no-store');
  const userId = req.auth?.userId;
  const tenantId = req.tenantId;
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (!tenantId) { res.status(401).json({ error: 'tenant-required' }); return; }

  const db = req.app.get('db') as Db | undefined;
  if (!db) throw new Error('no database: the database provider is not registered');
  res.status(200).json(await getBalance(db, freeQueriesStore(db)(tenantId), userId));
}

// Registered in the routes glue.
export const freeQueriesRoute = {
  id: 'free-queries',
  mount(router: Router) {
    router.get('/me/free-queries', requireAuth as any, wrapAsync(getFreeQueries as any));
  }
};
