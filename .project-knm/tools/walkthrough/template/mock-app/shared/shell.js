// knm-managed: v1 version: 1
import { esc } from './components.js?v=1';
import { icon } from './icons.js?v=2';

// Header (who is acting), content, and a bottom tab bar built from the screens that declare `meta.nav` for the user's side.
// A screen with `meta.bare = true` (a sign-in) has no tab bar.
const tabsHtml = (tabs, activeCode) =>
  tabs
    .map((t) => `<button class="tab-item${t.code === activeCode ? ' active' : ''}" data-goto="${t.code}">${icon(t.icon || 'home')}<span>${esc(t.nav)}</span></button>`)
    .join('');

export function renderShell({ user, body, activeCode, tabs, bare, appTitle }) {
  return `
    <div class="shell">
      <header class="topbar">
        <span class="app-pill">${esc(appTitle)}</span>
        <div class="who"><strong>${esc(user.name)}</strong><small>${esc(user.roleLabel || '')}</small></div>
      </header>
      <main class="content">${body}</main>
      ${bare || !tabs.length ? '' : `<nav class="tabbar" aria-label="Main">${tabsHtml(tabs, activeCode)}</nav>`}
    </div>`;
}

export function renderDirectory(screens, appTitle) {
  const rows = screens
    .map((s) => `<li><code>${esc(s.code)}</code> <a href="?screen=${esc(s.code)}">${esc(s.name)}</a></li>`)
    .join('');
  return `<div class="directory"><h1>${esc(appTitle)} (mock)</h1>
    <p>Standalone view of every mock screen. Pick one to open it. Sample data only.</p>
    <ul>${rows || '<li>No screens yet.</li>'}</ul><p><a href="?reset=1">Reset mock data</a></p></div>`;
}
