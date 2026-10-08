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
import { db } from "../config/database";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { templates, users } from "@shared/schema";
import { channels } from "@shared/whatsapp-schema";
import { toWhatsAppTemplate } from "../modules/campaigns/campaign.mapper";
import { ownerIdForUser } from "../services/contact-identity.service";

async function ownerIdForUserId(userId) {
    if (!userId)
        return null;
    const [user] = await db.select({
        id: users.id,
        role: users.role,
        createdBy: users.createdBy,
    }).from(users).where(eq(users.id, userId)).limit(1);
    return ownerIdForUser(user);
}

function contentFromLegacy(input, previous = {}) {
    return {
        ...previous,
        channelId: input.channelId ?? previous.channelId,
        header: input.header ?? previous.header,
        body: input.body ?? previous.body ?? "",
        footer: input.footer ?? previous.footer,
        buttons: input.buttons ?? previous.buttons ?? [],
        variables: input.variables ?? previous.variables ?? [],
        rejectionReason: input.rejectionReason ?? previous.rejectionReason,
        mediaType: input.mediaType ?? previous.mediaType ?? "text",
        mediaUrl: input.mediaUrl ?? previous.mediaUrl,
        mediaHandle: input.mediaHandle ?? previous.mediaHandle,
        carouselCards: input.carouselCards ?? previous.carouselCards ?? [],
        usageCount: input.usage_count ?? previous.usageCount ?? 0,
        headerType: input.headerType ?? previous.headerType,
        bodyVariables: input.bodyVariables ?? previous.bodyVariables,
    };
}

function activeTemplateConditions(ownerId) {
    return and(
        eq(templates.userId, ownerId),
        eq(templates.channelType, "whatsapp"),
        isNull(templates.deletedAt),
    );
}

export class TemplateRepository {
    async getAll(page = 1, limit = 10, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for template queries");
        const where = activeTemplateConditions(ownerId);
        const [{ count }] = await db.select({ count: sql `count(*)::int` }).from(templates).where(where);
        const rows = await db.select().from(templates)
            .where(where)
            .orderBy(desc(templates.createdAt))
            .limit(limit)
            .offset((page - 1) * limit);
        return {
            success: true,
            data: rows.map(toWhatsAppTemplate),
            pagination: { total: count, totalPages: Math.ceil(count / limit), page, limit },
        };
    }

    async getTemplateByUserID(userId, page = 1, limit = 10) {
        const ownerId = await ownerIdForUserId(userId);
        const result = await this.getAll(page, limit, ownerId);
        return { data: result.data, total: result.pagination.total, page, limit };
    }

    async getByChannel(channelId, page = 1, limit = 10) {
        const [channel] = await db.select({ createdBy: channels.createdBy })
            .from(channels).where(eq(channels.id, channelId)).limit(1);
        if (!channel?.createdBy)
            return { data: [], total: 0 };
        const ownerId = await ownerIdForUserId(channel.createdBy);
        const where = and(
            activeTemplateConditions(ownerId),
            sql `${templates.content}->>'channelId' = ${channelId}`,
        );
        const [{ count }] = await db.select({ count: sql `count(*)::int` }).from(templates).where(where);
        const rows = await db.select().from(templates).where(where)
            .orderBy(desc(templates.createdAt))
            .limit(limit)
            .offset((page - 1) * limit);
        return { data: rows.map(toWhatsAppTemplate), total: count };
    }

    async getByChannelOld(channelId) {
        const result = await this.getByChannel(channelId, 1, 1000);
        return result.data;
    }

    async getById(id, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for template queries");
        const [template] = await db.select().from(templates).where(and(
            eq(templates.id, id),
            activeTemplateConditions(ownerId),
        )).limit(1);
        return template ? toWhatsAppTemplate(template) : undefined;
    }

    async getByName(name, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for template queries");
        const [template] = await db.select().from(templates).where(and(
            eq(templates.name, name),
            activeTemplateConditions(ownerId),
        )).limit(1);
        return template ? toWhatsAppTemplate(template) : undefined;
    }

    async getByNameAndChannel(name, channelId) {
        const result = await this.getByChannel(channelId, 1, 1000);
        return result.data.find((template) => template.name === name);
    }

    async create(insertTemplate) {
        const ownerId = await ownerIdForUserId(insertTemplate.createdBy);
        if (!ownerId)
            throw new Error("Template owner not found");
        const [template] = await db.insert(templates).values({
            userId: ownerId,
            channelType: "whatsapp",
            name: insertTemplate.name,
            category: insertTemplate.category,
            language: insertTemplate.language || "en_US",
            status: insertTemplate.status || "draft",
            providerTemplateId: insertTemplate.whatsappTemplateId || null,
            providerStatus: insertTemplate.status || "draft",
            content: contentFromLegacy(insertTemplate),
            createdBy: insertTemplate.createdBy || null,
        }).returning();
        return toWhatsAppTemplate(template);
    }

    async update(id, input, ownerId) {
        if (!ownerId)
            ownerId = await ownerIdForUserId(input.createdBy);
        const current = await this.getById(id, ownerId);
        if (!current)
            return undefined;
        const [updated] = await db.update(templates).set({
            name: input.name ?? current.name,
            category: input.category ?? current.category,
            language: input.language ?? current.language,
            status: input.status ?? current.status,
            providerStatus: input.status ?? current.providerStatus,
            providerTemplateId: input.whatsappTemplateId ?? current.providerTemplateId,
            content: contentFromLegacy(input, current.content),
            updatedAt: new Date(),
        }).where(and(eq(templates.id, id), eq(templates.userId, ownerId))).returning();
        return updated ? toWhatsAppTemplate(updated) : undefined;
    }

    async delete(id, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for template deletion");
        const result = await db.update(templates)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(templates.id, id), eq(templates.userId, ownerId)))
            .returning();
        return result.length > 0;
    }
}
