import { Queue } from "bullmq";
import { getRedisConnection } from "../../infrastructure/bullmq/redis-connection";

export const CAMPAIGN_DISPATCH_QUEUE = "campaign-dispatch";
let queue;

export function getCampaignDispatchQueue() {
    if (!queue) {
        queue = new Queue(CAMPAIGN_DISPATCH_QUEUE, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: "exponential", delay: 2000 },
                removeOnComplete: 1000,
                removeOnFail: 5000,
            },
        });
    }
    return queue;
}

export async function enqueueCampaignDispatch(campaign, { action = "dispatch" } = {}) {
    const delay = campaign.status === "scheduled" && campaign.scheduledAt
        ? Math.max(new Date(campaign.scheduledAt).getTime() - Date.now(), 0)
        : 0;
    return getCampaignDispatchQueue().add(
        action,
        {
            campaignId: campaign.id,
            ownerId: campaign.userId,
            channelType: campaign.channelType,
            action,
        },
        {
            jobId: `${action}:${campaign.id}:${campaign.updatedAt?.getTime?.() || Date.now()}`,
            delay,
        },
    );
}

export async function closeCampaignDispatchQueue() {
    if (!queue)
        return;
    await queue.close();
    queue = undefined;
}
