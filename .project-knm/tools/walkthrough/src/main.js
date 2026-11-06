// knm-managed: v1 version: 2
import { validateWalkthrough } from './validation.js?v=9';
import { createEngine } from './engine.js?v=8';
import { watchUser, signInWithGoogle, signOutUser, setAppName } from './firebase.js?v=2';
import { createFeedback } from './feedback.js?v=2';

const $ = (id) => document.getElementById(id);
const APPS = new URL('../../apps/', import.meta.url);
const getJson = async (url) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Which app: ?app=<name>. With none given, a single registered app is used; several are listed to choose from.
const { apps } = await getJson(new URL('apps.json', APPS));
let appName = new URLSearchParams(location.search).get('app');
if (!appName && apps.length === 1) appName = apps[0].name;
if (!apps.some((a) => a.name === appName)) {
  $('cards').innerHTML = apps.map((a) => `<article class="card-wt"><h2>${esc(a.title)}</h2><a class="btn-primary" href="?app=${encodeURIComponent(a.name)}">Open</a></article>`).join('');
  $('catalogue').hidden = false;
  throw new Error('No app selected');
}

const ROOT = new URL(`${appName}/`, APPS);
const fetchJson = async (path) => {
  const res = await fetch(new URL(path, ROOT), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};
const store = await import(new URL('mock-app/store.js?v=1', ROOT));
const registry = await import(new URL('mock-app/registry.js?v=1', ROOT));
const { SCREENS, loadScreen } = registry;
const appInfo = await fetchJson('app.json');
setAppName(appInfo.feedbackApp);
await store.initStore();

// Mobile apps always show in the phone frame; desktop apps can switch to it (choice remembered per app).
const platform = apps.find((a) => a.name === appName).platform ?? 'desktop';
const deviceKey = `wt-phone:${appName}`;
const readPhone = () => { try { return localStorage.getItem(deviceKey) === '1'; } catch { return false; } };
const setPhone = (on) => {
  $('stage').classList.toggle('phone', on);
  $('btn-device').setAttribute('aria-pressed', String(on));
  try { localStorage.setItem(deviceKey, on ? '1' : '0'); } catch {}
};
if (platform === 'mobile') $('stage').classList.add('phone');
else {
  $('btn-device').hidden = false;
  setPhone(readPhone());
  $('btn-device').onclick = () => setPhone(!$('stage').classList.contains('phone'));
}

const engine = await createEngine({
  app: { root: ROOT, store, registry },
  els: { frame: $('frame'), floater: $('floater'), popup: $('popup'), hint: $('hint') },
  onChange({ title, step, total, canBack }) {
    $('catalogue').hidden = true;
    $('stage').hidden = false;
    $('bar-controls').hidden = false;
    $('bar-title').textContent = title;
    $('bar-progress').textContent = `${step}/${total}`;
    $('btn-back').disabled = !canBack;
  },
  onExit() {
    $('stage').hidden = true;
    $('bar-controls').hidden = true;
    $('bar-title').textContent = 'ERP walkthroughs';
    $('bar-progress').textContent = '';
    $('catalogue').hidden = false;
  }
});

const feedback = createFeedback({ el: $('feedback'), floater: $('floater') });
$('btn-signin').onclick = async () => {
  try { await signInWithGoogle(); } catch (e) { alert(`Sign-in failed: ${e.message}`); }
};
$('btn-signout').onclick = () => signOutUser();
// The walkthroughs are open to everyone; signing in is only needed to log feedback.
watchUser((user) => {
  feedback.setUser(user);
  $('user-name').textContent = user ? user.displayName || user.email : '';
  $('btn-signin').hidden = !!user;
  $('btn-signout').hidden = !user;
});

$('btn-back').onclick = () => engine.back();
$('btn-restart').onclick = () => engine.restart();
$('btn-exit').onclick = () => engine.exit();

const io = { fetchJson, loadScreen, screens: Object.keys(SCREENS) };
const { walkthroughs } = appInfo;

// Cards show at once; each is checked in the background and its Start button turns on when the check passes.
await Promise.all(
  walkthroughs.map(async (entry) => {
    const card = document.createElement('article');
    card.className = 'card-wt';
    card.innerHTML = `
      <h2>${esc(entry.title)}</h2>
      <p>${esc(entry.description)}</p>
      <p class="validity">Checking screens, actions and data...</p>
      <div class="problems-host"></div>
      <button class="btn-primary" disabled>Start walkthrough</button>`;
    card.querySelector('button').onclick = () => engine.start(entry);
    $('cards').appendChild(card);

    const { errors, warnings } = await validateWalkthrough(entry, io);
    const validity = card.querySelector('.validity');
    validity.classList.add(errors.length ? 'bad' : 'ok');
    validity.textContent = `${errors.length ? `${errors.length} problem(s) - cannot start` : 'Checked: all screens, actions and data found'}${warnings.length ? ` · ${warnings.length} warning(s)` : ''}`;
    if (errors.length) card.querySelector('.problems-host').innerHTML = `<ul class="problems">${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
    card.querySelector('button').disabled = errors.length > 0;
  })
);
