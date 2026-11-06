import http from 'http';
import { createApp, wrapAsync } from '../../files/src/http/app';

const serve = async (glue: any) => {
  const server = await new Promise<http.Server>((resolve) => { const s = createApp(glue).listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
};
const empty = { routes: [], middleware: [], providers: [] };

describe('express app contract', () => {
  it('mounts routes, parses JSON bodies and answers JSON 404 for unknown paths', async () => {
    const s = await serve({ ...empty, routes: [{ id: 'echo', mount: (r: any) => r.post('/echo', (req: any, res: any) => res.json({ got: req.body })) }] });
    const ok = await fetch(s.base + '/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' });
    expect(await ok.json()).toEqual({ got: { a: 1 } });
    const nf = await fetch(s.base + '/nope');
    expect(nf.status).toBe(404);
    expect(await nf.json()).toEqual({ error: 'not-found' });
    await s.close();
  });

  it('applies middleware outer to inner, before routes; a middleware can stop the request', async () => {
    const order: string[] = [];
    const mw = (id: string, stop = false) => ({ id, handler: (_q: any, res: any, next: any) => { order.push(id); stop ? res.status(401).json({ error: id }) : next(); } });
    const routes = [{ id: 'r', mount: (r: any) => r.get('/x', (_q: any, res: any) => { order.push('route'); res.json({}); }) }];
    const s = await serve({ ...empty, routes, middleware: [mw('outer'), mw('inner')] });
    await fetch(s.base + '/x');
    expect(order).toEqual(['outer', 'inner', 'route']);
    await s.close();
    order.length = 0;
    const s2 = await serve({ ...empty, routes, middleware: [mw('outer'), mw('guard', true), mw('inner')] });
    expect((await fetch(s2.base + '/x')).status).toBe(401);
    expect(order).toEqual(['outer', 'guard']);
    await s2.close();
  });

  it('providers run first and may configure the app', async () => {
    const s = await serve({ ...empty, providers: [{ id: 'p', register: (app: any) => app.set('flag', 'on') }], routes: [{ id: 'r', mount: (r: any) => r.get('/f', (req: any, res: any) => res.json({ flag: req.app.get('flag') })) }] });
    expect(await (await fetch(s.base + '/f')).json()).toEqual({ flag: 'on' });
    await s.close();
  });

  it('rejects duplicate ids', () => {
    expect(() => createApp({ ...empty, routes: [{ id: 'a', mount: () => {} }, { id: 'a', mount: () => {} }] } as any)).toThrow(/duplicate route id "a"/);
    expect(() => createApp({ ...empty, middleware: [{ id: 'm', handler: () => {} }, { id: 'm', handler: () => {} }] } as any)).toThrow(/duplicate middleware/);
    expect(() => createApp({ ...empty, providers: [{ id: 'p', register: () => {} }, { id: 'p', register: () => {} }] } as any)).toThrow(/duplicate provider/);
  });

  it('turns thrown and rejected handler errors into JSON, never leaking internals on 500', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const routes = [{ id: 'r', mount: (r: any) => {
      r.get('/boom', wrapAsync(async () => { throw new Error('secret db password'); }));
      r.get('/sync', () => { throw new Error('sync secret'); });
      r.get('/bad', () => { const e: any = new Error('bad input'); e.status = 422; throw e; });
    } }];
    const s = await serve({ ...empty, routes });
    for (const p of ['/boom', '/sync']) {
      const res = await fetch(s.base + p);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'internal-error' });
    }
    const bad = await fetch(s.base + '/bad');
    expect(bad.status).toBe(422);
    expect(await bad.json()).toEqual({ error: 'bad input' });
    await s.close();
    log.mockRestore();
  });

  it('wrapAsync forwards a synchronous throw as well', () => {
    const next = jest.fn();
    wrapAsync(() => { throw new Error('x'); })({} as any, {} as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('does not advertise the framework', async () => {
    const s = await serve({ ...empty, routes: [{ id: 'r', mount: (r: any) => r.get('/h', (_q: any, res: any) => res.send('ok')) }] });
    expect((await fetch(s.base + '/h')).headers.get('x-powered-by')).toBeNull();
    await s.close();
  });
});
