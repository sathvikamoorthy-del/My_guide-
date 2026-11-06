// knm-managed: v1 version: 1
// Hosts one mock-app screen in an iframe and reports its action clicks.
export function createFrame(container, onAction, MOCK_INDEX) {
  const iframe = document.createElement('iframe');
  iframe.title = 'Mock ERP application';
  container.appendChild(iframe);

  addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow || event.origin !== location.origin) return;
    const msg = event.data;
    if (msg?.source === 'tera-mock' && msg.type === 'action') onAction(msg.action, msg.screen);
  });

  return {
    load(screenCode, userId) {
      const url = new URL(MOCK_INDEX);
      url.searchParams.set('screen', screenCode);
      url.searchParams.set('user', userId);
      url.searchParams.set('embedded', '1');
      // A new value on every load, so the frame never reuses a cached copy of the mock app's page.
      url.searchParams.set('t', Date.now());
      iframe.src = url;
    },
    clear() {
      iframe.removeAttribute('src');
    }
  };
}
