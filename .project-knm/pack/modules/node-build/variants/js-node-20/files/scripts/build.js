// Production build for plain JavaScript: copies src/ to dist/ without test files (stale output is removed first).
//   node scripts/build.js
const fs = require('fs');
const path = require('path');

const isTest = (name) => /\.(test|spec)\.[cm]?jsx?$/.test(name);

function copyDir(from, to, copied, root = to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, copied, root);
    else if (!isTest(entry.name)) { fs.copyFileSync(src, dst); copied.push(path.relative(root, dst).split(path.sep).join('/')); }
  }
}

function build({ cwd = process.cwd(), outDir = 'dist' } = {}) {
  const src = path.join(cwd, 'src');
  fs.rmSync(path.join(cwd, outDir), { recursive: true, force: true });
  if (!fs.existsSync(src)) return { ok: false, output: 'no src/ directory\n', files: [] };
  const files = [];
  copyDir(src, path.join(cwd, outDir), files);
  return { ok: files.length > 0, output: files.length ? '' : 'src/ has no source files\n', files };
}

// Command line entry: prints the build output, returns the exit code.
function run(options) {
  const r = build(options);
  if (r.output) process.stdout.write(r.output);
  return r.ok ? 0 : 1;
}

module.exports = { build, run };

if (require.main === module) process.exit(run());
