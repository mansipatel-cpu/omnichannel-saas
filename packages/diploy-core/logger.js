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
function formatTimestamp() {
    return new Date().toISOString();
}
function formatMessage(level, message, context) {
    const timestamp = formatTimestamp();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    if (context && Object.keys(context).length > 0) {
        return `${prefix} ${message} ${JSON.stringify(context)}`;
    }
    return `${prefix} ${message}`;
}
function toLogContext(context) {
    if (!context)
        return undefined;
    if (context instanceof Error) {
        return { name: context.name, message: context.message, stack: context.stack };
    }
    return context;
}
export const diployLogger = {
    debug(message, context) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(formatMessage('debug', message, toLogContext(context)));
        }
    },
    info(message, context) {
        console.info(formatMessage('info', message, toLogContext(context)));
    },
    warn(message, context) {
        console.warn(formatMessage('warn', message, toLogContext(context)));
    },
    error(message, context) {
        console.error(formatMessage('error', message, toLogContext(context)));
    },
    success(message, context) {
        console.info(formatMessage('info', message, toLogContext(context)));
    },
    service(serviceName) {
        return {
            debug: (message, context) => diployLogger.debug(`[${serviceName}] ${message}`, context),
            info: (message, context) => diployLogger.info(`[${serviceName}] ${message}`, context),
            warn: (message, context) => diployLogger.warn(`[${serviceName}] ${message}`, context),
            error: (message, context) => diployLogger.error(`[${serviceName}] ${message}`, context),
        };
    }
};
