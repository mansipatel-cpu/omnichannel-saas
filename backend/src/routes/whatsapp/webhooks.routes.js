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
import * as webhooksController from "../../controllers/whatsappWebhooks.controller";
import { requireAuth } from "../../middleware/whatsappAuth";
export function registerWebhookRoutes(app) {
    // Get webhook configs
    app.get("/api/whatsapp/webhook-configs-channel-id/:id", requireAuth, webhooksController.getWebhookConfigsByChannelId);
    app.get("/api/whatsapp/webhook-configs", requireAuth, webhooksController.getWebhookConfigs);
    // Create webhook config
    app.post("/api/whatsapp/webhook-configs", requireAuth, webhooksController.createWebhookConfig);
    // Update webhook config
    app.patch("/api/whatsapp/webhook-configs/:id", requireAuth, webhooksController.updateWebhookConfig);
    // Delete webhook config
    app.delete("/api/whatsapp/webhook-configs/:id", requireAuth, webhooksController.deleteWebhookConfig);
    // Test webhook
    app.post("/api/whatsapp/webhook-configs/:id/test", requireAuth, webhooksController.testWebhook);
    // Get global webhook URL
    app.get("/api/whatsapp/webhook/global-url", requireAuth, webhooksController.getGlobalWebhookUrl);
    // Global webhook endpoint
    app.all("/webhook/global", webhooksController.handleWebhook);
    app.all("/webhook/:id", webhooksController.handleWebhook);
}
