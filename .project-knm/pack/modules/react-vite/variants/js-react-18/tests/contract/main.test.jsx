/** @jest-environment jsdom */
import { act } from 'react-dom/test-utils';
describe('entry point contract', () => {
    it('mounts the app into #root when it is imported, and mount() can target another element', async () => {
        document.body.innerHTML = '<div id="root"></div><div id="other"></div>';
        await act(async () => { await import('../../files/src/main'); });
        expect(document.getElementById('root').textContent).toMatch(/Page not found/); // the scaffold has no routes yet
        const { mount } = await import('../../files/src/main');
        await act(async () => { mount(document.getElementById('other')); });
        expect(document.getElementById('other').textContent).toMatch(/Page not found/);
    });
    it('mount() does nothing without an element', async () => {
        const { mount } = await import('../../files/src/main');
        expect(mount(null)).toBeNull();
    });
});
