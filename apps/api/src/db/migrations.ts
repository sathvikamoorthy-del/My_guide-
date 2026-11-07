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

export const migrations: Migration[] = [reports];
