/** @jest-environment jsdom */
describe('test setup contract', () => {
  it('provides the DOM matchers and the browser APIs jsdom lacks', async () => {
    delete (window as any).matchMedia; delete (window as any).ResizeObserver;
    await import('../../files/src/testing/setup');
    expect(window.matchMedia('(min-width: 1px)').matches).toBe(false);
    const ro = new (window as any).ResizeObserver(() => undefined);
    expect(() => { ro.observe(document.body); ro.unobserve(document.body); ro.disconnect(); }).not.toThrow();
    expect(() => window.scrollTo(0, 0)).not.toThrow();
    document.body.innerHTML = '<p>x</p>';
    expect(document.body.querySelector('p')).toBeInTheDocument();           // jest-dom is installed
  });
});
