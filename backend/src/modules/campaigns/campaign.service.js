import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { users } from "@shared/schema";
import { logAuditEvent } from "../../services/audit-log";
import { ownerIdForUser } from "../../services/contact-identity.service";
import { channelAdapterRegistry } from "./adapters/channel-adapter.registry";
import { campaignRepository } from "./campaign.repository";
import { enqueueCampaignDispatch } from "./campaign-dispatch.queue";
import {
    campaignCreateSchema,
    campaignListQuerySchema,
    campaignRecipientCreateSchema,
    campaignUpdateSchema,
} from "./campaign.validation";

export class CampaignServiceError extends Error {
    constructor(message, statusCode = 400, code = "CAMPAIGN_ERROR") {
        super(message);
        this.name = "CampaignServiceError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

function inferRestoreStatus(campaign) {
    if (campaign.completedAt)
        return "completed";
    if (campaign.scheduledAt && campaign.scheduledAt > new Date())
        return "scheduled";
    if ((campaign.statistics?.sentCount || campaign.statistics?.completedCount || 0) > 0)
        return "paused";
    return "draft";
}

function recipientFromContact(contact) {
    return {
        contactId: contact.id,
        phone: contact.phone,
        name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
        email: contact.email || null,
        status: "pending",
        variables: contact.customFields || {},
    };
}

export class CampaignService {
    constructor({
        repository = campaignRepository,
        adapters = channelAdapterRegistry,
        enqueue = enqueueCampaignDispatch,
        database = db,
    } = {}) {
        this.repository = repository;
        this.adapters = adapters;
        this.enqueue = enqueue;
        this.database = database;
    }

    async resolveOwnerId(actorId) {
        const [user] = await this.database.select({
            id: users.id,
            role: users.role,
            createdBy: users.createdBy,
        }).from(users).where(eq(users.id, actorId)).limit(1);
        if (!user)
            throw new CampaignServiceError("Unauthorized", 401, "UNAUTHORIZED");
        return ownerIdForUser(user);
    }

    async list(ownerId, input = {}) {
        const query = campaignListQuerySchema.parse(input);
        return this.repository.list(ownerId, query);
    }

    async get(ownerId, id, options) {
        const campaign = await this.repository.findById(ownerId, id, options);
        if (!campaign)
            throw new CampaignServiceError("Campaign not found", 404, "NOT_FOUND");
        return campaign;
    }

    async create({ ownerId, actorId, input, audit = {} }) {
        const data = campaignCreateSchema.parse(input);
        let contactRecipients = [];
        const contactIds = data.channel_config.contactIds || [];
        if (contactIds.length > 0) {
            const contacts = await this.repository.findRecipientsByIds(ownerId, contactIds);
            if (contacts.length !== new Set(contactIds).size) {
                throw new CampaignServiceError(
                    "One or more contacts do not belong to this tenant",
                    403,
                    "CONTACT_OWNERSHIP",
                );
            }
            contactRecipients = contacts.map(recipientFromContact);
        }

        const explicitRecipients = data.recipients.map((recipient) => ({
            contactId: recipient.contact_id || null,
            phone: recipient.phone,
            name: recipient.name || null,
            email: recipient.email || null,
            status: "pending",
            variables: recipient.variables,
        }));
        const template = await this.repository.findTemplate(ownerId, data.template_id);
        if (data.template_id && !template) {
            throw new CampaignServiceError("Template does not belong to this tenant", 403, "TEMPLATE_OWNERSHIP");
        }

        const campaignInput = {
            userId: ownerId,
            name: data.name,
            description: data.description || null,
            channelType: data.channel_type,
            campaignType: data.campaign_type,
            status: data.status,
            templateId: data.template_id || null,
            groupId: data.group_id || null,
            agentId: data.agent_id || null,
            phoneNumberId: data.phone_number_id || null,
            scheduledAt: data.scheduled_at || null,
            timezone: data.timezone || data.channel_config.schedule?.timezone || null,
            retryEnabled: data.retry_enabled,
            channelConfig: data.channel_config,
            statistics: { recipientCount: contactRecipients.length + explicitRecipients.length },
            createdBy: actorId,
        };

        const adapter = this.adapters.get(data.channel_type);
        const validation = await adapter.validateConfiguration({
            campaign: campaignInput,
            ownerId,
            template,
        });
        if (!validation.valid) {
            throw new CampaignServiceError(
                validation.errors.join("; "),
                400,
                "INVALID_CHANNEL_CONFIGURATION",
            );
        }

        const recipients = [];
        for (const recipient of [...contactRecipients, ...explicitRecipients]) {
            recipients.push(await adapter.prepareRecipient({
                recipient,
                campaign: campaignInput,
                context: validation.context,
            }));
        }

        const campaign = await this.repository.transaction(async (repository) => {
            const created = await repository.create(campaignInput);
            if (recipients.length > 0)
                await repository.addRecipients(ownerId, created.id, recipients);
            return created;
        });

        if (campaign.status !== "draft")
            await this.enqueue(campaign);
        await this.audit("campaign.create", actorId, campaign, audit);
        return campaign;
    }

    async update({ ownerId, actorId, id, input, audit = {} }) {
        const values = campaignUpdateSchema.parse(input);
        const current = await this.get(ownerId, id);
        if (values.template_id) {
            const template = await this.repository.findTemplate(ownerId, values.template_id);
            if (!template)
                throw new CampaignServiceError("Template does not belong to this tenant", 403);
        }
        const mapped = {};
        const keyMap = {
            campaign_type: "campaignType",
            template_id: "templateId",
            group_id: "groupId",
            agent_id: "agentId",
            phone_number_id: "phoneNumberId",
            scheduled_at: "scheduledAt",
            retry_enabled: "retryEnabled",
            channel_config: "channelConfig",
        };
        for (const [key, value] of Object.entries(values))
            mapped[keyMap[key] || key] = value;
        const updated = await this.repository.update(ownerId, id, mapped);
        await this.audit("campaign.update", actorId, updated, audit, { previousStatus: current.status });
        return updated;
    }

    async remove({ ownerId, actorId, id, audit = {} }) {
        const deleted = await this.repository.softDelete(ownerId, id);
        if (!deleted)
            throw new CampaignServiceError("Campaign not found", 404);
        await this.audit("campaign.delete", actorId, deleted, audit);
        return deleted;
    }

    async restore({ ownerId, actorId, id, audit = {} }) {
        const current = await this.get(ownerId, id, { includeDeleted: true });
        if (!current.deletedAt)
            throw new CampaignServiceError("Campaign is not deleted", 400);
        const restored = await this.repository.restore(ownerId, id, inferRestoreStatus(current));
        await this.audit("campaign.restore", actorId, restored, audit);
        return restored;
    }

    async addRecipients({ ownerId, actorId, campaignId, input, audit = {} }) {
        const campaign = await this.get(ownerId, campaignId);
        const adapter = this.adapters.get(campaign.channelType);
        const values = Array.isArray(input) ? input : input.recipients;
        const parsed = values.map((recipient) => campaignRecipientCreateSchema.parse(recipient));
        const contactIds = parsed.map((recipient) => recipient.contact_id).filter(Boolean);
        if (contactIds.length > 0) {
            const owned = await this.repository.findRecipientsByIds(ownerId, contactIds);
            if (owned.length !== new Set(contactIds).size)
                throw new CampaignServiceError("Contact does not belong to this tenant", 403);
        }
        const recipients = [];
        for (const recipient of parsed) {
            recipients.push(await adapter.prepareRecipient({
                recipient: {
                    contactId: recipient.contact_id || null,
                    phone: recipient.phone,
                    name: recipient.name || null,
                    email: recipient.email || null,
                    status: recipient.status,
                    variables: recipient.variables,
                },
                campaign,
            }));
        }
        const inserted = await this.repository.addRecipients(ownerId, campaignId, recipients);
        const statistics = await this.repository.aggregateStatistics(ownerId, campaignId);
        await this.audit("campaign.recipients.add", actorId, campaign, audit, {
            count: inserted.length,
            statistics,
        });
        return inserted;
    }

    async listRecipients(ownerId, campaignId, options) {
        const result = await this.repository.listRecipients(ownerId, campaignId, options);
        if (!result)
            throw new CampaignServiceError("Campaign not found", 404);
        return result;
    }

    async start({ ownerId, actorId, id, audit = {} }) {
        const campaign = await this.get(ownerId, id);
        if (!["draft", "scheduled", "paused", "failed"].includes(campaign.status))
            throw new CampaignServiceError("Campaign cannot be started from its current status", 409);
        const template = await this.repository.findTemplate(ownerId, campaign.templateId);
        const validation = await this.adapters.get(campaign.channelType).validateConfiguration({
            campaign,
            ownerId,
            template,
        });
        if (!validation.valid)
            throw new CampaignServiceError(validation.errors.join("; "), 400);
        const queued = await this.repository.update(ownerId, id, { status: "queued" });
        await this.enqueue(queued);
        await this.audit("campaign.dispatch", actorId, queued, audit);
        return queued;
    }

    async cancel({ ownerId, actorId, id, audit = {} }) {
        const campaign = await this.get(ownerId, id);
        await this.adapters.get(campaign.channelType).cancel({ campaign, ownerId });
        const cancelled = await this.repository.update(ownerId, id, {
            status: "cancelled",
            completedAt: new Date(),
        });
        await this.audit("campaign.cancel", actorId, cancelled, audit);
        return cancelled;
    }

    async retry({ ownerId, actorId, id, audit = {} }) {
        const campaign = await this.get(ownerId, id);
        if (!campaign.retryEnabled)
            throw new CampaignServiceError("Retry is not enabled for this campaign", 409);
        const queued = await this.repository.update(ownerId, id, { status: "queued" });
        await this.enqueue(queued, { action: "retry" });
        await this.audit("campaign.retry", actorId, queued, audit);
        return queued;
    }

    async audit(action, actorId, campaign, requestInfo, metadata = {}) {
        await logAuditEvent({
            action,
            userId: actorId,
            resourceType: "campaign",
            resourceId: campaign.id,
            ipAddress: requestInfo.ipAddress,
            userAgent: requestInfo.userAgent,
            metadata: {
                ownerId: campaign.userId,
                channelType: campaign.channelType,
                ...metadata,
            },
        });
    }
}

export const campaignService = new CampaignService();
