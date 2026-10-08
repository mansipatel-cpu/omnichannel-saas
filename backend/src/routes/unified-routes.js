import { Router } from "express";
import { accountOwnerIdForUserId, getContactCallHistory, getContactCampaignHistory, listCalls, listCampaigns } from "../services/unified-campaigns.service";

const router = Router();

const resolveOwner = async (req, res, next) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        req.accountOwnerId = await accountOwnerIdForUserId(req.userId);
        if (!req.accountOwnerId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        next();
    }
    catch (error) {
        next(error);
    }
};

router.use(resolveOwner);

router.get("/campaigns", async (req, res) => {
    try {
        const result = await listCampaigns(req.accountOwnerId, {
            channel: req.query.channel,
            includeDeleted: req.query.includeDeleted === "true",
            limit: Number.parseInt(req.query.limit, 10) || 50,
            offset: Number.parseInt(req.query.offset, 10) || 0,
        });
        res.json(result);
    }
    catch (error) {
        console.error("[Unified] Error listing campaigns:", error);
        res.status(500).json({ error: "Failed to list campaigns" });
    }
});

router.get("/contacts/:id/campaigns", async (req, res) => {
    try {
        const result = await getContactCampaignHistory(req.accountOwnerId, req.params.id);
        if (!result) {
            return res.status(404).json({ error: "Contact not found" });
        }
        res.json(result);
    }
    catch (error) {
        console.error("[Unified] Error loading contact campaign history:", error);
        res.status(500).json({ error: "Failed to load contact campaign history" });
    }
});

router.get("/calls", async (req, res) => {
    try {
        const result = await listCalls(req.accountOwnerId, {
            provider: req.query.provider,
            direction: req.query.direction,
            campaignId: req.query.campaignId,
            contactId: req.query.contactId,
            limit: Number.parseInt(req.query.limit, 10) || 50,
            offset: Number.parseInt(req.query.offset, 10) || 0,
        });
        res.json(result);
    }
    catch (error) {
        console.error("[Unified] Error listing calls:", error);
        res.status(500).json({ error: "Failed to list calls" });
    }
});

router.get("/contacts/:id/calls", async (req, res) => {
    try {
        const result = await getContactCallHistory(req.accountOwnerId, req.params.id);
        if (!result) {
            return res.status(404).json({ error: "Contact not found" });
        }
        res.json(result);
    }
    catch (error) {
        console.error("[Unified] Error loading contact call history:", error);
        res.status(500).json({ error: "Failed to load contact call history" });
    }
});

export default router;
