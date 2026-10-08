import { Worker } from "bullmq";
import { getRedisConnection } from "../../infrastructure/bullmq/redis-connection";
import { campaignRepository } from "./campaign.repository";
import { channelAdapterRegistry } from "./adapters/channel-adapter.registry";
import { CAMPAIGN_DISPATCH_QUEUE } from "./campaign-dispatch.queue";

let worker;

async function processCampaignJob(job) {
    const { campaignId, ownerId, channelType, action } = job.data;
    const campaign = await campaignRepository.findById(ownerId, campaignId);
    if (!campaign)
        return { skipped: true, reason: "campaign_not_found" };
    if (campaign.channelType !== channelType)
        throw new Error("Campaign channel changed after the job was queued");
    if (["cancelled", "deleted", "completed"].includes(campaign.status))
        return { skipped: true, reason: `campaign_${campaign.status}` };

    const adapter = channelAdapterRegistry.get(channelType);
    const template = await campaignRepository.findTemplate(ownerId, campaign.templateId);
    const validation = await adapter.validateConfiguration({ campaign, ownerId, template });
    if (!validation.valid) {
        await campaignRepository.update(ownerId, campaignId, {
            status: "failed",
            statistics: {
                ...(campaign.statistics || {}),
                errorMessage: validation.errors.join("; "),
            },
        });
        throw new Error(validation.errors.join("; "));
    }

    await campaignRepository.update(ownerId, campaignId, {
        status: "running",
        startedAt: campaign.startedAt || new Date(),
    });

    if (channelType === "voice") {
        const result = action === "retry"
            ? await adapter.retry({ campaign, ownerId, context: validation.context })
            : await adapter.dispatch({ campaign, ownerId, context: validation.context });
        return { campaignId, channelType, result };
    }

    const recipients = await campaignRepository.findRecipientsForDispatch(ownerId, campaignId, 5000);
    let processed = 0;
    let failed = 0;
    for (const row of recipients || []) {
        await campaignRepository.updateRecipient(ownerId, campaignId, row.id, {
            status: "processing",
            attemptCount: (row.attemptCount || 0) + 1,
        });
        try {
            const recipient = await adapter.prepareRecipient({
                recipient: row,
                campaign,
                context: validation.context,
            });
            const result = action === "retry"
                ? await adapter.retry({ campaign, recipient, ownerId, context: validation.context })
                : await adapter.dispatch({ campaign, recipient, ownerId, context: validation.context });
            await campaignRepository.updateRecipient(ownerId, campaignId, row.id, {
                status: result.status,
                providerReference: result.providerReference,
                sentAt: ["sent", "delivered", "read"].includes(result.status) ? new Date() : row.sentAt,
                result: { ...(row.result || {}), ...(result.result || {}) },
                errorCode: null,
                errorMessage: null,
            });
            processed++;
        }
        catch (error) {
            failed++;
            await campaignRepository.updateRecipient(ownerId, campaignId, row.id, {
                status: "failed",
                errorMessage: error.message,
                result: { ...(row.result || {}), lastErrorAt: new Date().toISOString() },
            });
        }
        await job.updateProgress(Math.round(((processed + failed) / recipients.length) * 100));
    }

    const statistics = await campaignRepository.aggregateStatistics(ownerId, campaignId);
    const finalStatus = recipients?.length > 0 && failed === recipients.length ? "failed" : "completed";
    await campaignRepository.update(ownerId, campaignId, {
        status: finalStatus,
        completedAt: new Date(),
        statistics,
    });
    return { campaignId, channelType, processed, failed };
}

export function startCampaignDispatchWorker() {
    if (worker)
        return worker;
    worker = new Worker(CAMPAIGN_DISPATCH_QUEUE, processCampaignJob, {
        connection: getRedisConnection(),
        concurrency: Math.max(Number(process.env.CAMPAIGN_DISPATCH_CONCURRENCY) || 5, 1),
    });
    worker.on("failed", (job, error) => {
        console.error(`[CampaignDispatch] Job ${job?.id || "unknown"} failed:`, error.message);
    });
    return worker;
}

export async function stopCampaignDispatchWorker() {
    if (!worker)
        return;
    await worker.close();
    worker = undefined;
}

export { processCampaignJob };
