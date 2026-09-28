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
import { z } from 'zod';
import { AppError } from './whatsappError';
export function validateRequest(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                throw new AppError(400, `Validation error: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw error;
        }
    };
}
export function validateQuery(schema) {
    return (req, res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                throw new AppError(400, `Query validation error: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw error;
        }
    };
}
export function validateParams(schema) {
    return (req, res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                throw new AppError(400, `Params validation error: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw error;
        }
    };
}
