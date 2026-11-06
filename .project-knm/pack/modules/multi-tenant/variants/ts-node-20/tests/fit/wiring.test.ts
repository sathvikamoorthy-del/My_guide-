// Fit test: depends on how the app wires tenancy; adapt when injected.
import { createTenantDb } from '../../files/src/tenancy/tenantDb';
import { tenantMiddleware } from '../../files/src/tenancy/tenantContext';

it('the middleware is a mountable handler and the scoped db can be created per request', () => {
  expect(typeof tenantMiddleware).toBe('function');
  const forTenant = createTenantDb({ execute: async () => ({ rows: [], rowsAffected: 0 }) }, { tables: { items: ['id'] } });
  expect(forTenant('tenant-1').tenantId).toBe('tenant-1');
});
