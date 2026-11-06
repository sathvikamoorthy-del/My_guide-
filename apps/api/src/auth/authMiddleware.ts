import { AuthClaims, AuthConfigError, SignOptions, verifyToken } from './jwt';

export interface AuthReq { headers: Record<string, string | string[] | undefined>; auth?: AuthClaims }
export interface AuthRes { status(code: number): AuthRes; json(body: unknown): unknown }
export type Next = (err?: unknown) => void;

// null = no bearer credentials at all (anonymous); '' = the caller tried to send a token but the header is malformed
const bearer = (h: unknown): string | null => {
  if (typeof h !== 'string' || !/^bearer\b/i.test(h.trim())) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : '';
};

// `authenticate` identifies the caller and never blocks an anonymous one: no Authorization header = anonymous (req.auth is
// unset), a token that is present but not valid (or a malformed Bearer header) = 401, a valid token sets req.auth ({ userId, tenantId?, roles?, claims }).
// Routes that need a signed-in user add `requireAuth`. Misconfiguration (no/short JWT_SECRET) fails closed with a 500.
export function createAuthenticate(options: SignOptions = {}) {
  return async (req: AuthReq, res: AuthRes, next: Next) => {
    const token = bearer(req.headers['authorization']);
    if (token === null) return next();
    try {
      if (!token) throw new Error('malformed bearer header');
      req.auth = await verifyToken(token, options);
    } catch (e) {
      if (e instanceof AuthConfigError) { res.status(500).json({ error: 'auth-misconfigured' }); return; }
      res.status(401).json({ error: 'unauthorized' });      // one answer for every kind of bad token: nothing to learn from it
      return;
    }
    next();
  };
}

export function requireAuth(req: AuthReq, res: AuthRes, next: Next) {
  if (!req.auth) { res.status(401).json({ error: 'unauthorized' }); return; }
  next();
}

export function requireRole(role: string) {
  return (req: AuthReq, res: AuthRes, next: Next) => {
    if (!req.auth) { res.status(401).json({ error: 'unauthorized' }); return; }
    if (!(req.auth.roles ?? []).includes(role)) { res.status(403).json({ error: 'forbidden' }); return; }
    next();
  };
}

// Registered in the middleware glue (outermost: before tenant resolution and auditing, which read req.auth).
export const authenticate = createAuthenticate();
