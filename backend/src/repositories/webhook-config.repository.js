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
import { eq, and } from "drizzle-orm";
import { webhookConfigs } from "@shared/whatsapp-schema";
export class WebhookConfigRepository {
    async getAll() {
        return await db.select().from(webhookConfigs);
    }
    async getById(id) {
        const [config] = await db
            .select()
            .from(webhookConfigs)
            .where(eq(webhookConfigs.id, id));
        return config || undefined;
    }
    async getByChannelAndType(channelId, type) {
        const [config] = await db
            .select()
            .from(webhookConfigs)
            .where(and(eq(webhookConfigs.channelId, channelId)));
        return config || undefined;
    }
    async create(insertConfig) {
        const [config] = await db
            .insert(webhookConfigs)
            .values(insertConfig)
            .returning();
        return config;
    }
    async update(id, config) {
        const [updated] = await db
            .update(webhookConfigs)
            .set(config)
            .where(eq(webhookConfigs.id, id))
            .returning();
        return updated || undefined;
    }
    async delete(id) {
        const result = await db.delete(webhookConfigs).where(eq(webhookConfigs.id, id)).returning();
        return result.length > 0;
    }
    async getAllByChannel(channelId) {
        return await db
            .select()
            .from(webhookConfigs)
            .where(eq(webhookConfigs.channelId, channelId));
    }
}
