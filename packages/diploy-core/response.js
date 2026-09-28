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
export const diployResponse = {
    success(res, data, statusCode = 200) {
        const response = {
            success: true,
            data
        };
        return res.status(statusCode).json(response);
    },
    created(res, data) {
        return diployResponse.success(res, data, 201);
    },
    noContent(res) {
        return res.status(204).send();
    },
    error(res, message, statusCode = 500, code) {
        const response = {
            success: false,
            error: message,
            code
        };
        return res.status(statusCode).json(response);
    },
    validationError(res, message, details) {
        const response = {
            success: false,
            error: message,
            code: 'VALIDATION_ERROR',
            ...(details && { data: details })
        };
        return res.status(400).json(response);
    },
    unauthorized(res, message = 'Authentication required') {
        return diployResponse.error(res, message, 401, 'UNAUTHORIZED');
    },
    forbidden(res, message = 'Access denied') {
        return diployResponse.error(res, message, 403, 'FORBIDDEN');
    },
    notFound(res, resource = 'Resource') {
        return diployResponse.error(res, `${resource} not found`, 404, 'NOT_FOUND');
    },
    paginated(res, data, options) {
        const totalPages = Math.ceil(options.total / options.limit);
        const response = {
            success: true,
            data,
            meta: {
                page: options.page,
                limit: options.limit,
                total: options.total,
                totalPages
            }
        };
        return res.status(200).json(response);
    }
};
