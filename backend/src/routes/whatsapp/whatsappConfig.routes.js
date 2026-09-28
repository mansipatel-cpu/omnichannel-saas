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
import { saveWhatsappConfig, getMyWhatsappConfig, updateWhatsappConfig, deleteWhatsappConfig, } from "../../controllers/whatsappConfig.controller";
import { requireAuth, requireRole } from "../../middleware/whatsappAuth";
export function registerWhatsappConfigRoutes(app) {
    // Get config (all authenticated users can read - needed for embedded signup flow)
    app.get("/api/whatsapp/embedded/config", requireAuth, getMyWhatsappConfig);
    // Create / Update (superadmin only)
    app.post("/api/whatsapp/embedded/config", requireAuth, requireRole("superadmin"), saveWhatsappConfig);
    // Update by id (superadmin only)
    app.put("/api/whatsapp/embedded/config/:id", requireAuth, requireRole("superadmin"), updateWhatsappConfig);
    // Delete (superadmin only)
    app.delete("/api/whatsapp/embedded/config", requireAuth, requireRole("superadmin"), deleteWhatsappConfig);
}
