import { and, eq, or } from "drizzle-orm";
import { agents, phoneNumbers, plivoPhoneNumbers, sipPhoneNumbers } from "@shared/schema";
import { db } from "../../../config/database";
import { campaignExecutor } from "../../../services/campaign-executor";
import { ChannelAdapter } from "./channel-adapter";

const STATUS_MAP = {
    pending: "pending",
    queued: "queued",
    initiated: "processing",
    ringing: "processing",
    "in-progress": "processing",
    in_progress: "processing",
    answered: "answered",
    connected: "answered",
    completed: "completed",
    done: "completed",
    busy: "failed",
    "no-answer": "failed",
    no_answer: "failed",
    failed: "failed",
    cancelled: "cancelled",
    canceled: "cancelled",
};

export class VoiceChannelAdapter extends ChannelAdapter {
    constructor({ database = db, executor = campaignExecutor } = {}) {
        super();
        this.db = database;
        this.executor = executor;
    }

    async validateConfiguration({ campaign, ownerId }) {
        const [agent] = await this.db.select().from(agents).where(and(
            eq(agents.id, campaign.agentId),
            eq(agents.userId, ownerId),
        )).limit(1);
        if (!agent)
            return { valid: false, errors: ["Voice agent is not available"] };

        const config = campaign.channelConfig || {};
        const standardId = campaign.phoneNumberId;
        const sipId = config.sipPhoneNumberId;
        const plivoId = config.plivoPhoneNumberId;
        let phone = null;
        let provider = "twilio";
        if (plivoId) {
            [phone] = await this.db.select().from(plivoPhoneNumbers).where(and(
                eq(plivoPhoneNumbers.id, plivoId),
                eq(plivoPhoneNumbers.userId, ownerId),
            )).limit(1);
            provider = "plivo";
        }
        else if (sipId) {
            [phone] = await this.db.select().from(sipPhoneNumbers).where(and(
                eq(sipPhoneNumbers.id, sipId),
                eq(sipPhoneNumbers.userId, ownerId),
            )).limit(1);
            provider = phone?.engine || "sip";
        }
        else {
            [phone] = await this.db.select().from(phoneNumbers).where(and(
                eq(phoneNumbers.id, standardId),
                or(eq(phoneNumbers.userId, ownerId), eq(phoneNumbers.isSystemPool, true)),
            )).limit(1);
        }
        if (!phone)
            return { valid: false, errors: ["Voice phone number is not available"] };

        const agentProvider = agent.telephonyProvider || "twilio";
        const compatible = agentProvider === "custom-voice-engine"
            || provider === "sip"
            || agentProvider.includes(provider)
            || provider.includes(agentProvider)
            || (provider === "twilio" && !agent.telephonyProvider);
        if (!compatible)
            return { valid: false, errors: ["Agent and phone provider are incompatible"] };
        return { valid: true, errors: [], context: { agent, phone, provider } };
    }

    async prepareRecipient({ recipient }) {
        const phone = recipient.phone.replace(/[^\d+]/g, "");
        if (!/^\+?[1-9]\d{6,14}$/.test(phone))
            throw new Error(`Invalid voice phone number: ${recipient.phone}`);
        return { ...recipient, phone };
    }

    async dispatch({ campaign }) {
        const result = await this.executor.executeCampaign(campaign.id);
        return {
            status: "processing",
            result: {
                provider: "voice",
                batchJobId: result?.batchJob?.id || result?.id || null,
            },
        };
    }

    async cancel({ campaign }) {
        const result = await this.executor.cancelCampaign(campaign.id);
        return { status: "cancelled", result };
    }

    async retry({ campaign }) {
        const result = await this.executor.retryCampaign(campaign.id);
        return { status: "processing", result };
    }

    async processWebhook({ payload }) {
        const providerReference = payload.callSid
            || payload.CallSid
            || payload.call_uuid
            || payload.conversation_id
            || payload.id;
        const providerStatus = payload.status
            || payload.CallStatus
            || payload.call_status
            || payload.event_type;
        return {
            providerReference,
            status: this.normalizeStatus(providerStatus),
            errorCode: payload.error_code || payload.ErrorCode || null,
            errorMessage: payload.error_message || payload.ErrorMessage || null,
            occurredAt: new Date(),
            result: payload,
        };
    }

    normalizeStatus(providerStatus) {
        return STATUS_MAP[String(providerStatus || "").toLowerCase()] || "processing";
    }
}
