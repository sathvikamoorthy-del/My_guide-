// Forward-only migrations. Each migration runs once, in order, in a transaction; its checksum is recorded, and a migration
// that was applied and has since been edited is an error (write a new migration instead).
import crypto from 'crypto';
const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
export async function migrate(db, migrations) {
    const seen = new Set();
    for (const m of migrations) {
        if (!/^[A-Za-z0-9._-]{1,80}$/.test(m.id))
            throw new Error(`bad migration id "${m.id}"`);
        if (seen.has(m.id))
            throw new Error(`duplicate migration id "${m.id}"`);
        seen.add(m.id);
    }
    await db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
    const done = new Map((await db.execute('SELECT id, checksum FROM schema_migrations')).rows.map((r) => [String(r.id), String(r.checksum)]));
    const applied = [];
    for (const m of migrations) {
        const sum = checksum(m.sql);
        if (done.has(m.id)) {
            if (done.get(m.id) !== sum)
                throw new Error(`migration "${m.id}" was changed after it was applied: add a new migration instead`);
            continue;
        }
        const statements = m.sql.split(';').map((s) => s.trim()).filter(Boolean);
        await db.batch([...statements.map((sql) => ({ sql, args: [] })), { sql: 'INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, ?)', args: [m.id, sum, new Date().toISOString()] }], 'write');
        applied.push(m.id);
    }
    return applied;
}
