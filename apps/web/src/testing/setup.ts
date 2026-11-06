// Runs before every test file: Testing Library's DOM matchers and the browser APIs jsdom does not provide.
import '@testing-library/jest-dom';

// Test files marked `@jest-environment node` have no window: the browser polyfills only apply under jsdom.
// The polyfills live on the Window prototype, so a test that deletes or overrides window.matchMedia / window.ResizeObserver
// falls back to them instead of losing the API.
if (typeof window !== 'undefined') {
  const proto = Object.getPrototypeOf(window) as any;
  if (!window.matchMedia) {
    proto.matchMedia = (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
  }
  if (!(window as any).ResizeObserver) {
    proto.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  if (!window.scrollTo || String(window.scrollTo).includes('not implemented')) window.scrollTo = (() => undefined) as typeof window.scrollTo;
}
