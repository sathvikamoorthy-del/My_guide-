// Runs before every test file: Testing Library's DOM matchers and the browser APIs jsdom does not provide.
import '@testing-library/jest-dom';

if (!window.matchMedia) {
  (window as any).matchMedia = (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
}
if (!(window as any).ResizeObserver) {
  (window as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}
if (!window.scrollTo || String(window.scrollTo).includes('not implemented')) window.scrollTo = (() => undefined) as typeof window.scrollTo;
