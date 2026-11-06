// knm-managed: v1 version: 1
// The only link from the mock app to a hosting walkthrough: report clicks on
// [data-action] controls to the parent window. A [data-goto] link with no action
// is reported as "goto-<code>" (sidebar items and links to another screen). Does nothing when not framed.
export function installBridge(getScreenCode) {
  if (window.parent === window) return;
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action], [data-goto]');
    if (!el) return;
    const action = el.dataset.action ?? `goto-${el.dataset.goto}`;
    window.parent.postMessage(
      { source: 'tera-mock', type: 'action', action, screen: getScreenCode() },
      location.origin
    );
  });
}
