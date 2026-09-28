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
import * as conversationsController from "../../controllers/whatsappConversations.controller";
import * as conversationPinsController from "../../controllers/whatsappConversationPins.controller";
import { validateRequest } from "../../middleware/whatsappValidation";
import { insertConversationSchema, PERMISSIONS } from "@shared/whatsapp-schema";
import { extractChannelId } from "../../middleware/whatsappChannel";
import { storage } from "../../storage/whatsappStorage";
import { requireAuth, requirePermission } from "../../middleware/whatsappAuth";
import { cancelConversationAutomation, getConversationAutomationStatus } from "../../controllers/whatsappWebhooks.controller";
export function registerConversationRoutes(app) {
    // Get unread count
    app.get('/api/whatsapp/conversations/unread-count', requireAuth, async (req, res) => {
        try {
            const activeChannel = await storage.getActiveChannel();
            if (!activeChannel) {
                return res.json({ count: 0 });
            }
            const conversations = await storage.getConversationsByChannel(activeChannel.id);
            const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
            res.json({ count: unreadCount });
        }
        catch (error) {
            console.error('Error getting unread count:', error);
            res.json({ count: 0 });
        }
    });
    // Get all conversations
    app.get("/api/whatsapp/conversations", requireAuth, extractChannelId, conversationsController.getConversations);
    // Pinned conversations (per user)
    app.get("/api/whatsapp/conversations/pins", requireAuth, conversationPinsController.listPins);
    app.post("/api/whatsapp/conversations/:id/pin", requireAuth, conversationPinsController.pinConversation);
    app.delete("/api/whatsapp/conversations/:id/pin", requireAuth, conversationPinsController.unpinConversation);
    // Get single conversation
    app.get("/api/whatsapp/conversations/:id", requireAuth, conversationsController.getConversation);
    // Create conversation
    app.post("/api/whatsapp/conversations", requireAuth, validateRequest(insertConversationSchema), conversationsController.createConversation);
    // Update conversation
    app.put("/api/whatsapp/conversations/:id", requireAuth, requirePermission(PERMISSIONS.INBOX_ASSIGN), conversationsController.updateConversation);
    // Delete conversation
    app.delete("/api/whatsapp/conversations/:id", requireAuth, conversationsController.deleteConversation);
    // Mark conversation as read
    app.put("/api/whatsapp/conversations/:id/read", requireAuth, conversationsController.markAsRead);
    // Update conversation status
    app.patch("/api/whatsapp/conversations/:id/status", requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            if (!['open', 'resolved', 'closed'].includes(status)) {
                return res.status(400).json({
                    message: 'Invalid status. Must be open, resolved, or closed'
                });
            }
            await storage.updateConversation(id, { status });
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating conversation status:', error);
            res.status(500).json({ message: 'Failed to update conversation status' });
        }
    });
    app.get('/api/whatsapp/conversations/:conversationId/automation-status', requireAuth, getConversationAutomationStatus);
    app.post('/api/whatsapp/conversations/:conversationId/cancel-automation', requireAuth, cancelConversationAutomation);
}
