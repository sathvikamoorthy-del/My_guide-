import { MemoryCache } from '../../files/src/cache/memoryCache';

const clock = () => { let t = 0; return { now: () => t, tick: (ms: number) => { t += ms; } }; };

describe('memory cache contract', () => {
  it('stores and returns values, counts hits and misses', () => {
    const c = new MemoryCache<number>();
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
    expect(c.stats()).toEqual({ hits: 1, misses: 1, size: 1 });
  });

  it('entries expire after their time to live (default and per entry)', () => {
    const k = clock(); const c = new MemoryCache<string>({ ttlMs: 1000, now: k.now });
    c.set('a', 'x'); c.set('b', 'y', 5000);
    k.tick(999); expect(c.get('a')).toBe('x');
    k.tick(1); expect(c.get('a')).toBeUndefined();
    k.tick(3999); expect(c.get('b')).toBe('y');
    k.tick(1); expect(c.get('b')).toBeUndefined();
    expect(c.stats().size).toBe(0);                                     // expired entries are removed when seen
  });

  it('keeps at most maxEntries and drops the least recently used first', () => {
    const c = new MemoryCache<number>({ maxEntries: 2 });
    c.set('a', 1); c.set('b', 2);
    c.get('a');                                                         // a is now more recent than b
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1); expect(c.get('c')).toBe(3);
    c.set('a', 10);                                                     // overwriting does not grow the cache
    expect(c.stats().size).toBe(2);
    expect(() => new MemoryCache({ maxEntries: 0 })).toThrow(/at least 1/);
  });

  it('deletes one key, a prefix, or everything', () => {
    const c = new MemoryCache<number>();
    c.set('t1|u|/a', 1); c.set('t1|u|/b', 2); c.set('t2|u|/a', 3);
    expect(c.delete('t2|u|/a')).toBe(true); expect(c.delete('nope')).toBe(false);
    expect(c.deletePrefix('t1|')).toBe(2);
    expect(c.stats().size).toBe(0);
    c.set('x', 1); c.clear(); expect(c.get('x')).toBeUndefined();
  });
});
