/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { storage } from "../storage/whatsappStorage";
import { aiSettings, campaigns, messageQueue, messages, webhookConfigs, whatsappBusinessAccountsConfig, sites, } from "@shared/whatsapp-schema";
import { searchTrainingData } from "../services/whatsappTraining.service";
import { AppError, asyncHandler } from "../middleware/whatsappError";
import crypto from "crypto";
import { triggerService } from "../services/whatsappAutomationExecution.service";
import { WhatsAppApiService } from "../integrations/whatsapp/api";
import { whatsappDb as db } from "../config/database";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { triggerThrottledNotification } from "../services/whatsappNotification.service";
import { cacheSetNX } from "../services/whatsappRedis";
import { CodVerificationService } from "../services/whatsappCodVerification.service";
import { ShopifyCodService } from "../services/whatsappShopifyCod.service";
import { WooCommerceCodService } from "../services/whatsappWoocommerceCod.service";
// ---------------------------------------------------------------------------
// Webhook deduplication
// Prevents duplicate processing when Meta delivers the same event twice.
// Primary store : Redis SETNX with TTL (cross-instance, low-latency).
// Fallback store: PostgreSQL `webhook_dedup` table — also cross-instance
//                 (no in-process Map, so multi-replica deployments stay
//                 consistent even when Redis is unavailable).
// ---------------------------------------------------------------------------
const DEDUP_TTL_SEC = 60;
// Best-effort cleanup of expired DB-fallback rows. Cheap because the
// `webhook_dedup_created_at_idx` index makes this an indexed range delete.
let _lastDedupSweepAt = 0;
const DEDUP_SWEEP_INTERVAL_MS = 60_000;
async function _sweepExpiredDedupRows() {
    const now = Date.now();
    if (now - _lastDedupSweepAt < DEDUP_SWEEP_INTERVAL_MS)
        return;
    _lastDedupSweepAt = now;
    try {
        await db.execute(sql `DELETE FROM webhook_dedup WHERE created_at < NOW() - (${DEDUP_TTL_SEC} || ' seconds')::interval`);
    }
    catch {
        /* swept opportunistically; safe to ignore */
    }
}
async function _isAlreadyProcessedDb(wamid, ttlSec) {
    // Atomic, TTL-aware dedup using a single round-trip upsert:
    //   - new row inserted                 → we won the slot (RETURNING yields 1 row)
    //   - existing row but older than TTL  → UPDATE refreshes created_at
    //                                        (RETURNING yields 1 row → we own it)
    //   - existing row inside TTL          → UPDATE WHERE skipped
    //                                        (RETURNING yields 0 rows → duplicate)
    // This avoids the stale-row race where a sweeper deletion has not yet
    // run but the previous record is already past its TTL.
    try {
        const result = await db.execute(sql `
      INSERT INTO webhook_dedup (wamid, created_at)
      VALUES (${wamid}, NOW())
      ON CONFLICT (wamid) DO UPDATE
        SET created_at = NOW()
        WHERE webhook_dedup.created_at < NOW() - (${ttlSec} || ' seconds')::interval
      RETURNING wamid
    `);
        const ownedRows = result?.rowCount ?? result?.rows?.length ?? 0;
        void _sweepExpiredDedupRows();
        return ownedRows === 0;
    }
    catch (err) {
        console.error(`[Webhook] DB dedup failed for ${wamid}:`, err.message);
        // If even the DB is down, fail OPEN (process the webhook). Better to
        // double-process than to silently drop legitimate events.
        return false;
    }
}
async function _isAlreadyProcessed(wamid, ttlSec = DEDUP_TTL_SEC) {
    // Try Redis first — works across multiple server instances and is fast.
    const acquired = await cacheSetNX(`wh:dedup:${wamid}`, "1", ttlSec);
    if (acquired === true)
        return false; // first time we see this wamid
    if (acquired === false)
        return true; // already processed within TTL
    // acquired === null: Redis unavailable — fall back to the shared DB store.
    return _isAlreadyProcessedDb(wamid, ttlSec);
}
export const getWebhookConfigs = asyncHandler(async (req, res) => {
    const user = req.session?.user;
    if (!user)
        return res.status(401).json({ error: 'Not authenticated' });
    if (user.role === 'superadmin') {
        const configs = await storage.getWebhookConfigs();
        return res.json(configs);
    }
    const ownerId = user.role === 'team' ? user.createdBy : user.id;
    const channels = await storage.getChannelsByUserId(ownerId);
    const channelIds = channels.map((ch) => ch.id);
    const allConfigs = await storage.getWebhookConfigs();
    const filteredConfigs = allConfigs.filter((config) => config.channelId && channelIds.includes(config.channelId));
    res.json(filteredConfigs);
});
export const getWebhookConfigsByChannelId = asyncHandler(async (req, res) => {
    const channelId = req.params.id;
    const user = req.session?.user;
    if (!user)
        return res.status(401).json({ error: 'Not authenticated' });
    if (user.role !== 'superadmin') {
        const ownerId = user.role === 'team' ? user.createdBy : user.id;
        const channels = await storage.getChannelsByUserId(ownerId);
        const channelIds = channels.map((ch) => ch.id);
        if (!channelIds.includes(channelId)) {
            return res.status(403).json({ error: 'Access denied to this channel' });
        }
    }
    console.log("Fetching webhook configs for channel ID:", channelId);
    const configs = await db.select().from(webhookConfigs).where(eq(webhookConfigs.channelId, channelId));
    res.json(configs);
});
export const getGlobalWebhookUrl = asyncHandler(async (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "https";
    const host = req.get("host");
    const webhookUrl = `${protocol}://${host}/webhook/global`;
    res.json({ webhookUrl });
});
export const createWebhookConfig = asyncHandler(async (req, res) => {
    const user = req.session?.user;
    if (!user)
        return res.status(401).json({ error: 'Not authenticated' });
    if (user.role !== 'superadmin')
        return res.status(403).json({ error: 'Only superadmin can configure webhooks' });
    const { verifyToken, events } = req.body;
    if (!verifyToken) {
        throw new AppError(400, "Verify token is required");
    }
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "https";
    const host = req.get("host");
    const webhookUrl = `${protocol}://${host}/webhook/global`;
    const config = await storage.createWebhookConfig({
        webhookUrl,
        verifyToken,
        events: events || [
            "messages",
            "message_status",
            "message_template_status_update",
        ],
        isActive: true,
        channelId: null,
    });
    res.status(201).json(config);
});
export const updateWebhookConfig = asyncHandler(async (req, res) => {
    const user = req.session?.user;
    if (!user)
        return res.status(401).json({ error: 'Not authenticated' });
    if (user.role !== 'superadmin')
        return res.status(403).json({ error: 'Only superadmin can configure webhooks' });
    const { id } = req.params;
    const updates = req.body;
    const config = await storage.updateWebhookConfig(id, updates);
    if (!config) {
        throw new AppError(404, "Webhook config not found");
    }
    res.json(config);
});
export const deleteWebhookConfig = asyncHandler(async (req, res) => {
    const user = req.session?.user;
    if (!user)
        return res.status(401).json({ error: 'Not authenticated' });
    if (user.role !== 'superadmin')
        return res.status(403).json({ error: 'Only superadmin can configure webhooks' });
    const { id } = req.params;
    const deleted = await storage.deleteWebhookConfig(id);
    if (!deleted) {
        throw new AppError(404, "Webhook config not found");
    }
    res.json({ success: true, message: "Webhook config deleted" });
});
export const testWebhook = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const config = await storage.getWebhookConfig(id);
    if (!config) {
        throw new AppError(404, "Webhook config not found");
    }
    // Build a benign test payload. `messages`/`statuses` are intentionally
    // omitted so handleMessageChange short-circuits and nothing is written
    // to conversations/messages tables — this is purely an in-process
    // exercise of the verification + dispatch path.
    const testPayload = {
        object: "whatsapp_business_account",
        entry: [
            {
                id: "test-entry",
                changes: [
                    {
                        value: {
                            messaging_product: "whatsapp",
                            metadata: {
                                display_phone_number: "15550555555",
                                phone_number_id: "test-phone-id",
                            },
                            test: true,
                        },
                        field: "messages",
                    },
                ],
            },
        ],
    };
    const rawBody = Buffer.from(JSON.stringify(testPayload), "utf8");
    // Compute X-Hub-Signature-256 using the configured Meta App Secret so
    // the synthesized request takes the same code path as a real Meta
    // delivery. When no secret is configured, omit the header — that
    // surfaces the production fail-closed branch in the toast.
    const wabaConfig = await db.query.whatsappBusinessAccountsConfig.findFirst({
        where: ne(whatsappBusinessAccountsConfig.appSecret, ""),
    });
    const configuredSecret = wabaConfig?.appSecret?.trim() || "";
    const headers = { "content-type": "application/json" };
    if (configuredSecret) {
        headers["x-hub-signature-256"] =
            "sha256=" +
                crypto.createHmac("sha256", configuredSecret).update(rawBody).digest("hex");
    }
    // Synthesize a request and a capturing response shim, then invoke
    // handleWebhook directly in-process. This avoids any network
    // round-trip — important behind nginx on a VPS where the container
    // cannot hairpin its own public TLS endpoint, which is what was
    // causing the production 500 in ~20ms.
    const fakeReq = {
        method: "POST",
        query: {},
        body: testPayload,
        rawBody,
        headers,
        params: {},
        session: req.session,
    };
    let capturedStatus = 200;
    let capturedBody = null;
    const fakeRes = {
        statusCode: 200,
        headersSent: false,
        status(code) {
            capturedStatus = code;
            this.statusCode = code;
            return this;
        },
        json(obj) {
            capturedBody = obj;
            this.headersSent = true;
            return this;
        },
        send(data) {
            capturedBody = data;
            this.headersSent = true;
            return this;
        },
        sendStatus(code) {
            capturedStatus = code;
            this.statusCode = code;
            this.headersSent = true;
            return this;
        },
        setHeader() {
            return this;
        },
        getHeader() {
            return undefined;
        },
        end() {
            this.headersSent = true;
            return this;
        },
    };
    let handlerError = null;
    try {
        await handleWebhookInternal(fakeReq, fakeRes);
    }
    catch (err) {
        handlerError = err instanceof Error ? err : new Error(String(err));
    }
    if (handlerError) {
        throw new AppError(500, `Test webhook handler threw: ${handlerError.message}`);
    }
    if (!fakeRes.headersSent) {
        throw new AppError(500, "Test webhook handler completed without sending a response");
    }
    if (capturedStatus >= 200 && capturedStatus < 300) {
        const message = configuredSecret
            ? "Test delivered in-process (X-Hub-Signature-256 verified against configured Meta App Secret)."
            : process.env.NODE_ENV === "production"
                ? "Test delivered in-process. Note: no Meta App Secret is configured, so real Meta deliveries will be rejected in production."
                : "Test delivered in-process. No Meta App Secret configured (signature check skipped in non-production).";
        return res.json({ success: true, message, status: capturedStatus });
    }
    const errMsg = (capturedBody && (capturedBody.error || capturedBody.message)) ||
        `HTTP ${capturedStatus}`;
    const hint = capturedBody && capturedBody.hint ? ` — ${capturedBody.hint}` : "";
    throw new AppError(400, `Test webhook failed (${capturedStatus}): ${errMsg}${hint}`);
});
// Verify Meta's X-Hub-Signature-256 header against the raw request body
// using the configured app secret. Returns `true` when the signature is
// present, well-formed, and matches; `false` otherwise.
function verifyMetaSignature(header, rawBody, appSecret) {
    if (!header || Array.isArray(header) || !rawBody || !appSecret)
        return false;
    const [algo, provided] = header.split("=");
    if (algo !== "sha256" || !provided)
        return false;
    const expected = crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");
    try {
        const a = Buffer.from(provided, "hex");
        const b = Buffer.from(expected, "hex");
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    }
    catch {
        return false;
    }
}
// Internal awaitable webhook processor. Exposed separately from the
// asyncHandler-wrapped route export so that in-process callers (e.g.
// the Test Webhook button) can `await` it directly and observe
// completion. The asyncHandler wrapper from @diploy/core does not
// return the inner Promise, so awaiting the wrapped export resolves
// immediately and would cause callers to read stale response state.
export async function handleWebhookInternal(req, res) {
    console.log("========== WEBHOOK HIT ==========");
    console.log("METHOD:", req.method);
    console.log("URL:", req.originalUrl);
    console.log("BODY:", JSON.stringify(req.body, null, 2));
    const { "hub.mode": mode, "hub.challenge": challenge, "hub.verify_token": verifyToken, } = req.query;
    const allConfigs = await storage.getWebhookConfigs();
    const activeConfig = allConfigs.find((c) => c.isActive);
    if (mode && challenge) {
        if (mode === "subscribe" &&
            activeConfig &&
            verifyToken === activeConfig.verifyToken) {
            console.log("Webhook verified successfully");
            await storage.updateWebhookConfig(activeConfig.id, {
                lastPingAt: new Date(),
            });
            return res.send(challenge);
        }
        throw new AppError(403, "Verification failed");
    }
    // X-Hub-Signature-256 verification for POST deliveries from Meta.
    // If an app secret is configured on the matched webhook config, the
    // signature header MUST be present and valid; otherwise we respond
    // 401. When no app secret is configured for any webhook config, we
    // log a loud warning and allow the request (backwards-compatible
    // rollout path — operators should set app secrets to enable
    // enforcement). Superadmin-configured global webhook endpoints that
    // do not have an app secret are a known deployment footgun.
    const signatureHeader = req.headers["x-hub-signature-256"] ??
        req.headers["X-Hub-Signature-256"];
    const rawBody = req.rawBody;
    // Single source of truth for the Meta App Secret: the WA Onboarding
    // row (whatsapp_business_accounts_config), same row used by
    // channels.controller.ts for the credential test flow.
    const wabaConfig = await db.query.whatsappBusinessAccountsConfig.findFirst({
        where: ne(whatsappBusinessAccountsConfig.appSecret, ""),
    });
    const configuredSecret = wabaConfig?.appSecret?.trim() || "";
    if (configuredSecret) {
        if (!verifyMetaSignature(signatureHeader, rawBody, configuredSecret)) {
            return res.status(401).json({ error: "Invalid webhook signature" });
        }
    }
    else if (process.env.NODE_ENV === "production") {
        // Fail-closed in production: refuse webhook POSTs when no Meta App
        // Secret is configured. Set it under Settings → WA Onboarding →
        // Meta App Credentials before Meta deliveries are accepted in prod.
        console.error("[Webhook] Rejecting POST delivery — Meta App Secret not configured. Set it in Settings → WA Onboarding → Meta App Credentials to enable X-Hub-Signature-256 enforcement.");
        return res.status(401).json({ error: "Webhook signing not configured", hint: "Set Meta App Secret under Settings → WA Onboarding" });
    }
    const body = req.body;
    // Avoid logging raw webhook bodies: they may contain PII (phone numbers,
    // names), message content, and—if signed payloads—secrets. Log only a
    // structural summary.
    if (process.env.NODE_ENV !== "production") {
        const entryCount = Array.isArray(body?.entry) ? body.entry.length : 0;
        const firstField = body?.entry?.[0]?.changes?.[0]?.field;
        console.log(`[Webhook] received object=${body?.object ?? "?"} entries=${entryCount} firstField=${firstField ?? "?"}`);
    }
    if (activeConfig) {
        await storage.updateWebhookConfig(activeConfig.id, {
            lastPingAt: new Date(),
        });
    }
    if (body.entry) {
        for (const entry of body.entry) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field === "messages") {
                    await handleMessageChange(change.value);
                }
                else if (change.field === "message_template_status_update") {
                    await handleTemplateStatusUpdate(change.value, entry.id);
                }
                else if (change.field === "smb_message_echoes") {
                    await handleSmbMessageEchoes(change.value);
                }
                else if (change.field === "smb_app_state_sync") {
                    await handleSmbAppStateSync(change.value);
                }
            }
        }
    }
    res.sendStatus(200);
}
export const handleWebhook = asyncHandler(handleWebhookInternal);
async function handleMessageChange(value) {
    const { messages, contacts, metadata, statuses } = value;
    // Handle message status updates (sent, delivered, read, failed)
    if (statuses && statuses.length > 0) {
        await handleMessageStatuses(statuses, metadata);
        return;
    }
    if (!messages || messages.length === 0) {
        return;
    }
    // Find channel by phone number ID
    const phoneNumberId = metadata?.phone_number_id;
    if (!phoneNumberId) {
        console.error("No phone_number_id in webhook");
        return;
    }
    const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
    if (!channel) {
        console.error(`No channel found for phone_number_id: ${phoneNumberId}`);
        return;
    }
    const waApi = new WhatsAppApiService(channel);
    for (const message of messages) {
        const { from, id: whatsappMessageId, text, type, timestamp, interactive } = message;
        // Deduplication: skip if this exact wamid was already processed within 60s
        if (whatsappMessageId && (await _isAlreadyProcessed(whatsappMessageId))) {
            console.log(`[Webhook Dedup] Skipping duplicate inbound message: ${whatsappMessageId}`);
            continue;
        }
        // Handle reaction messages before any other processing
        if (type === 'reaction' && message.reaction) {
            const emoji = message.reaction.emoji || '';
            const reactedMessageId = message.reaction.message_id;
            if (reactedMessageId) {
                const reactedMessage = await storage.getMessageByWhatsAppId(reactedMessageId);
                if (reactedMessage) {
                    const existingMeta = reactedMessage.metadata || {};
                    let reactions = existingMeta.reactions || [];
                    if (!emoji) {
                        reactions = reactions.filter((r) => r.from !== from);
                        console.log(`Reaction removed from message ${reactedMessageId}`);
                    }
                    else {
                        reactions = reactions.filter((r) => r.from !== from);
                        reactions.push({
                            emoji,
                            from,
                            timestamp,
                        });
                        console.log(`Reaction added to message ${reactedMessageId}`);
                    }
                    await storage.updateMessage(reactedMessage.id, {
                        metadata: { ...existingMeta, reactions },
                    });
                    const io = global.io;
                    if (io) {
                        io.to(`conversation:${reactedMessage.conversationId}`).emit('message_reaction', {
                            conversationId: reactedMessage.conversationId,
                            messageId: reactedMessage.id,
                            reactions: [...reactions],
                        });
                    }
                }
            }
            continue;
        }
        // Handle edit messages — update the original message content, no new row
        if (type === 'edit' && message.edit) {
            const originalWaId = message.edit.original_message_id;
            const newText = message.edit.message?.text?.body || message.edit.message?.caption || '';
            if (originalWaId && newText) {
                const originalMessage = await storage.getMessageByWhatsAppId(originalWaId);
                if (originalMessage) {
                    const existingMeta = originalMessage.metadata || {};
                    await storage.updateMessage(originalMessage.id, {
                        content: newText,
                        metadata: {
                            ...existingMeta,
                            edited: true,
                            editedAt: message.timestamp
                                ? new Date(parseInt(message.timestamp) * 1000).toISOString()
                                : new Date().toISOString(),
                        },
                    });
                    const io = global.io;
                    if (io) {
                        io.to(`conversation:${originalMessage.conversationId}`).emit('message_edited', {
                            conversationId: originalMessage.conversationId,
                            messageId: originalMessage.id,
                            content: newText,
                            editedAt: message.timestamp
                                ? new Date(parseInt(message.timestamp) * 1000).toISOString()
                                : new Date().toISOString(),
                        });
                    }
                    console.log(`[Webhook] Edit applied to message ${originalWaId}`);
                }
                else {
                    console.log(`[Webhook] Edit received but original message not found: ${originalWaId}`);
                }
            }
            continue;
        }
        let messageContent = "";
        let interactiveData = null;
        let mediaId = null;
        let mediaUrl = null;
        let mediaMimeType = null;
        let mediaSha256 = null;
        if (type === "text" && text) {
            messageContent = text.body;
        }
        else if (type === "button" && message.button) {
            messageContent = message.button.text || "[Button reply]";
            interactiveData = { type: "button", buttonPayload: message.button.payload };
        }
        else if (type === "interactive" && interactive) {
            if (interactive.type === "button_reply") {
                messageContent = interactive.button_reply.title;
                interactiveData = interactive;
            }
            else if (interactive.type === "list_reply") {
                messageContent = interactive.list_reply.title;
                interactiveData = interactive;
            }
            else if (interactive.type === "nfm_reply") {
                messageContent = "[Flow reply]";
                interactiveData = { type: "nfm_reply", flowResponse: interactive.nfm_reply?.response_json };
            }
            else {
                messageContent = `[Interactive: ${interactive.type || "unknown"}]`;
                interactiveData = interactive;
            }
        }
        else if (type === "image" && message.image) {
            messageContent = message.image.caption || "[Image]";
            mediaId = message.image.id;
            mediaMimeType = message.image.mime_type;
            mediaSha256 = message.image.sha256;
        }
        else if (type === "event" && message.event) {
            const event = message.event;
            messageContent = `📅 Event: ${event.name || "Untitled"}`;
            if (event.start_time) {
                const date = new Date(event.start_time * 1000).toLocaleString();
                messageContent += ` — ${date}`;
            }
            interactiveData = {
                type: "event",
                name: event.name,
                description: event.description,
                startTime: event.start_time,
                endTime: event.end_time,
                location: event.location,
                url: event.url,
            };
        }
        else if (type === "document" && message.document) {
            messageContent =
                message.document.caption ||
                    `[Document: ${message.document.filename || "file"}]`;
            mediaId = message.document.id;
            mediaMimeType = message.document.mime_type;
            mediaSha256 = message.document.sha256;
        }
        else if (type === "audio" && message.audio) {
            messageContent = "[Audio message]";
            mediaId = message.audio.id;
            mediaMimeType = message.audio.mime_type;
            mediaSha256 = message.audio.sha256;
        }
        else if (type === "video" && message.video) {
            messageContent = message.video.caption || "[Video]";
            mediaId = message.video.id;
            mediaMimeType = message.video.mime_type;
            mediaSha256 = message.video.sha256;
        }
        else if (type === "sticker" && message.sticker) {
            messageContent = "[Sticker]";
            mediaId = message.sticker.id;
            mediaMimeType = message.sticker.mime_type;
            mediaSha256 = message.sticker.sha256;
        }
        else if (type === "location" && message.location) {
            messageContent = message.location.name || message.location.address || "[Location]";
            interactiveData = {
                type: "location",
                latitude: message.location.latitude,
                longitude: message.location.longitude,
                name: message.location.name,
                address: message.location.address,
                url: message.location.url,
            };
        }
        else if (type === "location_request") {
            messageContent = "[Location request]";
        }
        else if (type === "contacts" && message.contacts) {
            const sharedNames = message.contacts.map((c) => c.name?.formatted_name || "Unknown").join(", ");
            messageContent = `[Contact: ${sharedNames}]`;
            interactiveData = { type: "contacts", sharedContacts: message.contacts };
        }
        else if (type === "address" && message.address) {
            messageContent = "[Address message]";
            interactiveData = { type: "address", address: message.address };
        }
        else if (type === "template") {
            messageContent = "[Template message]";
        }
        else if (type === "order" && message.order) {
            messageContent = "[Order received]";
            interactiveData = { type: "order", order: message.order };
        }
        else if (type === "system") {
            messageContent = message.system?.body || "[System message]";
            interactiveData = { type: "system", systemType: message.system?.type };
        }
        else if (type === "referral") {
            messageContent = message.text?.body || "[Referral message]";
            interactiveData = { type: "referral", referral: message.referral };
            // } else if (type === "unsupported") {
            //   const err = message.errors?.[0];
            //   const errTitle = err?.title || "This message type is not supported";
            //   messageContent = `[Unsupported: ${errTitle}]`;
            //   interactiveData = {
            //     type: "unsupported",
            //     originalType: type,
            //     errorCode: err?.code || null,
            //     errorTitle: err?.title || null,
            //     errorDetails: err?.error_data?.details || null,
            //     messageKeys: Object.keys(message),
            //     rawWebhook: message,
            //   };
            //   console.log(`[Webhook] Unsupported message from ${from}: errorCode=${err?.code}, errorTitle=${err?.title}, type=${type}`);
            // } else {
            //   messageContent = `[Unsupported: Message type "${type}" unknown]`;
            //   interactiveData = {
            //     type: "unsupported",
            //     originalType: type,
            //     messageKeys: Object.keys(message),
            //     rawWebhook: message,
            //   };
            //   console.log(`[Webhook] Unknown message type "${type}" from ${from}`);
            // }
        }
        else if (type === "unsupported") {
            const err = message.errors?.[0];
            const errorCode = err?.code;
            const unsupportedSubType = message.unsupported?.type || "unknown";
            // ✅ poll_update — spam hai, skip karo
            if (unsupportedSubType === "poll_update") {
                console.log(`[Webhook] poll_update skipped from ${from}`);
                continue;
            }
            const unsupportedLabels = {
                poll_creation: "🗳️ User sent a Poll",
                group_invite: "👥 User sent a Group Invite",
                location: "📍 User shared Live Location",
                pin: "📌 User pinned a message",
                keep_in_chat: "💾 User saved a message",
                link_preview: "🔗 User sent a Link",
                media_placeholder: "📎 User sent a Media",
                hsm: "📋 User sent a Template",
                list: "📝 User sent a List",
                product: "🛍️ User sent a Product",
                order: "🛒 User sent an Order",
                gif: "🎬 User sent a GIF",
                image: "🖼️ User sent an Image",
                reaction: "👍 User sent a Reaction",
                interactive: "🔘 User sent an Interactive message",
                errors: "⚠️ Message error",
                edit: "✏️ User edited a message",
                unknown: "📨 User sent an unsupported message",
            };
            // ✅ Error 131060 — pehli baar message (coexistence)
            if (errorCode === 131060) {
                messageContent = "👋 New user message received";
                interactiveData = {
                    type: "unsupported",
                    unsupportedSubType: "first_time_user",
                    errorCode: 131060,
                };
            }
            else {
                const label = unsupportedLabels[unsupportedSubType] ?? "📨 Unsupported message";
                messageContent = label;
                interactiveData = {
                    type: "unsupported",
                    unsupportedSubType,
                    errorCode: errorCode || null,
                    errorTitle: err?.title || null,
                };
            }
            // ✅ User ko auto-reply karo
            try {
                await waApi.sendTextMessage(from, "Sorry, we couldn't receive your message. Please send text, image, video, audio, or document. 🙏");
            }
            catch (e) {
                console.error("[Webhook] Auto-reply failed:", e);
            }
            console.log(`[Webhook] Unsupported from ${from}: subType=${unsupportedSubType}, code=${errorCode}`);
        }
        // Fetch media URL
        if (mediaId) {
            try {
                mediaUrl = await waApi.fetchMediaUrl(mediaId);
            }
            catch (err) {
                console.error("❌ Failed to fetch media URL:", err);
            }
        }
        // Find/create contact (channel-scoped)
        const whatsappProfileName = contacts?.find((c) => c.wa_id === from)?.profile?.name || from;
        let contact = await storage.getContactByPhoneAndChannel(from, channel.id);
        let isNewConversation = false;
        if (!contact) {
            contact = await storage.createContact({
                name: whatsappProfileName,
                phone: from,
                channelId: channel.id,
                source: 'whatsapp',
                createdBy: channel.createdBy || undefined,
            });
        }
        else if (contact.name === contact.phone && whatsappProfileName !== from) {
            await storage.updateContact(contact.id, { name: whatsappProfileName });
            contact = { ...contact, name: whatsappProfileName };
        }
        // Find/create conversation (channel-scoped)
        let conversation = await storage.getConversationByPhoneAndChannel(from, channel.id);
        if (!conversation) {
            isNewConversation = true;
            conversation = await storage.createConversation({
                contactId: contact.id,
                contactPhone: from,
                contactName: contact.name || from,
                channelId: channel.id,
                unreadCount: 1,
                lastIncomingMessageAt: new Date(),
                lastMessageText: messageContent,
                lastMessageAt: new Date(),
            });
        }
        else {
            const updates = {
                unreadCount: (conversation.unreadCount || 0) + 1,
                lastMessageAt: new Date(),
                lastIncomingMessageAt: new Date(),
                lastMessageText: messageContent,
            };
            if (conversation.contactName !== contact.name) {
                updates.contactName = contact.name;
            }
            if (!conversation.contactId && contact.id) {
                updates.contactId = contact.id;
            }
            await storage.updateConversation(conversation.id, updates);
        }
        const storedMessageType = interactiveData?.type === "unsupported" ? "unsupported" : type;
        // Create DB message
        const newMessage = await storage.createMessage({
            conversationId: conversation.id,
            content: messageContent,
            fromUser: false,
            direction: "inbound",
            status: "received",
            whatsappMessageId,
            messageType: storedMessageType,
            metadata: interactiveData ? JSON.stringify(interactiveData) : null,
            timestamp: new Date(parseInt(timestamp, 10) * 1000),
            mediaId,
            mediaUrl,
            mediaMimeType,
            mediaSha256,
        });
        // ================================
        //  🔥 REALTIME SEND USING IO
        // ================================
        const io = global.io;
        if (io) {
            const channelRoom = `channel:${channel.id}`;
            const conversationRoom = `conversation:${conversation.id}`;
            const normalizedPayload = {
                type: "new-message",
                conversationId: conversation.id,
                content: messageContent,
                createdAt: new Date().toISOString(),
                messageType: type,
                from: "whatsapp",
            };
            // ✅ 1. Sidebar / Inbox realtime
            io.to(channelRoom).emit("new-message", normalizedPayload);
            // ✅ 2. Open conversation realtime
            io.to(conversationRoom).emit("new-message", normalizedPayload);
            // ✅ New conversation notification
            if (isNewConversation) {
                io.to(channelRoom).emit("conversation_created", {
                    conversation: {
                        ...conversation,
                        lastMessageText: messageContent,
                        lastMessageAt: new Date().toISOString(),
                    },
                    message: {
                        id: newMessage.id,
                        conversationId: conversation.id,
                        content: messageContent,
                        messageType: type,
                        createdAt: new Date().toISOString(),
                    },
                });
            }
            console.log("✅ Emitted to channel + conversation rooms");
        }
        else {
            console.error("❌ IO not initialized");
        }
        try {
            if (channel.createdBy) {
                const ownerId = channel.createdBy;
                // const ownerResult = await db.select().from(users).where(eq(users.id, ownerId));
                // const teamMembers = await db.select().from(users).where(eq(users.createdBy, ownerId));
                // const allUsers = [...ownerResult, ...teamMembers];
                // const targetUserIds = [...new Set(allUsers.map((u) => u.id))];
                const targetUserIds = [ownerId];
                // Send notification to assigned user only
                if (conversation.assignedTo &&
                    conversation.assignedTo !== ownerId) {
                    targetUserIds.push(conversation.assignedTo);
                }
                // Remove duplicates
                const uniqueUserIds = [...new Set(targetUserIds)];
                if (uniqueUserIds.length > 0) {
                    const contactName = contact.name || from;
                    const preview = messageContent.length > 100 ? messageContent.substring(0, 100) + "..." : messageContent;
                    console.log(`🔔 Triggering new_message notification for ${targetUserIds.length} user(s)`);
                    await triggerThrottledNotification({
                        contactName,
                        contactPhone: from,
                        channelName: channel.name || channel.phoneNumber || "Unknown",
                        messagePreview: preview,
                    }, uniqueUserIds, channel.id);
                    console.log(`✅ new_message notification sent`);
                }
            }
        }
        catch (notifError) {
            console.error("❌ Error sending new message notification:", notifError);
        }
        // 👇 NEW — COD verification button click handling
        if (type === "button" && message.button?.payload?.startsWith("COD_")) {
            try {
                const record = await CodVerificationService.handleButtonReply(message.button.payload, from);
                if (record) {
                    if (record.platform === "shopify") {
                        const store = await storage.getShopifyStoreById(record.storeId);
                        if (store) {
                            await ShopifyCodService.updateOrderTag(store.shopDomain, store.accessToken, record.orderId, record.status);
                        }
                    }
                    else {
                        const store = await storage.getWooCommerceStoreById(record.storeId);
                        if (store) {
                            await WooCommerceCodService.updateOrderStatus(store.storeUrl, store.consumerKey, store.consumerSecret, record.orderId, record.status);
                        }
                    }
                    console.log(`[COD] Order ${record.orderNumber} marked as ${record.status} via WhatsApp`);
                }
                else {
                    console.warn(`[COD] Button payload ${message.button.payload} did not match a pending verification`);
                }
            }
            catch (err) {
                console.error("[COD] Error handling button reply:", err);
            }
            // COD click already saved as a message above (for inbox history) —
            // skip automation/AI triggers, this isn't a normal conversation reply.
            continue;
        }
        // Automations (run first — takes priority over AI)
        let automationHandled = false;
        try {
            const hasPendingExecution = await triggerService.getExecutionService().hasPendingExecutionAsync(conversation.id);
            if (hasPendingExecution) {
                const result = await triggerService.getExecutionService().handleUserResponse(conversation.id, messageContent, interactiveData);
                if (result && result.success) {
                    if (io) {
                        io.to(`conversation_${conversation.id}`).emit("automation-resumed", {
                            type: "automation-resumed",
                            data: result,
                        });
                    }
                    automationHandled = true;
                }
            }
            if (!automationHandled) {
                if (isNewConversation) {
                    automationHandled = await triggerService.handleNewConversation(conversation.id, channel.id, contact?.id);
                }
                else {
                    automationHandled = await triggerService.handleMessageReceived(conversation.id, {
                        content: messageContent,
                        text: messageContent,
                        body: messageContent,
                        type,
                        from,
                        whatsappMessageId,
                        timestamp,
                        interactive: interactiveData,
                    }, channel.id, contact?.id);
                }
            }
        }
        catch (automationError) {
            console.error("Automation Error:", automationError);
            if (io) {
                io.to(`conversation_${conversation.id}`).emit("automation-error", {
                    type: "automation-error",
                    error: automationError,
                });
            }
        }
        // AI auto reply — only fires when no automation handled this message, text only
        if (!automationHandled && type === "text" && messageContent) {
            try {
                const shouldSendAiReply = await checkAndSendAiReply(messageContent, conversation, contact, waApi);
                if (shouldSendAiReply) {
                    console.log(`AI auto reply complete for conversation ${conversation.id}`);
                }
            }
            catch (err) {
                console.error("AI Error:", err);
            }
        }
    }
}
// --- AI AUTO-REPLY HELPER FUNCTION (NEW) ---
async function checkAndSendAiReply(messageContent, conversation, contact, whatsappApi) {
    if (conversation.status === "assigned" && conversation.assignedTo) {
        return false;
    }
    const getAiSettings = await db
        .select()
        .from(aiSettings)
        .where(eq(aiSettings.channelId, conversation.channelId))
        .limit(1)
        .then((res) => res[0]);
    if (!getAiSettings || !getAiSettings.isActive) {
        return false;
    }
    let triggerWords = [];
    if (Array.isArray(getAiSettings.words)) {
        triggerWords = getAiSettings.words;
    }
    else if (typeof getAiSettings.words === "string") {
        try {
            triggerWords = JSON.parse(getAiSettings.words);
        }
        catch {
            triggerWords = [];
        }
    }
    const messageLower = messageContent.toLowerCase().trim();
    if (triggerWords.length > 0) {
        const hasMatch = triggerWords.some((word) => messageLower.includes(word.toLowerCase().trim()));
        if (!hasMatch) {
            const recentMessages = await db
                .select()
                .from(messages)
                .where(eq(messages.conversationId, conversation.id))
                .orderBy(desc(messages.timestamp))
                .limit(10);
            const hasAiHistory = recentMessages.some((msg) => {
                if (!msg.metadata)
                    return false;
                try {
                    const meta = typeof msg.metadata === "string" ? JSON.parse(msg.metadata) : msg.metadata;
                    return meta?.aiGenerated === true;
                }
                catch {
                    return false;
                }
            });
            if (!hasAiHistory) {
                console.log(`[AI] No trigger word match and no AI history, skipping`);
                return false;
            }
            console.log(`[AI] Continuing AI conversation (existing history) for: "${messageContent}"`);
        }
        else {
            console.log(`[AI] Trigger word matched: "${messageContent}"`);
        }
    }
    else {
        console.log(`[AI] No trigger words configured — replying to all messages`);
    }
    // Get conversation history for context
    const conversationHistory = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(desc(messages.timestamp));
    // Fetch site associated with this channel
    const site = await db
        .select()
        .from(sites)
        .where(eq(sites.channelId, conversation.channelId))
        .limit(1)
        .then((res) => res[0]);
    // Generate AI response with site context
    const aiResponse = await generateAiResponse(messageContent, conversationHistory, contact, getAiSettings, site);
    if (!aiResponse) {
        console.error("❌ Failed to generate AI response");
        return false;
    }
    // Send AI reply via WhatsApp
    try {
        const result = await whatsappApi.sendTextMessage(conversation.contactPhone, aiResponse);
        // Save AI response as outbound message
        const aiMessage = await storage.createMessage({
            conversationId: conversation.id,
            content: aiResponse,
            fromUser: true,
            direction: "outbound",
            status: "sent",
            whatsappMessageId: result.messages?.[0]?.id || null,
            messageType: "text",
            metadata: JSON.stringify({ aiGenerated: true, trigger: messageContent }),
            timestamp: new Date(),
        });
        // Update conversation
        await storage.updateConversation(conversation.id, {
            lastMessageAt: new Date(),
            lastMessageText: aiResponse,
        });
        // Broadcast AI message via WebSocket
        if (global.broadcastToConversation) {
            global.broadcastToConversation(conversation.id, {
                type: "new-message",
                message: aiMessage,
            });
            global.broadcastToConversation(conversation.id, {
                type: "ai-reply-sent",
                data: {
                    messageId: aiMessage.id,
                    trigger: messageContent,
                    response: aiResponse,
                },
            });
        }
        return true;
    }
    catch (error) {
        console.error("❌ Failed to send AI reply:", error);
        throw error;
    }
}
// --- AI RESPONSE GENERATION (NEW) ---
async function generateAiResponse(userMessage, conversationHistory, contact, aiSettings, site) {
    try {
        const { provider, apiKey, model, endpoint, temperature, maxTokens } = aiSettings;
        // 1. Search for relevant training data if site is available
        let trainingContext = "";
        if (site) {
            try {
                const trainingResults = await searchTrainingData(site.id, aiSettings.channelId || "", userMessage);
                if (trainingResults.chunks.length > 0) {
                    trainingContext += "\n\n--- RELEVANT KNOWLEDGE BASE ---\n";
                    trainingContext += trainingResults.chunks.join("\n\n");
                }
                if (trainingResults.qaPairs.length > 0) {
                    trainingContext += "\n\n--- RELEVANT FAQ PAIRS ---\n";
                    for (const qa of trainingResults.qaPairs) {
                        trainingContext += `Q: ${qa.question}\nA: ${qa.answer}\n\n`;
                    }
                }
            }
            catch (err) {
                console.warn("[AI] Training data search failed:", err);
            }
        }
        // 2. Build escalation instructions
        const widgetCfg = site?.widgetConfig || {};
        const escalationConfig = widgetCfg.escalationRules || {};
        const escalationEnabled = escalationConfig.enabled !== false;
        const maxAttempts = escalationConfig.maxAttempts || 3;
        // Count previous unanswered bot messages for escalation
        const unansweredCount = conversationHistory.filter((m) => !m.fromUser && m.content && (m.content.includes("I don't have") ||
            m.content.includes("I'm not sure") ||
            m.content.includes("I cannot find"))).length;
        let escalationInstruction = "";
        if (escalationEnabled) {
            const triggerPhrases = escalationConfig.triggerPhrases || [];
            escalationInstruction = `\n\nESCALATION RULES:
- If you cannot answer the user's question from the provided knowledge base/training data, you MUST start your response with "[ESCALATE_TO_AGENT]" and then provide a brief helpful message.
- If you are unsure or the question is outside your trained knowledge, use "[ESCALATE_TO_AGENT]".
${unansweredCount >= maxAttempts - 1 ? `- The user has had ${unansweredCount} unanswered questions. If you cannot answer this one confidently, you MUST escalate with "[ESCALATE_TO_AGENT]".` : ""}
${triggerPhrases.length > 0 ? `- If the user mentions any of these phrases, escalate immediately: ${triggerPhrases.join(", ")}` : ""}
- Always try to answer from the provided knowledge base first before escalating.`;
        }
        // 3. Build system prompt
        const siteName = site?.name || "our company";
        const basePrompt = widgetCfg.systemPrompt ||
            `You are a dedicated customer support assistant for ${siteName}. Your goal is to provide accurate information based EXCLUSIVELY on the provided knowledge base. Be conversational, professional, and concise.`;
        const strictInstruction = `
[CRITICAL INSTRUCTION]
1. DO NOT use any internal knowledge or external information not found in the "RELEVANT KNOWLEDGE BASE" or "RELEVANT FAQ PAIRS" sections.
2. If the answer is not explicitly stated in the provided context, you MUST state that you do not have that information.
3. NEVER make up information, offer general advice, or speculate.
4. If you cannot answer based ONLY on the provided context, follow the ESCALATION RULES below.
5. Your response should always be in the same language as the user's message.
`;
        const systemPrompt = basePrompt + "\n" + trainingContext + "\n" + strictInstruction + escalationInstruction;
        // 4. Build message context for AI
        const messages = [
            {
                role: "system",
                content: systemPrompt,
            },
        ];
        // Add conversation history (last 10 messages for context)
        conversationHistory
            .slice(-10)
            .reverse()
            .forEach((msg) => {
            messages.push({
                role: msg.fromUser ? "assistant" : "user",
                content: msg.content,
            });
        });
        // Add current user message
        messages.push({
            role: "user",
            content: userMessage,
        });
        // Call AI API based on provider
        let aiResponse = null;
        if (provider === "openai") {
            aiResponse = await callOpenAI(messages, apiKey, model, endpoint || "https://api.openai.com/v1", parseFloat(temperature || "0.7"), parseInt(maxTokens || "2048", 10));
        }
        else if (provider === "anthropic") {
            aiResponse = await callAnthropic(messages, apiKey, model, endpoint || "https://api.anthropic.com/v1", parseFloat(temperature || "0.7"), parseInt(maxTokens || "2048", 10));
        }
        else {
            console.error(`Unsupported AI provider: ${provider}`);
            return null;
        }
        return aiResponse;
    }
    catch (error) {
        console.error("❌ Error generating AI response:", error);
        return null;
    }
}
// --- OpenAI API Call ---
async function callOpenAI(messages, apiKey, model, endpoint, temperature, maxTokens) {
    try {
        const response = await fetch(`${endpoint}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            console.error("OpenAI API error:", error);
            return null;
        }
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    }
    catch (error) {
        console.error("OpenAI API call failed:", error);
        return null;
    }
}
// --- Anthropic API Call ---
async function callAnthropic(messages, apiKey, model, endpoint, temperature, maxTokens) {
    try {
        // Extract system message and convert format
        const systemMessage = messages.find((m) => m.role === "system")?.content || "";
        const conversationMessages = messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
        }));
        const response = await fetch(`${endpoint}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model,
                messages: conversationMessages,
                system: systemMessage,
                temperature,
                max_tokens: maxTokens,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            console.error("Anthropic API error:", error);
            return null;
        }
        const data = await response.json();
        return data.content?.[0]?.text || null;
    }
    catch (error) {
        console.error("Anthropic API call failed:", error);
        return null;
    }
}
// async function handleMessageStatuses(statuses: any[], metadata: any) {
//   const phoneNumberId = metadata?.phone_number_id;
//   if (!phoneNumberId) {
//     console.error("No phone_number_id in webhook status update");
//     return;
//   }
//   const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
//   if (!channel) {
//     console.error(`No channel found for phone_number_id: ${phoneNumberId}`);
//     return;
//   }
//   for (const statusUpdate of statuses) {
//     const {
//       id: whatsappMessageId,
//       status,
//       timestamp,
//       errors,
//       recipient_id,
//     } = statusUpdate;
//     // Deduplication: skip if this wamid+status combo was already processed within 60s
//     const dedupKey = `${whatsappMessageId}:${status}`;
//     if (whatsappMessageId && _isAlreadyProcessed(dedupKey)) {
//       console.log(`[Webhook Dedup] Skipping duplicate status update: ${whatsappMessageId} - ${status}`);
//       continue;
//     }
//     console.log(
//       `📊 Message status update: ${whatsappMessageId} - ${status}`,
//       errors ? `Errors: ${errors.length}` : ""
//     );
//     // Find the message by WhatsApp ID (inbox messages table first)
//     const message = await storage.getMessageByWhatsAppId(whatsappMessageId);
//     // If not found in messages table, check message_queue (campaign messages)
//     if (!message) {
//       const [queueEntry] = await db.select()
//         .from(messageQueue)
//         .where(eq(messageQueue.whatsappMessageId, whatsappMessageId))
//         .limit(1);
//       if (queueEntry) {
//         // Monotonic milestone tracking: use persisted timestamps/flags as source
//         // of truth, not status string — statuses can arrive out of order.
//         const alreadyDelivered = !!queueEntry.deliveredAt;
//         const alreadyRead = !!queueEntry.readAt;
//         const alreadyFailed = queueEntry.status === "failed";
//         let queueErrorCode: string | null = null;
//         let queueErrorMessage: string | null = null;
//         const now = new Date(parseInt(timestamp, 10) * 1000);
//         const updateFields: Record<string, any> = {};
//         let shouldIncrementDelivered = false;
//         let shouldIncrementRead = false;
//         let shouldIncrementFailed = false;
//         let shouldDecrementSent = false;
//         if (status === "delivered" && !alreadyDelivered && !alreadyRead) {
//           // First time reaching delivered milestone (and not already advanced to read)
//           updateFields.status = "delivered";
//           updateFields.deliveredAt = now;
//           shouldIncrementDelivered = true;
//         } else if (status === "read" && !alreadyRead) {
//           // First time reaching read milestone
//           updateFields.status = "read";
//           updateFields.readAt = now;
//           shouldIncrementRead = true;
//           if (!alreadyDelivered) {
//             // Read implies delivery — backfill the delivery milestone too
//             updateFields.deliveredAt = now;
//             shouldIncrementDelivered = true;
//           }
//         } else if (status === "failed" && errors && errors.length > 0 && !alreadyDelivered && !alreadyRead && !alreadyFailed) {
//           // Only mark failed if no positive milestone was already reached
//           updateFields.status = "failed";
//           const error = errors[0];
//           queueErrorCode = String(error.code);
//           queueErrorMessage = error.message || error.details || error.title || "Unknown failure";
//           updateFields.errorCode = queueErrorCode;
//           updateFields.errorMessage = queueErrorMessage;
//           shouldIncrementFailed = true;
//           shouldDecrementSent = queueEntry.status === "sent";
//         }
//         if (Object.keys(updateFields).length > 0) {
//           await db.update(messageQueue)
//             .set(updateFields)
//             .where(eq(messageQueue.id, queueEntry.id));
//         }
//         // Increment campaign counters only for first attainment of each milestone
//         const campaignId = queueEntry.campaignId;
//         if (campaignId && (shouldIncrementDelivered || shouldIncrementRead || shouldIncrementFailed)) {
//           const counterUpdate: Record<string, any> = {};
//           if (shouldIncrementDelivered) {
//             counterUpdate.deliveredCount = sql`COALESCE(${campaigns.deliveredCount}, 0) + 1`;
//           }
//           if (shouldIncrementRead) {
//             counterUpdate.readCount = sql`COALESCE(${campaigns.readCount}, 0) + 1`;
//           }
//           if (shouldIncrementFailed) {
//             counterUpdate.failedCount = sql`COALESCE(${campaigns.failedCount}, 0) + 1`;
//           }
//           if (shouldDecrementSent) {
//             counterUpdate.sentCount = sql`GREATEST(COALESCE(${campaigns.sentCount}, 0) - 1, 0)`;
//           }
//           await db.update(campaigns).set(counterUpdate).where(eq(campaigns.id, campaignId));
//           console.log(
//             `📊 [Campaign ${campaignId}] Counters updated for ${whatsappMessageId}:`,
//             Object.keys(counterUpdate).join(", ")
//           );
//         }
//       } else {
//         console.log(`⚠️ Message not found for WhatsApp ID: ${whatsappMessageId}`);
//       }
//       continue;
//     }
//     // Map WhatsApp status to our status
//     let messageStatus: "sent" | "delivered" | "read" | "failed" = "sent";
//     let errorDetails = null;
//     if (status === "sent") {
//       messageStatus = "sent";
//     } else if (status === "delivered") {
//       messageStatus = "delivered";
//     } else if (status === "read") {
//       messageStatus = "read";
//     } else if (status === "failed" && errors && errors.length > 0) {
//       messageStatus = "failed";
//       const error = errors[0];
//       const enriched = getWhatsAppError(error.code);
//       errorDetails = {
//         code: error.code,
//         title: error.title,
//         message: error.message || error.details,
//         description: enriched.description,
//         suggestion: enriched.suggestion,
//         errorData: error.error_data,
//         recipientId: recipient_id,
//         timestamp: timestamp,
//       };
//       console.error(`❌ Message failed with error:`, errorDetails);
//     }
//     const pricingData = statusUpdate.pricing;
//     const conversationData = statusUpdate.conversation;
//     const existingMetadata = (message.metadata as Record<string, any>) || {};
//     const updatedMetadata = {
//       ...existingMetadata,
//       ...(pricingData ? { pricing: pricingData } : {}),
//       ...(conversationData ? { conversation: conversationData } : {}),
//     };
//     const updatedMessage = await storage.updateMessage(message.id, {
//       status: messageStatus,
//       errorDetails: errorDetails || null,
//       deliveredAt:
//         messageStatus === "delivered"
//           ? new Date(parseInt(timestamp, 10) * 1000)
//           : message.deliveredAt,
//       readAt:
//         messageStatus === "read"
//           ? new Date(parseInt(timestamp, 10) * 1000)
//           : message.readAt,
//       metadata: updatedMetadata,
//       updatedAt: new Date(),
//     });
//     // Broadcast status update
//     // if ((global as any).broadcastToConversation && message.conversationId) {
//     //   (global as any).broadcastToConversation(message.conversationId, {
//     //     type: "message-status-update",
//     //     data: {
//     //       messageId: message.id,
//     //       whatsappMessageId,
//     //       status: messageStatus,
//     //       errorDetails,
//     //       timestamp: new Date(parseInt(timestamp, 10) * 1000),
//     //     },
//     //   });
//     // }
//     const io = (global as any).io;
// if (io && message.conversationId) {
//   const statusPayload = {
//     conversationId: message.conversationId,
//     messageId: message.id,
//     whatsappMessageId,
//     status: messageStatus,
//     timestamp: new Date(parseInt(timestamp, 10) * 1000).toISOString(),
//     errorDetails,
//   };
//   io.to(`conversation:${message.conversationId}`).emit(
//     "message_status_update",
//     statusPayload
//   );
//   if (channel?.id) {
//     io.to(`channel:${channel.id}`).emit(
//       "message_status_update",
//       statusPayload
//     );
//   }
//   console.log(
//     "📤 message_status_update emitted to conversation + channel:",
//     whatsappMessageId,
//     messageStatus
//   );
// }
//     const campaignId = (message as any).campaignId || (message.metadata as any)?.campaignId;
//     if (campaignId) {
//       const campaign = await storage.getCampaign(campaignId);
//       if (campaign) {
//         if (messageStatus === "delivered" && message.status !== "delivered") {
//           await db.update(campaigns).set({
//             deliveredCount: sql`COALESCE(${campaigns.deliveredCount}, 0) + 1`,
//           }).where(eq(campaigns.id, campaignId));
//         } else if (messageStatus === "read" && message.status !== "read") {
//           await db.update(campaigns).set({
//             readCount: sql`COALESCE(${campaigns.readCount}, 0) + 1`,
//           }).where(eq(campaigns.id, campaignId));
//         } else if (messageStatus === "failed" && message.status !== "failed") {
//           await db.update(campaigns).set({
//             failedCount: sql`COALESCE(${campaigns.failedCount}, 0) + 1`,
//             sentCount: message.status === "sent"
//               ? sql`GREATEST(COALESCE(${campaigns.sentCount}, 0) - 1, 0)`
//               : campaigns.sentCount,
//           }).where(eq(campaigns.id, campaignId));
//           const failureReason = errorDetails
//             ? `${errorDetails.title || "Error"}: ${errorDetails.message || "Unknown"} (code: ${errorDetails.code || "N/A"})`
//             : "Unknown failure";
//           console.error(`❌ [Campaign ${campaignId}] Message failed to ${recipient_id}: ${failureReason}`);
//         }
//       }
//     }
//   }
// }
async function handleMessageStatuses(statuses, metadata) {
    const phoneNumberId = metadata?.phone_number_id;
    if (!phoneNumberId) {
        console.error("No phone_number_id in webhook status update");
        return;
    }
    const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
    if (!channel) {
        console.error(`No channel found for phone_number_id: ${phoneNumberId}`);
        return;
    }
    const STATUS_PRIORITY = {
        failed: 0,
        sent: 1,
        delivered: 2,
        read: 3,
    };
    for (const statusUpdate of statuses) {
        const { id: whatsappMessageId, status, timestamp, errors, recipient_id, } = statusUpdate;
        const dedupKey = `status:${whatsappMessageId}:${status}`;
        if (whatsappMessageId &&
            (await _isAlreadyProcessed(dedupKey))) {
            continue;
        }
        const eventTime = new Date(parseInt(timestamp, 10) * 1000);
        const [queueEntry] = await db
            .select()
            .from(messageQueue)
            .where(eq(messageQueue.whatsappMessageId, whatsappMessageId))
            .limit(1);
        if (queueEntry) {
            const updateFields = {};
            const campaignId = queueEntry.campaignId;
            let shouldIncDelivered = false;
            let shouldIncRead = false;
            let shouldIncFailed = false;
            let shouldDecSent = false;
            // =================================================
            // 🔥 IDENTITY GUARDS (IMPORTANT FIX)
            // =================================================
            const alreadyDelivered = !!queueEntry.deliveredAt;
            const alreadyRead = !!queueEntry.readAt;
            const alreadyFailed = queueEntry.status === "failed";
            // =================================================
            // DELIVERED (ONCE ONLY)
            // =================================================
            if (status === "delivered") {
                if (alreadyDelivered || alreadyRead)
                    continue;
                updateFields.status = "delivered";
                updateFields.deliveredAt = eventTime;
                shouldIncDelivered = true;
            }
            // =================================================
            // READ (ONCE ONLY)
            // =================================================
            else if (status === "read") {
                if (alreadyRead)
                    continue;
                updateFields.status = "read";
                updateFields.readAt = eventTime;
                shouldIncRead = true;
                if (!alreadyDelivered) {
                    updateFields.deliveredAt = eventTime;
                    shouldIncDelivered = true;
                }
            }
            // =================================================
            // FAILED (ONCE ONLY)
            // =================================================
            else if (status === "failed") {
                if (alreadyFailed || alreadyRead || alreadyDelivered)
                    continue;
                const error = errors?.[0];
                updateFields.status = "failed";
                updateFields.errorCode = error?.code ? String(error.code) : null;
                updateFields.errorMessage =
                    error?.message || error?.details || error?.title || "Unknown error";
                shouldIncFailed = true;
                shouldDecSent = queueEntry.status === "sent";
            }
            // =================================================
            // UPDATE QUEUE (ONLY IF NEEDED)
            // =================================================
            if (Object.keys(updateFields).length > 0) {
                await db
                    .update(messageQueue)
                    .set(updateFields)
                    .where(eq(messageQueue.id, queueEntry.id));
            }
            // =================================================
            // CAMPAIGN COUNTERS (100% DEDUP SAFE)
            // =================================================
            if (campaignId) {
                if (shouldIncDelivered || shouldIncRead || shouldIncFailed || shouldDecSent) {
                    await db
                        .update(campaigns)
                        .set({
                        statistics: sql `coalesce(${campaigns.statistics}, '{}'::jsonb) || jsonb_build_object(
                            'deliveredCount', coalesce((${campaigns.statistics}->>'deliveredCount')::int, 0) + ${shouldIncDelivered ? 1 : 0},
                            'readCount', coalesce((${campaigns.statistics}->>'readCount')::int, 0) + ${shouldIncRead ? 1 : 0},
                            'failedCount', coalesce((${campaigns.statistics}->>'failedCount')::int, 0) + ${shouldIncFailed ? 1 : 0},
                            'sentCount', greatest(coalesce((${campaigns.statistics}->>'sentCount')::int, 0) - ${shouldDecSent ? 1 : 0}, 0)
                        )`,
                        updatedAt: new Date(),
                    })
                        .where(eq(campaigns.id, campaignId));
                }
            }
            // ✅ campaignRecipients status update
            if (campaignId && Object.keys(updateFields).length > 0) {
                try {
                    const { campaignRecipients } = await import("@shared/schema");
                    const recipientUpdate = {};
                    if (status === "delivered" && !alreadyDelivered && !alreadyRead) {
                        recipientUpdate.status = "delivered";
                        recipientUpdate.deliveredAt = eventTime;
                    }
                    else if (status === "read" && !alreadyRead) {
                        recipientUpdate.status = "read";
                        recipientUpdate.readAt = eventTime;
                        if (!alreadyDelivered)
                            recipientUpdate.deliveredAt = eventTime;
                    }
                    else if (status === "failed" && !alreadyFailed && !alreadyDelivered && !alreadyRead) {
                        recipientUpdate.status = "failed";
                        const error = errors?.[0];
                        recipientUpdate.errorCode = error?.code ? String(error.code) : null;
                        recipientUpdate.errorMessage = error?.message || error?.title || "Unknown error";
                    }
                    if (Object.keys(recipientUpdate).length > 0) {
                        await db
                            .update(campaignRecipients)
                            .set(recipientUpdate)
                            .where(eq(campaignRecipients.providerReference, whatsappMessageId));
                    }
                }
                catch (err) {
                    console.error(`[Webhook] Failed to update campaignRecipient for ${whatsappMessageId}:`, err);
                }
            }
        }
        // =================================================
        // INBOX MESSAGE UPDATE (SAFE)
        // =================================================
        const message = await storage.getMessageByWhatsAppId(whatsappMessageId);
        if (!message)
            continue;
        const currentPriority = STATUS_PRIORITY[message.status || "sent"] || 0;
        const incomingPriority = STATUS_PRIORITY[status] || 0;
        if (incomingPriority < currentPriority) {
            continue;
        }
        let messageStatus = message.status;
        let errorDetails = null;
        if (status === "sent")
            messageStatus = "sent";
        if (status === "delivered")
            messageStatus = "delivered";
        if (status === "read")
            messageStatus = "read";
        if (status === "failed" && errors?.length) {
            messageStatus = "failed";
            const error = errors[0];
            errorDetails = {
                code: error.code,
                message: error.message || error.details,
                title: error.title,
                recipientId: recipient_id,
                timestamp,
            };
        }
        const existingMetadata = typeof message.metadata === "string"
            ? JSON.parse(message.metadata || "{}")
            : message.metadata || {};
        await storage.updateMessage(message.id, {
            status: messageStatus,
            errorDetails,
            deliveredAt: messageStatus === "delivered" || messageStatus === "read"
                ? eventTime
                : message.deliveredAt,
            readAt: messageStatus === "read" ? eventTime : message.readAt,
            metadata: {
                ...existingMetadata,
                ...(statusUpdate.pricing && { pricing: statusUpdate.pricing }),
                ...(statusUpdate.conversation && {
                    conversation: statusUpdate.conversation,
                }),
            },
            updatedAt: new Date(),
        });
        // =================================================
        // SOCKET EVENT
        // =================================================
        const io = global.io;
        if (io && message.conversationId) {
            io.to(`conversation:${message.conversationId}`).emit("message_status_update", {
                conversationId: message.conversationId,
                messageId: message.id,
                whatsappMessageId,
                status: messageStatus,
                timestamp: eventTime.toISOString(),
                errorDetails,
            });
            io.to(`channel:${channel.id}`).emit("message_status_update", {
                conversationId: message.conversationId,
                messageId: message.id,
                whatsappMessageId,
                status: messageStatus,
                timestamp: eventTime.toISOString(),
                errorDetails,
            });
        }
    }
}
async function handleTemplateStatusUpdate(value, wabaId) {
    const { message_template_id, message_template_name, event, reason } = value;
    console.log(`[Template Status] Update received: ${message_template_name} (WA ID: ${message_template_id}) - ${event}${reason ? ` - Reason: ${reason}` : ""} - WABA: ${wabaId || "unknown"}`);
    if (message_template_id && event) {
        let status = "PENDING";
        if (event === "APPROVED") {
            status = "APPROVED";
        }
        else if (event === "REJECTED") {
            status = "REJECTED";
        }
        let targetChannelId = null;
        if (wabaId) {
            const allChannels = await storage.getChannels();
            const matchedChannel = allChannels.find((ch) => String(ch.whatsappBusinessAccountId) === String(wabaId));
            if (matchedChannel) {
                targetChannelId = matchedChannel.id;
                console.log(`[Template Status] Matched WABA ${wabaId} to channel: ${matchedChannel.phoneNumber} (${targetChannelId})`);
            }
            else {
                console.warn(`[Template Status] No channel found for WABA ${wabaId}, falling back to global search`);
            }
        }
        let template = null;
        if (targetChannelId) {
            const { data: channelTemplates } = await storage.getTemplatesByChannel(targetChannelId, 1, 10000);
            const templatesList = Array.isArray(channelTemplates) ? channelTemplates : [];
            template = templatesList.find((t) => String(t.whatsappTemplateId) === String(message_template_id));
        }
        if (!template) {
            const templatesResult = await storage.getTemplates(1, 10000);
            const templatesList = Array.isArray(templatesResult) ? templatesResult : (templatesResult?.data || []);
            template = templatesList.find((t) => String(t.whatsappTemplateId) === String(message_template_id) &&
                (!targetChannelId || t.channelId === targetChannelId));
        }
        if (template) {
            const updateData = { status };
            if (event === "REJECTED" && reason) {
                updateData.rejectionReason = reason;
            }
            await storage.updateTemplate(template.id, updateData);
            console.log(`[Template Status] Updated template "${template.name}" (channel: ${template.channelId}) status to ${status}${reason ? ` with reason: ${reason}` : ""}`);
        }
        else {
            console.warn(`[Template Status] No matching template found for WA ID: ${message_template_id} in channel: ${targetChannelId || "any"}`);
        }
    }
}
// ============== ADDITIONAL HELPER FUNCTIONS ==============
/**
 * Get automation execution status for a conversation
 * Useful for debugging and monitoring
 */
export const getConversationAutomationStatus = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const executionService = triggerService.getExecutionService();
    const hasPending = executionService.hasPendingExecution(conversationId);
    const pendingExecutions = executionService
        .getPendingExecutions()
        .filter((pe) => pe.conversationId === conversationId);
    res.json({
        conversationId,
        hasPendingExecution: hasPending,
        pendingExecutions,
        totalPendingCount: pendingExecutions.length,
    });
});
/**
 * Cancel automation execution for a conversation
 * Useful for manual intervention
 */
export const cancelConversationAutomation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const executionService = triggerService.getExecutionService();
    const cancelled = await executionService.cancelExecution(conversationId);
    res.json({
        success: cancelled,
        conversationId,
        message: cancelled
            ? "Automation execution cancelled successfully"
            : "No pending execution found for this conversation",
    });
});
/**
 * Get all pending executions across all conversations
 * Useful for monitoring dashboard
 */
export const getAllPendingExecutions = asyncHandler(async (req, res) => {
    const executionService = triggerService.getExecutionService();
    const pendingExecutions = executionService.getPendingExecutions();
    res.json({
        totalCount: pendingExecutions.length,
        executions: pendingExecutions,
    });
});
/**
 * Cleanup expired executions manually
 * Can be called via API or scheduled job
 */
export const cleanupExpiredExecutions = asyncHandler(async (req, res) => {
    const { timeoutMinutes = 30 } = req.query;
    const timeoutMs = parseInt(timeoutMinutes) * 60 * 1000;
    const executionService = triggerService.getExecutionService();
    const cleanedCount = await executionService.cleanupExpiredExecutions(timeoutMs);
    res.json({
        success: true,
        cleanedCount,
        message: `Cleaned up ${cleanedCount} expired executions`,
    });
});

async function handleSmbMessageEchoes(value) {
    const { message_echoes, metadata } = value;
    if (!message_echoes || message_echoes.length === 0) {
        return;
    }
    const phoneNumberId = metadata?.phone_number_id;
    if (!phoneNumberId) {
        console.error("[smb_message_echoes] No phone_number_id in webhook");
        return;
    }
    const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
    if (!channel) {
        console.error(`[smb_message_echoes] No channel found for phone_number_id: ${phoneNumberId}`);
        return;
    }
    const waApi = new WhatsAppApiService(channel);
    for (const echo of message_echoes) {
        const { to, id: whatsappMessageId, text, type, timestamp } = echo;
        const customerPhone = to;
        if (!customerPhone) {
            console.error("[smb_message_echoes] No 'to' field in echo message");
            continue;
        }
        const existingMessage = await storage.getMessageByWhatsAppId(whatsappMessageId);
        if (existingMessage) {
            console.log(`[smb_message_echoes] Duplicate message ${whatsappMessageId}, skipping`);
            continue;
        }
        let messageContent = "";
        let mediaId = null;
        let mediaUrl = null;
        let mediaMimeType = null;
        let mediaSha256 = null;
        if (type === "text" && text) {
            messageContent = text.body;
        }
        else if (type === "image" && echo.image) {
            messageContent = echo.image.caption || "[Image]";
            mediaId = echo.image.id;
            mediaMimeType = echo.image.mime_type;
            mediaSha256 = echo.image.sha256;
        }
        else if (type === "document" && echo.document) {
            messageContent = echo.document.caption || `[Document: ${echo.document.filename || "file"}]`;
            mediaId = echo.document.id;
            mediaMimeType = echo.document.mime_type;
            mediaSha256 = echo.document.sha256;
        }
        else if (type === "audio" && echo.audio) {
            messageContent = "[Audio message]";
            mediaId = echo.audio.id;
            mediaMimeType = echo.audio.mime_type;
            mediaSha256 = echo.audio.sha256;
        }
        else if (type === "video" && echo.video) {
            messageContent = echo.video.caption || "[Video]";
            mediaId = echo.video.id;
            mediaMimeType = echo.video.mime_type;
            mediaSha256 = echo.video.sha256;
        }
        else if (type === "location" && echo.location) {
            messageContent = `[Location: ${echo.location.latitude}, ${echo.location.longitude}]`;
        }
        else if (type === "contacts" && echo.contacts) {
            const contactNames = echo.contacts.map((c) => c.name?.formatted_name || "Contact").join(", ");
            messageContent = `[Contact: ${contactNames}]`;
        }
        else if (type === "sticker" && echo.sticker) {
            messageContent = "[Sticker]";
            mediaId = echo.sticker.id;
            mediaMimeType = echo.sticker.mime_type;
        }
        else {
            messageContent = `[${type} message]`;
        }
        if (mediaId) {
            try {
                mediaUrl = await waApi.fetchMediaUrl(mediaId);
            }
            catch (err) {
                console.error("[smb_message_echoes] Failed to fetch media URL:", err);
            }
        }
        let contact = await storage.getContactByPhoneAndChannel(customerPhone, channel.id);
        if (!contact) {
            contact = await storage.createContact({
                name: customerPhone,
                phone: customerPhone,
                channelId: channel.id,
                source: 'whatsapp',
                createdBy: channel.createdBy || undefined,
            });
        }
        let conversation = await storage.getConversationByPhoneAndChannel(customerPhone, channel.id);
        if (!conversation) {
            conversation = await storage.createConversation({
                contactId: contact.id,
                contactPhone: customerPhone,
                contactName: contact.name || customerPhone,
                channelId: channel.id,
                unreadCount: 0,
            });
        }
        else {
            await storage.updateConversation(conversation.id, {
                lastMessageAt: new Date(),
                lastMessageText: messageContent,
            });
        }
        const echoMetadata = { rawWebhook: echo, originalType: type };
        const newMessage = await storage.createMessage({
            conversationId: conversation.id,
            content: messageContent,
            fromUser: true,
            direction: "outbound",
            status: "sent",
            whatsappMessageId,
            messageType: type,
            timestamp: new Date(parseInt(timestamp, 10) * 1000),
            mediaId,
            mediaUrl,
            mediaMimeType,
            mediaSha256,
            metadata: echoMetadata,
        });
        const io = global.io;
        if (io) {
            const channelRoom = `channel:${channel.id}`;
            const conversationRoom = `conversation:${conversation.id}`;
            const normalizedPayload = {
                type: "new-message",
                conversationId: conversation.id,
                content: messageContent,
                createdAt: new Date().toISOString(),
                messageType: type,
                from: "business_app",
            };
            io.to(channelRoom).emit("new-message", normalizedPayload);
            io.to(conversationRoom).emit("new-message", normalizedPayload);
            console.log("[smb_message_echoes] Emitted echo message to rooms");
        }
        console.log(`[smb_message_echoes] Stored echo message ${whatsappMessageId} to ${customerPhone} in channel ${channel.id}`);
    }
}
async function handleSmbAppStateSync(value) {
    const { metadata, contacts: syncContacts } = value;
    if (!syncContacts || syncContacts.length === 0) {
        console.log("[smb_app_state_sync] No contacts to sync");
        return;
    }
    const phoneNumberId = metadata?.phone_number_id;
    if (!phoneNumberId) {
        console.error("[smb_app_state_sync] No phone_number_id in webhook");
        return;
    }
    const channel = await storage.getChannelByPhoneNumberId(phoneNumberId);
    if (!channel) {
        console.error(`[smb_app_state_sync] No channel found for phone_number_id: ${phoneNumberId}`);
        return;
    }
    for (const syncContact of syncContacts) {
        const phone = syncContact.wa_id;
        const name = syncContact.profile?.name || syncContact.name?.formatted_name;
        if (!phone)
            continue;
        let existingContact = await storage.getContactByPhoneAndChannel(phone, channel.id);
        if (!existingContact) {
            await storage.createContact({
                name: name || phone,
                phone,
                channelId: channel.id,
                source: 'whatsapp',
                createdBy: channel.createdBy || undefined,
            });
            console.log(`[smb_app_state_sync] Created contact ${phone} for channel ${channel.id}`);
        }
        else if (name && existingContact.name !== name) {
            await storage.updateContact(existingContact.id, { name });
            console.log(`[smb_app_state_sync] Updated contact name ${phone} -> ${name} for channel ${channel.id}`);
        }
    }
}
