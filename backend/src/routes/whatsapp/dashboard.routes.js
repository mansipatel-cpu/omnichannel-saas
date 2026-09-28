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
import * as dashboardController from "../../controllers/whatsappDashboard.controller";
import { extractChannelId } from "../../middleware/whatsappChannel";
import { requireAuth, requirePermission } from "../../middleware/whatsappAuth";
import { PERMISSIONS } from "@shared/whatsapp-schema";
export function registerDashboardRoutes(app) {
    // Get dashboard statistics
    app.get("/api/whatsapp/dashboard/stats", requireAuth, extractChannelId, dashboardController.getDashboardStats);
    app.get("/api/whatsapp/dashboard/admin/stats", requireAuth, dashboardController.getDashboardStatsForAdmin);
    app.get("/api/whatsapp/dashboard/user/stats", requireAuth, dashboardController.getDashboardStatsForUser);
    // Get analytics data
    app.get("/api/whatsapp/analytics", requireAuth, extractChannelId, requirePermission(PERMISSIONS.ANALYTICS_VIEW), dashboardController.getAnalytics);
    // Create analytics entry
    app.post("/api/whatsapp/analytics", requireAuth, dashboardController.createAnalytics);
}
