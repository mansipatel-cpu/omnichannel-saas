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
import * as panelController from "../../controllers/whatsappPanelConfig.controller";
import { handleDigitalOceanUpload, upload } from "../../middleware/whatsappUpload";
import { requireAuth, requireRole } from "../../middleware/whatsappAuth";
import { getFirstPanelConfig, updateFirstPanelConfig } from "../../services/whatsappPanel.config";
export function registerPanelConfigRoutes(app) {
    app.get("/api/whatsapp/platform-settings", async (_req, res) => {
        try {
            const config = await getFirstPanelConfig();
            res.json({
                embeddedSignupEnabled: config?.embeddedSignupEnabled ?? true,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.put("/api/whatsapp/platform-settings", requireAuth, requireRole("superadmin"), async (req, res) => {
        try {
            const { embeddedSignupEnabled } = req.body;
            const config = await updateFirstPanelConfig({
                embeddedSignupEnabled: !!embeddedSignupEnabled,
            });
            res.json({
                embeddedSignupEnabled: config?.embeddedSignupEnabled ?? true,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.post("/api/whatsapp/panel", requireAuth, requireRole("superadmin"), upload.fields([{ name: "logo", maxCount: 1 }, { name: "favicon", maxCount: 1 }]), handleDigitalOceanUpload, panelController.create);
    app.get("/api/whatsapp/panel", requireAuth, requireRole("superadmin"), panelController.getAll);
    app.get("/api/whatsapp/panel/:id", requireAuth, requireRole("superadmin"), panelController.getOne);
    app.put("/api/whatsapp/panel/:id", requireAuth, requireRole("superadmin"), upload.fields([{ name: "logo", maxCount: 1 }, { name: "favicon", maxCount: 1 }]), handleDigitalOceanUpload, panelController.update);
    app.delete("/api/whatsapp/panel/:id", requireAuth, requireRole("superadmin"), panelController.remove);
    app.get("/api/whatsapp/brand-settings", panelController.getBrandSettings);
    app.put("/api/whatsapp/brand-settings", requireAuth, requireRole("superadmin"), upload.fields([{ name: "logo", maxCount: 1 }, { name: "logo2", maxCount: 1 }, { name: "favicon", maxCount: 1 }]), handleDigitalOceanUpload, panelController.updateBrandSettings);
    app.post("/api/whatsapp/brand-settings", requireAuth, requireRole("superadmin"), upload.fields([{ name: "logo", maxCount: 1 }, { name: "logo2", maxCount: 1 }, { name: "favicon", maxCount: 1 }]), handleDigitalOceanUpload, panelController.createBrandSettings);
}
