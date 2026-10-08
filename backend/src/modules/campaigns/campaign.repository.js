import {
    and,
    asc,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    isNotNull,
    isNull,
    lte,
    or,
    sql,
} from "drizzle-orm";
import { db } from "../../config/database";
import {
    campaigns,
    campaignRecipients,
    sharedContacts,
    templates,
} from "@shared/schema";

const sortColumns = {
    created_at: campaigns.createdAt,
    updated_at: campaigns.updatedAt,
    name: campaigns.name,
    scheduled_at: campaigns.scheduledAt,
};

export class CampaignRepository {
    constructor(database = db) {
        this.db = database;
    }

    async transaction(callback) {
        return this.db.transaction((tx) => callback(new CampaignRepository(tx)));
    }

    async list(ownerId, query) {
        const conditions = [eq(campaigns.userId, ownerId)];
        if (query.channel_type)
            conditions.push(eq(campaigns.channelType, query.channel_type));
        if (query.channel_id)
            conditions.push(sql `${campaigns.channelConfig}->>'channelId' = ${query.channel_id}`);
        if (query.status)
            conditions.push(eq(campaigns.status, query.status));
        if (query.created_by)
            conditions.push(eq(campaigns.createdBy, query.created_by));
        if (query.template_id)
            conditions.push(eq(campaigns.templateId, query.template_id));
        if (query.date_from)
            conditions.push(gte(campaigns.createdAt, query.date_from));
        if (query.date_to)
            conditions.push(lte(campaigns.createdAt, query.date_to));
        if (query.search) {
            conditions.push(or(
                ilike(campaigns.name, `%${query.search}%`),
                ilike(campaigns.description, `%${query.search}%`),
            ));
        }
        if (query.deleted === "only")
            conditions.push(isNotNull(campaigns.deletedAt));
        else if (query.deleted !== "include")
            conditions.push(isNull(campaigns.deletedAt));

        const where = and(...conditions);
        const descending = query.sort.startsWith("-");
        const sortKey = query.sort.replace(/^-/, "");
        const order = descending ? desc(sortColumns[sortKey]) : asc(sortColumns[sortKey]);
        const offset = (query.page - 1) * query.page_size;

        const [rows, [{ total }]] = await Promise.all([
            this.db.select().from(campaigns)
                .where(where)
                .orderBy(order, desc(campaigns.id))
                .limit(query.page_size)
                .offset(offset),
            this.db.select({ total: sql `count(*)::int` }).from(campaigns).where(where),
        ]);

        return {
            data: rows,
            pagination: {
                page: query.page,
                pageSize: query.page_size,
                totalItems: total,
                totalPages: Math.ceil(total / query.page_size),
            },
        };
    }

    async findById(ownerId, id, { includeDeleted = false } = {}) {
        const conditions = [eq(campaigns.id, id), eq(campaigns.userId, ownerId)];
        if (!includeDeleted)
            conditions.push(isNull(campaigns.deletedAt));
        const [row] = await this.db.select().from(campaigns).where(and(...conditions)).limit(1);
        return row;
    }

    async create(values) {
        const [row] = await this.db.insert(campaigns).values(values).returning();
        return row;
    }

    async update(ownerId, id, values, { includeDeleted = false } = {}) {
        const conditions = [eq(campaigns.id, id), eq(campaigns.userId, ownerId)];
        if (!includeDeleted)
            conditions.push(isNull(campaigns.deletedAt));
        const [row] = await this.db.update(campaigns)
            .set({ ...values, updatedAt: new Date() })
            .where(and(...conditions))
            .returning();
        return row;
    }

    async softDelete(ownerId, id) {
        const now = new Date();
        return this.update(ownerId, id, {
            status: "deleted",
            deletedAt: now,
        });
    }

    async restore(ownerId, id, status = "draft") {
        const [row] = await this.db.update(campaigns)
            .set({ status, deletedAt: null, updatedAt: new Date() })
            .where(and(
                eq(campaigns.id, id),
                eq(campaigns.userId, ownerId),
                isNotNull(campaigns.deletedAt),
            ))
            .returning();
        return row;
    }

    async addRecipients(ownerId, campaignId, recipients) {
        if (recipients.length === 0)
            return [];
        const campaign = await this.findById(ownerId, campaignId);
        if (!campaign)
            return null;
        return this.db.insert(campaignRecipients)
            .values(recipients.map((recipient) => ({ ...recipient, campaignId })))
            .onConflictDoUpdate({
                target: [campaignRecipients.campaignId, campaignRecipients.phone],
                set: {
                    contactId: sql `excluded.contact_id`,
                    name: sql `excluded.name`,
                    email: sql `excluded.email`,
                    variables: sql `excluded.variables`,
                    updatedAt: new Date(),
                },
            })
            .returning();
    }

    async listRecipients(ownerId, campaignId, { page = 1, pageSize = 100, status } = {}) {
        const campaign = await this.findById(ownerId, campaignId, { includeDeleted: true });
        if (!campaign)
            return null;
        const conditions = [eq(campaignRecipients.campaignId, campaignId)];
        if (status)
            conditions.push(eq(campaignRecipients.status, status));
        const where = and(...conditions);
        const [rows, [{ total }]] = await Promise.all([
            this.db.select().from(campaignRecipients)
                .where(where)
                .orderBy(desc(campaignRecipients.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
            this.db.select({ total: sql `count(*)::int` })
                .from(campaignRecipients)
                .where(where),
        ]);
        return {
            data: rows,
            pagination: {
                page,
                pageSize,
                totalItems: total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async findRecipientsForDispatch(ownerId, campaignId, limit = 500) {
        const campaign = await this.findById(ownerId, campaignId);
        if (!campaign)
            return null;
        return this.db.select().from(campaignRecipients).where(and(
            eq(campaignRecipients.campaignId, campaignId),
            inArray(campaignRecipients.status, ["pending", "queued", "failed"]),
        )).orderBy(asc(campaignRecipients.createdAt)).limit(limit);
    }

    async updateRecipient(ownerId, campaignId, recipientId, values) {
        const [row] = await this.db.update(campaignRecipients)
            .set({ ...values, updatedAt: new Date() })
            .where(and(
                eq(campaignRecipients.id, recipientId),
                eq(campaignRecipients.campaignId, campaignId),
                sql `EXISTS (
                    SELECT 1 FROM ${campaigns}
                    WHERE ${campaigns.id} = ${campaignId}
                      AND ${campaigns.userId} = ${ownerId}
                )`,
            ))
            .returning();
        return row;
    }

    async findRecipientsByIds(ownerId, contactIds) {
        if (contactIds.length === 0)
            return [];
        return this.db.select().from(sharedContacts).where(and(
            eq(sharedContacts.userId, ownerId),
            inArray(sharedContacts.id, contactIds),
            isNull(sharedContacts.deletedAt),
        ));
    }

    async findTemplate(ownerId, templateId) {
        if (!templateId)
            return null;
        const [row] = await this.db.select().from(templates).where(and(
            eq(templates.id, templateId),
            eq(templates.userId, ownerId),
            isNull(templates.deletedAt),
        )).limit(1);
        return row;
    }

    async aggregateStatistics(ownerId, campaignId) {
        const campaign = await this.findById(ownerId, campaignId, { includeDeleted: true });
        if (!campaign)
            return null;
        const rows = await this.db.select({
            status: campaignRecipients.status,
            count: sql `count(*)::int`,
        }).from(campaignRecipients)
            .where(eq(campaignRecipients.campaignId, campaignId))
            .groupBy(campaignRecipients.status);
        const statistics = { recipientCount: 0 };
        for (const row of rows) {
            statistics.recipientCount += row.count;
            statistics[`${row.status}Count`] = row.count;
        }
        await this.update(ownerId, campaignId, { statistics }, { includeDeleted: true });
        return statistics;
    }

    async updateRecipientByProviderReference(ownerId, providerReference, values) {
        const [row] = await this.db.update(campaignRecipients)
            .set({ ...values, updatedAt: new Date() })
            .where(and(
                eq(campaignRecipients.providerReference, providerReference),
                sql `EXISTS (
                    SELECT 1 FROM ${campaigns}
                    WHERE ${campaigns.id} = ${campaignRecipients.campaignId}
                      AND ${campaigns.userId} = ${ownerId}
                )`,
            ))
            .returning();
        return row;
    }
}

export const campaignRepository = new CampaignRepository();
