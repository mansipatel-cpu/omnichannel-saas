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
import { eq, desc, sql, ne, and, inArray } from "drizzle-orm";
import { campaigns, users, templates } from "@shared/whatsapp-schema";
/** Infer a safe status when restoring a soft-deleted campaign (previous status was overwritten). */
function inferRestoreStatus(campaign) {
    const recipientCount = Number(campaign.recipientCount) || 0;
    const sentCount = Number(campaign.sentCount) || 0;
    if (campaign.completedAt || (recipientCount > 0 && sentCount >= recipientCount)) {
        return "completed";
    }
    // Never auto-resume sending after restore
    if (sentCount > 0) {
        return "paused";
    }
    if (campaign.scheduledAt && new Date(campaign.scheduledAt) > new Date()) {
        return "scheduled";
    }
    return "draft";
}
export class CampaignRepository {
    async getAllold(page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        // Fetch paginated campaign list
        const campaignsList = await db
            .select()
            .from(campaigns)
            .orderBy(desc(campaigns.createdAt))
            .limit(limit)
            .offset(offset);
        // Fetch total count
        const totalResult = await db
            .select({ total: sql `COUNT(*)` })
            .from(campaigns);
        return {
            data: campaignsList,
            total: totalResult[0]?.total ?? 0,
            page,
            limit,
        };
    }
    async getAll(page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        // const campaignsList = await db
        //   .select({
        //     id: campaigns.id,
        //     name: campaigns.name,
        //     createdBy: campaigns.createdBy,
        //     createdByName: sql<string>`
        //       CONCAT(
        //         COALESCE(${users.firstName}, ''), ' ', COALESCE(${users.lastName}, '')
        //       )
        //     `.as("createdByName"),
        //     status: campaigns.status,
        //     createdAt: campaigns.createdAt,
        //     updatedAt: campaigns.updatedAt,
        //   })
        //   .from(campaigns)
        //   // 👇 Cast campaigns.createdBy uuid → text for join
        //   .leftJoin(users, eq(users.id, sql`${campaigns.createdBy}::text`))
        //   .orderBy(desc(campaigns.createdAt))
        //   .limit(limit)
        //   .offset(offset);
        const campaignsList = await db
            .select({
            id: campaigns.id,
            name: campaigns.name,
            createdBy: campaigns.createdBy,
            createdByName: sql `
      CONCAT(
        COALESCE(${users.firstName}, ''),
        ' ',
        COALESCE(${users.lastName}, '')
      )
    `.as("createdByName"),
            status: campaigns.status,
            // TEMPLATE
            templateId: campaigns.templateId,
            templateName: templates.name,
            // COUNTS
            recipientCount: campaigns.recipientCount,
            sentCount: campaigns.sentCount,
            deliveredCount: campaigns.deliveredCount,
            readCount: campaigns.readCount,
            failedCount: campaigns.failedCount,
            repliedCount: campaigns.repliedCount,
            createdAt: campaigns.createdAt,
            updatedAt: campaigns.updatedAt,
        })
            .from(campaigns)
            .leftJoin(users, eq(users.id, sql `${campaigns.createdBy}::text`))
            // ✅ TEMPLATE JOIN
            .leftJoin(templates, eq(templates.id, campaigns.templateId))
            .where(ne(campaigns.status, 'deleted'))
            .orderBy(desc(campaigns.createdAt))
            .limit(limit)
            .offset(offset);
        const totalResult = await db
            .select({ total: sql `COUNT(*)` })
            .from(campaigns)
            .where(ne(campaigns.status, 'deleted'));
        return {
            data: campaignsList,
            total: totalResult[0]?.total ?? 0,
            page,
            limit,
        };
    }
    // async getByChannel(channelId: string): Promise<Campaign[]> {
    //   return await db
    //     .select()
    //     .from(campaigns)
    //     .where(eq(campaigns.channelId, channelId))
    //     .orderBy(desc(campaigns.createdAt));
    // }
    async getByChannel(channelId, page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        // Fetch paginated campaigns
        const data = await db
            .select()
            .from(campaigns)
            .where(and(eq(campaigns.channelId, channelId), ne(campaigns.status, 'deleted')))
            .orderBy(desc(campaigns.createdAt))
            .limit(limit)
            .offset(offset);
        // Fetch total count
        const [{ count }] = await db
            .select({ count: sql `COUNT(*)` })
            .from(campaigns)
            .where(and(eq(campaigns.channelId, channelId), ne(campaigns.status, 'deleted')));
        return {
            data,
            total: Number(count),
            page,
            limit,
        };
    }
    async getById(id) {
        const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), ne(campaigns.status, 'deleted')));
        return campaign || undefined;
    }
    async getByIdIncludingDeleted(id) {
        const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
        return campaign || undefined;
    }
    deletedSelectFields() {
        return {
            id: campaigns.id,
            name: campaigns.name,
            createdBy: campaigns.createdBy,
            createdByName: sql `
        CONCAT(
          COALESCE(${users.firstName}, ''),
          ' ',
          COALESCE(${users.lastName}, '')
        )
      `.as("createdByName"),
            status: campaigns.status,
            templateId: campaigns.templateId,
            templateName: templates.name,
            audienceType: campaigns.audienceType,
            platform: campaigns.platform,
            type: campaigns.type,
            campaignType: campaigns.campaignType,
            recipientCount: campaigns.recipientCount,
            sentCount: campaigns.sentCount,
            deliveredCount: campaigns.deliveredCount,
            readCount: campaigns.readCount,
            failedCount: campaigns.failedCount,
            repliedCount: campaigns.repliedCount,
            channelId: campaigns.channelId,
            createdAt: campaigns.createdAt,
            updatedAt: campaigns.updatedAt,
            // Soft-delete timestamp (status flip); exposed as deletedAt for UI parity with voice campaigns
            deletedAt: sql `${campaigns.updatedAt}`.as("deletedAt"),
        };
    }
    async getDeleted(page = 1, limit = 100) {
        const offset = (page - 1) * limit;
        const where = eq(campaigns.status, "deleted");
        const data = await db
            .select(this.deletedSelectFields())
            .from(campaigns)
            .leftJoin(users, eq(users.id, sql `${campaigns.createdBy}::text`))
            .leftJoin(templates, eq(templates.id, campaigns.templateId))
            .where(where)
            .orderBy(desc(campaigns.updatedAt))
            .limit(limit)
            .offset(offset);
        const totalResult = await db
            .select({ total: sql `COUNT(*)` })
            .from(campaigns)
            .where(where);
        return {
            data,
            total: totalResult[0]?.total ?? 0,
            page,
            limit,
        };
    }
    async getDeletedByChannel(channelId, page = 1, limit = 100) {
        const offset = (page - 1) * limit;
        const where = and(eq(campaigns.channelId, channelId), eq(campaigns.status, "deleted"));
        const data = await db
            .select(this.deletedSelectFields())
            .from(campaigns)
            .leftJoin(users, eq(users.id, sql `${campaigns.createdBy}::text`))
            .leftJoin(templates, eq(templates.id, campaigns.templateId))
            .where(where)
            .orderBy(desc(campaigns.updatedAt))
            .limit(limit)
            .offset(offset);
        const totalResult = await db
            .select({ total: sql `COUNT(*)` })
            .from(campaigns)
            .where(where);
        return {
            data,
            total: totalResult[0]?.total ?? 0,
            page,
            limit,
        };
    }
    async getDeletedByChannelIds(channelIds, page = 1, limit = 100) {
        if (channelIds.length === 0) {
            return { data: [], total: 0, page, limit };
        }
        const offset = (page - 1) * limit;
        const where = and(inArray(campaigns.channelId, channelIds), eq(campaigns.status, "deleted"));
        const data = await db
            .select(this.deletedSelectFields())
            .from(campaigns)
            .leftJoin(users, eq(users.id, sql `${campaigns.createdBy}::text`))
            .leftJoin(templates, eq(templates.id, campaigns.templateId))
            .where(where)
            .orderBy(desc(campaigns.updatedAt))
            .limit(limit)
            .offset(offset);
        const totalResult = await db
            .select({ total: sql `COUNT(*)` })
            .from(campaigns)
            .where(where);
        return {
            data,
            total: totalResult[0]?.total ?? 0,
            page,
            limit,
        };
    }
    async getDeletedByUserId(userId, page = 1, limit = 100) {
        const offset = (page - 1) * limit;
        const where = and(eq(campaigns.createdBy, userId), eq(campaigns.status, "deleted"));
        const data = await db
            .select(this.deletedSelectFields())
            .from(campaigns)
            .leftJoin(users, eq(users.id, sql `${campaigns.createdBy}::text`))
            .leftJoin(templates, eq(templates.id, campaigns.templateId))
            .where(where)
            .orderBy(desc(campaigns.updatedAt))
            .limit(limit)
            .offset(offset);
        const totalResult = await db
            .select({ total: sql `COUNT(*)` })
            .from(campaigns)
            .where(where);
        return {
            data,
            total: totalResult[0]?.total ?? 0,
            page,
            limit,
        };
    }
    // async getCampaignByUserId(userId: string): Promise<Campaign | undefined>{
    //   const [campaign] = await db.select().from(campaigns).where(eq(campaigns.createdBy, userId));
    //   return campaign || []
    // }
    async getCampaignByUserId(userId, page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        // const campaignsList = await db
        //   .select()
        //   .from(campaigns)
        //   .where(eq(campaigns.createdBy, userId))
        //   .orderBy(desc(campaigns.createdAt))
        //   .limit(Number(limit))
        //   .offset(Number(offset));
        const campaignsList = await db
            .select({
            id: campaigns.id,
            name: campaigns.name,
            createdBy: campaigns.createdBy,
            createdByName: sql `
      CONCAT(
        COALESCE(${users.firstName}, ''),
        ' ',
        COALESCE(${users.lastName}, '')
      )
    `.as("createdByName"),
            status: campaigns.status,
            // TEMPLATE
            templateId: campaigns.templateId,
            templateName: templates.name,
            audienceType: campaigns.audienceType,
            platform: campaigns.platform,
            // COUNTS
            recipientCount: campaigns.recipientCount,
            sentCount: campaigns.sentCount,
            deliveredCount: campaigns.deliveredCount,
            readCount: campaigns.readCount,
            failedCount: campaigns.failedCount,
            repliedCount: campaigns.repliedCount,
            createdAt: campaigns.createdAt,
            updatedAt: campaigns.updatedAt,
        })
            .from(campaigns)
            .leftJoin(users, eq(users.id, sql `${campaigns.createdBy}::text`))
            .leftJoin(templates, eq(templates.id, campaigns.templateId))
            // ✅ IMPORTANT
            .where(and(eq(campaigns.createdBy, userId), ne(campaigns.status, 'deleted')))
            .orderBy(desc(campaigns.createdAt))
            .limit(limit)
            .offset(offset);
        const totalResult = await db
            .select({ total: sql `COUNT(*)` })
            .from(campaigns)
            .where(and(eq(campaigns.createdBy, userId), ne(campaigns.status, 'deleted')));
        return {
            data: campaignsList,
            total: totalResult[0]?.total ?? 0,
            page,
            limit
        };
    }
    async create(insertCampaign) {
        const [campaign] = await db
            .insert(campaigns)
            .values({
            ...insertCampaign,
            contactGroups: (insertCampaign.contactGroups || []),
        })
            .returning();
        return campaign;
    }
    async getScheduledCampaigns(now) {
        return db
            .select()
            .from(campaigns)
            .where(sql `
          ${campaigns.status} = 'scheduled'
          AND ${campaigns.scheduledAt} IS NOT NULL
          AND ${campaigns.scheduledAt} <= ${now}
        `)
            .orderBy(campaigns.scheduledAt);
    }
    async update(id, campaign) {
        const [updated] = await db
            .update(campaigns)
            .set(campaign)
            .where(eq(campaigns.id, id))
            .returning();
        return updated || undefined;
    }
    async incrementSentCount(id) {
        await db
            .update(campaigns)
            .set({ sentCount: sql `COALESCE(${campaigns.sentCount}, 0) + 1` })
            .where(eq(campaigns.id, id));
    }
    async incrementFailedCount(id) {
        await db
            .update(campaigns)
            .set({ failedCount: sql `COALESCE(${campaigns.failedCount}, 0) + 1` })
            .where(eq(campaigns.id, id));
    }
    async delete(id) {
        const result = await db
            .update(campaigns)
            .set({ status: "deleted", updatedAt: new Date() })
            .where(and(eq(campaigns.id, id), ne(campaigns.status, "deleted")))
            .returning();
        return result.length > 0;
    }
    async restore(id) {
        const existing = await this.getByIdIncludingDeleted(id);
        if (!existing || existing.status !== "deleted") {
            return undefined;
        }
        const status = inferRestoreStatus(existing);
        const [updated] = await db
            .update(campaigns)
            .set({ status, updatedAt: new Date() })
            .where(and(eq(campaigns.id, id), eq(campaigns.status, "deleted")))
            .returning();
        return updated || undefined;
    }
    async getAllCampaignCount() {
        const campaignsList = await db.select().from(campaigns).where(ne(campaigns.status, 'deleted'));
        return campaignsList.length;
    }
}
