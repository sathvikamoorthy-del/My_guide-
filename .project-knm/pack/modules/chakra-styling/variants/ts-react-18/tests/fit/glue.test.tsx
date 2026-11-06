/** @jest-environment jsdom */
// Fit test: depends on the scaffold's theme glue; adapt when injected.
import { theme } from '../../files/src/app/theme';
import { chakraTokens } from '../../files/src/styling/tokens';

it('the tokens are registered in the theme glue by this module', () => {
  expect(Array.isArray(theme)).toBe(true);
  expect((theme as any[]).some((e) => e.tokens === chakraTokens)).toBe(true);
});
