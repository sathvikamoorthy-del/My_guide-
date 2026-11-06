/** @jest-environment node */
describe('vite config contract', () => {
  it('uses the React plugin, a dev port from PORT (default 5173) and builds to dist with source maps', async () => {
    delete process.env.PORT;
    const cfg = (await import('../../files/vite.config')).default as any;
    expect(cfg.plugins.flat(5).some((p: any) => p && /react/i.test(p.name))).toBe(true);
    expect(cfg.server.port).toBe(5173);
    expect(cfg.build).toEqual({ outDir: 'dist', sourcemap: true });
  });
  it('honours PORT', async () => {
    jest.resetModules(); process.env.PORT = '4321';
    expect(((await import('../../files/vite.config')).default as any).server.port).toBe(4321);
    delete process.env.PORT;
  });
});
