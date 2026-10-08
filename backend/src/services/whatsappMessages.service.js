import { storage } from "../storage/whatsappStorage";
import { AppError } from "../middleware/whatsappError";
import { whatsappDb as db } from "../config/database";
import { contacts as contactsTable, conversations as conversationsTable, messages as messagesTable } from "@shared/whatsapp-schema";
import { eq } from "drizzle-orm";
import { createWhatsAppContact, normalizePhone } from "./contact-identity.service";
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
export async function sendBusinessMessage({ to, message, templateName, parameters, buttonParameters, quickReplyPayloads, mediaId, channelId, conversationId, }) {
    /* ───── Resolve channel ───── */
    if (!channelId) {
        const active = await storage.getActiveChannel();
        if (!active)
            throw new AppError(400, "No active channel");
        channelId = active.id;
    }
    const channel = await storage.getChannel(channelId);
    if (!channel)
        throw new AppError(404, "Channel not found");
    let result;
    let sentText = message || "";
    /* ───────── TEMPLATE MESSAGE ───────── */
    if (templateName) {
        const components = [];
        // HEADER IMAGE
        if (mediaId) {
            components.push({
                type: "header",
                parameters: [
                    {
                        type: "image",
                        image: { id: mediaId },
                    },
                ],
            });
        }
        // BODY VARIABLES
        if (parameters && parameters.length > 0) {
            components.push({
                type: "body",
                parameters: parameters.map((val) => ({
                    type: "text",
                    text: String(val),
                })),
            });
        }
        // URL BUTTON VARIABLES
        if (buttonParameters?.length) {
            buttonParameters.forEach((value) => {
                components.push({
                    type: "button",
                    sub_type: "url",
                    index: String(components.filter(c => c.type === "button").length),
                    parameters: [
                        {
                            type: "text",
                            text: value,
                        },
                    ],
                });
            });
        }
        if (quickReplyPayloads?.length) {
            quickReplyPayloads.forEach((payload, idx) => {
                components.push({
                    type: "button",
                    sub_type: "quick_reply",
                    index: String(components.filter(c => c.type === "button").length),
                    parameters: [{ type: "payload", payload }],
                });
            });
        }
        const payload = {
            messaging_product: "whatsapp",
            to: to.replace(/\D/g, ""),
            type: "template",
            template: {
                name: templateName,
                language: { code: "en_US" },
                ...(components.length > 0 ? { components } : {}), // ✅ SAFE
            },
        };
        console.log("🚀 FINAL WhatsApp TEMPLATE PAYLOAD:", JSON.stringify(payload, null, 2));
        const response = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${channel.phoneNumberId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${channel.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const err = await response.json();
            console.error("WhatsApp API Error:", err);
            throw new Error(err.error?.message || "Template send failed");
        }
        result = await response.json();
        sentText = templateName; // fallback for conversation
    }
    /* ───────── TEXT MESSAGE ───────── */
    else {
        const payload = {
            messaging_product: "whatsapp",
            to: to.replace(/\D/g, ""),
            type: "text",
            text: { body: message || "Test message" },
        };
        const response = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${channel.phoneNumberId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${channel.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Text send failed");
        }
        result = await response.json();
    }
    /* ───── Conversation handling (transactional) ─────
     * Wrap contact-resolve, conversation-create, message-insert and the
     * conversation last-message status update in a single DB transaction.
     * If anything in this block fails, we don't end up with an orphan
     * contact or conversation that has no message attached.
     */
    const { conversation, createdMessage } = await db.transaction(async (tx) => {
        let conv = null;
        if (conversationId) {
            const [row] = await tx.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId)).limit(1);
            conv = row || null;
        }
        else {
            const [row] = await tx.select().from(conversationsTable).where(eq(conversationsTable.contactPhone, to)).limit(1);
            conv = row || null;
        }
        if (!conv) {
            let [contact] = await tx.select().from(contactsTable).where(eq(contactsTable.phone, normalizePhone(to) || to)).limit(1);
            if (!contact) {
                // Tenant-scope the new contact to the channel owner so it shows up in
                // tenant-aware queries like getContactsByTenant. createdBy is set to
                // the same id so audit/ownership matches the tenant.
                const ownerId = channel?.createdBy || undefined;
                contact = await createWhatsAppContact({
                    name: to,
                    phone: to,
                    channelId: channelId,
                    tenantId: ownerId,
                    createdBy: ownerId,
                }, { executor: tx });
            }
            [conv] = await tx.insert(conversationsTable).values({
                contactId: contact.id,
                contactPhone: to,
                contactName: contact.name || to,
                channelId: channelId,
                unreadCount: 0,
            }).returning();
        }
        const [msg] = await tx.insert(messagesTable).values({
            conversationId: conv.id,
            content: sentText,
            status: "sent",
            whatsappMessageId: result.messages?.[0]?.id,
        }).returning();
        await tx.update(conversationsTable)
            .set({ lastMessageAt: new Date(), lastMessageText: sentText })
            .where(eq(conversationsTable.id, conv.id));
        return { conversation: conv, createdMessage: msg };
    });
    if (global.broadcastToConversation) {
        global.broadcastToConversation(conversation.id, {
            type: "new-message",
            message: createdMessage,
        });
    }
    return {
        success: true,
        messageId: result.messages?.[0]?.id,
        conversationId: conversation.id,
    };
}
