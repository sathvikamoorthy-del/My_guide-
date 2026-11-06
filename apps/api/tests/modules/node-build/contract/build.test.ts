import fs from 'fs';
import os from 'os';
import path from 'path';
const { build, run } = require('../../../../scripts/build.js');

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knm-build-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'commonjs', strict: true, noEmit: true, types: [] }, include: ['src/**/*.ts'] }));
  fs.writeFileSync(path.join(dir, 'tests/a.test.ts'), 'export const t: number = 1;');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('node build contract', () => {
  it('compiles src to dist and leaves tests out', () => {
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a: number = 1;');
    const r = build({ cwd: dir });
    expect(r.ok).toBe(true);
    expect(fs.existsSync(path.join(dir, 'dist/a.js'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'dist/tests'))).toBe(false);
  });

  it('fails on a type error, reports it and produces no stale output', () => {
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a: number = 1;');
    expect(build({ cwd: dir }).ok).toBe(true);
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a: number = "x";');
    const r = build({ cwd: dir });
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/TS2322/);
    expect(fs.existsSync(path.join(dir, 'dist/a.js'))).toBe(false);
  });

  it('removes files that no longer exist in src', () => {
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a = 1;');
    fs.writeFileSync(path.join(dir, 'src/b.ts'), 'export const b = 1;');
    build({ cwd: dir });
    fs.rmSync(path.join(dir, 'src/b.ts'));
    build({ cwd: dir });
    expect(fs.existsSync(path.join(dir, 'dist/b.js'))).toBe(false);
  });

  it('run() prints the output and returns the exit code', () => {
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a = 1;');
    const out = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    expect(run({ cwd: dir })).toBe(0);
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a: string = 1;');
    expect(run({ cwd: dir })).toBe(1);
    expect(out).toHaveBeenCalled();
    out.mockRestore();
  });

  it('works as a command line script', () => {
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a = 1;');
    const { spawnSync } = require('child_process');
    const script = require.resolve('../../../../scripts/build.js');
    expect(spawnSync(process.execPath, [script], { cwd: dir }).status).toBe(0);
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a: string = 1;');
    expect(spawnSync(process.execPath, [script], { cwd: dir }).status).toBe(1);
  });
});
