// Production build: type-checks and compiles src/ to dist/ with the project's own tsconfig.json (stale output is removed first).
//   node scripts/build.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function build({ cwd = process.cwd(), outDir = 'dist' } = {}) {
  const tsc = require.resolve('typescript/bin/tsc', { paths: [cwd, __dirname] });
  fs.rmSync(path.join(cwd, outDir), { recursive: true, force: true });
  const r = spawnSync(process.execPath, [tsc, '--project', 'tsconfig.json', '--noEmit', 'false', '--noEmitOnError', '--outDir', outDir], { cwd, encoding: 'utf-8' });
  return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') };
}

// Command line entry: prints the build output, returns the exit code.
function run(options) {
  const r = build(options);
  if (r.output) process.stdout.write(r.output);
  return r.ok ? 0 : 1;
}

module.exports = { build, run };

if (require.main === module) process.exit(run());
