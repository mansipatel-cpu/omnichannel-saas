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
import { campaignsController } from "../../controllers/whatsappCampaigns.controller";
import { whatsappCampaignCompatibilityController as compatibilityController } from "../../modules/campaigns/campaign.compatibility.controller";
import { extractChannelId } from "../../middleware/whatsappChannel";
import { requireAuth, requirePermission } from "../../middleware/whatsappAuth";
import { PERMISSIONS } from "@shared/whatsapp-schema";
export function registerCampaignRoutes(app) {
    // Get all campaigns
    app.get("/api/whatsapp/campaigns", extractChannelId, requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), compatibilityController.list);
    // Soft-deleted campaigns (must be before /:id)
    app.get("/api/whatsapp/campaigns/deleted", extractChannelId, requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), compatibilityController.list);
    // Get campaign by ID
    app.get("/api/whatsapp/campaigns/:id", requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), compatibilityController.get);
    // Create new campaign
    // app.post("/api/whatsapp/campaigns",   requireAuth,
    // requirePermission(PERMISSIONS.CAMPAIGNS_CREATE), requireSubscription("campaign"), 
    //   campaignsController.createCampaign
    // );
    app.post("/api/whatsapp/campaigns", requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_CREATE), compatibilityController.create);
    app.post("/api/whatsapp/getCampaignsByUserId", requireAuth, campaignsController.getCampaignByUserID);
    // Update campaign status
    app.patch("/api/whatsapp/campaigns/:id/status", requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_EDIT), compatibilityController.updateStatus);
    app.put("/api/whatsapp/campaigns/:id", requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_EDIT), compatibilityController.update);
    // Restore soft-deleted campaign
    app.patch("/api/whatsapp/campaigns/:id/restore", requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_EDIT), compatibilityController.restore);
    // Delete campaign (soft-delete)
    app.delete("/api/whatsapp/campaigns/:id", requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_DELETE), compatibilityController.remove);
    // Start campaign execution
    app.post("/api/whatsapp/campaigns/:id/start", requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_SEND), compatibilityController.start);
    // Get campaign analytics
    app.get("/api/whatsapp/campaigns/:id/analytics", requireAuth, campaignsController.getCampaignAnalytics);
    // API campaign endpoint
    app.post("/api/whatsapp/campaigns/send/:apiKey", requireAuth, requirePermission(PERMISSIONS.CAMPAIGNS_SEND), campaignsController.sendApiCampaign);
}
