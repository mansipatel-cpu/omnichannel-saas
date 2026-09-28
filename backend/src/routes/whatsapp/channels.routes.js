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
import * as channelsController from "../../controllers/whatsappChannels.controller";
import { validateRequest } from "../../middleware/whatsappValidation";
import { insertChannelSchema } from "@shared/whatsapp-schema";
import { requireAuth, requireRole } from "../../middleware/whatsappAuth";
import { requireSubscription } from "../../middleware/whatsappRequireSubscription";
import multer from "multer";
import { whatsappDb as db } from "../../config/database";
import { whatsappChannels } from "@shared/whatsapp-schema";
const profileUpload = multer({ dest: "uploads/profile-photos/", limits: { fileSize: 5 * 1024 * 1024 } });
export function registerChannelRoutes(app) {
    app.get("/api/whatsapp/channels/all", requireAuth, requireRole("superadmin"), async (req, res) => {
        try {
            const allChannels = await db.select({
                id: whatsappChannels.id,
                name: whatsappChannels.name,
                phoneNumber: whatsappChannels.phoneNumber,
            }).from(whatsappChannels);
            res.json({ success: true, data: allChannels });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });
    app.get("/api/whatsapp/channels", requireAuth, channelsController.getChannels);
    app.post("/api/whatsapp/channels/userid", requireAuth, channelsController.getChannelsByUserId);
    // Get active channel
    app.get("/api/whatsapp/channels/active", requireAuth, channelsController.getActiveChannel);
    // Create channel
    app.post("/api/whatsapp/channels", requireAuth, validateRequest(insertChannelSchema), requireSubscription("channel"), channelsController.createChannel);
    // embedded signup
    app.post("/api/whatsapp/embedded-signup", requireAuth, requireSubscription("channel"), channelsController.embeddedSignup);
    // Update channel
    app.put("/api/whatsapp/channels/:id", requireAuth, channelsController.updateChannel);
    // Disconnect channel (deregister from Cloud API)
    app.post("/api/whatsapp/channels/:id/disconnect", requireAuth, channelsController.disconnectChannel);
    // Delete channel
    app.delete("/api/whatsapp/channels/:id", requireAuth, channelsController.deleteChannel);
    app.post("/api/whatsapp/channels/:id/health", requireAuth, channelsController.checkChannelHealth);
    app.post("/api/whatsapp/channels/health-check-all", requireAuth, channelsController.checkAllChannelsHealth);
    // WhatsApp Business Profile
    app.get("/api/whatsapp/channels/:id/profile", requireAuth, channelsController.getBusinessProfile);
    app.post("/api/whatsapp/channels/:id/profile", requireAuth, channelsController.updateBusinessProfile);
    app.post("/api/whatsapp/channels/:id/profile/photo", requireAuth, profileUpload.single("photo"), channelsController.uploadProfilePhoto);
    // Display Name Management
    app.get("/api/whatsapp/channels/:id/display-name", requireAuth, channelsController.getDisplayName);
    app.post("/api/whatsapp/channels/:id/display-name", requireAuth, channelsController.updateDisplayName);
    app.get("/api/whatsapp/channels/:id/messaging-limit", requireAuth, channelsController.getMessagingLimit);
    app.get("/api/whatsapp/test-credentials", requireAuth, requireRole("superadmin"), channelsController.testCredentials);
    app.get("/api/whatsapp/admin/channels", requireAuth, requireRole("superadmin"), channelsController.getAllChannelsAdmin);
    app.get("/api/whatsapp/admin/channel-signup-logs", requireAuth, requireRole("superadmin"), channelsController.getSignupLogs);
    // Webhook subscription management
    app.get("/api/whatsapp/channels/:id/webhook-subscription", requireAuth, channelsController.getWebhookSubscription);
    app.post("/api/whatsapp/channels/:id/webhook-resubscribe", requireAuth, channelsController.resubscribeWebhook);
    app.post("/api/whatsapp/channels/webhook-resubscribe-all", requireAuth, channelsController.resubscribeAllWebhooks);
}
