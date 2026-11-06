// knm-managed: v1 version: 1
import { roleChip } from './floater.js?v=6';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function show(el, html) {
  el.innerHTML = `<div class="popup" role="dialog" aria-modal="true">${html}</div>`;
  el.hidden = false;
  const btn = el.querySelector('[data-popup-continue]');
  btn.focus();
  return new Promise((resolve) => {
    btn.onclick = () => {
      el.hidden = true;
      el.innerHTML = '';
      resolve();
    };
  });
}

// from/to: { meta, user, color, proposedAction }, performedText: string
export function showTransition(el, { from, performedText, to }) {
  const same = from.user.name === to.user.name;
  return show(
    el,
    `<div class="popup-done">
       <div class="popup-screen">${esc(from.meta.code)}: ${esc(from.meta.name)}</div>
       <p><strong>${esc(from.user.name)}</strong> ${roleChip(from.user.roleLabel, from.color)} ${esc(performedText)}</p>
     </div>
     <div class="popup-next">
       <div class="popup-label">${same ? 'Continuing as' : 'Now moving to'}</div>
       <p><strong>${esc(to.user.name)}</strong> ${roleChip(to.user.roleLabel, to.color)}</p>
       <div class="popup-screen">${esc(to.meta.code)}: ${esc(to.meta.name)}</div>
       <p class="popup-action">Proposed action: ${esc(to.proposedAction)}</p>
     </div>
     <button class="btn-primary" data-popup-continue>Continue</button>`
  );
}

// A step with no spec detail: the walkthrough cannot show the screen's behaviour, so say so before moving on.
export function showNotDefined(el, { from, message }) {
  return show(
    el,
    `<div class="popup-done">
       <div class="popup-screen">${esc(from.meta.code)}: ${esc(from.meta.name)}</div>
     </div>
     <div class="popup-next"><div class="popup-label">Not defined</div><p>${esc(message)}</p></div>
     <button class="btn-primary" data-popup-continue>Continue</button>`
  );
}

export function showCompletion(el, { from, performedText, message }) {
  return show(
    el,
    `<div class="popup-done">
       <div class="popup-screen">${esc(from.meta.code)}: ${esc(from.meta.name)}</div>
       <p><strong>${esc(from.user.name)}</strong> ${roleChip(from.user.roleLabel, from.color)} ${esc(performedText)}</p>
     </div>
     <div class="popup-next"><div class="popup-label">Walkthrough complete</div><p>${esc(message ?? '')}</p></div>
     <button class="btn-primary" data-popup-continue>Back to walkthroughs</button>`
  );
}
