'use strict';
/**
 * ============================================================
 * BullMQ Redis Connection
 * Isolated Redis connection manager for BullMQ queues
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Health monitoring with periodic checks
 * - Graceful degradation when Redis is unavailable
 * ============================================================
 */
import Redis from 'ioredis';
let redisConnection = null;
let healthCheckInterval = null;
let lastHealthCheck = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;
const HEALTH_CHECK_INTERVAL_MS = 30000;
export function getRedisConnection() {
    if (!redisConnection) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisConnection = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: false,
            retryStrategy: (times) => {
                consecutiveFailures++;
                if (times > 20) {
                    console.error('[BullMQ] Redis connection failed after 20 retries, will continue trying...');
                    return 30000;
                }
                return Math.min(times * 200, 10000);
            },
            reconnectOnError: (err) => {
                const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
                return targetErrors.some(e => err.message.includes(e));
            },
        });
        redisConnection.on('connect', () => {
            console.log('[BullMQ] Redis connected');
            consecutiveFailures = 0;
        });
        redisConnection.on('ready', () => {
            console.log('[BullMQ] Redis ready');
            consecutiveFailures = 0;
        });
        redisConnection.on('error', (err) => {
            console.error('[BullMQ] Redis error:', err.message);
        });
        redisConnection.on('close', () => {
            console.log('[BullMQ] Redis connection closed');
        });
        redisConnection.on('reconnecting', () => {
            console.log('[BullMQ] Redis reconnecting...');
        });
        startHealthMonitor();
    }
    return redisConnection;
}
function startHealthMonitor() {
    if (healthCheckInterval) {
        return;
    }
    healthCheckInterval = setInterval(async () => {
        if (!redisConnection) {
            return;
        }
        try {
            await redisConnection.ping();
            lastHealthCheck = new Date();
            consecutiveFailures = 0;
        }
        catch (error) {
            consecutiveFailures++;
            console.warn(`[BullMQ] Health check failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${error.message}`);
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                console.error('[BullMQ] Redis health check failed multiple times, connection may be degraded');
            }
        }
    }, HEALTH_CHECK_INTERVAL_MS);
}
export async function closeRedisConnection() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
    if (redisConnection) {
        try {
            await redisConnection.quit();
        }
        catch (error) {
            console.warn('[BullMQ] Error during Redis disconnect:', error.message);
            redisConnection.disconnect();
        }
        redisConnection = null;
        console.log('[BullMQ] Redis connection closed gracefully');
    }
}
export function isRedisAvailable() {
    return redisConnection !== null &&
        (redisConnection.status === 'ready' || redisConnection.status === 'connect') &&
        consecutiveFailures < MAX_CONSECUTIVE_FAILURES;
}
export function getRedisHealthStatus() {
    return {
        connected: redisConnection !== null && redisConnection.status === 'ready',
        status: redisConnection?.status || 'disconnected',
        lastHealthCheck,
        consecutiveFailures,
    };
}
