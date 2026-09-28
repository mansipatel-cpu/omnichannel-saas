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
import { storage } from '../storage/whatsappStorage';
import { AppError } from './whatsappError';
export async function requireActiveChannel(req, res, next) {
    try {
        const activeChannel = await storage.getActiveChannel();
        if (!activeChannel) {
            throw new AppError(400, 'No active channel found. Please configure a channel first.');
        }
        req.activeChannel = activeChannel;
        req.channelId = activeChannel.id;
        next();
    }
    catch (error) {
        next(error);
    }
}
export async function extractChannelId(req, res, next) {
    try {
        // Check query parameter first
        let channelId = req.query.channelId;
        // If not in query, check if we need to get active channel
        if (!channelId) {
            const activeChannel = await storage.getActiveChannel();
            if (activeChannel) {
                channelId = activeChannel.id;
            }
        }
        req.channelId = channelId;
        next();
    }
    catch (error) {
        next(error);
    }
}
