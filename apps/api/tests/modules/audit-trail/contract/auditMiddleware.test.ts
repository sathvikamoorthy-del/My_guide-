import { createAuditMiddleware, auditMiddleware } from '../../../../src/audit/auditMiddleware';
import { AuditEntry } from '../../../../src/audit/auditTrail';

const run = async (req: any, status = 200, sink?: any) => {
  const entries: AuditEntry[] = [];
  const mw = createAuditMiddleware(sink ?? { append: (e: AuditEntry) => { entries.push(e); } });
  let finish = () => {};
  const res: any = { statusCode: status, on: (_e: string, cb: () => void) => { finish = cb; } };
  const next = jest.fn();
  mw(req, res, next);
  finish();
  await new Promise((r) => setImmediate(r));
  return { entries, next };
};

describe('audit middleware contract', () => {
  it('records a state-changing request after the response, with actor, tenant, route and status', async () => {
    const { entries, next } = await run({ method: 'post', path: '/invoices', auth: { userId: 'u1' }, tenantId: 't1' }, 201);
    expect(next).toHaveBeenCalledWith();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actor: 'u1', action: 'POST /invoices', tenantId: 't1', meta: { status: 201 } });
  });

  it('does not record reads', async () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) expect((await run({ method, path: '/x' })).entries).toHaveLength(0);
  });

  it('uses "anonymous" when nobody is signed in, and falls back to req.user and req.url', async () => {
    expect((await run({ method: 'DELETE', url: '/a' })).entries[0]).toMatchObject({ actor: 'anonymous', action: 'DELETE /a' });
    expect((await run({ method: 'PUT', path: '/b', user: { id: 'u2' } })).entries[0].actor).toBe('u2');
  });

  it('never delays or fails the request when the sink breaks', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { next } = await run({ method: 'POST', path: '/x' }, 200, { append: () => { throw new Error('down'); } });
    expect(next).toHaveBeenCalledWith();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('the default export is a mountable middleware', () => {
    expect(typeof auditMiddleware).toBe('function');
  });
});
