// knm-managed: v1 version: 2
// Usage (run from docs/project/walkthrough/):
//   node walkthrough/validate-cli.mjs              validate every app (also roles.json against users.json)
//   node walkthrough/validate-cli.mjs --app everp  validate one app
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateWalkthrough } from './src/validation.js';

const top = fileURLToPath(new URL('../', import.meta.url));
const want = process.argv.includes('--app') ? process.argv[process.argv.indexOf('--app') + 1] : null;
const { apps } = JSON.parse(await readFile(top + 'apps/apps.json', 'utf8'));

let failed = false;
for (const { name, platform } of apps) {
  if (want && name !== want) continue;
  if (platform !== 'desktop' && platform !== 'mobile') {
    console.log(`FAIL app ${name}\n  error:   apps.json: platform must be "desktop" or "mobile" (got ${JSON.stringify(platform)})`);
    failed = true;
    continue;
  }
  const root = `${top}apps/${name}/`;
  const { SCREENS, loadScreen } = await import(pathToFileURL(root + 'mock-app/registry.js').href);
  const io = {
    fetchJson: async (p) => JSON.parse(await readFile(root + p, 'utf8')),
    loadScreen,
    screens: Object.keys(SCREENS)
  };
  const { walkthroughs } = await io.fetchJson('app.json');
  console.log(`App ${name}`);
  for (const entry of walkthroughs) {
    const { errors, warnings } = await validateWalkthrough(entry, io);
    console.log(`${errors.length ? 'FAIL' : 'OK  '} ${entry.id}`);
    errors.forEach((e) => console.log('  error:   ' + e));
    warnings.forEach((w) => console.log('  warning: ' + w));
    failed ||= errors.length > 0;
  }
}
if (want && !apps.some((a) => a.name === want)) {
  console.log(`Unknown app "${want}"`);
  failed = true;
}
process.exit(failed ? 1 : 0);
