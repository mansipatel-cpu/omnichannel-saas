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
import path from "path";
import { requireAuth, requireRole } from "../../middleware/whatsappAuth";
import { getSMTPConfigHandler, upsertSMTPConfig, sendMailRoute } from "../../controllers/whatsappSmtp.controller";
import { upload, handleDigitalOceanUpload } from "../../middleware/whatsappUpload";
export function registerSMTPRoutes(app) {
    app.post("/api/whatsapp/admin/smtpConfig", requireAuth, requireRole("superadmin"), upsertSMTPConfig);
    app.get("/api/whatsapp/admin/getSmtpConfig", requireAuth, requireRole("superadmin"), getSMTPConfigHandler);
    app.post("/api/whatsapp/admin/smtp/upload-logo", requireAuth, requireRole("superadmin"), upload.single('logo'), handleDigitalOceanUpload, async (req, res) => {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }
            const logoUrl = file.cloudUrl || `/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`;
            res.json({ success: true, url: logoUrl });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    app.post("/api/whatsapp/contact/sendmail", requireAuth, sendMailRoute);
}
