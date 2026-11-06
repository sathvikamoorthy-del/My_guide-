// knm-managed: v1 version: 2
import { createFrame } from './frame-host.js?v=6';
import { renderFloater, makeDraggable } from './floater.js?v=6';
import { showTransition, showCompletion, showNotDefined } from './transition-popup.js?v=5';

// Set from the app passed to createEngine: { root, store, registry }.
let ROOT, setState, snapshot, getPath, applyChange, loadScreen;
const fetchJson = async (path) => {
  const res = await fetch(new URL(path, ROOT), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

const fmt = (value, format) => (format === 'inr' ? '₹' + Number(value).toLocaleString('en-IN') : String(value));

// Names of people come from users.json, read as "{users.<key>.name}". Everything else comes from the seed.
let people = {};
const lookup = (path) => (path.startsWith('users.') ? path.slice(6).split('.').reduce((o, k) => o?.[k], people) : getPath(path));

// Sequence text can name a value from the seed: "{order.id}" or "{order.advanceDue|inr}".
const fill = (text) => String(text ?? '').replace(/\{([^}|]+)(?:\|(\w+))?\}/g, (_, path, format) => fmt(lookup(path), format));

// A stateChange can copy a value from the seed: { "copy": "order.advanceDue" }.
const resolveChange = (change) => (change && typeof change === 'object' && 'copy' in change ? { set: getPath(change.copy) } : change);

export async function createEngine({ els, onChange, onExit, app }) {
  ROOT = app.root;
  ({ setState, snapshot, getPath, applyChange } = app.store);
  ({ loadScreen } = app.registry);
  // A missing roles.json must not stop the catalogue: roles only supply the chip colour (colorOf has a default).
  // The validator reports the missing file on the walkthrough card.
  const [users, roles] = await Promise.all([
    fetchJson('mock-app/mock-data/users.json'),
    fetchJson('roles.json').catch(() => {
      console.warn('roles.json is missing; role colours fall back to grey');
      return {};
    })
  ]);
  people = users;
  const colorOf = (userId) => roles[userId]?.color ?? '#475467';

  const frame = createFrame(els.frame, (action) => handleAction(action), new URL('mock-app/index.html', ROOT));
  makeDraggable(els.floater, els.floater.parentElement);
  let run = null; // { entry, seq, seed, stepId, history: [{ stepId, state }], shown: {}, busy }

  const stepNumber = () => Object.keys(run.seq.steps).indexOf(run.stepId) + 1;

  async function describe(stepId) {
    const step = run.seq.steps[stepId];
    const { meta } = await loadScreen(step.screen);
    return { step, meta, user: users[step.user], color: colorOf(step.user), proposedAction: fill(step.proposedAction) };
  }

  // The step that follows: the first action's nextStep, or the step's own nextStep for a step with no actions
  const nextOf = (stepId) => {
    const step = run.seq.steps[stepId];
    return Object.values(step.actions ?? {})[0]?.nextStep ?? step.nextStep;
  };

  // Steps after this one along the main path, without loops
  async function upcomingFrom(stepId) {
    const out = [];
    const seen = new Set([stepId]);
    let next = nextOf(stepId);
    while (next && !seen.has(next)) {
      seen.add(next);
      out.push(await describe(next));
      next = nextOf(next);
    }
    return out;
  }

  async function showStep(stepId) {
    clearHint();
    run.stepId = stepId;
    const { step, meta, user, color } = await describe(stepId);
    const items = (step.infoPanel ?? []).map((i) => {
      const text = fmt(getPath(i.key), i.format);
      const prevText = run.shown[i.key];
      return { label: fill(i.label), text, changed: prevText !== undefined && prevText !== text, prevText };
    });
    for (const i of step.infoPanel ?? []) run.shown[i.key] = fmt(getPath(i.key), i.format);
    const upcoming = await upcomingFrom(stepId);
    els.floater._ctx = {
      walkthrough: run.entry.id,
      stepId,
      stepNo: stepNumber(),
      stepTotal: Object.keys(run.seq.steps).length,
      screen: { code: meta.code, name: meta.name },
      next: upcoming[0] ? { code: upcoming[0].meta.code, name: upcoming[0].meta.name } : null
    };
    renderFloater(els.floater, { meta, user, color, proposedAction: fill(step.proposedAction), items, upcoming });
    frame.load(step.screen, step.user);
    onChange({ title: run.entry.title, step: stepNumber(), total: Object.keys(run.seq.steps).length, canBack: run.history.length > 0 });
    if (step.actions === undefined) await passThrough(stepId);
  }

  // A step with no screen action (no actions in the sequence): show its Not defined alert if it has one,
  // then move on by the step's own nextStep. Not added to history, so Back returns to the step before it.
  async function passThrough(stepId) {
    const step = run.seq.steps[stepId];
    const current = run;
    current.busy = true;
    try {
      const from = await describe(stepId);
      if (step.notDefined) await showNotDefined(els.popup, { from, message: fill(step.notDefined) });
      for (const [key, change] of Object.entries(step.stateChange ?? {})) applyChange(key, resolveChange(change));
      if (step.nextStep === null) {
        await showCompletion(els.popup, { from, performedText: fill(step.performedText), message: fill(run.seq.completionMessage) });
        end();
        return;
      }
      const to = await describe(step.nextStep);
      await showTransition(els.popup, { from, performedText: fill(step.performedText), to });
      await showStep(step.nextStep);
    } finally {
      current.busy = false;
    }
  }

  async function handleAction(actionId) {
    if (!run || run.busy) return;
    const step = run.seq.steps[run.stepId];
    const action = step.actions?.[actionId];
    if (!action) return hint(`Not part of this walkthrough step. Next: ${step.proposedAction}`);
    clearHint();

    const current = run;
    current.busy = true;
    try {
      const from = await describe(run.stepId);
      run.history.push({ stepId: run.stepId, state: snapshot() });
      for (const [key, change] of Object.entries(action.stateChange ?? {})) applyChange(key, resolveChange(change));

      if (action.nextStep === null) {
        await showCompletion(els.popup, { from, performedText: fill(action.performedText), message: fill(run.seq.completionMessage) });
        end();
        return;
      }
      const to = await describe(action.nextStep);
      await showTransition(els.popup, { from, performedText: fill(action.performedText), to });
      await showStep(action.nextStep);
    } finally {
      current.busy = false;
    }
  }

  // Off-script click: a visible message that stays until the user dismisses it or clicks the right control.
  // It is cleared when a step is shown, when the right control is clicked, and when the walkthrough ends.
  function hint(text) {
    const message = Object.assign(document.createElement('span'), { textContent: text });
    const close = Object.assign(document.createElement('button'), { type: 'button', className: 'hint-close', textContent: 'Dismiss' });
    close.onclick = clearHint;
    els.hint.replaceChildren(message, close);
    els.hint.hidden = false;
  }

  function clearHint() {
    els.hint.hidden = true;
    els.hint.replaceChildren();
  }

  function end() {
    clearHint();
    frame.clear();
    els.floater.hidden = true;
    els.floater._ctx = null;
    run = null;
    onExit();
  }

  return {
    async start(entry) {
      const [seq, seed] = await Promise.all([fetchJson(entry.sequenceFile), fetchJson(entry.seedData)]);
      setState(seed);
      run = { entry, seq, seed, stepId: null, history: [], shown: {}, busy: false };
      await showStep(seq.startStep);
    },
    async restart() {
      if (!run) return;
      setState(run.seed);
      run.history = [];
      run.shown = {};
      await showStep(run.seq.startStep);
    },
    async back() {
      if (!run || run.busy || !run.history.length) return;
      const prev = run.history.pop();
      setState(prev.state);
      run.shown = {};
      await showStep(prev.stepId);
    },
    exit: end
  };
}
