# memory-cache

Server cache module (STORY-053b). `MemoryCache` is size-bounded (LRU) with a time to live; `cacheMiddleware` (middleware glue, after auth and tenant) caches successful JSON GET responses keyed by tenant + user + URL, so one user is never served another's data; writes, errors, `no-store`/`private` and cookie-setting responses are never cached; `x-cache: hit|miss`. Single process only. `CACHE_TTL_SECONDS` (default 30).
