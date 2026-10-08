import { z } from "zod";

export const CAMPAIGN_CHANNEL_TYPES = ["whatsapp", "voice"];
export const CAMPAIGN_STATUSES = [
    "draft",
    "scheduled",
    "queued",
    "running",
    "paused",
    "completed",
    "failed",
    "cancelled",
    "deleted",
];
export const RECIPIENT_STATUSES = [
    "pending",
    "queued",
    "processing",
    "sent",
    "delivered",
    "read",
    "answered",
    "completed",
    "failed",
    "skipped",
    "cancelled",
];

const nullableId = z.string().trim().min(1).nullable().optional();
const optionalTimestamp = z.coerce.date().nullable().optional();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");
const daySchema = z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]);

function isValidTimezone(timezone) {
    try {
        Intl.DateTimeFormat("en-US", { timeZone: timezone });
        return true;
    }
    catch {
        return false;
    }
}

export const scheduleSchema = z.object({
    startTime: timeSchema,
    endTime: timeSchema,
    days: z.array(daySchema).min(1),
    timezone: z.string().refine(isValidTimezone, "Invalid IANA timezone"),
}).superRefine((schedule, ctx) => {
    if (schedule.startTime >= schedule.endTime) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endTime"],
            message: "Calling window must end after it starts",
        });
    }
});

export const whatsappChannelConfigSchema = z.object({
    channelId: z.string().trim().min(1),
    language: z.string().trim().min(2).default("en_US"),
    templateVariables: z.record(z.unknown()).default({}),
    apiType: z.string().trim().optional(),
    templateName: z.string().trim().optional(),
    audienceType: z.string().trim().optional(),
}).passthrough();

export const voiceChannelConfigSchema = z.object({
    flowId: nullableId,
    customScript: z.string().nullable().optional(),
    voiceId: nullableId,
    sipPhoneNumberId: nullableId,
    plivoPhoneNumberId: nullableId,
    schedule: scheduleSchema.nullable().optional(),
    retry: z.object({
        maxAttempts: z.number().int().min(1).max(20).default(3),
        intervalMinutes: z.number().int().min(1).max(10080).default(60),
        onNoAnswer: z.boolean().default(true),
        onBusy: z.boolean().default(false),
        onFailed: z.boolean().default(false),
    }).partial().optional(),
}).passthrough().superRefine((config, ctx) => {
    if (config.flowId && config.customScript?.trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["customScript"],
            message: "A voice campaign cannot use both flowId and customScript",
        });
    }
});

const commonCampaignFields = {
    name: z.string().trim().min(1, "Name is required").max(255),
    description: z.string().max(5000).nullable().optional(),
    campaign_type: z.string().trim().min(1).default("outbound"),
    status: z.enum(CAMPAIGN_STATUSES).default("draft"),
    group_id: nullableId,
    scheduled_at: optionalTimestamp,
    timezone: z.string().refine(isValidTimezone, "Invalid IANA timezone").nullable().optional(),
    retry_enabled: z.boolean().default(false),
    recipients: z.array(z.object({
        contact_id: nullableId,
        phone: z.string().trim().min(7).max(32),
        name: z.string().trim().max(255).nullable().optional(),
        email: z.string().email().nullable().optional(),
        variables: z.record(z.unknown()).default({}),
    })).default([]),
};

export const whatsappCampaignCreateSchema = z.object({
    ...commonCampaignFields,
    channel_type: z.literal("whatsapp"),
    template_id: z.string().trim().min(1, "template_id is required"),
    agent_id: z.null().optional(),
    phone_number_id: nullableId,
    channel_config: whatsappChannelConfigSchema,
});

export const voiceCampaignCreateSchema = z.object({
    ...commonCampaignFields,
    channel_type: z.literal("voice"),
    template_id: nullableId,
    agent_id: z.string().trim().min(1, "agent_id is required"),
    phone_number_id: z.string().trim().min(1, "phone_number_id is required"),
    channel_config: voiceChannelConfigSchema,
});

export const campaignCreateSchema = z.discriminatedUnion("channel_type", [
    whatsappCampaignCreateSchema,
    voiceCampaignCreateSchema,
]).superRefine((campaign, ctx) => {
    if (campaign.status === "scheduled" && !campaign.scheduled_at) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scheduled_at"],
            message: "scheduled_at is required for scheduled campaigns",
        });
    }
});

export const campaignUpdateSchema = z.object({
    name: commonCampaignFields.name.optional(),
    description: commonCampaignFields.description,
    campaign_type: commonCampaignFields.campaign_type.optional(),
    status: z.enum(CAMPAIGN_STATUSES).optional(),
    template_id: nullableId,
    group_id: nullableId,
    agent_id: nullableId,
    phone_number_id: nullableId,
    scheduled_at: optionalTimestamp,
    timezone: commonCampaignFields.timezone,
    retry_enabled: z.boolean().optional(),
    channel_config: z.record(z.unknown()).optional(),
}).strict();

export const campaignRecipientCreateSchema = z.object({
    contact_id: nullableId,
    phone: z.string().trim().min(7).max(32),
    name: z.string().trim().max(255).nullable().optional(),
    email: z.string().email().nullable().optional(),
    status: z.enum(RECIPIENT_STATUSES).default("pending"),
    variables: z.record(z.unknown()).default({}),
});

export const campaignListQuerySchema = z.object({
    channel_type: z.enum(CAMPAIGN_CHANNEL_TYPES).optional(),
    channel_id: z.string().optional(),
    status: z.enum(CAMPAIGN_STATUSES).optional(),
    created_by: z.string().optional(),
    template_id: z.string().optional(),
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
    deleted: z.enum(["exclude", "include", "only"]).default("exclude"),
    search: z.string().trim().max(255).optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(200).default(25),
    sort: z.enum([
        "created_at",
        "-created_at",
        "updated_at",
        "-updated_at",
        "name",
        "-name",
        "scheduled_at",
        "-scheduled_at",
    ]).default("-created_at"),
}).superRefine((query, ctx) => {
    if (query.date_from && query.date_to && query.date_from > query.date_to) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["date_to"],
            message: "date_to must not be before date_from",
        });
    }
});
