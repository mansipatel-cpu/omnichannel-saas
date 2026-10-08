import { campaignController } from "./campaign.controller";
import { voiceCampaignCompatibilityController } from "./campaign.compatibility.controller";
import { apiRateLimiter, strictRateLimiter } from "../../middleware/rateLimiter";

export function registerCampaignModuleRoutes(router, { authenticateHybrid, authenticateToken }) {
    const auth = authenticateHybrid || authenticateToken;

    router.get("/api/campaigns", auth, apiRateLimiter, (req, res) => {
        if (req.query.channel_type || req.query.page_size || req.query.deleted)
            return campaignController.list(req, res);
        return voiceCampaignCompatibilityController.list(req, res);
    });
    router.get("/api/campaigns/deleted", auth, apiRateLimiter, voiceCampaignCompatibilityController.list);
    router.post("/api/campaigns", auth, strictRateLimiter, (req, res) => {
        if (req.body?.channel_type)
            return campaignController.create(req, res);
        return voiceCampaignCompatibilityController.create(req, res);
    });
    router.get("/api/campaigns/:id", auth, apiRateLimiter, (req, res) => {
        if (req.query.unified === "true")
            return campaignController.get(req, res);
        return voiceCampaignCompatibilityController.get(req, res);
    });
    router.patch("/api/campaigns/:id", auth, strictRateLimiter, (req, res) => {
        if (req.body?.channel_config || req.body?.campaign_type || req.body?.channel_type)
            return campaignController.update(req, res);
        return voiceCampaignCompatibilityController.update(req, res);
    });
    router.delete("/api/campaigns/:id", auth, strictRateLimiter, voiceCampaignCompatibilityController.remove);
    router.patch("/api/campaigns/:id/restore", auth, strictRateLimiter, voiceCampaignCompatibilityController.restore);
    router.post("/api/campaigns/:id/restore", auth, strictRateLimiter, campaignController.restore);
    router.post("/api/campaigns/:id/start", auth, strictRateLimiter, campaignController.start);
    router.post("/api/campaigns/:id/cancel", auth, strictRateLimiter, campaignController.cancel);
    router.post("/api/campaigns/:id/retry", auth, strictRateLimiter, campaignController.retry);
    router.post("/api/campaigns/:id/recipients", auth, strictRateLimiter, campaignController.addRecipients);
    router.get("/api/campaigns/:id/recipients", auth, apiRateLimiter, campaignController.listRecipients);
    router.get("/api/campaigns/:campaignId/contacts", auth, apiRateLimiter, voiceCampaignCompatibilityController.listRecipients);

    return router;
}
