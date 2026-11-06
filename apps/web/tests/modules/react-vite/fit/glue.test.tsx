/** @jest-environment jsdom */
// Fit test: depends on the scaffold's glue files; adapt when injected.
import { providers } from '../../../../src/app/providers';
import { router } from '../../../../src/app/router';

it('the glue files export arrays the shell can consume', () => {
  expect(Array.isArray(providers)).toBe(true);
  expect(Array.isArray(router)).toBe(true);
});
