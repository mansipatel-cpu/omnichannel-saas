import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignService, CampaignServiceError } from "../src/modules/campaigns/campaign.service.js";
import {
    campaignCreateSchema,
    voiceCampaignCreateSchema,
    whatsappCampaignCreateSchema,
    scheduleSchema,
} from "../src/modules/campaigns/campaign.validation.js";
import {
    toVoiceCampaign,
    toWhatsAppCampaign,
    toLegacyCampaign,
    toLegacyRecipient,
} from "../src/modules/campaigns/campaign.mapper.js";
import {
    voiceCreateInput,
    whatsappCreateInput,
} from "../src/modules/campaigns/campaign.compatibility.controller.js";
import { WhatsAppChannelAdapter } from "../src/modules/campaigns/adapters/whatsapp-channel.adapter.js";
import { VoiceChannelAdapter } from "../src/modules/campaigns/adapters/voice-channel.adapter.js";

describe("Unified Campaign Architecture & Phase 5 Test Suite", () => {
    describe("WhatsApp Campaigns", () => {
        it("should validate a valid WhatsApp campaign payload", () => {
            const validPayload = {
                name: "Black Friday Sale",
                channel_type: "whatsapp",
                template_id: "tmpl_bf_01",
                channel_config: {
                    channelId: "wa_channel_123",
                    language: "en_US",
                    templateVariables: { "1": "Customer" },
                },
                recipients: [
                    { phone: "+12025550143", name: "Alice" }
                ],
            };

            const parsed = campaignCreateSchema.parse(validPayload);
            expect(parsed.name).toBe("Black Friday Sale");
            expect(parsed.channel_type).toBe("whatsapp");
            expect(parsed.template_id).toBe("tmpl_bf_01");
            expect(parsed.channel_config.channelId).toBe("wa_channel_123");
        });

        it("should reject WhatsApp campaign when template_id is missing", () => {
            const invalidPayload = {
                name: "Invalid Campaign",
                channel_type: "whatsapp",
                channel_config: {
                    channelId: "wa_channel_123",
                },
            };

            expect(() => campaignCreateSchema.parse(invalidPayload)).toThrow();
        });

        it("should reject WhatsApp campaign when channel_config.channelId is missing", () => {
            const invalidPayload = {
                name: "Missing Channel ID",
                channel_type: "whatsapp",
                template_id: "tmpl_01",
                channel_config: {},
            };

            expect(() => campaignCreateSchema.parse(invalidPayload)).toThrow();
        });

        it("should translate legacy WhatsApp create input correctly", () => {
            const legacyBody = {
                name: "Summer Promotion",
                description: "50% off promo",
                campaignType: "broadcast",
                status: "active",
                templateId: "tmpl_summer_99",
                channelId: "wa_channel_abc",
                templateLanguage: "en_GB",
                variableMapping: { name: "{{firstName}}" },
                contactGroups: ["contact_1", "contact_2"],
            };

            const unifiedInput = whatsappCreateInput(legacyBody);
            expect(unifiedInput.channel_type).toBe("whatsapp");
            expect(unifiedInput.name).toBe("Summer Promotion");
            expect(unifiedInput.template_id).toBe("tmpl_summer_99");
            expect(unifiedInput.status).toBe("queued");
            expect(unifiedInput.channel_config.channelId).toBe("wa_channel_abc");
            expect(unifiedInput.channel_config.language).toBe("en_GB");
            expect(unifiedInput.channel_config.contactIds).toEqual(["contact_1", "contact_2"]);
        });

        it("should map unified campaign back to legacy WhatsApp response format", () => {
            const unifiedCampaign = {
                id: "camp_wa_01",
                userId: "tenant_user_1",
                name: "Promotional Blast",
                channelType: "whatsapp",
                campaignType: "broadcast",
                status: "queued",
                templateId: "tmpl_101",
                channelConfig: {
                    channelId: "chan_wa_1",
                    templateName: "promo_v1",
                    language: "en_US",
                    compatibilityStatus: "active",
                },
                statistics: {
                    recipientCount: 100,
                    sentCount: 95,
                    deliveredCount: 90,
                    readCount: 60,
                    failedCount: 5,
                },
                createdAt: new Date(),
            };

            const legacy = toWhatsAppCampaign(unifiedCampaign);
            expect(legacy.channel).toBe("whatsapp");
            expect(legacy.channelId).toBe("chan_wa_1");
            expect(legacy.status).toBe("active");
            expect(legacy.recipientCount).toBe(100);
            expect(legacy.deliveredCount).toBe(90);
        });

        it("should validate and prepare WhatsApp recipients with phone normalization", async () => {
            const adapter = new WhatsAppChannelAdapter();
            const recipient = {
                phone: "+1 (202) 555-0199",
                name: "John Doe",
                variables: { components: [{ type: "body", parameters: [] }] },
            };
            const campaign = {
                channelConfig: { language: "es_ES" },
            };

            const prepared = await adapter.prepareRecipient({ recipient, campaign });
            expect(prepared.phone).toBe("+12025550199");
            expect(prepared.language).toBe("es_ES");
            expect(prepared.components).toHaveLength(1);
        });

        it("should reject invalid WhatsApp phone numbers during recipient preparation", async () => {
            const adapter = new WhatsAppChannelAdapter();
            const recipient = { phone: "123", name: "Bad Number" };
            const campaign = { channelConfig: { language: "en_US" } };

            await expect(adapter.prepareRecipient({ recipient, campaign })).rejects.toThrow("Invalid WhatsApp phone number");
        });

        it("should validate WhatsApp configuration against channel status and template approval", async () => {
            const mockDb = {
                select: vi.fn(() => ({
                    from: vi.fn(() => ({
                        where: vi.fn(() => ({
                            limit: vi.fn(async () => [{ id: "chan_1", isActive: true }]),
                        })),
                    })),
                })),
            };

            const adapter = new WhatsAppChannelAdapter({ database: mockDb });
            const campaign = { channelConfig: { channelId: "chan_1" } };
            const approvedTemplate = { channelType: "whatsapp", status: "approved" };

            const validResult = await adapter.validateConfiguration({
                campaign,
                ownerId: "owner_1",
                template: approvedTemplate,
            });
            expect(validResult.valid).toBe(true);

            const unapprovedTemplate = { channelType: "whatsapp", status: "rejected" };
            const invalidResult = await adapter.validateConfiguration({
                campaign,
                ownerId: "owner_1",
                template: unapprovedTemplate,
            });
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors).toContain("WhatsApp template is not approved");
        });
    });

    describe("Voice Campaigns", () => {
        it("should validate a valid Voice campaign payload", () => {
            const validPayload = {
                name: "Automated Follow-up Calls",
                channel_type: "voice",
                agent_id: "agent_voice_99",
                phone_number_id: "phone_num_77",
                retry_enabled: true,
                channel_config: {
                    flowId: "flow_sales_01",
                    retry: {
                        maxAttempts: 3,
                        intervalMinutes: 30,
                    },
                },
            };

            const parsed = campaignCreateSchema.parse(validPayload);
            expect(parsed.name).toBe("Automated Follow-up Calls");
            expect(parsed.channel_type).toBe("voice");
            expect(parsed.agent_id).toBe("agent_voice_99");
            expect(parsed.phone_number_id).toBe("phone_num_77");
            expect(parsed.retry_enabled).toBe(true);
        });

        it("should reject Voice campaign when agent_id or phone_number_id is missing", () => {
            const missingAgent = {
                name: "Voice Test",
                channel_type: "voice",
                phone_number_id: "phone_num_77",
                channel_config: {},
            };
            expect(() => campaignCreateSchema.parse(missingAgent)).toThrow();

            const missingPhone = {
                name: "Voice Test",
                channel_type: "voice",
                agent_id: "agent_99",
                channel_config: {},
            };
            expect(() => campaignCreateSchema.parse(missingPhone)).toThrow();
        });

        it("should reject Voice campaign specifying both flowId and customScript", () => {
            const conflictingPayload = {
                name: "Conflicting Voice Config",
                channel_type: "voice",
                agent_id: "agent_voice_99",
                phone_number_id: "phone_num_77",
                channel_config: {
                    flowId: "flow_123",
                    customScript: "Hello, this is a test script.",
                },
            };

            expect(() => campaignCreateSchema.parse(conflictingPayload)).toThrow(
                /A voice campaign cannot use both flowId and customScript/
            );
        });

        it("should validate schedule calling window rules", () => {
            const validSchedule = {
                startTime: "09:00",
                endTime: "17:00",
                days: ["monday", "tuesday", "wednesday"],
                timezone: "America/New_York",
            };
            expect(scheduleSchema.parse(validSchedule)).toEqual(validSchedule);

            const invalidWindow = {
                startTime: "18:00",
                endTime: "09:00",
                days: ["monday"],
                timezone: "America/New_York",
            };
            expect(() => scheduleSchema.parse(invalidWindow)).toThrow(/Calling window must end after it starts/);
        });

        it("should translate legacy Voice create input correctly", () => {
            const legacyBody = {
                name: "Appointment Reminders",
                goal: "Confirm doctor appointments",
                type: "reminder",
                agentId: "agent_med_01",
                phoneNumberId: "phone_med_02",
                script: "Hello, please confirm your appointment tomorrow.",
                retryEnabled: true,
                retryMaxAttempts: 4,
                retryIntervalMinutes: 45,
                scheduleEnabled: true,
                scheduleTimeStart: "10:00",
                scheduleTimeEnd: "16:00",
                scheduleDays: ["monday", "friday"],
                scheduleTimezone: "America/Chicago",
            };

            const unifiedInput = voiceCreateInput(legacyBody);
            expect(unifiedInput.channel_type).toBe("voice");
            expect(unifiedInput.name).toBe("Appointment Reminders");
            expect(unifiedInput.description).toBe("Confirm doctor appointments");
            expect(unifiedInput.agent_id).toBe("agent_med_01");
            expect(unifiedInput.phone_number_id).toBe("phone_med_02");
            expect(unifiedInput.channel_config.customScript).toBe("Hello, please confirm your appointment tomorrow.");
            expect(unifiedInput.channel_config.retry.maxAttempts).toBe(4);
            expect(unifiedInput.channel_config.schedule.startTime).toBe("10:00");
        });

        it("should map unified campaign back to legacy Voice response format", () => {
            const unifiedCampaign = {
                id: "camp_voice_01",
                userId: "tenant_user_1",
                name: "Past Due Collections",
                channelType: "voice",
                campaignType: "collections",
                status: "draft",
                agentId: "agent_coll_1",
                phoneNumberId: "phone_coll_2",
                description: "Recover outstanding balances",
                channelConfig: {
                    flowId: "flow_coll_1",
                    retry: { maxAttempts: 5, intervalMinutes: 120 },
                },
                statistics: {
                    recipientCount: 50,
                    completedCount: 30,
                    successfulCount: 25,
                    failedCount: 5,
                },
            };

            const legacy = toVoiceCampaign(unifiedCampaign);
            expect(legacy.channel).toBe("voice");
            expect(legacy.status).toBe("pending"); // "draft" maps to legacy "pending"
            expect(legacy.goal).toBe("Recover outstanding balances");
            expect(legacy.flowId).toBe("flow_coll_1");
            expect(legacy.retryMaxAttempts).toBe(5);
            expect(legacy.totalContacts).toBe(50);
            expect(legacy.completedCalls).toBe(30);
        });

        it("should dispatch voice campaign through executor", async () => {
            const mockExecutor = {
                executeCampaign: vi.fn(async (campaignId) => ({ batchJob: { id: `batch_${campaignId}` } })),
                cancelCampaign: vi.fn(async () => ({ success: true })),
                retryCampaign: vi.fn(async () => ({ retried: true })),
            };

            const adapter = new VoiceChannelAdapter({ executor: mockExecutor });
            const result = await adapter.dispatch({ campaign: { id: "camp_v1" } });

            expect(mockExecutor.executeCampaign).toHaveBeenCalledWith("camp_v1");
            expect(result.status).toBe("processing");
            expect(result.result.batchJobId).toBe("batch_camp_v1");
        });
    });

    describe("Tenant Isolation", () => {
        const TENANT_A = "tenant_org_A";
        const TENANT_B = "tenant_org_B";

        it("should reject campaign creation when contacts belong to another tenant", async () => {
            const mockRepository = {
                findRecipientsByIds: vi.fn(async (ownerId, contactIds) => {
                    // Simulates only returning contacts that match the ownerId
                    if (ownerId === TENANT_A) {
                        return [{ id: "contact_A1", phone: "+12025550100" }];
                    }
                    return [];
                }),
                findTemplate: vi.fn(async () => ({ id: "tmpl_1", channelType: "whatsapp", status: "approved" })),
            };

            const service = new CampaignService({
                repository: mockRepository,
                adapters: {
                    get: () => ({
                        validateConfiguration: async () => ({ valid: true, context: {} }),
                        prepareRecipient: async ({ recipient }) => recipient,
                    }),
                },
                database: {},
            });

            const input = {
                name: "Isolated Campaign",
                channel_type: "whatsapp",
                template_id: "tmpl_1",
                channel_config: {
                    channelId: "wa_1",
                    contactIds: ["contact_A1", "contact_B1"], // B1 does not belong to Tenant A
                },
            };

            await expect(service.create({
                ownerId: TENANT_A,
                actorId: "actor_1",
                input,
            })).rejects.toThrow("One or more contacts do not belong to this tenant");
        });

        it("should reject campaign creation when template belongs to another tenant", async () => {
            const mockRepository = {
                findRecipientsByIds: vi.fn(async () => []),
                findTemplate: vi.fn(async (ownerId, templateId) => {
                    // Template tmpl_foreign does not belong to TENANT_A
                    return null;
                }),
            };

            const service = new CampaignService({
                repository: mockRepository,
                adapters: {},
                database: {},
            });

            const input = {
                name: "Foreign Template Test",
                channel_type: "whatsapp",
                template_id: "tmpl_foreign",
                channel_config: { channelId: "wa_1" },
            };

            await expect(service.create({
                ownerId: TENANT_A,
                actorId: "actor_1",
                input,
            })).rejects.toThrow("Template does not belong to this tenant");
        });

        it("should return 404 when querying a campaign owned by a different tenant", async () => {
            const mockRepository = {
                findById: vi.fn(async (ownerId, id) => {
                    // Only returns if ownerId matches the campaign's user
                    if (ownerId === TENANT_A && id === "camp_A") {
                        return { id: "camp_A", userId: TENANT_A };
                    }
                    return null;
                }),
            };

            const service = new CampaignService({
                repository: mockRepository,
            });

            // TENANT_B trying to access TENANT_A's campaign
            await expect(service.get(TENANT_B, "camp_A")).rejects.toThrow("Campaign not found");
        });

        it("should prevent updating another tenant's campaign", async () => {
            const mockRepository = {
                findById: vi.fn(async (ownerId, id) => null), // Not found for TENANT_B
                update: vi.fn(),
            };

            const service = new CampaignService({ repository: mockRepository });

            await expect(service.update({
                ownerId: TENANT_B,
                actorId: "actor_b",
                id: "camp_A",
                input: { name: "Hijacked Name" },
            })).rejects.toThrow("Campaign not found");

            expect(mockRepository.update).not.toHaveBeenCalled();
        });

        it("should prevent deleting another tenant's campaign", async () => {
            const mockRepository = {
                softDelete: vi.fn(async (ownerId, id) => null),
            };

            const service = new CampaignService({ repository: mockRepository });

            await expect(service.remove({
                ownerId: TENANT_B,
                actorId: "actor_b",
                id: "camp_A",
            })).rejects.toThrow("Campaign not found");
        });
    });

    describe("Webhook Idempotency and Retry", () => {
        it("should parse and normalize WhatsApp webhook payload deterministically", async () => {
            const adapter = new WhatsAppChannelAdapter();
            const webhookPayload = {
                statuses: [
                    {
                        id: "wamid.HBgLMTIwMjU1NTAxOTkVAgASGBQz",
                        status: "delivered",
                        timestamp: "1720000000",
                        recipient_id: "12025550199",
                    },
                ],
            };

            const result1 = await adapter.processWebhook({ payload: webhookPayload });
            const result2 = await adapter.processWebhook({ payload: webhookPayload });

            expect(result1.providerReference).toBe("wamid.HBgLMTIwMjU1NTAxOTkVAgASGBQz");
            expect(result1.status).toBe("delivered");
            expect(result1).toEqual(result2); // Idempotent output
        });

        it("should parse and normalize Voice webhook payloads across different provider keys", async () => {
            const adapter = new VoiceChannelAdapter();

            // Twilio format
            const twilioPayload = {
                CallSid: "CA1234567890abcdef",
                CallStatus: "completed",
            };
            const twilioResult = await adapter.processWebhook({ payload: twilioPayload });
            expect(twilioResult.providerReference).toBe("CA1234567890abcdef");
            expect(twilioResult.status).toBe("completed");

            // Plivo / Generic format
            const plivoPayload = {
                call_uuid: "plivo-uuid-98765",
                call_status: "in-progress",
            };
            const plivoResult = await adapter.processWebhook({ payload: plivoPayload });
            expect(plivoResult.providerReference).toBe("plivo-uuid-98765");
            expect(plivoResult.status).toBe("processing");
        });

        it("should reject campaign retry when retryEnabled is false", async () => {
            const mockRepository = {
                findById: vi.fn(async () => ({
                    id: "camp_no_retry",
                    userId: "owner_1",
                    retryEnabled: false,
                    status: "failed",
                })),
            };

            const service = new CampaignService({ repository: mockRepository });

            await expect(service.retry({
                ownerId: "owner_1",
                actorId: "actor_1",
                id: "camp_no_retry",
            })).rejects.toThrow("Retry is not enabled for this campaign");
        });

        it("should enqueue campaign retry with action: 'retry' when retryEnabled is true", async () => {
            const queuedCampaign = {
                id: "camp_retry_ok",
                userId: "owner_1",
                retryEnabled: true,
                status: "queued",
                channelType: "whatsapp",
            };

            const mockRepository = {
                findById: vi.fn(async () => ({
                    id: "camp_retry_ok",
                    userId: "owner_1",
                    retryEnabled: true,
                    status: "failed",
                })),
                update: vi.fn(async () => queuedCampaign),
            };

            const mockEnqueue = vi.fn(async () => undefined);
            const mockAudit = vi.fn();

            const service = new CampaignService({
                repository: mockRepository,
                enqueue: mockEnqueue,
            });
            service.audit = mockAudit;

            const result = await service.retry({
                ownerId: "owner_1",
                actorId: "actor_1",
                id: "camp_retry_ok",
            });

            expect(mockRepository.update).toHaveBeenCalledWith(
                "owner_1",
                "camp_retry_ok",
                { status: "queued" }
            );
            expect(mockEnqueue).toHaveBeenCalledWith(queuedCampaign, { action: "retry" });
            expect(result.status).toBe("queued");
        });

        it("should map recipient details cleanly for legacy consumers without mutation", () => {
            const unifiedRecipient = {
                id: "rec_1",
                campaignId: "camp_1",
                phone: "+12025550199",
                name: "Johnathan Smith",
                status: "sent",
                attemptCount: 2,
                providerReference: "msg_provider_abc",
                variables: { promoCode: "DISCOUNT20" },
                result: { lastAttemptAt: "2026-10-08T12:00:00Z" },
            };

            const legacyWa = toLegacyRecipient(unifiedRecipient, "whatsapp");
            expect(legacyWa.whatsappMessageId).toBe("msg_provider_abc");
            expect(legacyWa.templateParams).toEqual({ promoCode: "DISCOUNT20" });
            expect(legacyWa.retryCount).toBe(1);

            const legacyVoice = toLegacyRecipient(unifiedRecipient, "voice");
            expect(legacyVoice.firstName).toBe("Johnathan");
            expect(legacyVoice.lastName).toBe("Smith");
            expect(legacyVoice.customFields).toEqual({ promoCode: "DISCOUNT20" });
            expect(legacyVoice.lastAttemptAt).toBe("2026-10-08T12:00:00Z");
        });
    });
});
