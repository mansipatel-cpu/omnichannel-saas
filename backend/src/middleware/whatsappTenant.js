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
import { Role } from '@shared/whatsapp-roles';
export async function resolveTenantChannels(req, res, next) {
    try {
        const user = req.session?.user || req.user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (user.role === Role.SUPERADMIN) {
            req.isSuperAdmin = true;
            req.tenantChannelIds = null;
            return next();
        }
        const ownerId = user.role === Role.TEAM ? user.createdBy : user.id;
        if (!ownerId) {
            req.isSuperAdmin = false;
            req.tenantChannelIds = [];
            return next();
        }
        const channels = await storage.getChannelsByUserId(ownerId);
        const channelIds = channels.map((ch) => ch.id);
        req.isSuperAdmin = false;
        req.tenantChannelIds = channelIds;
        next();
    }
    catch (error) {
        next(error);
    }
}
export function verifyChannelOwnership(req, channelId) {
    if (req.isSuperAdmin)
        return true;
    const tenantChannelIds = req.tenantChannelIds || [];
    return tenantChannelIds.includes(channelId);
}
