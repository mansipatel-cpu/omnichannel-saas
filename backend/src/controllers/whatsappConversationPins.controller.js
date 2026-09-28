import { whatsappDb as db } from "../config/database";
import { conversationPins, conversations } from "@shared/whatsapp-schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { storage } from "../storage/whatsappStorage";
const PIN_CAP_PER_USER_PER_CHANNEL = 20;
function getSessionUser(req) {
    return req.session?.user || null;
}
function getUserId(req) {
    const u = getSessionUser(req);
    return u?.id || null;
}
async function canAccessChannel(user, channelId) {
    if (!user)
        return false;
    if (!channelId)
        return true;
    if (user.role === "superadmin")
        return true;
    const ownerId = user.role === "team" ? user.createdBy : user.id;
    if (!ownerId)
        return false;
    try {
        const channels = await storage.getChannelsByUserId(ownerId);
        return channels.some((ch) => ch.id === channelId);
    }
    catch (e) {
        console.error("canAccessChannel lookup failed:", e);
        return false;
    }
}
export async function listPins(req, res) {
    try {
        const user = getSessionUser(req);
        const userId = user?.id;
        if (!userId)
            return res.status(401).json({ error: "Not authenticated" });
        const channelId = (typeof req.query.channelId === "string" && req.query.channelId.trim()) ||
            undefined;
        if (channelId && !(await canAccessChannel(user, channelId))) {
            return res.status(403).json({ error: "Access denied to this channel" });
        }
        const whereClause = channelId
            ? and(eq(conversationPins.userId, userId), eq(conversationPins.channelId, channelId))
            : eq(conversationPins.userId, userId);
        const rows = await db
            .select({
            id: conversationPins.id,
            conversationId: conversationPins.conversationId,
            channelId: conversationPins.channelId,
            createdAt: conversationPins.createdAt,
        })
            .from(conversationPins)
            .where(whereClause)
            .orderBy(desc(conversationPins.createdAt));
        res.json({ success: true, pins: rows });
    }
    catch (e) {
        console.error("listPins error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
}
export async function pinConversation(req, res) {
    try {
        const user = getSessionUser(req);
        const userId = user?.id;
        if (!userId)
            return res.status(401).json({ error: "Not authenticated" });
        const conversationId = req.params.id;
        if (!conversationId)
            return res.status(400).json({ error: "Missing conversation id" });
        const conv = await db
            .select({ id: conversations.id, channelId: conversations.channelId })
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);
        if (conv.length === 0)
            return res.status(404).json({ error: "Conversation not found" });
        const channelId = conv[0].channelId;
        if (!(await canAccessChannel(user, channelId))) {
            return res.status(403).json({ error: "Access denied to this channel" });
        }
        const existing = await db
            .select({ id: conversationPins.id })
            .from(conversationPins)
            .where(and(eq(conversationPins.userId, userId), eq(conversationPins.conversationId, conversationId)))
            .limit(1);
        if (existing.length > 0) {
            return res.json({ success: true, alreadyPinned: true });
        }
        if (channelId) {
            const countRes = await db
                .select({ count: sql `count(*)` })
                .from(conversationPins)
                .where(and(eq(conversationPins.userId, userId), eq(conversationPins.channelId, channelId)));
            const count = Number(countRes[0]?.count || 0);
            if (count >= PIN_CAP_PER_USER_PER_CHANNEL) {
                return res.status(409).json({
                    success: false,
                    code: "PIN_CAP_REACHED",
                    error: "PIN_CAP_REACHED",
                    cap: PIN_CAP_PER_USER_PER_CHANNEL,
                });
            }
        }
        await db.insert(conversationPins).values({
            userId,
            conversationId,
            channelId: channelId || null,
        });
        res.json({ success: true });
    }
    catch (e) {
        console.error("pinConversation error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
}
export async function unpinConversation(req, res) {
    try {
        const user = getSessionUser(req);
        const userId = user?.id;
        if (!userId)
            return res.status(401).json({ error: "Not authenticated" });
        const conversationId = req.params.id;
        if (!conversationId)
            return res.status(400).json({ error: "Missing conversation id" });
        const conv = await db
            .select({ channelId: conversations.channelId })
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);
        const channelId = conv[0]?.channelId || null;
        if (channelId && !(await canAccessChannel(user, channelId))) {
            return res.status(403).json({ error: "Access denied to this channel" });
        }
        await db
            .delete(conversationPins)
            .where(and(eq(conversationPins.userId, userId), eq(conversationPins.conversationId, conversationId)));
        res.json({ success: true });
    }
    catch (e) {
        console.error("unpinConversation error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
}
