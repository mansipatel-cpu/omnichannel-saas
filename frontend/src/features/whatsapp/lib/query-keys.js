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
/**
 * Centralized React-Query key factory.
 *
 * Keep all query keys defined here so that invalidations and cache lookups use
 * the same structure and typos can be caught at the call site. The key shape
 * mirrors the REST URL for the data (paired with any scoping params).
 */
export const queryKeys = {
    channels: {
        active: () => ["/api/whatsapp/channels/active"],
        byUser: (userId) => ["/api/whatsapp/channels", { userId }],
    },
    conversations: {
        all: () => ["/api/whatsapp/conversations"],
        list: (channelId) => ["/api/whatsapp/conversations", channelId],
        detail: (conversationId) => ["/api/whatsapp/conversations", conversationId],
        messages: (conversationId) => ["/api/whatsapp/conversations", conversationId, "messages"],
        pins: (channelId) => ["/api/whatsapp/conversations/pins", channelId],
    },
    campaigns: {
        all: () => ["/api/whatsapp/campaigns"],
        list: (scope) => scope ? ["/api/whatsapp/campaigns", scope] : ["/api/whatsapp/campaigns"],
        byChannel: (channelId) => ["/api/whatsapp/campaigns", channelId],
        detail: (id) => ["/api/whatsapp/campaigns", id],
    },
    templates: {
        all: () => ["/api/whatsapp/templates"],
        list: (scope) => scope ? ["/api/whatsapp/templates", scope] : ["/api/whatsapp/templates"],
        byChannel: (channelId) => ["/api/whatsapp/templates", channelId],
        detail: (id) => ["/api/whatsapp/templates", id],
    },
    automations: {
        all: () => ["/api/whatsapp/automations"],
        list: (channelId) => ["/api/whatsapp/automations", channelId],
        detail: (id) => ["/api/whatsapp/automations", id],
    },
    contacts: {
        all: () => ["/api/whatsapp/contacts"],
        list: (params) => ["/api/whatsapp/contacts", params],
        detail: (id) => ["/api/whatsapp/contacts", id],
    },
};
