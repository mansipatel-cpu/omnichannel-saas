import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../config/database";
import { users, sharedContacts, unifiedCampaigns, unifiedCampaignRecipients, callHistory } from "@shared/schema";
import { ownerIdForUser } from "./contact-identity.service";

const CHANNELS = new Set(["voice", "whatsapp"]);

export async function accountOwnerIdForUserId(userId) {
    if (!userId)
        return null;
    const [user] = await db
        .select({ id: users.id, role: users.role, createdBy: users.createdBy })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
    return user ? ownerIdForUser(user) : null;
}

async function recipientStatusCounts(campaignIds) {
    if (campaignIds.length === 0)
        return new Map();
    const rows = await db
        .select({
            campaignId: unifiedCampaignRecipients.campaignId,
            status: unifiedCampaignRecipients.status,
            count: sql `count(*)::int`,
        })
        .from(unifiedCampaignRecipients)
        .where(inArray(unifiedCampaignRecipients.campaignId, campaignIds))
        .groupBy(unifiedCampaignRecipients.campaignId, unifiedCampaignRecipients.status);
    const byCampaign = new Map();
    for (const row of rows) {
        const counts = byCampaign.get(row.campaignId) || {};
        counts[row.status || "unknown"] = row.count;
        byCampaign.set(row.campaignId, counts);
    }
    return byCampaign;
}

/** Every campaign of an account, calling and WhatsApp, newest first. */
export async function listCampaigns(ownerId, { channel, includeDeleted = false, limit = 50, offset = 0 } = {}) {
    const conditions = [eq(unifiedCampaigns.userId, ownerId)];
    const normalizedChannel = channel === "calling" ? "voice" : channel;
    if (normalizedChannel && CHANNELS.has(normalizedChannel))
        conditions.push(eq(unifiedCampaigns.channelType, normalizedChannel));
    if (!includeDeleted)
        conditions.push(isNull(unifiedCampaigns.deletedAt));
    const where = and(...conditions);
    const [rows, [{ total }]] = await Promise.all([
        db.select().from(unifiedCampaigns).where(where)
            .orderBy(desc(unifiedCampaigns.createdAt))
            .limit(Math.min(Math.max(limit, 1), 200))
            .offset(Math.max(offset, 0)),
        db.select({ total: sql `count(*)::int` }).from(unifiedCampaigns).where(where),
    ]);
    const counts = await recipientStatusCounts(rows.map((r) => r.id));
    return {
        campaigns: rows.map((row) => ({ ...row, recipientStatusCounts: counts.get(row.id) || {} })),
        total,
    };
}

/** One shared contact and every campaign they were part of, on any channel. */
export async function getContactCampaignHistory(ownerId, contactId) {
    const [contact] = await db
        .select()
        .from(sharedContacts)
        .where(and(eq(sharedContacts.id, contactId), eq(sharedContacts.userId, ownerId)))
        .limit(1);
    if (!contact)
        return null;
    const history = await db
        .select({
            recipientId: unifiedCampaignRecipients.id,
            campaignId: unifiedCampaigns.id,
            campaignName: unifiedCampaigns.name,
            channel: unifiedCampaigns.channelType,
            campaignStatus: unifiedCampaigns.status,
            status: unifiedCampaignRecipients.status,
            attemptCount: unifiedCampaignRecipients.attemptCount,
            lastAttemptAt: sql `${unifiedCampaignRecipients.result}->>'lastAttemptAt'`,
            sentAt: unifiedCampaignRecipients.sentAt,
            deliveredAt: unifiedCampaignRecipients.deliveredAt,
            readAt: unifiedCampaignRecipients.readAt,
            error: unifiedCampaignRecipients.errorMessage,
            addedAt: unifiedCampaignRecipients.createdAt,
        })
        .from(unifiedCampaignRecipients)
        .innerJoin(unifiedCampaigns, eq(unifiedCampaigns.id, unifiedCampaignRecipients.campaignId))
        .where(and(eq(unifiedCampaignRecipients.contactId, contactId), eq(unifiedCampaigns.userId, ownerId)))
        .orderBy(desc(sql `coalesce(${unifiedCampaignRecipients.sentAt}, ${unifiedCampaignRecipients.createdAt})`));
    return { contact, history };
}

const callHistoryColumns = {
    id: callHistory.id,
    provider: callHistory.provider,
    direction: callHistory.direction,
    status: callHistory.status,
    fromNumber: callHistory.fromNumber,
    toNumber: callHistory.toNumber,
    durationSeconds: callHistory.durationSeconds,
    recordingUrl: callHistory.recordingUrl,
    aiSummary: callHistory.aiSummary,
    sentiment: callHistory.sentiment,
    classification: callHistory.classification,
    creditsUsed: callHistory.creditsUsed,
    agentId: callHistory.agentId,
    contactId: callHistory.contactId,
    contactName: sharedContacts.name,
    campaignId: callHistory.campaignId,
    campaignName: unifiedCampaigns.name,
    campaignRecipientId: callHistory.campaignRecipientId,
    callId: callHistory.callId,
    providerTable: callHistory.providerTable,
    providerRowId: callHistory.providerRowId,
    providerCallId: callHistory.providerCallId,
    startedAt: callHistory.startedAt,
    answeredAt: callHistory.answeredAt,
    endedAt: callHistory.endedAt,
    createdAt: callHistory.createdAt,
};

/** Every call of an account on every provider, newest first. */
export async function listCalls(ownerId, { provider, direction, campaignId, contactId, limit = 50, offset = 0 } = {}) {
    const conditions = [eq(callHistory.userId, ownerId)];
    if (provider)
        conditions.push(eq(callHistory.provider, provider));
    if (direction === "inbound" || direction === "outbound")
        conditions.push(eq(callHistory.direction, direction));
    if (campaignId)
        conditions.push(eq(callHistory.campaignId, campaignId));
    if (contactId)
        conditions.push(eq(callHistory.contactId, contactId));
    const where = and(...conditions);
    const [calls, [{ total }]] = await Promise.all([
        db.select(callHistoryColumns)
            .from(callHistory)
            .leftJoin(sharedContacts, eq(sharedContacts.id, callHistory.contactId))
            .leftJoin(unifiedCampaigns, eq(unifiedCampaigns.id, callHistory.campaignId))
            .where(where)
            .orderBy(desc(callHistory.createdAt))
            .limit(Math.min(Math.max(limit, 1), 200))
            .offset(Math.max(offset, 0)),
        db.select({ total: sql `count(*)::int` }).from(callHistory).where(where),
    ]);
    return { calls, total };
}

/** One shared contact and every call made to or from them, on any provider. */
export async function getContactCallHistory(ownerId, contactId) {
    const [contact] = await db
        .select()
        .from(sharedContacts)
        .where(and(eq(sharedContacts.id, contactId), eq(sharedContacts.userId, ownerId)))
        .limit(1);
    if (!contact)
        return null;
    const calls = await db
        .select(callHistoryColumns)
        .from(callHistory)
        .leftJoin(sharedContacts, eq(sharedContacts.id, callHistory.contactId))
        .leftJoin(unifiedCampaigns, eq(unifiedCampaigns.id, callHistory.campaignId))
        .where(and(eq(callHistory.contactId, contactId), eq(callHistory.userId, ownerId)))
        .orderBy(desc(callHistory.createdAt));
    return { contact, calls };
}
