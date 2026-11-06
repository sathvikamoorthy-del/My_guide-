import { createAuditTrail, consoleSink } from './auditTrail';
// Records every state-changing request (not GET/HEAD/OPTIONS) after the response is sent: actor, tenant, route and status.
export function createAuditMiddleware(sink = consoleSink) {
    const trail = createAuditTrail({ sink, onError: (err) => console.error('audit sink failed', err) });
    return (req, res, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
            res.on('finish', () => {
                const who = req.auth?.userId ?? req.user?.id;
                void trail.record({
                    actor: typeof who === 'string' && who ? who : 'anonymous',
                    action: `${req.method.toUpperCase()} ${req.path ?? req.url ?? ''}`,
                    tenantId: req.tenantId,
                    meta: { status: res.statusCode }
                });
            });
        }
        next();
    };
}
// Registered in the middleware glue; place it after authentication so the actor is known.
export const auditMiddleware = createAuditMiddleware();
