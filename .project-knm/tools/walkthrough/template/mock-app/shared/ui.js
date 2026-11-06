// knm-managed: v1 version: 1
// Toast and "Not defined" alert, same behaviour as mock-model.
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function toast(message) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toasts', className: 'toasts' }));
  }
  const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: message });
  host.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

export function notDefined(message) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="Not defined">
      <h2>Not defined</h2><div class="dialog-body"><p>${esc(message)}</p></div>
      <div class="dialog-actions"><button class="btn btn-primary" data-action="close-alert">OK</button></div></div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('button').onclick = close;
  overlay.addEventListener('mousedown', (e) => e.target === overlay && close());
  overlay.querySelector('button').focus();
}
