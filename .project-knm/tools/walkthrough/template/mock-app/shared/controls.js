// knm-managed: v1 version: 1
// Walkthrough behaviour for controls that do not move the flow. A click shows a toast saying
// what would happen, or the "Not defined" alert. A field toasts on change, so focusing it stays quiet.
// The shell keeps its own handlers (shell-behavior.js).
import { toast, notDefined } from './ui.js?v=1';

const FIELD = 'input, select, textarea';

function respond(el) {
  if (el.dataset.notDefined) return notDefined(el.dataset.notDefined);
  toast(el.dataset.toast);
}

export function installControls() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-toast], [data-not-defined]');
    // A select with no spec detail alerts on click; other fields wait for change.
    if (!el || (el.matches(FIELD) && !el.dataset.notDefined)) return;
    respond(el);
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches?.('[data-toast]')) respond(e.target);
  });
}
