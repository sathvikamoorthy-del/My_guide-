// Fit test: the default time to live is the app's choice (CACHE_TTL_SECONDS); adapt when injected.
import { MemoryCache } from '../../files/src/cache/memoryCache';
it('the default time to live is 30 seconds', () => {
    let t = 0;
    const c = new MemoryCache({ now: () => t });
    c.set('a', 1);
    t = 29999;
    expect(c.get('a')).toBe(1);
    t = 30000;
    expect(c.get('a')).toBeUndefined();
});
