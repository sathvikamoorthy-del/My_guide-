// Resolves the tenant of a request from the authenticated identity (never from a client-chosen header by default).
const TENANT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const fromIdentity = (req) => req.auth?.tenantId ?? req.user?.tenantId;
export function createTenantMiddleware(options = {}) {
    const resolve = options.resolve ?? fromIdentity;
    return async (req, res, next) => {
        let id;
        try {
            id = await resolve(req);
        }
        catch {
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
