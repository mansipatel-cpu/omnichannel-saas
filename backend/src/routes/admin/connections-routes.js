'use strict';
import { storage } from '../../storage';
import { requireAdminPermission } from '../../middleware/admin-auth';
import { db } from '../../config/database';
import { eq } from 'drizzle-orm';
import { openaiCredentials } from '@shared/schema';
import { ElevenLabsPoolService } from '../../services/elevenlabs-pool';
async function safeParseResponse(response) {
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        return { data, isJson: true };
    }
    catch {
        return { data: null, isJson: false, rawText: text };
    }
}
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
export function registerConnectionsRoutes(router) {
    router.post('/test-connection/twilio', requireAdminPermission('settings', 'system_settings', 'update'), async (req, res) => {
        try {
            const dbSid = await storage.getGlobalSetting('twilio_account_sid');
            const dbToken = await storage.getGlobalSetting('twilio_auth_token');
            const accountSid = dbSid?.value || process.env.TWILIO_ACCOUNT_SID;
            const authToken = dbToken?.value || process.env.TWILIO_AUTH_TOKEN;
            if (!accountSid || !authToken) {
                return res.json({ connected: false, error: 'Twilio credentials not configured' });
            }
            const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
            const response = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            const { data, isJson, rawText } = await safeParseResponse(response);
            if (response.ok && isJson && data) {
                res.json({ connected: true, accountName: data.friendly_name, accountStatus: data.status });
            }
            else {
                res.json({ connected: false, error: `Twilio API error: ${response.status} ${response.statusText}`, details: isJson ? JSON.stringify(data) : (rawText?.substring(0, 200) || 'Unknown error') });
            }
        }
        catch (error) {
            const isTimeout = error.name === 'AbortError';
            res.json({ connected: false, error: isTimeout ? 'Connection timed out. Twilio API may be unreachable.' : (error.message || 'Failed to test Twilio connection') });
        }
    });
    router.post('/test-connection/elevenlabs', requireAdminPermission('settings', 'system_settings', 'update'), async (req, res) => {
        try {
            const poolStats = await ElevenLabsPoolService.getPoolStats();
            const envApiKey = process.env.ELEVENLABS_API_KEY;
            if (poolStats.totalKeys > 0) {
                try {
                    const credential = await ElevenLabsPoolService.getAvailableCredential();
                    if (credential) {
                        const voicesResponse = await fetchWithTimeout('https://api.elevenlabs.io/v2/voices?page_size=10', { headers: { 'xi-api-key': credential.apiKey } });
                        const agentsResponse = await fetchWithTimeout('https://api.elevenlabs.io/v1/convai/agents', { headers: { 'xi-api-key': credential.apiKey } });
                        const voicesParsed = await safeParseResponse(voicesResponse);
                        const agentsParsed = await safeParseResponse(agentsResponse);
                        if (voicesResponse.ok && agentsResponse.ok && voicesParsed.isJson && agentsParsed.isJson) {
                            const healthyCount = poolStats.credentials.filter(c => c.healthStatus === 'healthy').length;
                            return res.json({
                                connected: true,
                                voiceCount: voicesParsed.data?.total_count || voicesParsed.data?.voices?.length || 0,
                                agentCount: agentsParsed.data?.agents?.length || 0,
                                source: `Pool (${poolStats.totalKeys} keys, ${healthyCount} healthy)`,
                                apiVersion: 'v2 (voices) + v1 (agents)'
                            });
                        }
                    }
                }
                catch (poolError) {
                    console.error('Pool key test failed, trying env var:', poolError);
                }
            }
            if (!envApiKey) {
                return res.json({ connected: false, error: 'ElevenLabs API key not configured (no env var or pool keys)' });
            }
            const voicesResponse = await fetchWithTimeout('https://api.elevenlabs.io/v2/voices?page_size=10', { headers: { 'xi-api-key': envApiKey } });
            const agentsResponse = await fetchWithTimeout('https://api.elevenlabs.io/v1/convai/agents', { headers: { 'xi-api-key': envApiKey } });
            const voicesParsed = await safeParseResponse(voicesResponse);
            const agentsParsed = await safeParseResponse(agentsResponse);
            if (voicesResponse.ok && agentsResponse.ok && voicesParsed.isJson && agentsParsed.isJson) {
                res.json({
                    connected: true,
                    voiceCount: voicesParsed.data?.total_count || voicesParsed.data?.voices?.length || 0,
                    agentCount: agentsParsed.data?.agents?.length || 0,
                    source: 'Environment variable',
                    apiVersion: 'v2 (voices) + v1 (agents)'
                });
            }
            else {
                res.json({ connected: false, error: !voicesResponse.ok ? `ElevenLabs v2 voices API error: ${voicesResponse.status}` : `ElevenLabs v1 agents API error: ${agentsResponse.status}` });
            }
        }
        catch (error) {
            const isTimeout = error.name === 'AbortError';
            res.json({ connected: false, error: isTimeout ? 'Connection timed out.' : (error.message || 'Failed to test ElevenLabs connection') });
        }
    });
    router.post('/test-connection/openai', requireAdminPermission('settings', 'system_settings', 'update'), async (req, res) => {
        try {
            const dbApiKey = await storage.getGlobalSetting('openai_api_key');
            const apiKey = dbApiKey?.value || process.env.OPENAI_API_KEY;
            if (!apiKey) {
                return res.json({ connected: false, error: 'OpenAI API key not configured' });
            }
            const response = await fetchWithTimeout('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
            const { data, isJson, rawText } = await safeParseResponse(response);
            if (response.ok && isJson && data) {
                res.json({
                    connected: true,
                    modelCount: data.data?.length || 0,
                    hasEmbeddings: data.data?.some((m) => m.id.includes('embedding')) || false,
                    source: dbApiKey?.value ? 'Database' : 'Environment variable'
                });
            }
            else {
                res.json({ connected: false, error: `OpenAI API error: ${response.status} ${response.statusText}` });
            }
        }
        catch (error) {
            const isTimeout = error.name === 'AbortError';
            res.json({ connected: false, error: isTimeout ? 'Connection timed out.' : (error.message || 'Failed to test OpenAI connection') });
        }
    });
    router.post('/test-connection/openai-realtime', requireAdminPermission('settings', 'system_settings', 'update'), async (req, res) => {
        try {
            const credentials = await db.select().from(openaiCredentials).where(eq(openaiCredentials.isActive, true));
            if (!credentials || credentials.length === 0) {
                return res.json({ connected: false, error: 'No OpenAI Realtime credentials configured', keyCount: 0 });
            }
            const firstCredential = credentials[0];
            const modelsResponse = await fetchWithTimeout('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${firstCredential.apiKey}` } });
            if (!modelsResponse.ok) {
                const { data, isJson, rawText } = await safeParseResponse(modelsResponse);
                return res.json({ connected: false, error: `OpenAI API error: ${modelsResponse.status}`, keyCount: credentials.length, details: isJson ? JSON.stringify(data) : rawText?.substring(0, 200) });
            }
            const modelsData = await modelsResponse.json();
            const hasRealtimeModels = modelsData.data?.some((m) => m.id.includes('realtime')) || false;
            let realtimeSessionsWorking = false;
            let realtimeError = '';
            try {
                const realtimeResponse = await fetchWithTimeout('https://api.openai.com/v1/realtime/client_secrets', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${firstCredential.apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session: {
                            type: 'realtime',
                            model: 'gpt-realtime-mini'
                        }
                    })
                });
                if (realtimeResponse.ok) {
                    realtimeSessionsWorking = true;
                }
                else {
                    const errorText = await realtimeResponse.text();
                    try {
                        const parsed = JSON.parse(errorText);
                        realtimeError = parsed.error?.message || `HTTP ${realtimeResponse.status}`;
                    }
                    catch {
                        realtimeError = `HTTP ${realtimeResponse.status}: ${errorText.substring(0, 100)}`;
                    }
                }
            }
            catch (e) {
                realtimeError = e.message || 'Failed to test realtime endpoint';
            }
            res.json({
                connected: realtimeSessionsWorking,
                keyCount: credentials.length,
                freeKeys: credentials.filter(c => c.modelTier === 'free').length,
                proKeys: credentials.filter(c => c.modelTier === 'pro').length,
                hasRealtimeModels,
                realtimeSessionsWorking,
                realtimeError: realtimeError || undefined,
                source: 'Credential Pool'
            });
        }
        catch (error) {
            const isTimeout = error.name === 'AbortError';
            res.json({ connected: false, error: isTimeout ? 'Connection timed out.' : (error.message || 'Failed to test OpenAI Realtime connection') });
        }
    });
}
