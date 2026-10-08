const value = (object, key, fallback = null) => object?.[key] ?? fallback;

export function toVoiceCampaign(campaign) {
    const config = campaign.channelConfig || {};
    const retry = config.retry || {};
    const schedule = config.schedule || {};
    const stats = campaign.statistics || {};
    return {
        ...campaign,
        channel: "voice",
        status: campaign.status === "draft" ? "pending" : campaign.status,
        type: campaign.campaignType || "outbound",
        goal: campaign.description,
        script: value(config, "customScript"),
        flowId: value(config, "flowId"),
        voiceId: value(config, "voiceId"),
        sipPhoneNumberId: value(config, "sipPhoneNumberId"),
        plivoPhoneNumberId: value(config, "plivoPhoneNumberId"),
        scheduledFor: campaign.scheduledAt,
        scheduleEnabled: Boolean(config.schedule),
        scheduleTimeStart: value(schedule, "startTime"),
        scheduleTimeEnd: value(schedule, "endTime"),
        scheduleDays: value(schedule, "days", []),
        scheduleTimezone: value(schedule, "timezone", campaign.timezone),
        batchJobId: value(config, "batchJobId"),
        batchJobStatus: value(config, "batchJobStatus"),
        retryMaxAttempts: value(retry, "maxAttempts", 3),
        retryIntervalMinutes: value(retry, "intervalMinutes", 60),
        retryOnNoAnswer: value(retry, "onNoAnswer", true),
        retryOnBusy: value(retry, "onBusy", false),
        retryOnFailed: value(retry, "onFailed", false),
        currentRetryPass: value(retry, "currentPass", 0),
        batchJobHistory: value(retry, "history", []),
        totalContacts: value(stats, "recipientCount", 0),
        completedCalls: value(stats, "completedCount", 0),
        successfulCalls: value(stats, "successfulCount", 0),
        failedCalls: value(stats, "failedCount", 0),
        errorCode: value(stats, "errorCode"),
        errorMessage: value(stats, "errorMessage"),
        config,
    };
}

export function toWhatsAppCampaign(campaign) {
    const config = campaign.channelConfig || {};
    const stats = campaign.statistics || {};
    const compatibilityStatus = ["queued", "running"].includes(campaign.status)
        ? (config.compatibilityStatus || "active")
        : campaign.status;
    return {
        ...campaign,
        channel: "whatsapp",
        channelId: value(config, "channelId"),
        campaignType: campaign.campaignType,
        type: value(config, "type", "marketing"),
        apiType: value(config, "apiType", "mm_lite"),
        templateName: value(config, "templateName"),
        templateLanguage: value(config, "language", "en_US"),
        variableMapping: value(config, "templateVariables", {}),
        contactGroups: value(config, "contactIds", []),
        audienceType: value(config, "audienceType", "all"),
        platform: value(config, "platform"),
        csvData: value(config, "csvData", []),
        apiKey: value(config, "apiKey"),
        apiEndpoint: value(config, "apiEndpoint"),
        status: compatibilityStatus,
        recipientCount: value(stats, "recipientCount", 0),
        sentCount: value(stats, "sentCount", 0),
        deliveredCount: value(stats, "deliveredCount", 0),
        readCount: value(stats, "readCount", 0),
        repliedCount: value(stats, "repliedCount", 0),
        failedCount: value(stats, "failedCount", 0),
        populationStartedAt: campaign.startedAt,
    };
}

export function toLegacyCampaign(campaign, channelType = campaign?.channelType) {
    if (!campaign)
        return campaign;
    return channelType === "whatsapp"
        ? toWhatsAppCampaign(campaign)
        : toVoiceCampaign(campaign);
}

export function toLegacyRecipient(recipient, channelType) {
    if (channelType === "whatsapp") {
        return {
            ...recipient,
            whatsappMessageId: recipient.providerReference,
            templateParams: recipient.variables || {},
            retryCount: Math.max((recipient.attemptCount || 0) - 1, 0),
        };
    }
    const [firstName = "", ...lastParts] = (recipient.name || "").trim().split(/\s+/);
    return {
        ...recipient,
        firstName,
        lastName: lastParts.join(" ") || null,
        customFields: recipient.variables || {},
        lastAttemptAt: recipient.result?.lastAttemptAt || null,
        nextRetryAt: recipient.result?.nextRetryAt || null,
    };
}

export function toWhatsAppTemplate(template) {
    const content = template.content || {};
    return {
        ...template,
        channelId: content.channelId || null,
        header: content.header || null,
        body: content.body || "",
        footer: content.footer || null,
        buttons: content.buttons || [],
        variables: content.variables || [],
        rejectionReason: content.rejectionReason || null,
        mediaType: content.mediaType || "text",
        mediaUrl: content.mediaUrl || null,
        mediaHandle: content.mediaHandle || null,
        carouselCards: content.carouselCards || [],
        whatsappTemplateId: template.providerTemplateId,
        usage_count: content.usageCount || 0,
        headerType: content.headerType || null,
        bodyVariables: content.bodyVariables || null,
    };
}
