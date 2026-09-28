'use strict';
import multer from "multer";
import { storage } from "../storage";
import { db } from "../config/database";
import { authenticateToken, requireRole, generateTokenAsync, checkActiveMembership, checkUserActive } from "../middleware/auth";
import { authenticateHybrid, optionalHybridAuth } from "../middleware/hybrid-auth";
import { authRateLimiter, strictRateLimiter, paymentRateLimiter } from "../middleware/rateLimiter";
import { elevenLabsService } from "../services/elevenlabs";
import { ElevenLabsPoolService } from "../services/elevenlabs-pool";
import { twilioService } from "../services/twilio";
import { campaignExecutor } from "../services/campaign-executor";
import { NotificationService as notificationServiceSingleton } from "../services/notification-service";
import { IncomingAgentService } from "../services/incoming-agent";
import { FlowAgentService } from "../services/flow-agent";
import { webhookDeliveryService } from "../services/webhook-delivery";
import { webhookTestService } from "../services/webhook-test-service";
import { contactUploadService } from "../services/contact-upload-service";
import { recordingService } from "../services/recording-service";
import { CampaignScheduler } from "../services/campaign-scheduler";
import { emailService } from "../services/email-service";
/**
 * Shared upload configuration for file uploads
 */
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
    'text/plain', 'application/json',
]);
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`File type ${file.mimetype} is not allowed`));
        }
    }
});
/**
 * Helper function to escape CSV fields
 */
export function escapeCSV(value) {
    if (typeof value === 'number')
        return value.toString();
    if (!value)
        return "";
    const stringValue = value.toString();
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}
/**
 * Creates the shared route context with all dependencies.
 * Call this once in registerRoutes and pass to all route factories.
 */
export function createRouteContext() {
    const elevenLabsPoolService = new ElevenLabsPoolService();
    const incomingAgentService = new IncomingAgentService();
    const flowAgentService = new FlowAgentService();
    const campaignScheduler = new CampaignScheduler();
    return {
        db,
        storage,
        authenticateToken,
        authenticateHybrid,
        optionalHybridAuth,
        requireRole,
        generateTokenAsync,
        checkActiveMembership,
        checkUserActive,
        authRateLimiter,
        strictRateLimiter,
        paymentRateLimiter,
        elevenLabsService,
        elevenLabsPoolService,
        twilioService,
        campaignExecutor,
        notificationService: notificationServiceSingleton,
        incomingAgentService,
        flowAgentService,
        webhookDeliveryService,
        webhookTestService,
        contactUploadService,
        recordingService,
        campaignScheduler,
        emailService,
        upload,
        escapeCSV,
    };
}
