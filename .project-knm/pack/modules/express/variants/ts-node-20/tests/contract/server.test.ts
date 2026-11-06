import { start } from '../../files/src/http/server';

describe('server contract', () => {
  it('starts on a free port with the scaffold glue and stops cleanly', async () => {
    const server = await start(0);
    const port = (server.address() as any).port;
    const res = await fetch(`http://127.0.0.1:${port}/definitely-missing`);
    // 404 with the bare scaffold; an installed guard (auth, tenant) may answer first: either way it is the JSON error shape
    expect([401, 403, 404]).toContain(res.status);
    expect(typeof (await res.json()).error).toBe('string');
    await new Promise((r) => server.close(r));
  });

  it('reports a port that is already taken', async () => {
    const first = await start(0);
    const port = (first.address() as any).port;
    await expect(start(port)).rejects.toThrow(/EADDRINUSE/);
    await new Promise((r) => first.close(r));
  });
});
