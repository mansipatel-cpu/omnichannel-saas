'use strict';
import { storage } from '../storage';

const ELEVENLABS_HMAC_SECRET = 'elevenlabs_hmac_secret';
const ELEVENLABS_LAST_WEBHOOK_AT = 'elevenlabs_last_webhook_at';

function stripProtocol(url) {
    return url.replace(/^https?:\/\//, '');
}

function getFrontendUrl() {
    if (process.env.APP_DOMAIN) {
        const domain = stripProtocol(process.env.APP_DOMAIN);
        return `https://${domain}`;
    }
    return process.env.APP_URL || 'http://localhost:5000';
}

export function getElevenLabsWebhookUrl() {
    return `${getFrontendUrl()}/api/elevenlabs/webhook`;
}

export async function getElevenLabsHmacSecret() {
    const setting = await storage.getGlobalSetting(ELEVENLABS_HMAC_SECRET);
    if (setting?.value) {
        return setting.value;
    }
    return process.env.ELEVENLABS_HMAC_SECRET || null;
}

export async function setElevenLabsHmacSecret(secret) {
    await storage.updateGlobalSetting(ELEVENLABS_HMAC_SECRET, secret);
}

export async function recordWebhookReceived(gateway) {
    if (gateway !== 'elevenlabs') {
        return;
    }
    await storage.updateGlobalSetting(ELEVENLABS_LAST_WEBHOOK_AT, new Date().toISOString());
}
