'use strict';
/**
 * ============================================================
 * BullMQ Queue Definitions
 * Defines all queues used for campaign processing
 * ============================================================
 */
import { Queue } from 'bullmq';
import { getRedisConnection } from './redis-connection';
export const QUEUE_NAMES = {
    CAMPAIGN_CALLS: 'campaign-calls',
    CAMPAIGN_SCHEDULER: 'campaign-scheduler',
    CAMPAIGN_RECOVERY: 'campaign-recovery',
};
let campaignCallsQueue = null;
let campaignSchedulerQueue = null;
let campaignRecoveryQueue = null;
const defaultQueueOptions = {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: {
            age: 3600,
            count: 1000,
        },
        removeOnFail: {
            age: 86400,
            count: 5000,
        },
    },
};
export function getCampaignCallsQueue() {
    if (!campaignCallsQueue) {
        campaignCallsQueue = new Queue(QUEUE_NAMES.CAMPAIGN_CALLS, {
            connection: getRedisConnection(),
            ...defaultQueueOptions,
        });
    }
    return campaignCallsQueue;
}
export function getCampaignSchedulerQueue() {
    if (!campaignSchedulerQueue) {
        campaignSchedulerQueue = new Queue(QUEUE_NAMES.CAMPAIGN_SCHEDULER, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: {
                    age: 3600,
                    count: 100,
                },
            },
        });
    }
    return campaignSchedulerQueue;
}
export function getCampaignRecoveryQueue() {
    if (!campaignRecoveryQueue) {
        campaignRecoveryQueue = new Queue(QUEUE_NAMES.CAMPAIGN_RECOVERY, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 2,
                backoff: {
                    type: 'fixed',
                    delay: 10000,
                },
                removeOnComplete: true,
                removeOnFail: {
                    age: 86400,
                    count: 100,
                },
            },
        });
    }
    return campaignRecoveryQueue;
}
export async function closeAllQueues() {
    const closePromises = [];
    if (campaignCallsQueue) {
        closePromises.push(campaignCallsQueue.close());
        campaignCallsQueue = null;
    }
    if (campaignSchedulerQueue) {
        closePromises.push(campaignSchedulerQueue.close());
        campaignSchedulerQueue = null;
    }
    if (campaignRecoveryQueue) {
        closePromises.push(campaignRecoveryQueue.close());
        campaignRecoveryQueue = null;
    }
    await Promise.all(closePromises);
    console.log('[BullMQ] All queues closed');
}
export async function addCampaignCallJobs(jobs) {
    const queue = getCampaignCallsQueue();
    const bulkJobs = jobs.map((job) => ({
        name: `call-${job.callId}`,
        data: job,
        opts: {
            jobId: job.callId,
            priority: job.retryCount > 0 ? 10 : 1,
        },
    }));
    await queue.addBulk(bulkJobs);
    console.log(`[BullMQ] Added ${jobs.length} call jobs to queue`);
}
export async function getQueueStats(queueName) {
    let queue;
    switch (queueName) {
        case QUEUE_NAMES.CAMPAIGN_CALLS:
            queue = getCampaignCallsQueue();
            break;
        case QUEUE_NAMES.CAMPAIGN_SCHEDULER:
            queue = getCampaignSchedulerQueue();
            break;
        case QUEUE_NAMES.CAMPAIGN_RECOVERY:
            queue = getCampaignRecoveryQueue();
            break;
        default:
            throw new Error(`Unknown queue: ${queueName}`);
    }
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
}
