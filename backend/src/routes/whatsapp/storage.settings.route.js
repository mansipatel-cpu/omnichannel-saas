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
import { getStorageSettings, getActiveStorage, updateStorageSetting, deleteStorageSetting, testStorageConnection, } from "../../controllers/whatsappStorageSettings.controller";
import { requireAuth, requireRole } from "../../middleware/whatsappAuth";
export function registerStorageSettingsRoutes(app) {
    app.get("/api/whatsapp/storage-settings", requireAuth, requireRole("superadmin"), getStorageSettings);
    app.get("/api/whatsapp/storage-settings/active", requireAuth, requireRole("superadmin"), getActiveStorage);
    app.post("/api/whatsapp/storage-settings/update", requireAuth, requireRole("superadmin"), updateStorageSetting);
    app.post("/api/whatsapp/storage-settings/test", requireAuth, requireRole("superadmin"), testStorageConnection);
    app.delete("/api/whatsapp/storage-settings/:id", requireAuth, requireRole("superadmin"), deleteStorageSetting);
}
