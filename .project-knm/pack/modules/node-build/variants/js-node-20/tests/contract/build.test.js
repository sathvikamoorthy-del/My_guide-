import fs from 'fs';
import os from 'os';
import path from 'path';
const { build, run } = require('../../files/scripts/build.js');

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knm-build-'));
  fs.mkdirSync(path.join(dir, 'src/lib'), { recursive: true });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('node build contract', () => {
  it('copies sources (nested) to dist and leaves test files out', () => {
    fs.writeFileSync(path.join(dir, 'src/a.js'), 'export const a = 1;');
    fs.writeFileSync(path.join(dir, 'src/lib/b.js'), 'export const b = 1;');
    fs.writeFileSync(path.join(dir, 'src/a.test.js'), 'x');
    const r = build({ cwd: dir });
    expect(r.ok).toBe(true);
    expect(r.files.sort()).toEqual(['a.js', 'lib/b.js']);
    expect(fs.existsSync(path.join(dir, 'dist/a.test.js'))).toBe(false);
  });

  it('removes stale output and fails without sources', () => {
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'dist/old.js'), 'x');
    const r = build({ cwd: dir });
    expect(r.ok).toBe(false);
    expect(fs.existsSync(path.join(dir, 'dist/old.js'))).toBe(false);
    fs.rmSync(path.join(dir, 'src'), { recursive: true });
    expect(build({ cwd: dir }).output).toMatch(/no src/);
  });

  it('run() prints the output and returns the exit code', () => {
    const out = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    fs.rmSync(path.join(dir, 'src'), { recursive: true });
    expect(run({ cwd: dir })).toBe(1);
    expect(out).toHaveBeenCalled();
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/a.js'), 'export const a = 1;');
    expect(run({ cwd: dir })).toBe(0);
    out.mockRestore();
  });

  it('works as a command line script', () => {
    const { spawnSync } = require('child_process');
    const script = require.resolve('../../files/scripts/build.js');
    expect(spawnSync(process.execPath, [script], { cwd: dir }).status).toBe(1);
    fs.writeFileSync(path.join(dir, 'src/a.js'), 'export const a = 1;');
    expect(spawnSync(process.execPath, [script], { cwd: dir }).status).toBe(0);
  });
});
