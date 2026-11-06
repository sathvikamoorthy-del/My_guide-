// Resolves the tenant of a request from the authenticated identity (never from a client-chosen header by default).
export interface TenantRequest { tenantId?: string; auth?: { tenantId?: unknown }; user?: { tenantId?: unknown } }
export interface TenantResponse { status(code: number): TenantResponse; json(body: unknown): unknown }
export type Next = (err?: unknown) => void;
export interface TenantContextOptions {
  /** Returns the tenant id for the request, or undefined. Default: the authenticated `req.auth.tenantId` / `req.user.tenantId`. */
  resolve?: (req: TenantRequest) => unknown | Promise<unknown>;
}

const TENANT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const fromIdentity = (req: TenantRequest) => req.auth?.tenantId ?? req.user?.tenantId;

export function createTenantMiddleware(options: TenantContextOptions = {}) {
  const resolve = options.resolve ?? fromIdentity;
  return async (req: TenantRequest, res: TenantResponse, next: Next) => {
    let id: unknown;
    try {
      id = await resolve(req);
    } catch {
      res.status(403).json({ error: 'tenant-forbidden' });
      return;
    }
    if (typeof id !== 'string' || !TENANT_ID.test(id)) {
      res.status(401).json({ error: 'tenant-required' });
      return;
    }
    req.tenantId = id;
    next();
  };
}

// Registered in the middleware glue after authentication; reads the tenant from the authenticated identity.
export const tenantMiddleware = createTenantMiddleware();
