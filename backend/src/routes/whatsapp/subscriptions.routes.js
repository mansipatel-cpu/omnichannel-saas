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
import { requireAuth, requireRole } from "../../middleware/whatsappAuth";
import { getActiveSubscriptionByUserId, getAllSubscriptions, getSubscriptionById, getSubscriptionsByUserId, createSubscription, AssignSubscription, updateSubscription, cancelSubscription, renewSubscription, toggleAutoRenew, checkExpiredSubscriptions, } from "../../controllers/whatsappSubscriptions.controller";
export function registerSubscriptionsRoutes(app) {
    app.get("/api/whatsapp/subscriptions", requireAuth, requireRole("superadmin"), getAllSubscriptions);
    app.get("/api/whatsapp/admin/subscriptions/:id", requireAuth, requireRole("superadmin"), getSubscriptionById);
    app.get("/api/whatsapp/subscriptions/user/:userId", requireAuth, getSubscriptionsByUserId);
    app.get("/api/whatsapp/subscriptions/active/:userId", requireAuth, getActiveSubscriptionByUserId);
    app.post("/api/whatsapp/subscriptions", requireAuth, createSubscription);
    app.post("/api/whatsapp/assignSubscription", requireAuth, requireRole("superadmin"), AssignSubscription);
    app.put("/api/whatsapp/admin/subscriptions/:id", requireAuth, requireRole("superadmin"), updateSubscription);
    app.delete("/api/whatsapp/subscriptions/:id", requireAuth, cancelSubscription);
    app.put("/api/whatsapp/subscriptions/renew/:id", requireAuth, renewSubscription);
    app.put("/api/whatsapp/subscriptions/toggle-autorenew/:id", requireAuth, toggleAutoRenew);
    app.put("/api/whatsapp/admin/subscriptions/expire", requireAuth, requireRole("superadmin"), checkExpiredSubscriptions);
}
