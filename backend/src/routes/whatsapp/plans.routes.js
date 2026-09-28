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
import { getAllPlans, getPlanById, createPlan, updatePlan, deletePlan, } from "../../controllers/whatsappPlans.controller";
export function registerPlansRoutes(app) {
    app.get("/api/whatsapp/admin/plans", getAllPlans);
    app.get("/api/whatsapp/admin/plans/:id", requireAuth, getPlanById);
    app.post("/api/whatsapp/admin/plans", requireAuth, requireRole("superadmin"), createPlan);
    app.put("/api/whatsapp/admin/plans/:id", requireAuth, requireRole("superadmin"), updatePlan);
    app.delete("/api/whatsapp/admin/plans/:id", requireAuth, requireRole("superadmin"), deletePlan);
}
