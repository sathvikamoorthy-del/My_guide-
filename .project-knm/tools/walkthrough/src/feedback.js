// knm-managed: v1 version: 1
// Feedback panel: log observations about a screen, a transition, or the walkthrough in general.
// Floats (draggable) or docks to the bottom, like the step floater. Notes are shared through Firebase.
import { signInWithGoogle, addFeedback, editFeedback, setStatus, deleteFeedback, watchFeedback, isAdmin } from './firebase.js?v=2';
import { makeDraggable } from './floater.js?v=6';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TAGS = ['UI', 'Logic', 'Validation', 'Colour/Font', 'Content', 'Flow', 'Other'];
const STATUSES = ['open', 'accepted', 'rejected', 'done'];
const label = (s) => (s ? `${s.code} – ${s.name}` : '');
const when = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'just now');

export function createFeedback({ el, floater }) {
  let user = null;
  let notes = [];
  let tab = 'new';
  let editing = null; // id of the note being edited
  let filters = { walkthrough: '', type: '', status: '', mine: false };
  let stop = null;
  let loadError = '';
  const draftKey = () => `wt-feedback-draft:${user?.uid}`;
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey())) ?? {}; } catch { return {}; } };
  const saveDraft = (d) => { try { localStorage.setItem(draftKey(), JSON.stringify(d)); } catch {} };
  const clearDraft = () => { try { localStorage.removeItem(draftKey()); } catch {} };

  el.dataset.dock = 'float';
  makeDraggable(el, { getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }) });

  const ctx = () => floater._ctx ?? null;

  function open() {
    el.hidden = false;
    render();
  }
  const close = () => (el.hidden = true);

  function setUser(u) {
    user = u;
    stop?.();
    stop = null;
    notes = [];
    if (!u) return render();
    loadError = '';
    stop = watchFeedback(
      (list) => { notes = list; if (!el.hidden && user && tab === 'all') renderList(); },
      (e) => { loadError = e.message; if (!el.hidden) render(); }
    );
    render();
  }

  function render() {
    if (el.hidden) return;
    const c = ctx();
    const dock = el.dataset.dock;
    if (!user) return renderSignedOut(dock);
    el.innerHTML = `
      <div class="floater-head fb-head" title="Drag to move">
        <strong>Feedback</strong>
        <div class="floater-ctrls">
          <button class="floater-dock" data-act="dock" title="${dock === 'float' ? 'Dock to bottom' : 'Back to floating'}" aria-label="${dock === 'float' ? 'Dock to bottom' : 'Back to floating'}">${dock === 'float' ? '⤓' : '⧉'}</button>
          <button class="floater-dock" data-act="close" title="Close" aria-label="Close">✕</button>
        </div>
      </div>
      <div class="fb-tabs">
        <button data-tab="new" class="${tab === 'new' ? 'on' : ''}">${editing ? 'Edit note' : 'New note'}</button>
        <button data-tab="all" class="${tab === 'all' ? 'on' : ''}">All notes</button>
      </div>
      <div class="fb-body">${tab === 'new' ? formHtml(c) : ''}${tab === 'all' ? '<div id="fb-list"></div>' : ''}</div>`;
    el.querySelector('[data-act=close]').onclick = close;
    el.querySelector('[data-act=dock]').onclick = () => {
      el.dataset.dock = el.dataset.dock === 'float' ? 'bottom' : 'float';
      render();
    };
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { if (b.dataset.tab === 'all') editing = null; tab = b.dataset.tab; render(); }));
    if (tab === 'new') bindForm(c);
    else renderList();
  }

  function header(dock) {
    return `<div class="floater-head fb-head" title="Drag to move">
        <strong>Feedback</strong>
        <div class="floater-ctrls">
          <button class="floater-dock" data-act="dock" title="${dock === 'float' ? 'Dock to bottom' : 'Back to floating'}" aria-label="${dock === 'float' ? 'Dock to bottom' : 'Back to floating'}">${dock === 'float' ? '⤓' : '⧉'}</button>
          <button class="floater-dock" data-act="close" title="Close" aria-label="Close">✕</button>
        </div>
      </div>`;
  }

  function renderSignedOut(dock) {
    el.innerHTML = `${header(dock)}
      <div class="fb-body fb-signin">
        <p>Sign in to log feedback and see everyone's notes.</p>
        <button class="btn-primary" id="fb-signin">Sign in with Google</button>
        <div class="fb-error" id="fb-error" role="alert"></div>
      </div>`;
    el.querySelector('[data-act=close]').onclick = close;
    el.querySelector('[data-act=dock]').onclick = () => {
      el.dataset.dock = el.dataset.dock === 'float' ? 'bottom' : 'float';
      render();
    };
    el.querySelector('#fb-signin').onclick = async () => {
      try { await signInWithGoogle(); } catch (e) { el.querySelector('#fb-error').textContent = `Sign-in failed: ${e.message}`; }
    };
  }

  function formHtml(c) {
    const e = editing ? notes.find((n) => n.id === editing) : null;
    const d = e ?? { type: 'screen', title: '', text: '', ...readDraft() };
    const type = d.type ?? 'screen';
    const target = type === 'screen' ? label(e?.screen ?? c?.screen) : type === 'transition' ? `${label(e?.from ?? c?.screen)} → ${label(e?.to ?? c?.next)}` : '';
    return `
      <form id="fb-form" autocomplete="off">
        <label>Type
          <select name="type">${['screen', 'transition', 'generic'].map((t) => `<option value="${t}"${t === type ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>
        </label>
        <div class="fb-target">${target ? `About: <strong>${esc(target)}</strong>` : type === 'generic' ? 'Applies across screens' : 'No step is open'}</div>
        <label>Title
          <input name="title" list="fb-tags" maxlength="100" required value="${esc(d.title)}" placeholder="e.g. Validation, Colour/Font">
          <datalist id="fb-tags">${TAGS.map((t) => `<option value="${t}">`).join('')}</datalist>
        </label>
        <label>Feedback
          <textarea name="text" rows="5" maxlength="2000" required placeholder="What should change, and why?">${esc(d.text)}</textarea>
        </label>
        <div class="fb-error" id="fb-error" role="alert"></div>
        <div class="fb-actions">
          <button class="btn-primary" type="submit">${editing ? 'Save changes' : 'Send'}</button>
          ${editing ? '<button type="button" class="fb-link" id="fb-cancel">Cancel</button>' : ''}
        </div>
      </form>`;
  }

  function bindForm(c) {
    const form = el.querySelector('#fb-form');
    const err = el.querySelector('#fb-error');
    const read = () => ({ type: form.type.value, title: form.title.value.trim(), text: form.text.value.trim() });
    form.type.onchange = () => { if (!editing) saveDraft({ ...readDraft(), ...read() }); render(); };
    form.oninput = () => { if (!editing) saveDraft(read()); };
    const cancel = el.querySelector('#fb-cancel');
    if (cancel) cancel.onclick = () => { editing = null; tab = 'all'; render(); };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const btn = form.querySelector('[type=submit]');
      const v = read();
      if (!v.title || !v.text) return;
      if (v.type !== 'generic' && !editing && !c) { err.textContent = 'Open a walkthrough step first, or choose Generic.'; return; }
      btn.disabled = true;
      err.textContent = '';
      try {
        if (editing) {
          await editFeedback(editing, v);
          editing = null;
          tab = 'all';
        } else {
          const fb = { ...v, viewport: { w: innerWidth, h: innerHeight } };
          if (c) Object.assign(fb, { walkthrough: c.walkthrough, stepId: c.stepId, stepNo: c.stepNo, stepTotal: c.stepTotal });
          if (v.type === 'screen') fb.screen = c.screen;
          if (v.type === 'transition') {
            fb.from = c.screen;
            if (c.next) fb.to = c.next;
          }
          await addFeedback(user, fb);
          clearDraft();
          tab = 'all';
        }
        render();
      } catch (e) {
        err.textContent = `Could not send: ${e.message}. Your text is kept; try again.`;
        btn.disabled = false;
      }
    };
  }

  const matches = (n) =>
    (!filters.walkthrough || n.walkthrough === filters.walkthrough) &&
    (!filters.type || n.type === filters.type) &&
    (!filters.status || n.status === filters.status) &&
    (!filters.mine || n.uid === user.uid);

  function renderList() {
    const host = el.querySelector('#fb-list');
    if (!host) return;
    const admin = isAdmin(user);
    const wts = [...new Set(notes.map((n) => n.walkthrough).filter(Boolean))];
    const shown = notes.filter(matches);
    host.innerHTML = `
      <div class="fb-filters">
        <select data-f="walkthrough"><option value="">All walkthroughs</option>${wts.map((w) => `<option${w === filters.walkthrough ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select>
        <select data-f="type"><option value="">Any type</option>${['screen', 'transition', 'generic'].map((t) => `<option${t === filters.type ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <select data-f="status"><option value="">Any status</option>${STATUSES.map((s) => `<option${s === filters.status ? ' selected' : ''}>${s}</option>`).join('')}</select>
        <label class="fb-mine"><input type="checkbox" data-f="mine"${filters.mine ? ' checked' : ''}> Mine</label>
        ${admin ? '<button class="fb-link" data-export="md">Export .md</button><button class="fb-link" data-export="json">Export .json</button>' : ''}
      </div>
      ${loadError ? `<div class="fb-error">${esc(loadError)}</div>` : ''}
      <ul class="fb-list">${shown.length ? shown.map((n) => noteHtml(n, admin)).join('') : '<li class="fb-empty">No notes yet.</li>'}</ul>`;
    host.querySelectorAll('[data-f]').forEach((f) => (f.onchange = () => {
      filters[f.dataset.f] = f.type === 'checkbox' ? f.checked : f.value;
      renderList();
    }));
    host.querySelectorAll('[data-export]').forEach((b) => (b.onclick = () => exportNotes(shown, b.dataset.export)));
    host.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => { editing = b.dataset.edit; tab = 'new'; render(); }));
    host.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Delete this note?')) return;
      try { await deleteFeedback(b.dataset.del); } catch (e) { alert(`Could not delete: ${e.message}`); }
    }));
    host.querySelectorAll('[data-status]').forEach((s) => (s.onchange = async () => {
      try { await setStatus(s.dataset.status, s.value); } catch (e) { alert(`Could not change status: ${e.message}`); }
    }));
  }

  function noteHtml(n, admin) {
    const mine = n.uid === user.uid;
    const target = n.type === 'screen' ? label(n.screen) : n.type === 'transition' ? `${label(n.from)} → ${label(n.to)}` : 'General';
    return `<li class="fb-note">
      <div class="fb-note-top"><span class="fb-type fb-${esc(n.type)}">${esc(n.type)}</span> <strong>${esc(n.title)}</strong>
        ${admin ? `<select data-status="${esc(n.id)}">${STATUSES.map((s) => `<option${s === n.status ? ' selected' : ''}>${s}</option>`).join('')}</select>` : `<span class="fb-status fb-s-${esc(n.status)}">${esc(n.status)}</span>`}</div>
      <div class="fb-target">${esc(target)}${n.walkthrough ? ` · ${esc(n.walkthrough)}${n.stepNo ? ` ${n.stepNo}/${n.stepTotal}` : ''}` : ''}</div>
      <div class="fb-text">${esc(n.text)}</div>
      <div class="fb-meta">${esc(n.authorName || n.authorEmail)} · ${esc(when(n.createdAt))}
        ${(mine && n.status === 'open') ? `<button class="fb-link" data-edit="${esc(n.id)}">Edit</button><button class="fb-link" data-del="${esc(n.id)}">Delete</button>` : admin ? `<button class="fb-link" data-del="${esc(n.id)}">Delete</button>` : ''}</div>
    </li>`;
  }

  function exportNotes(list, kind) {
    let body, type;
    if (kind === 'json') {
      body = JSON.stringify(list, null, 2);
      type = 'application/json';
    } else {
      const groups = {};
      for (const n of [...list].reverse()) {
        const key = n.walkthrough ?? 'General';
        const sub = n.type === 'screen' ? label(n.screen) : n.type === 'transition' ? `Transition ${label(n.from)} → ${label(n.to)}` : 'General';
        ((groups[key] ??= {})[sub] ??= []).push(n);
      }
      body = '# Walkthrough feedback\n\n';
      for (const [w, subs] of Object.entries(groups)) {
        body += `## ${w}\n\n`;
        for (const [s, items] of Object.entries(subs)) {
          body += `### ${s}\n\n`;
          items.forEach((n, i) => (body += `${i + 1}. **${n.title}** [${n.status}] – ${n.text.replace(/\n+/g, ' ')} (${n.authorName || n.authorEmail}, ${when(n.createdAt)})\n`));
          body += '\n';
        }
      }
      type = 'text/markdown';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type }));
    a.download = `walkthrough-feedback.${kind === 'json' ? 'json' : 'md'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.addEventListener('floater-feedback', open);
  return { setUser, close };
}
