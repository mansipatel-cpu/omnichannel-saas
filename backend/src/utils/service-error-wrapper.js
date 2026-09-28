"use strict";
/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { ExternalServiceError } from "./errors";
export function wrapServiceError(options) {
    const { service, operation, originalError, context, recoverable = false } = options;
    let message = `${service} ${operation} failed`;
    if (originalError) {
        const errorMessage = originalError instanceof Error
            ? originalError.message
            : String(originalError);
        if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
            message = `${service} service timeout during ${operation}`;
        }
        else if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
            message = `${service} service unavailable during ${operation}`;
        }
        else if (errorMessage.includes("401") || errorMessage.includes("403")) {
            message = `${service} authentication failed during ${operation}`;
        }
        else if (errorMessage.includes("429")) {
            message = `${service} rate limit exceeded during ${operation}`;
        }
        else {
            message = `${service} ${operation} failed: ${errorMessage}`;
        }
    }
    return new ExternalServiceError(service, message, originalError, {
        ...context,
        operation,
        recoverable
    });
}
export async function withServiceErrorHandling(service, operation, fn, options) {
    try {
        return await fn();
    }
    catch (error) {
        const originalError = error instanceof Error ? error : new Error(String(error));
        if (options?.logError !== false) {
            console.error(`❌ [${service}] ${operation} failed:`, originalError.message);
        }
        if (options?.fallback !== undefined) {
            console.log(`⚠️ [${service}] Using fallback for ${operation}`);
            return options.fallback;
        }
        throw wrapServiceError({
            service,
            operation,
            originalError,
            context: options?.context
        });
    }
}
export function isServiceError(error) {
    return error instanceof ExternalServiceError;
}
export function getServiceErrorMessage(error) {
    if (error instanceof ExternalServiceError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
const serviceAvailability = new Map();
export function markServiceUnavailable(service, reason) {
    serviceAvailability.set(service, {
        available: false,
        reason,
        lastChecked: new Date()
    });
    console.warn(`⚠️ [${service}] Marked as unavailable: ${reason}`);
}
export function markServiceAvailable(service) {
    serviceAvailability.set(service, {
        available: true,
        lastChecked: new Date()
    });
}
export function isServiceAvailable(service) {
    const status = serviceAvailability.get(service);
    if (!status) {
        return { available: true, lastChecked: new Date() };
    }
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!status.available && status.lastChecked < fiveMinutesAgo) {
        return { available: true, lastChecked: new Date() };
    }
    return status;
}
