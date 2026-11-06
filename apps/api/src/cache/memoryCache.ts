// In-memory cache: size-bounded (least recently used goes first) with a time-to-live per entry. One process only.
export interface CacheOptions { maxEntries?: number; ttlMs?: number; now?: () => number }
export interface CacheStats { hits: number; misses: number; size: number }

export class MemoryCache<V = unknown> {
  private map = new Map<string, { value: V; expires: number }>();
  private hits = 0;
  private misses = 0;
  private readonly max: number;
  private readonly ttl: number;
  private readonly now: () => number;

  constructor(o: CacheOptions = {}) {
    this.max = o.maxEntries ?? 500;
    this.ttl = o.ttlMs ?? 30_000;
    this.now = o.now ?? Date.now;
    if (!(this.max >= 1)) throw new Error('maxEntries must be at least 1');
  }

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) { this.misses++; return undefined; }
    if (e.expires <= this.now()) { this.map.delete(key); this.misses++; return undefined; }
    this.map.delete(key); this.map.set(key, e);                  // most recently used goes last
    this.hits++;
    return e.value;
  }

  set(key: string, value: V, ttlMs: number = this.ttl): void {
    this.map.delete(key);
    this.map.set(key, { value, expires: this.now() + ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }

  delete(key: string): boolean { return this.map.delete(key); }
  /** Removes every key that starts with the prefix; returns how many. */
  deletePrefix(prefix: string): number {
    let n = 0;
    for (const k of [...this.map.keys()]) if (k.startsWith(prefix)) { this.map.delete(k); n++; }
    return n;
  }
  clear(): void { this.map.clear(); }
  stats(): CacheStats { return { hits: this.hits, misses: this.misses, size: this.map.size }; }
}
