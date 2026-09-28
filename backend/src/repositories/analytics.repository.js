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
import { gte, sql } from "drizzle-orm";
import { analytics, messages, conversations } from "@shared/whatsapp-schema";
export class AnalyticsRepository {
    async getAnalyticsByChannel(channelId, days) {
        const startDate = days
            ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await db
            .select({
            date: sql `DATE(${messages.createdAt})`,
            sent: sql `COUNT(CASE WHEN ${messages.status} = 'sent' THEN 1 END)`,
            delivered: sql `COUNT(CASE WHEN ${messages.status} = 'delivered' THEN 1 END)`,
            read: sql `COUNT(CASE WHEN ${messages.status} = 'read' THEN 1 END)`,
            replied: sql `COUNT(CASE WHEN ${messages.status} = 'replied' THEN 1 END)`,
            failed: sql `COUNT(CASE WHEN ${messages.status} = 'failed' THEN 1 END)`,
        })
            .from(messages)
            .leftJoin(conversations, sql `${messages.conversationId} = ${conversations.id}`)
            .where(sql `${conversations.channelId} = ${channelId} AND ${messages.createdAt} >= ${startDate}`)
            .groupBy(sql `DATE(${messages.createdAt})`)
            .orderBy(sql `DATE(${messages.createdAt})`);
        // Convert to Analytics format
        return result.map(row => ({
            id: `analytics-${channelId}-${row.date.toISOString()}`,
            channelId: channelId ?? null,
            date: row.date,
            messagesSent: row.sent ?? null,
            messagesDelivered: row.delivered ?? null,
            messagesRead: row.read ?? null,
            messagesReplied: row.replied ?? null,
            createdAt: new Date(),
            newContacts: null,
            activeCampaigns: null,
        }));
    }
    async getAnalytics(days) {
        const startDate = days
            ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await db
            .select({
            date: sql `DATE(${messages.createdAt})`,
            sent: sql `COUNT(CASE WHEN ${messages.status} = 'sent' THEN 1 END)`,
            delivered: sql `COUNT(CASE WHEN ${messages.status} = 'delivered' THEN 1 END)`,
            read: sql `COUNT(CASE WHEN ${messages.status} = 'read' THEN 1 END)`,
            replied: sql `COUNT(CASE WHEN ${messages.status} = 'replied' THEN 1 END)`,
            failed: sql `COUNT(CASE WHEN ${messages.status} = 'failed' THEN 1 END)`,
        })
            .from(messages)
            .where(gte(messages.createdAt, startDate))
            .groupBy(sql `DATE(${messages.createdAt})`)
            .orderBy(sql `DATE(${messages.createdAt})`);
        // Convert to Analytics format
        return result.map(row => ({
            id: `analytics-${row.date.toISOString()}`,
            channelId: null, // must be string | null
            date: row.date,
            messagesTotal: Number(row.sent) + Number(row.delivered) + Number(row.read) + Number(row.replied) + Number(row.failed),
            messagesSent: Number(row.sent) ?? null,
            messagesDelivered: Number(row.delivered) ?? null,
            messagesRead: Number(row.read) ?? null,
            messagesReplied: Number(row.replied) ?? null,
            messagesFailed: Number(row.failed) ?? null,
            createdAt: new Date() ?? null,
            newContacts: null,
            activeCampaigns: null,
            // remove updatedAt since it's not in the type
        }));
    }
    async createOrUpdate(insertAnalytics) {
        const [result] = await db
            .insert(analytics)
            .values(insertAnalytics)
            .onConflictDoUpdate({
            target: [analytics.channelId, analytics.date],
            set: {
                messagesSent: insertAnalytics.messagesSent,
                messagesDelivered: insertAnalytics.messagesDelivered,
                messagesRead: insertAnalytics.messagesRead,
                messagesReplied: insertAnalytics.messagesReplied,
            },
        })
            .returning();
        return result;
    }
    async deleteOldAnalytics(daysToKeep) {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        await db.delete(analytics).where(gte(analytics.date, cutoffDate));
    }
}
