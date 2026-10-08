import { and, eq } from "drizzle-orm";
import { channels } from "@shared/whatsapp-schema";
import { db } from "../../../config/database";
import { WhatsAppApiService } from "../../../integrations/whatsapp/api";
import { ChannelAdapter } from "./channel-adapter";

const STATUS_MAP = {
    accepted: "sent",
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
    deleted: "cancelled",
};

export class WhatsAppChannelAdapter extends ChannelAdapter {
    constructor({ database = db, provider = WhatsAppApiService } = {}) {
        super();
        this.db = database;
        this.provider = provider;
    }

    async getOwnedChannel(ownerId, channelId) {
        const [channel] = await this.db.select().from(channels).where(and(
            eq(channels.id, channelId),
            eq(channels.createdBy, ownerId),
        )).limit(1);
        return channel;
    }

    async validateConfiguration({ campaign, ownerId, template }) {
        const channel = await this.getOwnedChannel(ownerId, campaign.channelConfig.channelId);
        if (!channel || !channel.isActive)
            return { valid: false, errors: ["WhatsApp channel is not active"] };
        if (!template || template.channelType !== "whatsapp")
            return { valid: false, errors: ["WhatsApp template is not available"] };
        const approved = (template.providerStatus || template.status || "").toLowerCase() === "approved";
        if (!approved)
            return { valid: false, errors: ["WhatsApp template is not approved"] };
        return { valid: true, errors: [], context: { channel, template } };
    }

    async prepareRecipient({ recipient, campaign }) {
        const phone = recipient.phone.replace(/[^\d+]/g, "");
        if (!/^\+?[1-9]\d{6,14}$/.test(phone))
            throw new Error(`Invalid WhatsApp phone number: ${recipient.phone}`);
        return {
            ...recipient,
            phone,
            components: recipient.variables?.components || [],
            language: campaign.channelConfig.language || "en_US",
        };
    }

    async dispatch({ campaign, recipient, context }) {
        const response = await this.provider.sendTemplateMessage(
            context.channel,
            recipient.phone,
            campaign.channelConfig.templateName || context.template.name,
            recipient.components || [],
            recipient.language,
            campaign.channelConfig.type !== "transactional",
        );
        return {
            providerReference: response.messages?.[0]?.id || null,
            status: this.normalizeStatus(response.messages?.[0]?.message_status || "sent"),
            result: { provider: "meta", sentVia: response._sentVia || "cloud_api" },
        };
    }

    async cancel() {
        return { status: "cancelled" };
    }

    async retry(args) {
        return this.dispatch(args);
    }

    async processWebhook({ payload }) {
        const status = payload.statuses?.[0] || payload;
        return {
            providerReference: status.id || status.message_id,
            status: this.normalizeStatus(status.status),
            errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : null,
            errorMessage: status.errors?.[0]?.title || status.errors?.[0]?.message || null,
            occurredAt: status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date(),
            result: status,
        };
    }

    normalizeStatus(providerStatus) {
        return STATUS_MAP[String(providerStatus || "").toLowerCase()] || "processing";
    }
}
