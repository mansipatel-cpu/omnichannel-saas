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
import { adminCreateNotification, adminGetNotifications, adminSendNotification, userGetNotifications, userMarkAsRead, userUnreadCount, userMarkAllRead, getNotificationTemplates, updateNotificationTemplate, getUserPreferences, updateUserPreference, deleteNotification, } from "../../controllers/whatsappNotification.controller";
export function registerNotificationsRoutes(app) {
    app.post("/api/whatsapp/notifications", requireAuth, adminCreateNotification);
    // Send
    app.post("/api/whatsapp/notifications/:id/send", requireAuth, adminSendNotification);
    // List all
    app.get("/api/whatsapp/notifications/", requireAuth, adminGetNotifications);
    // List all user notifications
    app.get("/api/whatsapp/notifications/users/", requireAuth, userGetNotifications);
    // Mark as read
    app.post("/api/whatsapp/notifications/:id/read", requireAuth, userMarkAsRead);
    // Mark all read
    app.post("/api/whatsapp/notifications/mark-all", requireAuth, userMarkAllRead);
    // Unread count
    app.get("/api/whatsapp/notifications/unread-count", requireAuth, userUnreadCount);
    app.get("/api/whatsapp/notification-templates", requireAuth, getNotificationTemplates);
    app.put("/api/whatsapp/notification-templates/:id", requireAuth, requireRole("superadmin"), updateNotificationTemplate);
    // User notification preferences
    app.get("/api/whatsapp/notification-preferences", requireAuth, getUserPreferences);
    app.put("/api/whatsapp/notification-preferences", requireAuth, updateUserPreference);
    // Delete a sent notification
    app.delete("/api/whatsapp/notifications/:id", requireAuth, deleteNotification);
}
