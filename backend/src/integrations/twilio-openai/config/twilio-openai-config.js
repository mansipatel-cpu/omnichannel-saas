'use strict';
/**
 * ============================================================
 * Twilio + OpenAI Realtime Engine Configuration
 *
 * Configuration for the isolated Twilio-OpenAI telephony engine.
 * Uses existing Twilio credentials from the database.
 * ============================================================
 */
import { getDomain } from '../../../utils/domain';
export const TWILIO_OPENAI_CONFIG = {
    openaiRealtimeUrl: 'wss://api.openai.com/v1/realtime',
    openaiRealtimeModel: 'gpt-realtime-1.5',
    defaultVoice: 'alloy',
    defaultTemperature: 0.7,
    webhookTimeout: 15000,
    maxCallDuration: 3600,
    recordCalls: true,
};
export function getWebhookBaseUrl() {
    return getDomain();
}
export function getAnswerWebhookUrl() {
    return `${getWebhookBaseUrl()}/api/twilio-openai/voice/answer`;
}
export function getStatusWebhookUrl() {
    return `${getWebhookBaseUrl()}/api/twilio-openai/voice/status`;
}
export function getStreamWebhookUrl(callSid) {
    const baseUrl = getWebhookBaseUrl();
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'wss://');
    return `${wsUrl}/api/twilio-openai/stream/${callSid}`;
}
export function getIncomingWebhookUrl() {
    return `${getWebhookBaseUrl()}/api/twilio-openai/voice/incoming`;
}
export function getRecordingWebhookUrl() {
    return `${getWebhookBaseUrl()}/api/twilio-openai/voice/recording`;
}
export function generateTwiML(options) {
    const { message, streamUrl, statusCallbackUrl, customParameters } = options;
    let customParamsXml = '';
    if (customParameters) {
        for (const [key, value] of Object.entries(customParameters)) {
            customParamsXml += `<Parameter name="${key}" value="${escapeXml(value)}" />`;
        }
    }
    const connectAction = statusCallbackUrl ? `action="${escapeXml(statusCallbackUrl)}"` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${message ? `<Say>${escapeXml(message)}</Say>` : ''}
  <Connect ${connectAction}>
    <Stream url="${escapeXml(streamUrl)}">
      ${customParamsXml}
    </Stream>
  </Connect>
</Response>`;
}
export function generateTransferTwiML(phoneNumber, callerId) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}">
    <Number>${escapeXml(phoneNumber)}</Number>
  </Dial>
</Response>`;
}
export function generateHangupTwiML(message) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${message ? `<Say>${escapeXml(message)}</Say>` : ''}
  <Hangup/>
</Response>`;
}
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
