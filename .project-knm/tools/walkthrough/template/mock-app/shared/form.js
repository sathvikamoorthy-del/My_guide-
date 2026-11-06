// knm-managed: v1 version: 2
// Form controls for mock screens. They show the sample value and change nothing.
// A change or click shows a toast saying what would happen (data-toast), or the
// "Not defined" alert when the project spec (context.md) has no detail (data-not-defined).
// The behaviour is wired in controls.js.
import { esc } from './components.js?v=1';

const reacts = (fallback, o = {}) =>
  o.notDefined ? ` data-not-defined="${esc(o.notDefined)}"` : ` data-toast="${esc(o.toast ?? fallback)}"`;
const mark = (label, o) => `${esc(label)}${o.required ? ' *' : ''}`;

export const input = (label, value = '', o = {}) =>
  `<label class="field"><span>${mark(label, o)}</span><input type="${o.type ?? 'text'}" value="${esc(value)}"${
    o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''
  }${reacts(`${label} would be saved.`, o)}></label>`;

export const select = (label, options, selected, o = {}) =>
  `<label class="field"><span>${mark(label, o)}</span><select${reacts(`${label} would be applied.`, o)}>${options
    .map((x) => `<option${x === selected ? ' selected' : ''}>${esc(x)}</option>`)
    .join('')}</select></label>`;

export const radios = (label, name, options, selected, o = {}) =>
  `<fieldset class="field"><legend><span>${mark(label, o)}</span></legend><div class="row">${options
    .map(
      (x) =>
        `<label><input type="radio" name="${esc(name)}" value="${esc(x)}"${x === selected ? ' checked' : ''}${reacts(
          `${label}: ${x} would be selected.`,
          o
        )}> ${esc(x)}</label>`
    )
    .join('')}</div></fieldset>`;

// A button either runs a walkthrough action (action, optional goto for standalone browsing), or toasts what it would do.
export const button = (label, o = {}) => {
  const cls = `btn${o.primary ? ' btn-primary' : ''}`;
  if (o.action)
    return `<button class="${cls}" data-action="${esc(o.action)}"${o.goto ? ` data-goto="${esc(o.goto)}"` : ''}>${esc(label)}</button>`;
  return `<button class="${cls}"${reacts(`${label} would run here.`, o)}>${esc(label)}</button>`;
};
