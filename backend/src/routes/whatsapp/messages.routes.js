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
import * as messagesController from "../../controllers/whatsappMessages.controller";
import { handleDigitalOceanUpload, upload } from "../../middleware/whatsappUpload";
import { requireAuth } from "../../middleware/whatsappAuth";
export function registerMessageRoutes(app) {
    // Get messages for conversation
    app.get("/api/whatsapp/conversations/:conversationId/messages", requireAuth, messagesController.getMessages);
    // Create message in conversation
    app.post("/api/whatsapp/conversations/:conversationId/messages", requireAuth, upload.single("media"), handleDigitalOceanUpload, messagesController.createMessage);
    // Send WhatsApp message
    app.post("/api/whatsapp/messages/send", requireAuth, messagesController.sendMessage);
    // get media url
    app.get("/api/whatsapp/messages/media-url", requireAuth, messagesController.getMediaUrl);
    // get media proxy
    app.get("/api/whatsapp/messages/media-proxy", requireAuth, messagesController.getMediaProxy);
}
