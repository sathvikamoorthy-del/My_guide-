// Fit test: depends on the scaffold's glue files; adapt when injected.
import { routes } from '../../../../src/glue/routes';
import { middleware } from '../../../../src/glue/middleware';
import { providers } from '../../../../src/glue/providers';

it('the glue files export arrays the app factory can consume', () => {
  for (const g of [routes, middleware, providers]) expect(Array.isArray(g)).toBe(true);
});
