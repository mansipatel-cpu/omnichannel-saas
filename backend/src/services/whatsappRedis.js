import Redis from "ioredis";
let redisClient = null;
let connectionAttempted = false;
let isConnected = false;
const redisStateListeners = new Set();
export function onRedisStateChange(listener) {
    redisStateListeners.add(listener);
    return () => redisStateListeners.delete(listener);
}
function emitRedisState(available) {
    for (const listener of redisStateListeners) {
        try {
            listener(available);
        }
        catch (err) {
            console.error("[Redis] State listener threw:", err.message);
        }
    }
}
function initRedis() {
    if (connectionAttempted)
        return redisClient;
    connectionAttempted = true;
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.log("[Redis] REDIS_URL not set — running without Redis");
        return null;
    }
    try {
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 5)
                    return null;
                return Math.min(times * 500, 3000);
            },
            lazyConnect: false,
        });
        redisClient.on("connect", () => {
            const wasConnected = isConnected;
            isConnected = true;
            console.log("[Redis] Connected successfully");
            if (!wasConnected)
                emitRedisState(true);
        });
        let redisErrorLogged = false;
        redisClient.on("error", (err) => {
            if (!redisErrorLogged) {
                redisErrorLogged = true;
                console.error("[Redis] Connection error:", err.message);
            }
            const wasConnected = isConnected;
            isConnected = false;
            if (wasConnected)
                emitRedisState(false);
        });
        redisClient.on("close", () => {
            const wasConnected = isConnected;
            isConnected = false;
            if (wasConnected)
                emitRedisState(false);
        });
    }
    catch (err) {
        console.error("[Redis] Failed to initialize:", err.message);
        redisClient = null;
    }
    return redisClient;
}
export function getRedisClient() {
    if (!connectionAttempted)
        initRedis();
    return isConnected ? redisClient : null;
}
export function isRedisAvailable() {
    if (!connectionAttempted)
        initRedis();
    return isConnected && redisClient !== null;
}
export async function cacheGet(key) {
    const client = getRedisClient();
    if (!client)
        return null;
    try {
        return await client.get(key);
    }
    catch {
        return null;
    }
}
export async function cacheSet(key, value, ttlSeconds) {
    const client = getRedisClient();
    if (!client)
        return false;
    try {
        if (ttlSeconds) {
            await client.set(key, value, "EX", ttlSeconds);
        }
        else {
            await client.set(key, value);
        }
        return true;
    }
    catch {
        return false;
    }
}
export async function cacheSetNX(key, value, ttlSeconds) {
    const client = getRedisClient();
    if (!client)
        return null;
    try {
        const result = await client.set(key, value, "EX", ttlSeconds, "NX");
        return result === "OK";
    }
    catch {
        return null;
    }
}
export async function cacheDel(key) {
    const client = getRedisClient();
    if (!client)
        return false;
    try {
        await client.del(key);
        return true;
    }
    catch {
        return false;
    }
}
export async function cacheGetJSON(key) {
    const raw = await cacheGet(key);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function cacheSetJSON(key, value, ttlSeconds) {
    try {
        return await cacheSet(key, JSON.stringify(value), ttlSeconds);
    }
    catch {
        return false;
    }
}
