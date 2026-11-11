// The app's tables, as Drizzle definitions. This starter has one generic table; replace it with the app's own schema
// (migrations stay with the database module: write the matching SQL there).
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export type Setting = typeof settings.$inferSelect;

// REQ-169 / WI-007 (migration 0001_reports). Tenant tables: read and write them through the tenant-scoped data access
// (src/tenancy/tenantDb.ts), never across tenants.
export const answers = sqliteTable('answers', {
  id: text('id').notNull(),
  tenantId: text('tenant_id').notNull(),
  createdAt: text('created_at').notNull()
}, (t) => ({ pk: primaryKey({ columns: [t.tenantId, t.id] }) }));

export const sources = sqliteTable('sources', {
  id: text('id').notNull(),
  tenantId: text('tenant_id').notNull(),
  createdAt: text('created_at').notNull()
}, (t) => ({ pk: primaryKey({ columns: [t.tenantId, t.id] }) }));

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  reporterUserId: text('reporter_user_id').notNull(),
  targetType: text('target_type', { enum: ['answer', 'source'] }).notNull(),
  targetId: text('target_id').notNull(),
  problemType: text('problem_type', { enum: ['incorrect', 'outdated', 'missing-details', 'broken-link', 'other'] }).notNull(),
  description: text('description'),
  status: text('status').notNull().default('open'),
  createdAt: text('created_at').notNull()
});

export type Report = typeof reports.$inferSelect;

// REQ-264 / WI-015 (migration 0002_free_queries). Tenant table: one row per query that used a free query. Read and write it
// through the tenant-scoped data access (src/freeQueries/freeQueriesStore.ts).
export const freeQueryUses = sqliteTable('free_query_uses', {
  tenantId: text('tenant_id').notNull(),
  queryId: text('query_id').notNull(),
  userId: text('user_id').notNull(),
  usedAt: text('used_at').notNull()
}, (t) => ({ pk: primaryKey({ columns: [t.tenantId, t.queryId] }) }));

export type FreeQueryUse = typeof freeQueryUses.$inferSelect;
