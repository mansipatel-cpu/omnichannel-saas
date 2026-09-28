'use strict';
const DEFAULT_RETRYABLE_CODES = new Set([
    'ECONNRESET',
    'ECONNABORTED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'UND_ERR_SOCKET',
]);
function defaultIsRetryable(err) {
    if (!err || typeof err !== 'object')
        return false;
    const e = err;
    const status = e.status ?? e.statusCode ?? e.response?.status;
    if (typeof status === 'number') {
        if (status === 429)
            return true;
        if (status >= 500 && status <= 599)
            return true;
        return false;
    }
    if (e.code && DEFAULT_RETRYABLE_CODES.has(e.code))
        return true;
    const msg = (e.message || '').toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out'))
        return true;
    if (msg.includes('socket hang up') || msg.includes('network'))
        return true;
    return false;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Wrap an async function with exponential-backoff retries for transient failures.
 *
 * Defaults target ElevenLabs/HTTP style errors: retries on 429 and 5xx plus common
 * network-level errors. Non-retryable errors (4xx except 429, validation errors)
 * throw immediately on the first failure, preserving existing behaviour.
 */
export async function withRetry(fn, opts = {}) {
    const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
    const baseDelayMs = opts.baseDelayMs ?? 500;
    const maxDelayMs = opts.maxDelayMs ?? 8000;
    const isRetryable = opts.isRetryable ?? defaultIsRetryable;
    const label = opts.label ?? 'withRetry';
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastErr = err;
            if (attempt >= maxAttempts || !isRetryable(err)) {
                throw err;
            }
            const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
            const jitter = Math.floor(Math.random() * Math.min(250, backoff));
            const delay = backoff + jitter;
            const e = err;
            const status = e.status ?? e.statusCode ?? e.response?.status;
            console.warn(`[${label}] attempt ${attempt}/${maxAttempts} failed${status ? ` (status ${status})` : ''}: ${e.message ?? err}. Retrying in ${delay}ms`);
            await sleep(delay);
        }
    }
    throw lastErr;
}
