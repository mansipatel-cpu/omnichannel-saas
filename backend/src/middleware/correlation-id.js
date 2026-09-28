/**
 * @fileoverview Correlation ID Middleware
 * @copyright Diploy - AgentLabs
 * @license Envato Regular/Extended License
 *
 * Generates unique correlation IDs for request tracing across distributed systems.
 * Enables end-to-end request tracking through logs and external service calls.
 */
import crypto from 'crypto';
/**
 * Header name for correlation ID
 * X-Correlation-ID is the most widely used standard
 */
export const CORRELATION_ID_HEADER = 'X-Correlation-ID';
/**
 * Generate a unique correlation ID
 * Uses UUID v4 format for compatibility with most logging/tracing systems
 */
export function generateCorrelationId() {
    return crypto.randomUUID();
}
/**
 * Get current request's correlation ID
 * Useful for accessing from within services that don't have direct Request access
 */
let currentCorrelationId;
export function getCurrentCorrelationId() {
    return currentCorrelationId;
}
export function setCurrentCorrelationId(id) {
    currentCorrelationId = id;
}
/**
 * Correlation ID middleware
 *
 * - Checks for existing correlation ID in request headers (for cross-service propagation)
 * - Generates new ID if not present
 * - Adds correlation ID to response headers
 * - Makes ID available on request object and globally
 *
 * Usage:
 *   app.use(correlationIdMiddleware);
 *
 *   // In routes:
 *   console.log(`[${req.correlationId}] Processing request...`);
 *
 *   // In services:
 *   import { getCurrentCorrelationId } from './middleware/correlation-id';
 *   console.log(`[${getCurrentCorrelationId()}] Service operation...`);
 */
export function correlationIdMiddleware(req, res, next) {
    // Check for existing correlation ID in headers (propagated from upstream service)
    let correlationId = req.headers[CORRELATION_ID_HEADER.toLowerCase()];
    // Generate new ID if not present
    if (!correlationId) {
        correlationId = generateCorrelationId();
    }
    // Attach to request object
    req.correlationId = correlationId;
    // Set global correlation ID for services
    setCurrentCorrelationId(correlationId);
    // Add to response headers for client-side correlation
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    // Clean up global state on response finish
    res.on('finish', () => {
        setCurrentCorrelationId(undefined);
    });
    next();
}
/**
 * Create headers object with correlation ID for external service calls
 * Use this when making HTTP requests to external services to propagate tracing
 *
 * @example
 * const headers = getCorrelationHeaders();
 * await fetch('https://api.example.com', { headers: { ...headers, 'Content-Type': 'application/json' } });
 */
export function getCorrelationHeaders() {
    const id = getCurrentCorrelationId();
    return id ? { [CORRELATION_ID_HEADER]: id } : {};
}
/**
 * Format a log message with correlation ID prefix
 * Use for consistent log formatting across the application
 *
 * @example
 * console.log(formatLogWithCorrelation('Processing payment'));
 * // Output: [abc123-def456-ghi789] Processing payment
 */
export function formatLogWithCorrelation(message) {
    const id = getCurrentCorrelationId();
    return id ? `[${id}] ${message}` : message;
}
