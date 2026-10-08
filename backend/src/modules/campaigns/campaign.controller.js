import { ZodError } from "zod";
import { extractRequestInfo } from "../../services/audit-log";
import { CampaignServiceError, campaignService } from "./campaign.service";

function sendError(res, error) {
    if (error instanceof ZodError) {
        return res.status(400).json({
            error: "Validation failed",
            issues: error.issues,
        });
    }
    if (error instanceof CampaignServiceError) {
        return res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
        });
    }
    console.error("[CampaignController]", error);
    return res.status(500).json({ error: "Campaign operation failed" });
}

async function context(req) {
    const actorId = req.userId || req.user?.id || req.session?.user?.id;
    const ownerId = req.accountOwnerId || await campaignService.resolveOwnerId(actorId);
    return { actorId, ownerId, audit: extractRequestInfo(req) };
}

export const campaignController = {
    list: async (req, res) => {
        try {
            const { ownerId } = await context(req);
            res.json(await campaignService.list(ownerId, req.query));
        }
        catch (error) {
            sendError(res, error);
        }
    },

    create: async (req, res) => {
        try {
            const ctx = await context(req);
            res.status(201).json(await campaignService.create({ ...ctx, input: req.body }));
        }
        catch (error) {
            sendError(res, error);
        }
    },

    get: async (req, res) => {
        try {
            const { ownerId } = await context(req);
            res.json(await campaignService.get(ownerId, req.params.id));
        }
        catch (error) {
            sendError(res, error);
        }
    },

    update: async (req, res) => {
        try {
            const ctx = await context(req);
            res.json(await campaignService.update({ ...ctx, id: req.params.id, input: req.body }));
        }
        catch (error) {
            sendError(res, error);
        }
    },

    remove: async (req, res) => {
        try {
            const ctx = await context(req);
            await campaignService.remove({ ...ctx, id: req.params.id });
            res.json({ success: true });
        }
        catch (error) {
            sendError(res, error);
        }
    },

    restore: async (req, res) => {
        try {
            const ctx = await context(req);
            res.json(await campaignService.restore({ ...ctx, id: req.params.id }));
        }
        catch (error) {
            sendError(res, error);
        }
    },

    start: async (req, res) => {
        try {
            const ctx = await context(req);
            const campaign = await campaignService.start({ ...ctx, id: req.params.id });
            res.json({ message: "Campaign queued", campaignId: campaign.id, campaign });
        }
        catch (error) {
            sendError(res, error);
        }
    },

    cancel: async (req, res) => {
        try {
            const ctx = await context(req);
            const campaign = await campaignService.cancel({ ...ctx, id: req.params.id });
            res.json({ message: "Campaign cancelled", campaignId: campaign.id, campaign });
        }
        catch (error) {
            sendError(res, error);
        }
    },

    retry: async (req, res) => {
        try {
            const ctx = await context(req);
            const campaign = await campaignService.retry({ ...ctx, id: req.params.id });
            res.json({ message: "Campaign retry queued", campaignId: campaign.id, campaign });
        }
        catch (error) {
            sendError(res, error);
        }
    },

    addRecipients: async (req, res) => {
        try {
            const ctx = await context(req);
            const recipients = await campaignService.addRecipients({
                ...ctx,
                campaignId: req.params.id,
                input: req.body,
            });
            res.status(201).json({ data: recipients, count: recipients.length });
        }
        catch (error) {
            sendError(res, error);
        }
    },

    listRecipients: async (req, res) => {
        try {
            const { ownerId } = await context(req);
            res.json(await campaignService.listRecipients(ownerId, req.params.id, {
                page: Math.max(Number(req.query.page) || 1, 1),
                pageSize: Math.min(Math.max(Number(req.query.page_size || req.query.pageSize) || 100, 1), 500),
                status: req.query.status,
            }));
        }
        catch (error) {
            sendError(res, error);
        }
    },
};
