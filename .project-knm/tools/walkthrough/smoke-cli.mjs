// knm-managed: v1 version: 1
// Loads walkthrough/?app=<app> in headless Chrome/Chromium and checks that the page really works:
// no uncaught console error, and one card per walkthrough in app.json, none showing problems.
// Usage (run from the project root): node docs/mock/<id>/walkthrough/smoke-cli.mjs --app <name>
// Browser: $KNM_BROWSER, else Chrome/Chromium/Edge in the usual places or on PATH.
// Exit: 0 passed, 1 failed, 2 skipped (no browser found; nothing was checked).
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const top = fileURLToPath(new URL('../', import.meta.url));   // docs/mock/<id>/
const app = process.argv.includes('--app') ? process.argv[process.argv.indexOf('--app') + 1] : null;
if (!app) { console.log('smoke: --app <name> is needed'); process.exit(1); }

const CANDIDATES = [
  process.env.KNM_BROWSER,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);
const onPath = (name) => (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').some((d) => d && existsSync(join(d, name)));
const browser = CANDIDATES.find((c) => (c.includes('/') || c.includes('\\') ? existsSync(c) : onPath(c)));
if (!browser) {
  console.log('smoke: SKIPPED, no Chrome/Chromium found (set KNM_BROWSER to its path). The page was NOT loaded.');
  process.exit(2);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain' };
const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let file = join(top, rel);
  if (!file.startsWith(top.replace(/[\\/]$/, '') + sep) && file !== top) { res.writeHead(403).end(); return; }
  if (rel.endsWith(sep) || rel.endsWith('/')) file = join(file, 'index.html');
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/walkthrough/?app=${encodeURIComponent(app)}`;

const profile = await mkdtemp(join(tmpdir(), 'knm-smoke-'));
const run = () => new Promise((resolve) => {
  const p = spawn(browser, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions', `--user-data-dir=${profile}`,
    '--enable-logging=stderr', '--v=0', '--virtual-time-budget=15000', '--dump-dom', url], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
  const timer = setTimeout(() => p.kill('SIGKILL'), 60000);
  p.on('close', () => { clearTimeout(timer); resolve({ out, err }); });
  p.on('error', (e) => { clearTimeout(timer); resolve({ out, err: String(e) }); });
});
const { out: dom, err } = await run();
server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});

const problems = [];
const consoleLines = err.split('\n').filter((l) => /:CONSOLE[:(]/.test(l) || /CONSOLE\(\d+\)/.test(l));
for (const l of consoleLines) if (/Uncaught|Error|Failed to load/i.test(l)) problems.push(`console: ${l.replace(/^.*?(CONSOLE[^\]]*\]\s*)/, '').trim()}`);

let expected = 0;
try { expected = JSON.parse(await readFile(`${top}apps/${app}/app.json`, 'utf8')).walkthroughs.length; } catch { problems.push(`apps/${app}/app.json cannot be read`); }
const cards = (dom.match(/class="card-wt"/g) ?? []).length;
if (!dom.includes('id="cards"')) problems.push('the page did not render (no catalogue in the loaded document)');
else if (cards !== expected) problems.push(`${cards} walkthrough card(s) rendered, app.json lists ${expected}`);
const bad = (dom.match(/class="validity bad"/g) ?? []).length;
if (bad) problems.push(`${bad} card(s) show problems (the browser check found errors; run validate-mock for the list)`);

if (problems.length) { console.log(`smoke: FAIL ${url}`); problems.forEach((p) => console.log('  error:   ' + p)); process.exit(1); }
console.log(`smoke: OK   ${cards} card(s) rendered for ${app}, no console errors (${browser})`);
