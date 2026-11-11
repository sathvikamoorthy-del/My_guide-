// The app's forward-only migrations, in order. Never edit a migration that has been applied: add a new one instead.
import { Migration } from './migrate';

// REQ-169 / WI-007: reports on answers and sources. `answers` and `sources` hold only the id and tenant for now; the
// conversation feature fills them. One open report per user and target is enforced by a partial unique index.
const reports: Migration = {
  id: '0001_reports',
  sql: `
CREATE TABLE answers (id TEXT NOT NULL, tenant_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (tenant_id, id));
CREATE TABLE sources (id TEXT NOT NULL, tenant_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (tenant_id, id));
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reporter_user_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('answer','source')),
  target_id TEXT NOT NULL,
  problem_type TEXT NOT NULL CHECK (problem_type IN ('incorrect','outdated','missing-details','broken-link','other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX reports_one_open_per_user_target ON reports (tenant_id, reporter_user_id, target_type, target_id) WHERE status = 'open';
CREATE INDEX reports_by_tenant_status ON reports (tenant_id, status)`
};

// REQ-264 / WI-015: free queries. `settings` is in the schema but no earlier migration created it, hence IF NOT EXISTS; the
// allowance is its row `free_query_allowance` (no row = the default of 2). `free_query_uses` is a tenant table with one row
// per query that used a free query; the primary key makes recording a query twice impossible.
const freeQueries: Migration = {
  id: '0002_free_queries',
  sql: `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE free_query_uses (
  tenant_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  used_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, query_id)
);
CREATE INDEX free_query_uses_by_user ON free_query_uses (tenant_id, user_id)`
};

export const migrations: Migration[] = [reports, freeQueries];
