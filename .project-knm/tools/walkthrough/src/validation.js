// knm-managed: v1 version: 2
// Validates a walkthrough before it can start. Works in the browser and in Node:
// the caller supplies the loaders, so no DOM is needed.
//
// io = { fetchJson(rootRelativePath), loadScreen(code), screens: [codes] }

const ACTION_RE = /data-action="([^"]+)"/g;
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

export async function validateWalkthrough(entry, io) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);

  let seq, seed, users;
  try {
    seq = await io.fetchJson(entry.sequenceFile);
  } catch {
    return { errors: [`Sequence file not found or invalid JSON: ${entry.sequenceFile}`], warnings };
  }
  try {
    seed = await io.fetchJson(entry.seedData);
  } catch {
    return { errors: [`Seed data not found or invalid JSON: ${entry.seedData}`], warnings };
  }
  try {
    users = await io.fetchJson('mock-app/mock-data/users.json');
  } catch {
    return { errors: ['mock-app/mock-data/users.json is missing or not valid JSON'], warnings };
  }
  // Keys starting with "_" (for example "_sample") are metadata, not users.
  const userKeys = Object.keys(users).filter((k) => !k.startsWith('_'));
  // roles.json (user key -> { label, color }) sits next to app.json; the floater and popups read the role colour from it.
  let roles = null;
  try {
    roles = await io.fetchJson('roles.json');
  } catch {
    err('roles.json is missing or not valid JSON (it sits next to app.json: a map of user key -> { label, color }; "knm-context add-user" keeps it in step with users.json)');
  }
  for (const key of userKeys) {
    const u = users[key];
    if (!u || typeof u.name !== 'string' || !u.name) err(`users.json: user "${key}" needs a name`);
    else if (!u.roleLabel) warnings.push(`users.json: user "${key}" has no roleLabel (the role chip will be blank)`);
    if (roles && !roles[key]) err(`roles.json has no entry for user "${key}" (add { "label", "color" })`);
  }

  const steps = seq.steps ?? {};
  if (!steps[seq.startStep]) err(`startStep "${seq.startStep}" is not a defined step`);

  // Fetch every screen the sequence uses at the same time; the checks below then find them already loaded.
  await Promise.all([...new Set(Object.values(steps).map((s) => s.screen))].map((code) => io.loadScreen(code).catch(() => {})));

  const reached = new Set([seq.startStep]);

  // The data each step sees: the seed with every earlier stateChange applied along the first path found to the step.
  // A screen can look different after a change (a scan result, a recorded delivery), so it is checked in that state.
  const applyTo = (state, changes) => {
    for (const [key, change] of Object.entries(changes ?? {})) {
      const keys = key.split('.');
      const last = keys.pop();
      const parent = keys.reduce((o, k) => o?.[k], state);
      if (!parent) continue;
      const c = change && typeof change === 'object' && 'copy' in change ? { set: getPath(state, change.copy) } : change;
      parent[last] = typeof c === 'number' ? parent[last] + c : c?.set;
    }
  };
  const stateAt = {};
  if (steps[seq.startStep]) {
    stateAt[seq.startStep] = structuredClone(seed);
    const queue = [seq.startStep];
    while (queue.length) {
      const id = queue.shift();
      const step = steps[id];
      const moves = step.actions === undefined ? [[step.nextStep, step.stateChange]] : Object.values(step.actions).map((a) => [a.nextStep, a.stateChange]);
      for (const [next, changes] of moves) {
        if (!next || !steps[next] || next in stateAt) continue;
        stateAt[next] = structuredClone(stateAt[id]);
        applyTo(stateAt[next], changes);
        queue.push(next);
      }
    }
  }

  for (const [id, step] of Object.entries(steps)) {
    const at = `Step "${id}"`;
    if (!users[step.user] || String(step.user).startsWith('_')) err(`${at}: unknown user "${step.user}"`);
    if (!step.proposedAction) warnings.push(`${at}: no proposedAction (the next-step popup will be blank)`);

    let markup = '';
    let meta;
    try {
      const screen = await io.loadScreen(step.screen);
      meta = screen.meta;
      if (!meta?.code || !meta?.name) err(`${at}: screen ${step.screen} must export meta with code and name`);
      else if (meta.code !== step.screen) err(`${at}: screen registered as ${step.screen} declares code ${meta.code}`);
      markup = screen.render({ user: users[step.user], data: structuredClone(stateAt[id] ?? seed), params: new URLSearchParams() });
    } catch (e) {
      err(`${at}: screen "${step.screen}" cannot be loaded or rendered (${e.message})`);
    }

    // A step with no actions passes straight on (optional Not defined alert, then nextStep; null ends).
    // A step with actions must not also carry a step-level nextStep or notDefined.
    if (step.actions === undefined) {
      if (step.nextStep === undefined) err(`${at}: has no actions, so it needs nextStep (null ends the walkthrough)`);
      else if (step.nextStep !== null && !steps[step.nextStep]) err(`${at}: nextStep "${step.nextStep}" is not a defined step`);
      else if (step.nextStep) reached.add(step.nextStep);
    } else if (step.nextStep !== undefined || step.notDefined !== undefined) {
      err(`${at}: a step with actions cannot also set nextStep or notDefined (the engine shows a Not defined alert only for a step without actions; for a control on a screen use data-not-defined)`);
    }

    const onScreen = new Set([...markup.matchAll(ACTION_RE)].map((m) => m[1]));
    for (const [actionId, action] of Object.entries(step.actions ?? {})) {
      // goto-<code> is a link reported by the bridge (sidebar or a [data-goto] link); it is not a data-action on the screen.
      if (markup && !onScreen.has(actionId) && !actionId.startsWith('goto-'))
        err(`${at}: action "${actionId}" is not on screen ${step.screen} (was the mock screen changed?)`);
      if (action.nextStep) {
        reached.add(action.nextStep);
        if (!steps[action.nextStep]) err(`${at}: action "${actionId}" goes to unknown step "${action.nextStep}"`);
      } else if (action.nextStep !== null) {
        err(`${at}: action "${actionId}" needs nextStep (use null to end the walkthrough)`);
      }
      if (!action.performedText) warnings.push(`${at}: action "${actionId}" has no performedText`);
      for (const [key, change] of Object.entries(action.stateChange ?? {})) {
        const current = getPath(seed, key);
        if (current === undefined) err(`${at}: stateChange key "${key}" is not in the seed data`);
        else if (typeof change === 'number' && typeof current !== 'number')
          err(`${at}: stateChange "${key}" adds a number to a non-number`);
      }
    }
    for (const a of onScreen)
      if (!step.actions?.[a]) warnings.push(`${at}: screen ${step.screen} has action "${a}" with no rule (clicking it shows a hint)`);

    // A step with no actions can change state too (applied when its Not defined alert is dismissed).
    if (step.actions === undefined)
      for (const key of Object.keys(step.stateChange ?? {}))
        if (getPath(seed, key) === undefined) err(`${at}: stateChange key "${key}" is not in the seed data`);

    for (const item of step.infoPanel ?? [])
      if (getPath(seed, item.key) === undefined) err(`${at}: infoPanel key "${item.key}" is not in the seed data`);
  }

  for (const id of Object.keys(steps)) if (!reached.has(id)) warnings.push(`Step "${id}" is never reached`);
  return { errors, warnings };
}
