import { db } from "../../config/database";
import { websiteWidgets, widgetCallSessions, users, userSubscriptions, plans } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
export class WidgetStorage {
    async createWidget(data) {
        const [widget] = await db.insert(websiteWidgets).values(data).returning();
        return widget;
    }
    async getWidgetById(id) {
        const [widget] = await db.select().from(websiteWidgets).where(eq(websiteWidgets.id, id)).limit(1);
        return widget || null;
    }
    async getWidgetByEmbedToken(embedToken) {
        const [widget] = await db.select().from(websiteWidgets).where(eq(websiteWidgets.embedToken, embedToken)).limit(1);
        return widget || null;
    }
    async getWidgetsByUserId(userId) {
        return db.select().from(websiteWidgets)
            .where(eq(websiteWidgets.userId, userId))
            .orderBy(desc(websiteWidgets.createdAt));
    }
    async updateWidget(id, userId, data) {
        const [widget] = await db.update(websiteWidgets)
            .set({ ...data, updatedAt: new Date() })
            .where(and(eq(websiteWidgets.id, id), eq(websiteWidgets.userId, userId)))
            .returning();
        return widget || null;
    }
    async deleteWidget(id, userId) {
        const result = await db.delete(websiteWidgets)
            .where(and(eq(websiteWidgets.id, id), eq(websiteWidgets.userId, userId)));
        return (result.rowCount ?? 0) > 0;
    }
    async incrementWidgetStats(widgetId, durationMinutes) {
        await db.update(websiteWidgets)
            .set({
            totalCalls: sql `${websiteWidgets.totalCalls} + 1`,
            totalMinutes: sql `${websiteWidgets.totalMinutes} + ${durationMinutes}`,
            updatedAt: new Date(),
        })
            .where(eq(websiteWidgets.id, widgetId));
    }
    async createSession(data) {
        const [session] = await db.insert(widgetCallSessions).values(data).returning();
        return session;
    }
    async getSessionById(id) {
        const [session] = await db.select().from(widgetCallSessions).where(eq(widgetCallSessions.id, id)).limit(1);
        return session || null;
    }
    async getSessionByToken(sessionToken) {
        const [session] = await db.select().from(widgetCallSessions)
            .where(eq(widgetCallSessions.sessionToken, sessionToken))
            .limit(1);
        return session || null;
    }
    async updateSession(id, data) {
        const [session] = await db.update(widgetCallSessions)
            .set(data)
            .where(eq(widgetCallSessions.id, id))
            .returning();
        return session || null;
    }
    async getActiveSessionsForWidget(widgetId) {
        return db.select().from(widgetCallSessions)
            .where(and(eq(widgetCallSessions.widgetId, widgetId), sql `${widgetCallSessions.status} IN ('active', 'pending', 'connecting')`));
    }
    async getActiveSessionCount(widgetId) {
        const sessions = await this.getActiveSessionsForWidget(widgetId);
        return sessions.length;
    }
    async getSessionsByWidgetId(widgetId, limit = 50) {
        return db.select().from(widgetCallSessions)
            .where(eq(widgetCallSessions.widgetId, widgetId))
            .orderBy(desc(widgetCallSessions.createdAt))
            .limit(limit);
    }
    async getUserCredits(userId) {
        const [user] = await db.select({ credits: users.credits })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        return user?.credits ?? 0;
    }
    async getUserWithPlan(userId) {
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user)
            return null;
        const [subscription] = await db.select()
            .from(userSubscriptions)
            .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active')))
            .limit(1);
        let plan = null;
        if (subscription) {
            const [p] = await db.select().from(plans).where(eq(plans.id, subscription.planId)).limit(1);
            plan = p || null;
        }
        if (!plan) {
            const [freePlan] = await db.select().from(plans).where(eq(plans.name, user.planType || 'free')).limit(1);
            plan = freePlan || null;
        }
        return { user, plan, subscription };
    }
    async getWidgetCount(userId) {
        const widgets = await this.getWidgetsByUserId(userId);
        return widgets.length;
    }
    async getWidgetStats(userId) {
        const widgets = await this.getWidgetsByUserId(userId);
        const totalWidgets = widgets.length;
        const totalCalls = widgets.reduce((sum, w) => sum + w.totalCalls, 0);
        const totalMinutes = widgets.reduce((sum, w) => sum + w.totalMinutes, 0);
        const widgetStats = widgets.map(w => ({
            id: w.id,
            name: w.name,
            calls: w.totalCalls,
            minutes: w.totalMinutes,
            status: w.status
        }));
        return { totalWidgets, totalCalls, totalMinutes, widgetStats };
    }
    async getLastSessionByIp(widgetId, visitorIp) {
        const [session] = await db.select().from(widgetCallSessions)
            .where(and(eq(widgetCallSessions.widgetId, widgetId), eq(widgetCallSessions.visitorIp, visitorIp)))
            .orderBy(desc(widgetCallSessions.createdAt))
            .limit(1);
        return session || null;
    }
}
export const widgetStorage = new WidgetStorage();
