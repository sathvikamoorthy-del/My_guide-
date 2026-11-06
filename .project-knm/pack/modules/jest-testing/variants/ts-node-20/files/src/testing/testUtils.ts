// Small helpers for handler and middleware tests (no framework needed).
export interface MockRes {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  finished: boolean;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  send(body: unknown): MockRes;
  set(name: string, value: string): MockRes;
  on(event: string, cb: () => void): MockRes;
}

export function mockRes(): MockRes {
  const listeners: Record<string, (() => void)[]> = {};
  const res: MockRes = {
    statusCode: 200, body: undefined, headers: {}, finished: false,
    status(code) { res.statusCode = code; return res; },
    json(body) { res.body = body; return res.send(body); },
    send(body) { res.body = body; res.finished = true; (listeners.finish ?? []).forEach((cb) => cb()); return res; },
    set(name, value) { res.headers[name.toLowerCase()] = value; return res; },
    on(event, cb) { (listeners[event] ??= []).push(cb); return res; }
  };
  return res;
}

export function mockReq<T extends object>(overrides: T = {} as T) {
  return { method: 'GET', path: '/', headers: {} as Record<string, string>, body: undefined as unknown, ...overrides };
}

/** Runs `fn` with environment variables set, then restores them (also when `fn` throws). */
export async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const before: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    before[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}
