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
    active: () => ["/api/whatsapp/channels/active"] as const,
    byUser: (userId?: string) => ["/api/whatsapp/channels", { userId }] as const,
  },
  conversations: {
    all: () => ["/api/whatsapp/conversations"] as const,
    list: (channelId?: string) => ["/api/whatsapp/conversations", channelId] as const,
    detail: (conversationId?: string) =>
      ["/api/whatsapp/conversations", conversationId] as const,
    messages: (conversationId?: string) =>
      ["/api/whatsapp/conversations", conversationId, "messages"] as const,
    pins: (channelId?: string) =>
      ["/api/whatsapp/conversations/pins", channelId] as const,
  },
  campaigns: {
    all: () => ["/api/whatsapp/campaigns"] as const,
    list: (scope?: Record<string, unknown>) =>
      scope ? (["/api/whatsapp/campaigns", scope] as const) : (["/api/whatsapp/campaigns"] as const),
    byChannel: (channelId?: string) => ["/api/whatsapp/campaigns", channelId] as const,
    detail: (id: string) => ["/api/whatsapp/campaigns", id] as const,
  },
  templates: {
    all: () => ["/api/whatsapp/templates"] as const,
    list: (scope?: Record<string, unknown>) =>
      scope ? (["/api/whatsapp/templates", scope] as const) : (["/api/whatsapp/templates"] as const),
    byChannel: (channelId?: string) => ["/api/whatsapp/templates", channelId] as const,
    detail: (id: string) => ["/api/whatsapp/templates", id] as const,
  },
  automations: {
    all: () => ["/api/whatsapp/automations"] as const,
    list: (channelId?: string) => ["/api/whatsapp/automations", channelId] as const,
    detail: (id: string) => ["/api/whatsapp/automations", id] as const,
  },
  contacts: {
    all: () => ["/api/whatsapp/contacts"] as const,
    list: (params: Record<string, unknown>) => ["/api/whatsapp/contacts", params] as const,
    detail: (id: string) => ["/api/whatsapp/contacts", id] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
