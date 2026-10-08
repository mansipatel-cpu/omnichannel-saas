import { and, eq, isNull, lte } from "drizzle-orm";
import { campaigns, users } from "@shared/schema";
import { channels } from "@shared/whatsapp-schema";
import { db } from "../config/database";
import { ownerIdForUser } from "../services/contact-identity.service";
import { CampaignRepository as UnifiedCampaignRepository } from "../modules/campaigns/campaign.repository";
import { toWhatsAppCampaign } from "../modules/campaigns/campaign.mapper";

const unified = new UnifiedCampaignRepository(db);

async function ownerForUserId(userId) {
    const [user] = await db.select({
        id: users.id,
        role: users.role,
        createdBy: users.createdBy,
    }).from(users).where(eq(users.id, userId)).limit(1);
    return ownerIdForUser(user);
}

async function ownerForChannel(channelId) {
    const [channel] = await db.select({ createdBy: channels.createdBy })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);
    return ownerForUserId(channel?.createdBy);
}

function creationValues(input, ownerId) {
    return {
        userId: ownerId,
        name: input.name,
        description: input.description || null,
        channelType: "whatsapp",
        campaignType: input.campaignType,
        status: input.status === "active" || input.status === "sending" ? "running" : input.status,
        templateId: input.templateId || null,
        scheduledAt: input.scheduledAt || null,
        retryEnabled: input.autoRetry || false,
        channelConfig: {
            channelId: input.channelId,
            language: input.templateLanguage || "en_US",
            templateVariables: input.variableMapping || {},
            templateName: input.templateName,
            type: input.type,
            apiType: input.apiType,
            contactIds: input.contactGroups || [],
            csvData: input.csvData || [],
            audienceType: input.audienceType,
            platform: input.platform,
            apiKey: input.apiKey,
            apiEndpoint: input.apiEndpoint,
            compatibilityStatus: input.status,
        },
        statistics: {
            recipientCount: input.recipientCount || 0,
            sentCount: input.sentCount || 0,
            deliveredCount: input.deliveredCount || 0,
            readCount: input.readCount || 0,
            repliedCount: input.repliedCount || 0,
            failedCount: input.failedCount || 0,
        },
        createdBy: input.createdBy,
    };
}

export class CampaignRepository {
    async getAll() {
        throw new Error("Tenant owner is required; use getCampaignByUserId");
    }

    async getByChannel(channelId, page = 1, limit = 10) {
        const ownerId = await ownerForChannel(channelId);
        if (!ownerId)
            return { data: [], total: 0, page, limit };
        const result = await unified.list(ownerId, {
            channel_type: "whatsapp",
            channel_id: channelId,
            deleted: "exclude",
            page,
            page_size: Math.min(limit, 200),
            sort: "-created_at",
        });
        return {
            data: result.data.map(toWhatsAppCampaign),
            total: result.pagination.totalItems,
            page,
            limit,
        };
    }

    async getById(id, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for campaign lookup");
        const campaign = await unified.findById(ownerId, id);
        return campaign?.channelType === "whatsapp" ? toWhatsAppCampaign(campaign) : undefined;
    }

    async getByIdIncludingDeleted(id, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for campaign lookup");
        const campaign = await unified.findById(ownerId, id, { includeDeleted: true });
        return campaign?.channelType === "whatsapp" ? toWhatsAppCampaign(campaign) : undefined;
    }

    async getDeletedByChannel(channelId, page = 1, limit = 100) {
        const ownerId = await ownerForChannel(channelId);
        if (!ownerId)
            return { data: [], total: 0, page, limit };
        const result = await unified.list(ownerId, {
            channel_type: "whatsapp",
            channel_id: channelId,
            deleted: "only",
            page,
            page_size: Math.min(limit, 200),
            sort: "-updated_at",
        });
        return {
            data: result.data.map(toWhatsAppCampaign),
            total: result.pagination.totalItems,
            page,
            limit,
        };
    }

    async getDeletedByChannelIds(channelIds, page = 1, limit = 100) {
        const results = await Promise.all(channelIds.map((id) => this.getDeletedByChannel(id, 1, limit)));
        const data = results.flatMap((result) => result.data)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice((page - 1) * limit, page * limit);
        return { data, total: results.reduce((sum, result) => sum + result.total, 0), page, limit };
    }

    async getDeletedByUserId(userId, page = 1, limit = 100) {
        const ownerId = await ownerForUserId(userId);
        if (!ownerId)
            return { data: [], total: 0, page, limit };
        const result = await unified.list(ownerId, {
            channel_type: "whatsapp",
            deleted: "only",
            page,
            page_size: Math.min(limit, 200),
            sort: "-updated_at",
        });
        return {
            data: result.data.map(toWhatsAppCampaign),
            total: result.pagination.totalItems,
            page,
            limit,
        };
    }

    async getDeleted(page, limit, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for deleted campaigns");
        return this.getDeletedByUserId(ownerId, page, limit);
    }

    async getCampaignByUserId(userId, page = 1, limit = 10) {
        const ownerId = await ownerForUserId(userId);
        if (!ownerId)
            return { data: [], total: 0, page, limit };
        const result = await unified.list(ownerId, {
            channel_type: "whatsapp",
            deleted: "exclude",
            page,
            page_size: Math.min(limit, 200),
            sort: "-created_at",
        });
        return {
            data: result.data.map(toWhatsAppCampaign),
            total: result.pagination.totalItems,
            page,
            limit,
        };
    }

    async create(input) {
        const ownerId = await ownerForUserId(input.createdBy);
        if (!ownerId)
            throw new Error("Campaign owner not found");
        return toWhatsAppCampaign(await unified.create(creationValues(input, ownerId)));
    }

    async getScheduledCampaigns(now) {
        return db.select().from(campaigns).where(and(
            eq(campaigns.channelType, "whatsapp"),
            eq(campaigns.status, "scheduled"),
            lte(campaigns.scheduledAt, now),
            isNull(campaigns.deletedAt),
        ));
    }

    async update(id, input, ownerId) {
        if (!ownerId)
            ownerId = await ownerForUserId(input.createdBy);
        if (!ownerId)
            throw new Error("ownerId is required for campaign update");
        const current = await unified.findById(ownerId, id, { includeDeleted: true });
        if (!current)
            return undefined;
        const merged = creationValues({ ...toWhatsAppCampaign(current), ...input }, ownerId);
        delete merged.userId;
        delete merged.createdBy;
        return toWhatsAppCampaign(await unified.update(ownerId, id, merged, { includeDeleted: true }));
    }

    async incrementSentCount(id, ownerId) {
        const campaign = await unified.findById(ownerId, id);
        return unified.update(ownerId, id, {
            statistics: {
                ...(campaign.statistics || {}),
                sentCount: (campaign.statistics?.sentCount || 0) + 1,
            },
        });
    }

    async incrementFailedCount(id, ownerId) {
        const campaign = await unified.findById(ownerId, id);
        return unified.update(ownerId, id, {
            statistics: {
                ...(campaign.statistics || {}),
                failedCount: (campaign.statistics?.failedCount || 0) + 1,
            },
        });
    }

    async delete(id, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for campaign deletion");
        return Boolean(await unified.softDelete(ownerId, id));
    }

    async restore(id, ownerId) {
        if (!ownerId)
            throw new Error("ownerId is required for campaign restoration");
        const campaign = await unified.restore(ownerId, id, "draft");
        return campaign ? toWhatsAppCampaign(campaign) : undefined;
    }

    async getAllCampaignCount(ownerId) {
        const result = await unified.list(ownerId, {
            channel_type: "whatsapp",
            deleted: "exclude",
            page: 1,
            page_size: 1,
            sort: "-created_at",
        });
        return result.pagination.totalItems;
    }
}
