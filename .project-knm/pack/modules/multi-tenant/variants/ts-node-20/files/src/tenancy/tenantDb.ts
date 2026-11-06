// Tenant-scoped data access (shared database, `tenant_id` column). This is the only sanctioned data path for tenant tables:
// every statement is built here with the tenant condition first, values are always bound, and there is no raw-SQL escape hatch.
export interface Executor {
  execute(sql: string, args: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowsAffected: number }>;
}
export type Row = Record<string, unknown>;
export type Where = Record<string, string | number | boolean | null>;
export interface TenantDbOptions {
  /** Tenant tables and the columns callers may use. The tenant column is added automatically. */
  tables: Record<string, string[]>;
  tenantColumn?: string;
}
export interface SelectOptions { limit?: number; orderBy?: string; desc?: boolean }
export interface TenantScope {
  readonly tenantId: string;
  select(table: string, where?: Where, options?: SelectOptions): Promise<Row[]>;
  insert(table: string, values: Row): Promise<number>;
  update(table: string, values: Row, where: Where): Promise<number>;
  remove(table: string, where: Where): Promise<number>;
}

export type TenantErrorCode = 'invalid-tenant' | 'unknown-table' | 'unknown-column' | 'tenant-mismatch' | 'invalid-value' | 'empty-update';
export class TenantError extends Error {
  constructor(public code: TenantErrorCode, message: string) {
    super(message);
    this.name = 'TenantError';
  }
}

const TENANT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

export function createTenantDb(executor: Executor, options: TenantDbOptions) {
  const tenantColumn = options.tenantColumn ?? 'tenant_id';
  if (!IDENT.test(tenantColumn)) throw new TenantError('unknown-column', `bad tenant column "${tenantColumn}"`);
  for (const [table, cols] of Object.entries(options.tables)) {
    for (const name of [table, ...cols]) {
      if (!IDENT.test(name)) throw new TenantError('unknown-column', `"${name}" is not a plain identifier`);
    }
  }
  const tableCols = (table: string) => {
    if (!Object.prototype.hasOwnProperty.call(options.tables, table)) throw new TenantError('unknown-table', `table "${table}" is not a registered tenant table`);
    return options.tables[table];
  };
  const column = (table: string, name: string) => {
    if (!tableCols(table).includes(name)) throw new TenantError('unknown-column', `column "${name}" is not allowed on "${table}"`);
    return name;
  };
  const value = (v: unknown) => {
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v === true ? 1 : v === false ? 0 : v;
    throw new TenantError('invalid-value', 'values must be string, number, boolean or null');
  };

  return (tenantId: string): TenantScope => {
    if (typeof tenantId !== 'string' || !TENANT_ID.test(tenantId)) throw new TenantError('invalid-tenant', 'a valid tenant id is required');

    // `tenant_id = ?` always comes first; callers may repeat the tenant column only with their own tenant's value.
    const condition = (table: string, where: Where = {}) => {
      const parts = [`${tenantColumn} = ?`];
      const args: unknown[] = [tenantId];
      for (const [key, v] of Object.entries(where)) {
        if (key === tenantColumn) {
          if (v !== tenantId) throw new TenantError('tenant-mismatch', 'a query cannot target another tenant');
          continue;
        }
        if (v === undefined) throw new TenantError('invalid-value', `"${key}" is undefined (it would silently drop the filter)`);
        column(table, key);
        if (v === null) parts.push(`${key} IS NULL`);
        else { parts.push(`${key} = ?`); args.push(value(v)); }
      }
      return { sql: parts.join(' AND '), args };
    };

    return {
      tenantId,
      async select(table, where, opts = {}) {
        tableCols(table);
        const c = condition(table, where);
        let sql = `SELECT * FROM ${table} WHERE ${c.sql}`;
        if (opts.orderBy) sql += ` ORDER BY ${column(table, opts.orderBy)}${opts.desc ? ' DESC' : ''}`;
        if (opts.limit !== undefined) {
          if (!Number.isInteger(opts.limit) || opts.limit < 1) throw new TenantError('invalid-value', 'limit must be a positive integer');
          sql += ` LIMIT ${opts.limit}`;
        }
        return (await executor.execute(sql, c.args)).rows;
      },
      async insert(table, values) {
        tableCols(table);
        const keys: string[] = [tenantColumn];
        const args: unknown[] = [tenantId];
        for (const [key, v] of Object.entries(values)) {
          if (key === tenantColumn) {
            if (v !== tenantId) throw new TenantError('tenant-mismatch', 'a row cannot be written to another tenant');
            continue;
          }
          if (v === undefined) throw new TenantError('invalid-value', `"${key}" is undefined`);
          keys.push(column(table, key));
          args.push(value(v));
        }
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
        return (await executor.execute(sql, args)).rowsAffected;
      },
      async update(table, values, where) {
        tableCols(table);
        const sets: string[] = [];
        const setArgs: unknown[] = [];
        for (const [key, v] of Object.entries(values)) {
          if (key === tenantColumn) throw new TenantError('tenant-mismatch', 'a row cannot be moved to another tenant');
          if (v === undefined) throw new TenantError('invalid-value', `"${key}" is undefined`);
          sets.push(`${column(table, key)} = ?`);
          setArgs.push(value(v));
        }
        if (sets.length === 0) throw new TenantError('empty-update', 'nothing to update');
        const c = condition(table, where);
        return (await executor.execute(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${c.sql}`, [...setArgs, ...c.args])).rowsAffected;
      },
      async remove(table, where) {
        tableCols(table);
        const c = condition(table, where);
        return (await executor.execute(`DELETE FROM ${table} WHERE ${c.sql}`, c.args)).rowsAffected;
      }
    };
  };
}
