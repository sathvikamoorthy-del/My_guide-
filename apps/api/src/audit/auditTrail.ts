// Append-only audit trail: who did what to what, when. Entries are redacted, size-capped and frozen before they reach the sink.
export interface AuditEvent { actor: string; action: string; target?: string; tenantId?: string; meta?: Record<string, unknown> }
export interface AuditEntry extends AuditEvent { at: string }
export interface AuditSink { append(entry: AuditEntry): Promise<void> | void }
export interface AuditOptions {
  sink: AuditSink;
  /** Keys whose values are replaced by "[redacted]" at any depth (case-insensitive). */
  redactKeys?: string[];
  /** Throw when the sink fails (default: the failure is reported to `onError` and the request goes on). */
  failClosed?: boolean;
  onError?: (err: unknown, entry: AuditEntry) => void;
  now?: () => Date;
}

export const DEFAULT_REDACT = ['password', 'token', 'secret', 'authorization', 'apikey', 'api_key', 'cookie'];
const MAX_META_CHARS = 4096;

export function redact(value: unknown, keys: Set<string>, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) return value.map((v) => redact(v, keys, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = keys.has(k.toLowerCase()) ? '[redacted]' : redact(v, keys, depth + 1);
    return out;
  }
  return value;
}

export function createAuditTrail(options: AuditOptions) {
  const keys = new Set((options.redactKeys ?? DEFAULT_REDACT).map((k) => k.toLowerCase()));
  const now = options.now ?? (() => new Date());
  return {
    async record(event: AuditEvent): Promise<AuditEntry> {
      if (!event.actor || !event.action) throw new Error('an audit event needs an actor and an action');
      let meta = event.meta ? (redact(event.meta, keys) as Record<string, unknown>) : undefined;
      if (meta && JSON.stringify(meta).length > MAX_META_CHARS) meta = { truncated: true };
      const entry: AuditEntry = Object.freeze({ ...event, meta, at: now().toISOString() });
      try {
        await options.sink.append(entry);
      } catch (err) {
        if (options.failClosed) throw err;
        options.onError?.(err, entry);
      }
      return entry;
    }
  };
}

/** One JSON line per entry on stdout; replace with a database or log-service sink in production. */
export const consoleSink: AuditSink = { append: (entry) => { process.stdout.write(JSON.stringify(entry) + '\n'); } };
