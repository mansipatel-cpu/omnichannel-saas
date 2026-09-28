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
import * as analyticsController from "../../controllers/whatsappAnalytics.controller";
import * as dashboardController from "../../controllers/whatsappDashboard.controller";
import { requireAuth, requirePermission } from "../../middleware/whatsappAuth";
import { PERMISSIONS } from "@shared/whatsapp-schema";
export function registerAnalyticsRoutes(app) {
    // Legacy analytics endpoint for backward compatibility
    app.get("/api/whatsapp/analytics", requireAuth, requirePermission(PERMISSIONS.ANALYTICS_VIEW), dashboardController.getAnalytics);
    app.get("/api/whatsapp/analytics/messages", requireAuth, requirePermission(PERMISSIONS.ANALYTICS_VIEW), analyticsController.getMessageAnalytics);
    app.get("/api/whatsapp/analytics/campaigns", requireAuth, requirePermission(PERMISSIONS.ANALYTICS_VIEW), analyticsController.getCampaignAnalytics);
    app.get("/api/whatsapp/analytics/campaigns/:campaignId", requireAuth, requirePermission(PERMISSIONS.ANALYTICS_VIEW), analyticsController.getCampaignAnalyticsById);
    app.get("/api/whatsapp/analytics/export", requireAuth, requirePermission(PERMISSIONS.ANALYTICS_EXPORT), analyticsController.exportAnalytics);
}
