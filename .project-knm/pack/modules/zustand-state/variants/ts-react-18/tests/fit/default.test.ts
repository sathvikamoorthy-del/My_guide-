/** @jest-environment jsdom */
// Fit test: the app decides what is persisted and under which key; adapt when injected.
import { createAppStore } from '../../files/src/state/createStore';

it('a store can be created with a persist key', () => {
  expect(typeof createAppStore({ a: 1 }, { persistKey: 'x' }).getState().reset).toBe('function');
});
