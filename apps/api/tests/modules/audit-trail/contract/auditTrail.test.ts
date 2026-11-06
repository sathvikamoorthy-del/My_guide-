import { createAuditTrail, AuditEntry, redact } from '../../../../src/audit/auditTrail';

const memory = () => { const entries: AuditEntry[] = []; return { entries, sink: { append: (e: AuditEntry) => { entries.push(e); } } }; };

describe('audit trail contract', () => {
  it('records who did what, with a timestamp, and the entry is immutable', async () => {
    const m = memory();
    const trail = createAuditTrail({ sink: m.sink, now: () => new Date('2026-01-02T03:04:05Z') });
    const e = await trail.record({ actor: 'u1', action: 'invoice.delete', target: 'inv-9', tenantId: 't1' });
    expect(m.entries).toEqual([{ actor: 'u1', action: 'invoice.delete', target: 'inv-9', tenantId: 't1', meta: undefined, at: '2026-01-02T03:04:05.000Z' }]);
    expect(Object.isFrozen(e)).toBe(true);
  });

  it('requires an actor and an action', async () => {
    const trail = createAuditTrail({ sink: memory().sink });
    await expect(trail.record({ actor: '', action: 'x' })).rejects.toThrow(/actor and an action/);
    await expect(trail.record({ actor: 'u', action: '' })).rejects.toThrow(/actor and an action/);
  });

  it('redacts secrets at any depth, case-insensitively, without mutating the input', async () => {
    const m = memory();
    const meta = { user: 'a', Password: 'p', nested: { list: [{ apiKey: 'k', ok: 1 }], Authorization: 'Bearer x' } };
    await createAuditTrail({ sink: m.sink }).record({ actor: 'u', action: 'login', meta });
    expect(m.entries[0].meta).toEqual({ user: 'a', Password: '[redacted]', nested: { list: [{ apiKey: '[redacted]', ok: 1 }], Authorization: '[redacted]' } });
    expect(meta.Password).toBe('p');
    expect(redact({ a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } }, new Set())).toBeTruthy();
  });

  it('replaces an oversized meta with a truncation marker', async () => {
    const m = memory();
    await createAuditTrail({ sink: m.sink }).record({ actor: 'u', action: 'x', meta: { blob: 'x'.repeat(5000) } });
    expect(m.entries[0].meta).toEqual({ truncated: true });
  });

  it('a failing sink is reported but does not break the caller (unless failClosed)', async () => {
    const boom = { append: () => { throw new Error('disk full'); } };
    const onError = jest.fn();
    await expect(createAuditTrail({ sink: boom, onError }).record({ actor: 'u', action: 'x' })).resolves.toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    await expect(createAuditTrail({ sink: boom, failClosed: true }).record({ actor: 'u', action: 'x' })).rejects.toThrow('disk full');
  });
});
