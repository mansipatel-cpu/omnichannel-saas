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

import type { Message, ConversationWithContact } from "./types";

export const DEMO_CONVERSATION_ID = "client-demo-inbox";
export const DEMO_CONTACT_ID = "client-demo-contact";
export const DEMO_INBOX_PHONE = "+15550001111";
export const DEMO_INBOX_NAME = "Demo User";
export const DEMO_INBOX_GREETING =
  "Hello! This is a demo conversation. You can send messages here without WhatsApp.";

export function isDemoConversationId(id?: string | null): boolean {
  return id === DEMO_CONVERSATION_ID;
}

export function isServerDemoConversation(conv: {
  id?: string;
  type?: string | null;
  contactPhone?: string | null;
}): boolean {
  if (!conv) return false;
  if (conv.id === DEMO_CONVERSATION_ID) return false;
  return conv.type === "demo" || conv.contactPhone === DEMO_INBOX_PHONE;
}

export function createDemoGreetingMessage(): Message {
  const now = new Date().toISOString();
  return {
    id: "client-demo-greeting",
    conversationId: DEMO_CONVERSATION_ID,
    whatsappMessageId: "demo_greeting",
    fromUser: false,
    direction: "inbound",
    content: DEMO_INBOX_GREETING,
    type: "text",
    messageType: "text",
    status: "delivered",
    createdAt: now,
  };
}

export function createDemoConversation(channelId?: string): ConversationWithContact {
  const now = new Date().toISOString();
  return {
    id: DEMO_CONVERSATION_ID,
    channelId: channelId || null,
    contactId: DEMO_CONTACT_ID,
    contactPhone: DEMO_INBOX_PHONE,
    contactName: DEMO_INBOX_NAME,
    status: "open",
    priority: "normal",
    type: "whatsapp",
    unreadCount: 0,
    lastMessageAt: now as any,
    lastIncomingMessageAt: now as any,
    lastMessageText: DEMO_INBOX_GREETING,
    createdAt: now as any,
    updatedAt: now as any,
    contact: {
      id: DEMO_CONTACT_ID,
      channelId: channelId || "",
      name: DEMO_INBOX_NAME,
      phone: DEMO_INBOX_PHONE,
      source: "demo",
      status: "active",
      groups: [],
      tags: ["demo"],
      createdAt: now as any,
      updatedAt: now as any,
    } as any,
  } as ConversationWithContact;
}

export function createLocalOutboundMessage(content: string): Message {
  const now = new Date().toISOString();
  return {
    id: `client-demo-out-${Date.now()}`,
    conversationId: DEMO_CONVERSATION_ID,
    whatsappMessageId: `demo_out_${Date.now()}`,
    fromUser: true,
    direction: "outbound",
    content,
    type: "text",
    messageType: "text",
    status: "sent",
    createdAt: now,
  };
}

export function createLocalInboundReply(): Message {
  const now = new Date().toISOString();
  return {
    id: `client-demo-in-${Date.now()}`,
    conversationId: DEMO_CONVERSATION_ID,
    whatsappMessageId: `demo_in_${Date.now()}`,
    fromUser: false,
    direction: "inbound",
    content: "Thanks for your message! (Demo reply)",
    type: "text",
    messageType: "text",
    status: "delivered",
    createdAt: now,
  };
}
