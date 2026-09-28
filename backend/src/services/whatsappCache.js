const MAX_LRU_SIZE = 1000;
const l1Cache = new Map();
function evictExpired() {
    const now = Date.now();
    for (const [key, entry] of l1Cache) {
        if (entry.expiresAt <= now) {
            l1Cache.delete(key);
        }
    }
}
function enforceLRUSize() {
    if (l1Cache.size <= MAX_LRU_SIZE)
        return;
    const keysToDelete = l1Cache.size - MAX_LRU_SIZE;
    const iter = l1Cache.keys();
    for (let i = 0; i < keysToDelete; i++) {
        const { value: key } = iter.next();
        if (key)
            l1Cache.delete(key);
    }
}
setInterval(evictExpired, 60_000).unref();
let redisHelpers = null;
async function loadRedis() {
    if (redisHelpers !== null)
        return redisHelpers;
    try {
        const mod = await import("./whatsappRedis");
        if (mod && typeof mod.isRedisAvailable === "function") {
            redisHelpers = {
                isRedisAvailable: mod.isRedisAvailable,
                cacheGet: mod.cacheGet ?? (async () => null),
                cacheSet: mod.cacheSet ?? (async () => { }),
                cacheDel: mod.cacheDel ?? (async () => { }),
            };
        }
        else {
            redisHelpers = null;
        }
    }
    catch {
        redisHelpers = null;
    }
    return redisHelpers;
}
loadRedis().catch(() => { });
export async function cacheGet(key, ttlSeconds, fetchFn) {
    const now = Date.now();
    const l1Entry = l1Cache.get(key);
    if (l1Entry && l1Entry.expiresAt > now) {
        l1Cache.delete(key);
        l1Cache.set(key, l1Entry);
        return l1Entry.value;
    }
    const redis = await loadRedis();
    if (redis && redis.isRedisAvailable()) {
        try {
            const raw = await redis.cacheGet(key);
            if (raw !== null) {
                const parsed = JSON.parse(raw);
                l1Cache.set(key, { value: parsed, expiresAt: now + ttlSeconds * 1000 });
                enforceLRUSize();
                return parsed;
            }
        }
        catch { }
    }
    const value = await fetchFn();
    l1Cache.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
    enforceLRUSize();
    if (redis && redis.isRedisAvailable()) {
        try {
            await redis.cacheSet(key, JSON.stringify(value), ttlSeconds);
        }
        catch { }
    }
    return value;
}
export async function cacheInvalidate(key) {
    l1Cache.delete(key);
    const redis = await loadRedis();
    if (redis && redis.isRedisAvailable()) {
        try {
            await redis.cacheDel(key);
        }
        catch { }
    }
}
export async function cacheInvalidatePrefix(prefix) {
    for (const k of l1Cache.keys()) {
        if (k.startsWith(prefix)) {
            l1Cache.delete(k);
        }
    }
}
export const CACHE_KEYS = {
    channel: (id) => `channel:${id}`,
    panelConfig: () => "panel:config",
    smtpConfig: () => "smtp:config",
    userPermissions: (userId) => `user:perms:${userId}`,
    subscriptionPlans: () => "subscription:plans",
    planById: (id) => `plan:${id}`,
};
export const CACHE_TTL = {
    channel: 300,
    panelConfig: 600,
    smtpConfig: 600,
    userPermissions: 300,
    subscriptionPlans: 600,
};
