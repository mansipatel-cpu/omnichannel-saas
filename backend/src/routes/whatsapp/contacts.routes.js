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
import * as contactsController from "../../controllers/whatsappContacts.controller";
import { validateRequest } from "../../middleware/whatsappValidation";
import { insertContactSchema, PERMISSIONS } from "@shared/whatsapp-schema";
import { extractChannelId } from "../../middleware/whatsappChannel";
import { requireAuth, requirePermission } from "../../middleware/whatsappAuth";
import { requireSubscription } from "../../middleware/whatsappRequireSubscription";
export function registerContactRoutes(app) {
    // Get all contacts
    app.get("/api/whatsapp/contacts-all", requireAuth, requirePermission(PERMISSIONS.CONTACTS_VIEW), extractChannelId, contactsController.getContacts);
    app.get("/api/whatsapp/contacts", requireAuth, requirePermission(PERMISSIONS.CONTACTS_VIEW), extractChannelId, contactsController.getContactsWithPagination);
    // Get single contact
    app.get("/api/whatsapp/contacts/:id", requireAuth, requirePermission(PERMISSIONS.CONTACTS_VIEW), contactsController.getContact);
    // Create contact
    app.post("/api/whatsapp/contacts", extractChannelId, requireAuth, requirePermission(PERMISSIONS.CONTACTS_CREATE), requireSubscription('contacts'), validateRequest(insertContactSchema), contactsController.createContact);
    app.get("/api/whatsapp/user/contacts/:userId", requireAuth, contactsController.getContactsByUser);
    // Update contact
    app.put("/api/whatsapp/contacts/:id", requireAuth, requirePermission(PERMISSIONS.CONTACTS_EDIT), contactsController.updateContact);
    // Delete contact
    app.delete("/api/whatsapp/contacts/:id", requireAuth, requirePermission(PERMISSIONS.CONTACTS_DELETE), contactsController.deleteContact);
    // Delete Bulk contact
    app.delete("/api/whatsapp/contacts-bulk", requireAuth, requirePermission(PERMISSIONS.CONTACTS_DELETE), contactsController.deleteBulkContacts);
    // Import contacts
    app.post("/api/whatsapp/contacts/import", requireAuth, requirePermission(PERMISSIONS.CONTACTS_EXPORT), // or CONTACTS_IMPORT if you defined it
    extractChannelId, requireSubscription('contacts'), contactsController.importContacts);
}
