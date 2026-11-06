// knm-managed: v1 version: 1
// The one floating card per screen: "<code>: <name> - <user>", what to do now,
// live info, and the steps coming up. Draggable; position survives step changes.
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function roleChip(label, color) {
  return `<span class="chip" style="--chip:${esc(color)}">${esc(label)}</span>`;
}

const MAX_UPCOMING = 3;

// data: { meta, user, color, proposedAction, items: [{ label, text, changed, prevText }],
//         upcoming: [{ meta, user, color, proposedAction }] }
export function renderFloater(el, data) {
  const { meta, user, color, proposedAction, items, upcoming = [] } = data;
  const dock = el.dataset.dock || 'float';
  const collapsed = el.classList.contains('collapsed');
  const shown = upcoming.slice(0, MAX_UPCOMING);
  const more = upcoming.length - shown.length;
  el.hidden = false;
  el.innerHTML = `
    <div class="floater-head" title="Drag to move">
      <div>
        <div class="floater-title">${esc(meta.code)}: ${esc(meta.name)}</div>
        <div class="floater-user">${esc(user.name)} ${roleChip(user.roleLabel, color)}</div>
      </div>
      <div class="floater-ctrls">
        ${dock === 'float'
          ? `<button class="floater-dock" data-dock="top" title="Dock to top" aria-label="Dock to top">⤒</button>
             <button class="floater-dock" data-dock="bottom" title="Dock to bottom" aria-label="Dock to bottom">⤓</button>`
          : `<button class="floater-dock" data-dock="float" title="Back to floating" aria-label="Back to floating">⧉</button>`}
      <button class="floater-toggle" aria-label="${collapsed ? 'Expand' : 'Collapse'}" aria-expanded="${!collapsed}">${collapsed ? '+' : '–'}</button>
      </div>
    </div>
    <div class="floater-now"><span>Do now</span>${esc(proposedAction)}</div>
    <div class="floater-body">
      <dl class="floater-info">
        ${items
          .map(
            (i) => `<div class="${i.changed ? 'changed' : ''}"><dt>${esc(i.label)}</dt>
              <dd>${i.changed ? `<s>${esc(i.prevText)}</s> ` : ''}${esc(i.text)}</dd></div>`
          )
          .join('')}
      </dl>
      ${
        shown.length
          ? `<details class="floater-next"${el.dataset.nextOpen === '1' ? ' open' : ''}>
              <summary class="floater-next-title">Coming up (${upcoming.length})</summary>
              <ol>${shown
                .map(
                  (s) => `<li><strong>${esc(s.user.name)}</strong> ${roleChip(s.user.roleLabel, s.color)}
                    <div>${esc(s.meta.code)}: ${esc(s.meta.name)}</div>
                    <div class="floater-next-action">${esc(s.proposedAction)}</div></li>`
                )
                .join('')}</ol>
              ${more > 0 ? `<div class="floater-more">+ ${more} more step${more > 1 ? 's' : ''}</div>` : ''}</details>`
          : '<div class="floater-next"><div class="floater-next-title">This is the last step</div></div>'
      }
    </div>`;
  const next = el.querySelector('details.floater-next');
  if (next) next.ontoggle = () => (el.dataset.nextOpen = next.open ? '1' : '0');
  el.querySelectorAll('.floater-dock[data-dock]').forEach((b) => {
    b.onclick = () => {
      setDock(el, b.dataset.dock);
      renderFloater(el, { ...data, items: items.map((i) => ({ ...i, changed: false })) });
    };
  });
  el.querySelector('.floater-toggle').onclick = () => {
    el.classList.toggle('collapsed');
    renderFloater(el, { ...data, items: items.map((i) => ({ ...i, changed: false })) });
  };
}

// Dock modes: 'float' (inside the mock-app frame), 'top' (above the frame, in the page flow),
// 'bottom' (fixed to the bottom of the screen). Moving the node keeps its listeners and drag position.
export function setDock(el, mode) {
  const home = (el._home ??= el.parentElement);
  const stage = home.parentElement;
  el.dataset.dock = mode;
  if (mode === 'top') stage.insertBefore(el, home);
  else if (mode === 'bottom') document.body.appendChild(el);
  else home.appendChild(el);
  el._ro?.disconnect();
  stage.style.paddingBottom = '';
  if (mode === 'bottom') {
    // keep the frame clear of the fixed card
    el._ro = new ResizeObserver(() => (stage.style.paddingBottom = el.offsetHeight + 16 + 'px'));
    el._ro.observe(el);
  }
}

// Drag by the header. Stays inside `bounds`; position is kept while the card re-renders.
export function makeDraggable(el, bounds) {
  let drag = null;

  el.addEventListener('pointerdown', (e) => {
    const head = e.target.closest('.floater-head');
    if (!head || e.target.closest('button') || (el.dataset.dock || 'float') !== 'float') return;
    const box = el.getBoundingClientRect();
    const area = bounds.getBoundingClientRect();
    drag = { dx: e.clientX - box.left, dy: e.clientY - box.top, area };
    el.style.left = box.left - area.left + 'px';
    el.style.top = box.top - area.top + 'px';
    el.style.bottom = 'auto';
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const maxX = drag.area.width - el.offsetWidth;
    const maxY = drag.area.height - el.offsetHeight;
    el.style.left = Math.min(Math.max(0, e.clientX - drag.area.left - drag.dx), Math.max(0, maxX)) + 'px';
    el.style.top = Math.min(Math.max(0, e.clientY - drag.area.top - drag.dy), Math.max(0, maxY)) + 'px';
  });

  const stop = () => {
    drag = null;
    el.classList.remove('dragging');
  };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
}
