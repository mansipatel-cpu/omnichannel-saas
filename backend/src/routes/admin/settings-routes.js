'use strict';
import { storage } from '../../storage';
import { requireAdminPermission } from '../../middleware/admin-auth';
import { db } from '../../config/database';
import { eq } from 'drizzle-orm';
import { openaiCredentials } from '@shared/schema';
import { ElevenLabsPoolService } from '../../services/elevenlabs-pool';
import { getResourceStatus, clearSettingsCache } from '../../services/resource-watchdog';
import { resyncElevenLabsPhoneCredentials } from '../../services/elevenlabs-phone-resync';
export function registerSettingsRoutes(router) {
    router.get('/settings', requireAdminPermission('settings', 'system_settings', 'read'), async (req, res) => {
        try {
            const settingKeys = [
                'default_llm_free', 'default_tts_model', 'pro_plan_bonus_credits', 'credit_price_per_minute',
                'phone_number_monthly_credits', 'min_credit_purchase', 'system_phone_pool_size', 'llm_margin_percentage',
                'twilio_account_sid', 'twilio_auth_token', 'plivo_auth_id', 'plivo_auth_token',
                'elevenlabs_api_key', 'openai_api_key',
                'google_client_id', 'google_client_secret',
                'auto_restart_enabled', 'auto_restart_ram_percent', 'auto_restart_cpu_percent',
                'system_timezone'
            ];
            const settings = {};
            for (const key of settingKeys) {
                const setting = await storage.getGlobalSetting(key);
                if (setting) {
                    settings[key] = setting.value;
                }
            }
            const dbTwilioSid = settings.twilio_account_sid;
            const dbTwilioToken = settings.twilio_auth_token;
            const dbTwilioConfigured = !!(dbTwilioSid && dbTwilioSid.trim() && dbTwilioToken && dbTwilioToken.trim());
            settings.twilio_configured = dbTwilioConfigured;
            const dbPlivoAuthId = settings.plivo_auth_id;
            const dbPlivoAuthToken = settings.plivo_auth_token;
            const dbPlivoConfigured = !!(dbPlivoAuthId && dbPlivoAuthId.trim() && dbPlivoAuthToken && dbPlivoAuthToken.trim());
            settings.plivo_configured = dbPlivoConfigured;
            const poolStats = await ElevenLabsPoolService.getPoolStats();
            settings.elevenlabs_configured = poolStats.totalKeys > 0;
            const dbOpenAIKey = settings.openai_api_key;
            settings.openai_configured = !!(dbOpenAIKey && dbOpenAIKey.trim());
            const openaiRealtimeCredentials = await db.select().from(openaiCredentials).where(eq(openaiCredentials.isActive, true));
            settings.openai_realtime_configured = openaiRealtimeCredentials.length > 0;
            const dbGoogleClientId = settings.google_client_id;
            const dbGoogleClientSecret = settings.google_client_secret;
            const envGoogleClientId = process.env.GOOGLE_CLIENT_ID;
            const envGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
            settings.google_oauth_configured = !!((dbGoogleClientId || envGoogleClientId) && (dbGoogleClientSecret || envGoogleClientSecret));
            // Mask both google credential fields — replace raw values with display-safe form
            if (dbGoogleClientId) {
                settings.google_client_id_display = dbGoogleClientId.length > 8 ? `...${dbGoogleClientId.slice(-8)}` : dbGoogleClientId;
                settings.google_client_id = undefined; // remove raw value from response
            }
            else if (envGoogleClientId) {
                settings.google_client_id_display = envGoogleClientId.length > 8 ? `...${envGoogleClientId.slice(-8)}` : envGoogleClientId;
                settings.google_client_id_from_env = true;
                settings.google_client_id = undefined;
            }
            const secretKeys = [
                'twilio_auth_token', 'plivo_auth_token', 'openai_api_key',
                'google_client_secret'
            ];
            for (const key of secretKeys) {
                if (settings[key]) {
                    settings[key] = true;
                }
            }
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.json(settings);
        }
        catch (error) {
            console.error('Error fetching settings:', error);
            res.status(500).json({ error: 'Failed to fetch settings' });
        }
    });
    router.get('/system-settings', requireAdminPermission('settings', 'system_settings', 'read'), async (req, res) => {
        try {
            const systemSettingKeys = [
                'jwt_expiry_days', 'otp_expiry_minutes', 'password_reset_expiry_minutes', 'phone_number_monthly_credits',
                'low_credits_threshold', 'webhook_retry_max_attempts', 'webhook_retry_intervals_minutes', 'webhook_expiry_hours',
                'system_phone_pool_size', 'max_ws_connections_per_process', 'max_ws_connections_per_user', 'max_ws_connections_per_ip',
                'max_openai_connections_per_credential', 'openai_connection_timeout_ms', 'openai_idle_timeout_ms',
                'db_pool_min_connections', 'db_pool_max_connections', 'db_pool_idle_timeout_ms', 'campaign_batch_concurrency',
            ];
            const systemSettings = {};
            for (const key of systemSettingKeys) {
                const setting = await storage.getGlobalSetting(key);
                if (setting) {
                    systemSettings[key] = setting.value;
                }
            }
            const defaults = {
                jwt_expiry_days: 7, otp_expiry_minutes: 5, password_reset_expiry_minutes: 5, phone_number_monthly_credits: 50,
                low_credits_threshold: 50, webhook_retry_max_attempts: 5, webhook_retry_intervals_minutes: [1, 5, 15, 30, 60],
                webhook_expiry_hours: 24, system_phone_pool_size: 5, max_ws_connections_per_process: 1000,
                max_ws_connections_per_user: 5, max_ws_connections_per_ip: 10, max_openai_connections_per_credential: 50,
                openai_connection_timeout_ms: 3600000, openai_idle_timeout_ms: 300000, db_pool_min_connections: 2,
                db_pool_max_connections: 20, db_pool_idle_timeout_ms: 30000, campaign_batch_concurrency: 10,
            };
            for (const key of systemSettingKeys) {
                if (systemSettings[key] === undefined) {
                    systemSettings[key] = defaults[key];
                }
            }
            res.json(systemSettings);
        }
        catch (error) {
            console.error('Error fetching system settings:', error);
            res.status(500).json({ error: 'Failed to fetch system settings' });
        }
    });
    router.get('/settings/:key', requireAdminPermission('settings', 'system_settings', 'read'), async (req, res) => {
        try {
            const { key } = req.params;
            const setting = await storage.getGlobalSetting(key);
            if (!setting) {
                const defaults = {
                    'default_tts_model': 'eleven_turbo_v2', 'default_llm_free': null, 'pro_plan_bonus_credits': 0,
                    'credit_price_per_minute': 0.1, 'phone_number_monthly_credits': 50, 'min_credit_purchase': 10,
                    'system_phone_pool_size': 5, 'llm_margin_percentage': 15, 'auto_restart_enabled': false,
                    'auto_restart_ram_percent': 75, 'auto_restart_cpu_percent': 85,
                    'system_timezone': 'UTC'
                };
                return res.json({ [key]: defaults[key] ?? null });
            }
            res.json({ [key]: setting.value });
        }
        catch (error) {
            console.error('Error fetching setting:', error);
            res.status(500).json({ error: 'Failed to fetch setting' });
        }
    });
    router.patch('/settings/:key', requireAdminPermission('settings', 'system_settings', 'update'), async (req, res) => {
        try {
            const { key } = req.params;
            const { value } = req.body;
            const allowedCredentials = [
                'twilio_account_sid', 'twilio_auth_token', 'openai_api_key', 'elevenlabs_hmac_secret',
                'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name',
                'app_name', 'app_tagline', 'logo_url', 'favicon_url', 'branding_updated_at',
                'google_client_id', 'google_client_secret',
                'password_reset_expiry_minutes'
            ];
            if (!allowedCredentials.includes(key) && (key.includes('api_key') || key.includes('secret') || key.includes('password') || key.includes('token'))) {
                return res.status(400).json({ error: 'API keys must be configured as environment variables' });
            }
            let finalValue = value;
            if (key === 'auto_restart_enabled') {
                finalValue = value === true || value === 'true';
            }
            else if (key === 'auto_restart_ram_percent') {
                const ramPercent = Number(value);
                if (isNaN(ramPercent))
                    return res.status(400).json({ error: 'RAM percentage must be a number' });
                finalValue = Math.max(50, Math.min(95, ramPercent));
            }
            else if (key === 'auto_restart_cpu_percent') {
                const cpuPercent = Number(value);
                if (isNaN(cpuPercent))
                    return res.status(400).json({ error: 'CPU percentage must be a number' });
                finalValue = Math.max(20, Math.min(95, cpuPercent));
            }
            await storage.updateGlobalSetting(key, finalValue);
            if (key.startsWith('auto_restart_')) {
                clearSettingsCache();
            }
            if (key === 'twilio_account_sid' || key === 'twilio_auth_token') {
                resyncElevenLabsPhoneCredentials().then(summary => {
                    if (summary.synced > 0 || summary.failed > 0) {
                        console.log(`[Settings] Twilio credential change: re-synced ${summary.synced} ElevenLabs phone number(s), ${summary.failed} failed`);
                    }
                    if (summary.errors.length > 0) {
                        console.error('[Settings] ElevenLabs resync errors:', summary.errors);
                    }
                }).catch(err => {
                    console.error('[Settings] Background ElevenLabs resync failed:', err.message);
                });
            }
            res.json({ success: true, key, value: finalValue });
        }
        catch (error) {
            console.error(`Error updating setting '${req.params.key}':`, error);
            res.status(500).json({ error: 'Failed to update setting' });
        }
    });
    router.get('/resource-status', requireAdminPermission('settings', 'system_settings', 'read'), async (req, res) => {
        try {
            const status = await getResourceStatus();
            res.json(status);
        }
        catch (error) {
            console.error('Error getting resource status:', error);
            res.status(500).json({ error: 'Failed to get resource status' });
        }
    });
    router.get('/analytics', requireAdminPermission('settings', 'analytics_settings', 'read'), async (req, res) => {
        try {
            const timeRange = req.query.timeRange || '30days';
            const analytics = await storage.getGlobalAnalytics(timeRange);
            res.json(analytics || {});
        }
        catch (error) {
            console.error('Error fetching analytics:', error);
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    });
}
