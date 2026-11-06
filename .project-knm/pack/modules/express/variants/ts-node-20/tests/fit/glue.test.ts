// Fit test: depends on the scaffold's glue files; adapt when injected.
import { routes } from '../../files/src/glue/routes';
import { middleware } from '../../files/src/glue/middleware';
import { providers } from '../../files/src/glue/providers';

it('the glue files export arrays the app factory can consume', () => {
  for (const g of [routes, middleware, providers]) expect(Array.isArray(g)).toBe(true);
});
