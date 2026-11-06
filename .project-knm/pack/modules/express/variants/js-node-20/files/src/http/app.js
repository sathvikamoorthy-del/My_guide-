// Express application factory: assembles the scaffold's glue (providers, middleware, routes) into one app.
import express, { Router } from 'express';
// Express 4 does not catch rejected promises from async handlers: forward them to the error handler.
export const wrapAsync = (fn) => (req, res, next) => {
    try {
        Promise.resolve(fn(req, res, next)).catch(next);
    }
    catch (err) {
        next(err);
    }
};
function assertUnique(kind, entries) {
    const seen = new Set();
    for (const e of entries) {
        if (seen.has(e.id))
            throw new Error(`duplicate ${kind} id "${e.id}"`);
        seen.add(e.id);
    }
}
export function createApp(glue) {
    assertUnique('provider', glue.providers);
    assertUnique('middleware', glue.middleware);
    assertUnique('route', glue.routes);
    const app = express();
    app.disable('x-powered-by');
    for (const p of glue.providers)
        p.register(app);
    app.use(express.json({ limit: '1mb' }));
    for (const m of glue.middleware)
        app.use(wrapAsync(m.handler)); // outer to inner, as listed
    const router = Router();
    for (const r of glue.routes)
        r.mount(router);
    app.use(router);
    app.use((_req, res) => { res.status(404).json({ error: 'not-found' }); });
    app.use((err, _req, res, _next) => {
        const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
        if (status === 500)
            console.error(err);
        res.status(status).json({ error: status === 500 ? 'internal-error' : String(err.message ?? 'error') }); // never leak internals on 500
    });
    return app;
}
