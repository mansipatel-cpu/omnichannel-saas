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

import type { Express } from "express";
import { diployLogger, HTTP_STATUS, DIPLOY_BRAND } from "@diploy/core";
import { campaignsController } from "../controllers/campaigns.controller";
import { extractChannelId } from "../middlewares/channel.middleware";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware";
import { PERMISSIONS } from "@shared/whatsapp-schema";
import { requireSubscription } from "server/middlewares/requireSubscription";

export function registerCampaignRoutes(app: Express) {
  // Get all campaigns
  app.get("/api/whatsapp/campaigns",
    extractChannelId,
    requireAuth,
    requirePermission(PERMISSIONS.CAMPAIGNS_VIEW),
    campaignsController.getCampaigns
  );

  // Soft-deleted campaigns (must be before /:id)
  app.get("/api/whatsapp/campaigns/deleted",
    extractChannelId,
    requireAuth,
    requirePermission(PERMISSIONS.CAMPAIGNS_VIEW),
    campaignsController.getDeletedCampaigns
  );

  // Get campaign by ID
  app.get("/api/whatsapp/campaigns/:id", requireAuth,
    requirePermission(PERMISSIONS.CAMPAIGNS_VIEW),
    campaignsController.getCampaign
  );

  // Create new campaign
  // app.post("/api/whatsapp/campaigns",   requireAuth,
  // requirePermission(PERMISSIONS.CAMPAIGNS_CREATE), requireSubscription("campaign"), 
  //   campaignsController.createCampaign
  // );




  app.post("/api/whatsapp/campaigns", requireAuth,
    requirePermission(PERMISSIONS.CAMPAIGNS_CREATE),
    campaignsController.createCampaign
  );




  app.post("/api/whatsapp/getCampaignsByUserId", requireAuth, campaignsController.getCampaignByUserID);



  // Update campaign status
  app.patch("/api/whatsapp/campaigns/:id/status", requireAuth,
    requirePermission(PERMISSIONS.CAMPAIGNS_EDIT),
    campaignsController.updateCampaignStatus
  );

  // Restore soft-deleted campaign
  app.patch("/api/whatsapp/campaigns/:id/restore", requireAuth,
    requirePermission(PERMISSIONS.CAMPAIGNS_EDIT),
    campaignsController.restoreCampaign
  );

  // Delete campaign (soft-delete)
  app.delete("/api/whatsapp/campaigns/:id", requireAuth,
    requirePermission(PERMISSIONS.CAMPAIGNS_DELETE),
    campaignsController.deleteCampaign
  );

  // Start campaign execution
  app.post("/api/whatsapp/campaigns/:id/start",
    requireAuth,
    campaignsController.startCampaign
  );

  // Get campaign analytics
  app.get("/api/whatsapp/campaigns/:id/analytics",
    requireAuth,
    campaignsController.getCampaignAnalytics
  );

  // API campaign endpoint
  app.post("/api/whatsapp/campaigns/send/:apiKey", requireAuth,
    requirePermission(PERMISSIONS.CAMPAIGNS_SEND),
    campaignsController.sendApiCampaign
  );
}