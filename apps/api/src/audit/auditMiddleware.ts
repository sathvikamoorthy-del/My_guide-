import { createAuditTrail, AuditSink, consoleSink } from './auditTrail';

export interface AuditRequest { method: string; path?: string; url?: string; tenantId?: string; auth?: { userId?: unknown }; user?: { id?: unknown } }
export interface AuditResponse { statusCode: number; on(event: 'finish', cb: () => void): unknown }

// Records every state-changing request (not GET/HEAD/OPTIONS) after the response is sent: actor, tenant, route and status.
export function createAuditMiddleware(sink: AuditSink = consoleSink) {
  const trail = createAuditTrail({ sink, onError: (err) => console.error('audit sink failed', err) });
  return (req: AuditRequest, res: AuditResponse, next: (err?: unknown) => void) => {
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
