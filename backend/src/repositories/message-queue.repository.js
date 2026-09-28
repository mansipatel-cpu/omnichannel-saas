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
import { whatsappDb as db } from "../config/database";
import { eq, desc, sql } from "drizzle-orm";
import { messageQueue, messages, conversations } from "@shared/whatsapp-schema";
// Helper functions to replace date-fns
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function startOfMonth(date) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}
function subMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() - months);
    return d;
}
export class MessageQueueRepository {
    async getByChannel(channelId) {
        return await db
            .select()
            .from(messageQueue)
            .where(eq(messageQueue.channelId, channelId))
            .orderBy(desc(messageQueue.createdAt));
    }
    async getPending() {
        return await db
            .select()
            .from(messageQueue)
            .where(eq(messageQueue.status, 'pending'))
            .orderBy(messageQueue.createdAt);
    }
    // async getMessagesToCheck(): Promise<MessageQueue[]> {
    //   const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    //   return await db
    //     .select()
    //     .from(messages)
    //     .where(
    //       and(
    //         eq(messages.type, 'outgoing'),
    //         eq(messages.status, 'sent'),
    //         lt(messages.createdAt, tenMinutesAgo)
    //       )
    //     )
    //     .orderBy(messages.createdAt);
    // }
    async create(insertMessage) {
        const [message] = await db
            .insert(messageQueue)
            .values(insertMessage)
            .returning();
        return message;
    }
    async createBulk(insertMessages) {
        if (insertMessages.length === 0)
            return [];
        return await db
            .insert(messageQueue)
            .values(insertMessages)
            .returning();
    }
    async update(id, message) {
        const [updated] = await db
            .update(messageQueue)
            .set(message)
            .where(eq(messageQueue.id, id))
            .returning();
        return updated || undefined;
    }
    async updateByWhatsAppId(whatsappMessageId, updates) {
        const result = await db
            .update(messageQueue)
            .set(updates)
            .where(eq(messageQueue.whatsappMessageId, whatsappMessageId))
            .returning();
        return result.length > 0;
    }
    async getByCampaign(campaignId) {
        return await db
            .select()
            .from(messageQueue)
            .where(eq(messageQueue.campaignId, campaignId))
            .orderBy(desc(messageQueue.createdAt));
    }
    async getMessageStats() {
        const now = new Date();
        const thisMonthStart = startOfMonth(now);
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = thisMonthStart;
        const todayStart = startOfDay(now);
        // GLOBAL STATS (no channel filter)
        const result = await db
            .select({
            messagesSent: sql `COUNT(CASE WHEN ${messages.status} = 'sent' THEN 1 END)`.mapWith(Number),
            messagesDelivered: sql `COUNT(CASE WHEN ${messages.status} = 'delivered' THEN 1 END)`.mapWith(Number),
            messagesFailed: sql `COUNT(CASE WHEN ${messages.status} = 'failed' THEN 1 END)`.mapWith(Number),
            messagesRead: sql `COUNT(CASE WHEN ${messages.status} = 'read' THEN 1 END)`.mapWith(Number),
            totalMessages: sql `COUNT(*)`.mapWith(Number),
            todayMessages: sql `
        COUNT(CASE WHEN ${messages.createdAt} >= ${todayStart} THEN 1 END)
      `.mapWith(Number),
            thisMonthMessages: sql `
        COUNT(CASE WHEN ${messages.createdAt} >= ${thisMonthStart} THEN 1 END)
      `.mapWith(Number),
            lastMonthMessages: sql `
        COUNT(
          CASE WHEN ${messages.createdAt} >= ${lastMonthStart}
          AND ${messages.createdAt} < ${lastMonthEnd}
          THEN 1 END
        )
      `.mapWith(Number),
        })
            .from(messages); // <-- NO JOIN / NO FILTER
        return (result[0] || {
            messagesSent: 0,
            messagesDelivered: 0,
            messagesFailed: 0,
            messagesRead: 0,
            totalMessages: 0,
            todayMessages: 0,
            thisMonthMessages: 0,
            lastMonthMessages: 0,
        });
    }
    async getMessageStatsOld() {
        const now = new Date();
        const thisMonthStart = startOfMonth(now);
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = thisMonthStart;
        const todayStart = startOfDay(now);
        const result = await db
            .select({
            // Status-wise counts
            messagesSent: sql `COUNT(CASE WHEN ${messageQueue.status} = 'sent' THEN 1 END)`.mapWith(Number),
            messagesDelivered: sql `COUNT(CASE WHEN ${messageQueue.status} = 'delivered' THEN 1 END)`.mapWith(Number),
            messagesFailed: sql `COUNT(CASE WHEN ${messageQueue.status} = 'failed' THEN 1 END)`.mapWith(Number),
            messagesRead: sql `COUNT(CASE WHEN ${messageQueue.status} = 'read' THEN 1 END)`.mapWith(Number),
            // Total (all messages)
            totalMessages: sql `COUNT(*)`.mapWith(Number),
            todayMessages: sql `
        COUNT(CASE WHEN ${messageQueue.createdAt} >= ${todayStart} THEN 1 END)
      `.mapWith(Number),
            // This month (all statuses)
            thisMonthMessages: sql `
          COUNT(CASE WHEN ${messageQueue.createdAt} >= ${thisMonthStart} THEN 1 END)
        `.mapWith(Number),
            // Last month (all statuses)
            lastMonthMessages: sql `
          COUNT(CASE WHEN ${messageQueue.createdAt} >= ${lastMonthStart}
                     AND ${messageQueue.createdAt} < ${lastMonthEnd}
          THEN 1 END)
        `.mapWith(Number),
        })
            .from(messageQueue);
        return (result[0] || {
            messagesSent: 0,
            messagesDelivered: 0,
            messagesFailed: 0,
            messagesRead: 0,
            totalMessages: 0,
            todayMessages: 0,
            thisMonthMessages: 0,
            lastMonthMessages: 0,
        });
    }
    async getMessageStatsByChannel(channelId) {
        const now = new Date();
        const thisMonthStart = startOfMonth(now);
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = thisMonthStart;
        const todayStart = startOfDay(now);
        const result = await db
            .select({
            messagesSent: sql `COUNT(CASE WHEN ${messages.status} IN ('sent', 'delivered', 'read') THEN 1 END)`.mapWith(Number),
            messagesDelivered: sql `COUNT(CASE WHEN ${messages.status} IN ('delivered', 'read') THEN 1 END)`.mapWith(Number),
            messagesFailed: sql `COUNT(CASE WHEN ${messages.status} = 'failed' THEN 1 END)`.mapWith(Number),
            messagesRead: sql `COUNT(CASE WHEN ${messages.status} = 'read' THEN 1 END)`.mapWith(Number),
            totalMessages: sql `COUNT(CASE WHEN ${messages.status} IN ('sent', 'delivered', 'read', 'failed') THEN 1 END)`.mapWith(Number),
            todayMessages: sql `COUNT(CASE WHEN ${messages.status} IN ('sent', 'delivered', 'read', 'failed') AND ${messages.createdAt} >= ${todayStart} THEN 1 END)`.mapWith(Number),
            thisMonthMessages: sql `COUNT(CASE WHEN ${messages.status} IN ('sent', 'delivered', 'read', 'failed') AND ${messages.createdAt} >= ${thisMonthStart} THEN 1 END)`.mapWith(Number),
            lastMonthMessages: sql `COUNT(CASE WHEN ${messages.status} IN ('sent', 'delivered', 'read', 'failed') AND ${messages.createdAt} >= ${lastMonthStart} AND ${messages.createdAt} < ${lastMonthEnd} THEN 1 END)`.mapWith(Number),
        })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .where(eq(conversations.channelId, channelId));
        return (result[0] || {
            messagesSent: 0,
            messagesDelivered: 0,
            messagesFailed: 0,
            totalMessages: 0,
            messagesRead: 0,
            thisMonthMessages: 0,
            todayMessages: 0,
            lastMonthMessages: 0,
        });
    }
}
