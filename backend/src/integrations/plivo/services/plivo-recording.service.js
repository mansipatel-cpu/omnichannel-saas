'use strict';
/**
 * ============================================================
 * Plivo Recording Service
 *
 * Manages call recording via Plivo REST API:
 * - Start recording on active calls
 * - Stop recording on active calls
 * - Handle recording callbacks
 * ============================================================
 */
import axios from 'axios';
import { db } from '../../../config/database';
import { plivoCredentials } from '@shared/schema';
import { logger } from '../../../utils/logger';
import { getDomain } from '../../../utils/domain';
import { eq, and } from 'drizzle-orm';
export class PlivoRecordingService {
    static PLIVO_API_BASE = 'https://api.plivo.com/v1';
    /**
     * Get Plivo credentials for API authentication
     */
    static async getPlivoClient(credentialId) {
        let credential;
        if (credentialId) {
            const [cred] = await db
                .select()
                .from(plivoCredentials)
                .where(and(eq(plivoCredentials.id, credentialId), eq(plivoCredentials.isActive, true)))
                .limit(1);
            credential = cred;
        }
        if (!credential) {
            const [primaryCred] = await db
                .select()
                .from(plivoCredentials)
                .where(and(eq(plivoCredentials.isPrimary, true), eq(plivoCredentials.isActive, true)))
                .limit(1);
            credential = primaryCred;
        }
        if (!credential) {
            const [anyCred] = await db
                .select()
                .from(plivoCredentials)
                .where(eq(plivoCredentials.isActive, true))
                .limit(1);
            credential = anyCred;
        }
        if (!credential) {
            throw new Error('No active Plivo credentials found. Please configure Plivo credentials in admin settings.');
        }
        return credential;
    }
    /**
     * Get base URL for webhooks
     */
    static getBaseUrl() {
        return getDomain();
    }
    /**
     * Build the recording callback URL
     */
    static getRecordingCallbackUrl(callRecordId) {
        const baseUrl = this.getBaseUrl();
        return `${baseUrl}/api/plivo/recording/callback/${callRecordId}`;
    }
    /**
     * Start recording on an active call
     */
    static async startRecording(params) {
        const { callUuid, callRecordId, plivoCredentialId } = params;
        logger.info(`[Recording] Starting recording for call ${callUuid}`, undefined, 'Recording');
        try {
            const credential = await this.getPlivoClient(plivoCredentialId);
            const callbackUrl = this.getRecordingCallbackUrl(callRecordId);
            logger.info(`[Recording] Callback URL: ${callbackUrl}`, undefined, 'Recording');
            const url = `${this.PLIVO_API_BASE}/Account/${credential.authId}/Call/${callUuid}/Record/`;
            const response = await axios.post(url, {
                time_limit: 3600,
                file_format: 'mp3',
                callback_url: callbackUrl,
                callback_method: 'POST',
            }, {
                auth: {
                    username: credential.authId,
                    password: credential.authToken,
                },
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = response.data;
            logger.info(`[Recording] Started successfully: ${JSON.stringify(data)}`, undefined, 'Recording');
            return {
                success: true,
                recordingId: data.recording_id || data.recordingId,
                url: data.url,
            };
        }
        catch (error) {
            const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
            logger.error(`[Recording] Failed to start recording for call ${callUuid}: ${errorMessage}`, error, 'Recording');
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    /**
     * Stop recording on an active call
     */
    static async stopRecording(params) {
        const { callUuid, plivoCredentialId } = params;
        logger.info(`[Recording] Stopping recording for call ${callUuid}`, undefined, 'Recording');
        try {
            const credential = await this.getPlivoClient(plivoCredentialId);
            const url = `${this.PLIVO_API_BASE}/Account/${credential.authId}/Call/${callUuid}/Record/`;
            const response = await axios.delete(url, {
                auth: {
                    username: credential.authId,
                    password: credential.authToken,
                },
            });
            logger.info(`[Recording] Stop API Response Status: ${response.status}`, undefined, 'Recording');
            logger.info(`[Recording] ✓ Stopped successfully for ${callUuid}`, undefined, 'Recording');
            return {
                success: true,
            };
        }
        catch (error) {
            // 204 No Content is a success response for DELETE
            if (error.response?.status === 204) {
                logger.info(`[Recording] Stop API Response Status: 204`, undefined, 'Recording');
                logger.info(`[Recording] ✓ Stopped successfully for ${callUuid}`, undefined, 'Recording');
                return {
                    success: true,
                };
            }
            const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
            logger.error(`[Recording] Failed to stop recording for call ${callUuid}: ${errorMessage}`, error, 'Recording');
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
}
