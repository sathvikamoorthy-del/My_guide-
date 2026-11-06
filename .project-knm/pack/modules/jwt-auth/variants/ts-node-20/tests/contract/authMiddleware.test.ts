import { createAuthenticate, requireAuth, requireRole } from '../../files/src/auth/authMiddleware';
import { signToken } from '../../files/src/auth/jwt';

const SECRET = 'a-test-secret-that-is-long-enough-123456';
const res = () => { const r: any = { code: 0, body: null, status(c: number) { r.code = c; return r; }, json(b: unknown) { r.body = b; return r; } }; return r; };
const call = async (mw: any, headers: any) => { const req: any = { headers }; const r = res(); const next = jest.fn(); await mw(req, r, next); return { req, r, next }; };

describe('auth middleware contract', () => {
  const authenticate = createAuthenticate({ secret: SECRET });

  it('no Authorization header: anonymous, passes through, req.auth unset', async () => {
    const { req, next } = await call(authenticate, {});
    expect(next).toHaveBeenCalledWith(); expect(req.auth).toBeUndefined();
  });

  it('a valid bearer token sets req.auth (scheme is case-insensitive)', async () => {
    const t = await signToken({ userId: 'u1', tenantId: 'acme', roles: ['admin'] }, { secret: SECRET });
    for (const h of [`Bearer ${t}`, `bearer ${t}`, `BEARER   ${t} `]) {
      const { req, next } = await call(authenticate, { authorization: h });
      expect(next).toHaveBeenCalledWith();
      expect(req.auth).toMatchObject({ userId: 'u1', tenantId: 'acme', roles: ['admin'] });
    }
  });

  it('a present but invalid token is 401 with one generic answer, and the request stops', async () => {
    const good = await signToken({ userId: 'u1' }, { secret: SECRET });
    const expired = await signToken({ userId: 'u1' }, { secret: SECRET, expiresIn: -10 });
    const bodies = new Set<string>();
    for (const h of ['Bearer garbage', `Bearer ${expired}`, `Bearer ${good}x`, 'Bearer a b']) {
      const { r, next } = await call(authenticate, { authorization: h });
      expect(r.code).toBe(401); expect(next).not.toHaveBeenCalled(); bodies.add(JSON.stringify(r.body));
    }
    expect([...bodies]).toEqual(['{"error":"unauthorized"}']);
  });

  it('a header that is not a bearer token is treated as no token', async () => {
    const { req, next } = await call(authenticate, { authorization: 'Basic dXNlcjpwdw==' });
    expect(next).toHaveBeenCalledWith(); expect(req.auth).toBeUndefined();
  });

  it('a missing or short secret fails closed with a 500, not a pass', async () => {
    const t = await signToken({ userId: 'u1' }, { secret: SECRET });
    const { r, next } = await call(createAuthenticate({ secret: 'short' }), { authorization: `Bearer ${t}` });
    expect(r.code).toBe(500); expect(r.body).toEqual({ error: 'auth-misconfigured' }); expect(next).not.toHaveBeenCalled();
  });

  it('requireAuth and requireRole guard routes', async () => {
    expect((await call(requireAuth, {})).r.code).toBe(401);
    const signed = { headers: {}, auth: { userId: 'u1', roles: ['viewer'], claims: {} } } as any;
    const r1 = res(); const n1 = jest.fn(); requireAuth(signed, r1, n1); expect(n1).toHaveBeenCalled();
    const r2 = res(); const n2 = jest.fn(); requireRole('admin')(signed, r2, n2); expect(r2.code).toBe(403); expect(n2).not.toHaveBeenCalled();
    const r3 = res(); const n3 = jest.fn(); requireRole('viewer')(signed, r3, n3); expect(n3).toHaveBeenCalled();
    const r4 = res(); requireRole('admin')({ headers: {} } as any, r4, jest.fn()); expect(r4.code).toBe(401);
  });
});
