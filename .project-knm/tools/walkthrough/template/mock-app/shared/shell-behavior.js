// knm-managed: v1 version: 1
// Controls that lead to a screen this walkthrough does not build: a click says what would open.
import { announce } from './spec.js?v=1';

export function installShellBehavior() {
  document.addEventListener('click', (e) => {
    const unbuilt = e.target.closest('[data-spec-code]');
    if (unbuilt) announce(unbuilt.dataset.specCode);
  });
}
