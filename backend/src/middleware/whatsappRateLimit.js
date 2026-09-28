const AUTHED_RATE_LIMIT = 500;
const UNAUTHED_RATE_LIMIT = 100;
const WINDOW_MS = 60_000;
const store = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        entry.timestamps = entry.timestamps.filter((t) => t > now - WINDOW_MS);
        if (entry.timestamps.length === 0) {
            store.delete(key);
        }
    }
}, 30_000).unref();
function parseEnvLimit(val) {
    if (!val)
        return null;
    const parsed = parseInt(val, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
}
function getLimit(isAuthenticated) {
    if (isAuthenticated) {
        return (parseEnvLimit(process.env.API_RATE_LIMIT_AUTHED) ??
            parseEnvLimit(process.env.API_RATE_LIMIT) ??
            AUTHED_RATE_LIMIT);
    }
    return (parseEnvLimit(process.env.API_RATE_LIMIT_UNAUTHED) ??
        parseEnvLimit(process.env.API_RATE_LIMIT) ??
        UNAUTHED_RATE_LIMIT);
}
/**
 * Core sliding-window check.
 *
 * When `peek` is true the function checks the current state without recording
 * a new timestamp — useful to guard the entry path before an expensive operation
 * (e.g. bcrypt) while keeping the actual increment for the right code path.
 */
export function applyRateLimit(bucketKey, limit, peek = false) {
    const now = Date.now();
    let entry = store.get(bucketKey);
    if (!entry) {
        entry = { timestamps: [] };
        store.set(bucketKey, entry);
    }
    entry.timestamps = entry.timestamps.filter((t) => t > now - WINDOW_MS);
    if (entry.timestamps.length >= limit) {
        const oldestInWindow = entry.timestamps[0];
        const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
        const resetAt = Math.ceil((oldestInWindow + WINDOW_MS) / 1000);
        return { limited: true, retryAfter, resetAt, remaining: 0 };
    }
    if (!peek) {
        entry.timestamps.push(now);
    }
    const base = entry.timestamps[0] ?? now;
    const resetAt = Math.ceil((base + WINDOW_MS) / 1000);
    return { limited: false, resetAt, remaining: limit - entry.timestamps.length };
}
function getTenantKey(req) {
    const user = req.session?.user;
    if (user?.id)
        return { key: `user:${user.id}`, isAuthenticated: true };
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.ip ||
        "unknown";
    return { key: `ip:${ip}`, isAuthenticated: false };
}
export function getUnauthedLimit() {
    return getLimit(false);
}
function isExempt(path) {
    if (path.startsWith("/api/whatsapp/webhooks"))
        return true;
    if (path.startsWith("/webhooks"))
        return true;
    if (path === "/api/whatsapp/version")
        return true;
    if (path === "/api/whatsapp/health")
        return true;
    if (path.startsWith("/api/whatsapp/agents/online"))
        return true;
    if (path === "/api/whatsapp/auth/me")
        return true;
    if (path === "/api/whatsapp/languages/enabled")
        return true;
    if (path === "/api/whatsapp/brand-settings")
        return true;
    if (path === "/api/whatsapp/auth/country-data")
        return true;
    if (path.startsWith("/api/whatsapp/v1/"))
        return true;
    return false;
}
export function rateLimitMiddleware(req, res, next) {
    if (!req.path.startsWith("/api"))
        return next();
    if (isExempt(req.path))
        return next();
    const { key, isAuthenticated } = getTenantKey(req);
    const limit = getLimit(isAuthenticated);
    const result = applyRateLimit(key, limit);
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader("X-RateLimit-Reset", String(result.resetAt));
    if (result.limited) {
        res.setHeader("Retry-After", String(result.retryAfter));
        return res.status(429).json({
            error: "Too many requests. Please try again later.",
            retryAfter: result.retryAfter,
        });
    }
    next();
}
