// In-memory cache: size-bounded (least recently used goes first) with a time-to-live per entry. One process only.
export class MemoryCache {
    constructor(o = {}) {
        this.map = new Map();
        this.hits = 0;
        this.misses = 0;
        this.max = o.maxEntries ?? 500;
        this.ttl = o.ttlMs ?? 30000;
        this.now = o.now ?? Date.now;
        if (!(this.max >= 1))
            throw new Error('maxEntries must be at least 1');
    }
    get(key) {
        const e = this.map.get(key);
        if (!e) {
            this.misses++;
            return undefined;
        }
        if (e.expires <= this.now()) {
            this.map.delete(key);
            this.misses++;
            return undefined;
        }
        this.map.delete(key);
        this.map.set(key, e); // most recently used goes last
        this.hits++;
        return e.value;
    }
    set(key, value, ttlMs = this.ttl) {
        this.map.delete(key);
        this.map.set(key, { value, expires: this.now() + ttlMs });
        while (this.map.size > this.max)
            this.map.delete(this.map.keys().next().value);
    }
    delete(key) { return this.map.delete(key); }
    /** Removes every key that starts with the prefix; returns how many. */
    deletePrefix(prefix) {
        let n = 0;
        for (const k of [...this.map.keys()])
            if (k.startsWith(prefix)) {
                this.map.delete(k);
                n++;
            }
        return n;
    }
    clear() { this.map.clear(); }
    stats() { return { hits: this.hits, misses: this.misses, size: this.map.size }; }
}
