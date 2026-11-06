// Small helpers for handler and middleware tests (no framework needed).
export function mockRes() {
    const listeners = {};
    const res = {
        statusCode: 200, body: undefined, headers: {}, finished: false,
        status(code) { res.statusCode = code; return res; },
        json(body) { res.body = body; return res.send(body); },
        send(body) { res.body = body; res.finished = true; (listeners.finish ?? []).forEach((cb) => cb()); return res; },
        set(name, value) { res.headers[name.toLowerCase()] = value; return res; },
        on(event, cb) { (listeners[event] ?? (listeners[event] = [])).push(cb); return res; }
    };
    return res;
}
export function mockReq(overrides = {}) {
    return { method: 'GET', path: '/', headers: {}, body: undefined, ...overrides };
}
/** Runs `fn` with environment variables set, then restores them (also when `fn` throws). */
export async function withEnv(vars, fn) {
    const before = {};
    for (const [k, v] of Object.entries(vars)) {
        before[k] = process.env[k];
        if (v === undefined)
            delete process.env[k];
        else
            process.env[k] = v;
    }
    try {
        return await fn();
    }
    finally {
        for (const [k, v] of Object.entries(before)) {
            if (v === undefined)
                delete process.env[k];
            else
                process.env[k] = v;
        }
    }
}
