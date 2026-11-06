// Scaffold-owned glue file (STORY-105). Modules register at the markers below; do not edit the marked lines by hand.
// knm:imports
import { cacheMiddleware } from '../cache/cacheMiddleware'; // knm:module memory-cache
import { tenantMiddleware } from '../tenancy/tenantContext'; // knm:module multi-tenant
import { authenticate } from '../auth/authMiddleware'; // knm:module jwt-auth
import { auditMiddleware } from '../audit/auditMiddleware'; // knm:module audit-trail

export const middleware = [
  // knm:entries
  { id: 'jwt-auth', handler: authenticate }, // knm:module jwt-auth
  { id: 'audit-trail', handler: auditMiddleware }, // knm:module audit-trail
  { id: 'multi-tenant', handler: tenantMiddleware }, // knm:module multi-tenant
  { id: 'memory-cache', handler: cacheMiddleware }, // knm:module memory-cache
  // knm:entries-end
];
