import { extractRequestInfo } from "../../services/audit-log";
import { campaignService, CampaignServiceError } from "./campaign.service";
import {
    toLegacyCampaign,
    toLegacyRecipient,
    toVoiceCampaign,
    toWhatsAppCampaign,
} from "./campaign.mapper";

function actorId(req) {
    return req.userId || req.user?.id || req.session?.user?.id;
}

async function serviceContext(req) {
    const actor = actorId(req);
    return {
        actorId: actor,
        ownerId: await campaignService.resolveOwnerId(actor),
        audit: extractRequestInfo(req),
    };
}

function fail(res, error, fallback) {
    if (error instanceof CampaignServiceError)
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
    if (error?.issues)
        return res.status(400).json({ error: "Validation failed", issues: error.issues });
    console.error(`[CampaignCompatibility] ${fallback}:`, error);
    return res.status(500).json({ error: fallback });
}

async function allCampaigns(ownerId, query) {
    const first = await campaignService.list(ownerId, { ...query, page: 1, page_size: 200 });
    const rows = [...first.data];
    for (let page = 2; page <= first.pagination.totalPages; page++) {
        const next = await campaignService.list(ownerId, { ...query, page, page_size: 200 });
        rows.push(...next.data);
    }
    return rows;
}

export function voiceCreateInput(body) {
    const phoneNumberId = body.phoneNumberId || body.sipPhoneNumberId || body.plivoPhoneNumberId;
    const schedule = body.scheduleEnabled ? {
        startTime: body.scheduleTimeStart,
        endTime: body.scheduleTimeEnd,
        days: body.scheduleDays || body.daysOfWeek || [],
        timezone: body.scheduleTimezone || "America/New_York",
    } : null;
    return {
        channel_type: "voice",
        name: body.name,
        description: body.goal || null,
        campaign_type: body.type || "outbound",
        status: body.scheduledFor && new Date(body.scheduledFor) > new Date() ? "scheduled" : "draft",
        template_id: null,
        agent_id: body.agentId,
        phone_number_id: phoneNumberId,
        scheduled_at: body.scheduledFor || null,
        timezone: body.scheduleTimezone || "America/New_York",
        retry_enabled: body.retryEnabled ?? false,
        channel_config: {
            flowId: body.flowId || null,
            customScript: body.flowId ? null : (body.script || null),
            voiceId: body.voiceId || null,
            sipPhoneNumberId: body.sipPhoneNumberId || null,
            plivoPhoneNumberId: body.plivoPhoneNumberId || null,
            schedule,
            retry: {
                maxAttempts: body.retryMaxAttempts ?? 3,
                intervalMinutes: body.retryIntervalMinutes ?? 60,
                onNoAnswer: body.retryOnNoAnswer ?? true,
                onBusy: body.retryOnBusy ?? false,
                onFailed: body.retryOnFailed ?? false,
            },
        },
    };
}

export function whatsappCreateInput(body) {
    return {
        channel_type: "whatsapp",
        name: body.name,
        description: body.description || null,
        campaign_type: body.campaignType,
        status: body.status === "scheduled" ? "scheduled" : "queued",
        template_id: body.templateId,
        scheduled_at: body.scheduledAt || null,
        retry_enabled: body.autoRetry ?? false,
        channel_config: {
            channelId: body.channelId,
            language: body.templateLanguage || "en_US",
            templateVariables: body.variableMapping || {},
            templateName: body.templateName,
            type: body.type || "marketing",
            apiType: body.apiType || "mm_lite",
            audienceType: body.audienceType || "all",
            platform: body.platform,
            contactIds: body.contactGroups || [],
            csvData: body.csvData || [],
            compatibilityStatus: body.status || "active",
        },
    };
}

export const voiceCampaignCompatibilityController = {
    list: async (req, res) => {
        try {
            const { ownerId } = await serviceContext(req);
            const deleted = req.path.endsWith("/deleted");
            const rows = await allCampaigns(ownerId, {
                channel_type: "voice",
                deleted: deleted ? "only" : "exclude",
            });
            const mapped = rows.map(toVoiceCampaign);
            if (req.query.page !== undefined || req.query.pageSize !== undefined) {
                const page = Math.max(Number(req.query.page) || 1, 1);
                const pageSize = Math.max(Number(req.query.pageSize) || 25, 1);
                return res.json({
                    data: mapped.slice((page - 1) * pageSize, page * pageSize),
                    pagination: {
                        page,
                        pageSize,
                        totalItems: mapped.length,
                        totalPages: Math.ceil(mapped.length / pageSize),
                    },
                });
            }
            res.json(mapped);
        }
        catch (error) {
            fail(res, error, "Failed to get campaigns");
        }
    },

    create: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            const campaign = await campaignService.create({
                ...ctx,
                input: voiceCreateInput(req.body),
            });
            res.json(toVoiceCampaign(campaign));
        }
        catch (error) {
            fail(res, error, "Failed to create campaign");
        }
    },

    get: async (req, res) => {
        try {
            const { ownerId } = await serviceContext(req);
            const campaign = await campaignService.get(ownerId, req.params.id);
            if (campaign.channelType !== "voice")
                throw new CampaignServiceError("Campaign not found", 404);
            res.json(toVoiceCampaign(campaign));
        }
        catch (error) {
            fail(res, error, "Failed to get campaign");
        }
    },

    update: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            const current = await campaignService.get(ctx.ownerId, req.params.id);
            const input = voiceCreateInput({ ...toVoiceCampaign(current), ...req.body });
            const updated = await campaignService.update({
                ...ctx,
                id: req.params.id,
                input: {
                    name: input.name,
                    description: input.description,
                    campaign_type: input.campaign_type,
                    agent_id: input.agent_id,
                    phone_number_id: input.phone_number_id,
                    scheduled_at: input.scheduled_at,
                    timezone: input.timezone,
                    retry_enabled: input.retry_enabled,
                    channel_config: input.channel_config,
                },
            });
            res.json(toVoiceCampaign(updated));
        }
        catch (error) {
            fail(res, error, "Failed to update campaign");
        }
    },

    remove: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            await campaignService.remove({ ...ctx, id: req.params.id });
            res.json({ success: true });
        }
        catch (error) {
            fail(res, error, "Failed to delete campaign");
        }
    },

    restore: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            res.json(toVoiceCampaign(await campaignService.restore({ ...ctx, id: req.params.id })));
        }
        catch (error) {
            fail(res, error, "Failed to restore campaign");
        }
    },

    listRecipients: async (req, res) => {
        try {
            const { ownerId } = await serviceContext(req);
            const result = await campaignService.listRecipients(ownerId, req.params.campaignId, {
                page: 1,
                pageSize: 500,
            });
            res.json(result.data.map((row) => toLegacyRecipient(row, "voice")));
        }
        catch (error) {
            fail(res, error, "Failed to get contacts");
        }
    },

    addRecipients: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            const recipients = (req.body.recipients || req.body).map((row) => ({
                contact_id: row.contactId || null,
                phone: row.phone,
                name: row.name || [row.firstName, row.lastName].filter(Boolean).join(" "),
                email: row.email || null,
                variables: row.customFields || {},
            }));
            const inserted = await campaignService.addRecipients({
                ...ctx,
                campaignId: req.params.campaignId,
                input: recipients,
            });
            res.json({ count: inserted.length, inserted: inserted.length, failed: 0, skippedInvalid: 0 });
        }
        catch (error) {
            fail(res, error, "Failed to add contacts");
        }
    },
};

export const whatsappCampaignCompatibilityController = {
    list: async (req, res) => {
        try {
            const { ownerId } = await serviceContext(req);
            const deleted = req.path.endsWith("/deleted");
            const channelId = req.headers["x-channel-id"] || req.query.channelId;
            const result = await campaignService.list(ownerId, {
                channel_type: "whatsapp",
                channel_id: channelId,
                deleted: deleted ? "only" : "exclude",
                page: req.query.page || 1,
                page_size: req.query.limit || (deleted ? 100 : 10),
            });
            const rows = result.data.map(toWhatsAppCampaign);
            if (deleted)
                return res.json(rows);
            const stats = {
                totalCampaigns: result.pagination.totalItems,
                activeCampaigns: rows.filter((item) => ["active", "sending"].includes(item.status)).length,
                totalRecipients: rows.reduce((sum, item) => sum + item.recipientCount, 0),
                totalSent: rows.reduce((sum, item) => sum + item.sentCount, 0),
                totalDelivered: rows.reduce((sum, item) => sum + item.deliveredCount, 0),
                totalRead: rows.reduce((sum, item) => sum + item.readCount, 0),
                totalFailed: rows.reduce((sum, item) => sum + item.failedCount, 0),
            };
            res.json({
                data: rows,
                total: result.pagination.totalItems,
                page: result.pagination.page,
                limit: result.pagination.pageSize,
                pagination: {
                    page: result.pagination.page,
                    limit: result.pagination.pageSize,
                    total: result.pagination.totalItems,
                    totalPages: result.pagination.totalPages,
                },
                stats,
            });
        }
        catch (error) {
            fail(res, error, "Failed to get campaigns");
        }
    },

    create: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            const input = whatsappCreateInput({
                ...req.body,
                channelId: req.body.channelId || req.headers["x-channel-id"] || req.query.channelId,
            });
            res.json(toWhatsAppCampaign(await campaignService.create({ ...ctx, input })));
        }
        catch (error) {
            fail(res, error, "Failed to create campaign");
        }
    },

    get: async (req, res) => {
        try {
            const { ownerId } = await serviceContext(req);
            const campaign = await campaignService.get(ownerId, req.params.id);
            if (campaign.channelType !== "whatsapp")
                throw new CampaignServiceError("Campaign not found", 404);
            res.json(toWhatsAppCampaign(campaign));
        }
        catch (error) {
            fail(res, error, "Failed to get campaign");
        }
    },

    update: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            const current = await campaignService.get(ctx.ownerId, req.params.id);
            const legacy = { ...toWhatsAppCampaign(current), ...req.body };
            const input = whatsappCreateInput(legacy);
            const updated = await campaignService.update({
                ...ctx,
                id: req.params.id,
                input: {
                    name: input.name,
                    description: input.description,
                    campaign_type: input.campaign_type,
                    status: input.status,
                    template_id: input.template_id,
                    scheduled_at: input.scheduled_at,
                    retry_enabled: input.retry_enabled,
                    channel_config: input.channel_config,
                },
            });
            res.json(toWhatsAppCampaign(updated));
        }
        catch (error) {
            fail(res, error, "Failed to update campaign");
        }
    },

    remove: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            await campaignService.remove({ ...ctx, id: req.params.id });
            res.json({ success: true });
        }
        catch (error) {
            fail(res, error, "Failed to delete campaign");
        }
    },

    restore: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            res.json(toWhatsAppCampaign(await campaignService.restore({ ...ctx, id: req.params.id })));
        }
        catch (error) {
            fail(res, error, "Failed to restore campaign");
        }
    },

    start: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            await campaignService.start({ ...ctx, id: req.params.id });
            res.json({ success: true, message: "Campaign queued for sending" });
        }
        catch (error) {
            fail(res, error, "Failed to start campaign");
        }
    },

    updateStatus: async (req, res) => {
        try {
            const ctx = await serviceContext(req);
            const status = req.body.status === "sending" ? "running" : req.body.status;
            const campaign = await campaignService.update({
                ...ctx,
                id: req.params.id,
                input: { status },
            });
            res.json(toLegacyCampaign(campaign));
        }
        catch (error) {
            fail(res, error, "Failed to update campaign status");
        }
    },
};
