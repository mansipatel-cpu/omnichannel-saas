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
import { asyncHandler } from '../middleware/whatsappError';
export const getDashboardStats = asyncHandler(async (req, res) => {
    const channelId = req.query.channelId;
    const user = req.session?.user;
    if (channelId) {
        if (user && user.role !== 'superadmin') {
            const ownerId = user.role === 'team' ? user.createdBy : user.id;
            const channels = await storage.getChannelsByUserId(ownerId);
            const channelIds = channels.map((ch) => ch.id);
            if (!channelIds.includes(channelId)) {
                return res.status(403).json({ error: 'Access denied to this channel' });
            }
        }
        const userId = user?.id || '';
        const stats = await storage.getDashboardStatsByChannel(channelId, userId);
        res.json(stats);
    }
    else if (user && user.role === 'superadmin') {
        const stats = await storage.getDashboardStats();
        res.json(stats);
    }
    else {
        const ownerId = user?.role === 'team' ? user?.createdBy : user?.id;
        if (!ownerId)
            return res.json({ totalMessages: 0, activeCampaigns: 0, deliveryRate: 0, newLeads: 0, messagesGrowth: 0, campaignsRunning: 0, unreadChats: 0 });
        const channels = await storage.getChannelsByUserId(ownerId);
        if (channels.length === 0)
            return res.json({ totalMessages: 0, activeCampaigns: 0, deliveryRate: 0, newLeads: 0, messagesGrowth: 0, campaignsRunning: 0, unreadChats: 0 });
        const stats = await storage.getDashboardStatsByChannel(channels[0].id, user?.id || '');
        res.json(stats);
    }
});
export const getDashboardStatsForAdmin = asyncHandler(async (req, res) => {
    const user = req.session?.user;
    if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    const stats = await storage.getDashboardStats();
    res.json(stats);
});
export const getDashboardStatsForUser = asyncHandler(async (req, res) => {
    const channelId = req.query.channelId;
    const user = req.session?.user;
    const userId = user?.id;
    // Verify channel ownership for non-superadmin
    if (channelId && user && user.role !== 'superadmin') {
        const ownerId = user.role === 'team' ? user.createdBy : user.id;
        const channels = await storage.getChannelsByUserId(ownerId);
        const channelIds = channels.map((ch) => ch.id);
        if (!channelIds.includes(channelId)) {
            return res.status(403).json({ error: 'Access denied to this channel' });
        }
    }
    const stats = await storage.getDashboardStatsByChannel(channelId || '', userId);
    res.json(stats);
});
export const getAnalytics = asyncHandler(async (req, res) => {
    const channelId = req.query.channelId;
    const days = req.query.days ? parseInt(req.query.days) : undefined;
    const user = req.session?.user;
    if (channelId) {
        if (user && user.role !== 'superadmin') {
            const ownerId = user.role === 'team' ? user.createdBy : user.id;
            const channels = await storage.getChannelsByUserId(ownerId);
            const channelIds = channels.map((ch) => ch.id);
            if (!channelIds.includes(channelId)) {
                return res.status(403).json({ error: 'Access denied to this channel' });
            }
        }
        const analytics = await storage.getAnalyticsByChannel(channelId, days);
        res.json(analytics);
    }
    else if (user && user.role === 'superadmin') {
        const analytics = await storage.getAnalytics();
        res.json(analytics);
    }
    else {
        const ownerId = user?.role === 'team' ? user?.createdBy : user?.id;
        if (!ownerId)
            return res.json([]);
        const channels = await storage.getChannelsByUserId(ownerId);
        if (channels.length === 0)
            return res.json([]);
        const analytics = await storage.getAnalyticsByChannel(channels[0].id, days);
        res.json(analytics);
    }
});
export const createAnalytics = asyncHandler(async (req, res) => {
    const analytics = await storage.createAnalytics(req.body);
    res.json(analytics);
});
