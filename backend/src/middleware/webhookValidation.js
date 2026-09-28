"use strict";
import crypto from "crypto";
import { WebhookValidationError } from "../utils/errors";
import { storage } from "../storage";
/**
 * Middleware to capture raw body for webhook signature verification.
 * Must be applied before body parsers for webhook routes.
 *
 * @param {RawBodyRequest} req - Express request with rawBody property
 * @param {Response} _res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function captureRawBody(req, _res, next) {
    if (req.headers["content-type"] === "application/json") {
        let data = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
            data += chunk;
        });
        req.on("end", () => {
            req.rawBody = Buffer.from(data, "utf8");
            try {
                req.body = JSON.parse(data);
            }
            catch {
                req.body = {};
            }
            next();
        });
    }
    else {
        next();
    }
}
/**
 * Validates Twilio webhook signatures.
 * Uses Twilio's built-in request validation.
 *
 * Handles proxy environments (reverse proxies, load balancers) by:
 * 1. Using X-Forwarded-Proto header for correct protocol detection
 * 2. Using X-Forwarded-Host or configured domain for correct host
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export async function validateTwilioWebhook(req, res, next) {
    try {
        const twilioSignature = req.headers["x-twilio-signature"];
        if (!twilioSignature) {
            console.warn("[Twilio Webhook] No signature header found, skipping validation");
            return next();
        }
        const authTokenSetting = await storage.getGlobalSetting("twilio_auth_token");
        const authTokenValue = authTokenSetting?.value || process.env.TWILIO_AUTH_TOKEN;
        if (!authTokenValue || typeof authTokenValue !== "string") {
            console.warn("[Twilio Webhook] No auth token configured, skipping signature verification");
            return next();
        }
        const authToken = authTokenValue;
        const twilioModule = await import("twilio");
        // Handle both ESM (development) and CommonJS (production bundled) module structures
        // In ESM/tsx: twilioModule.default.validateRequest exists
        // In bundled production: twilioModule.validateRequest or twilioModule.default may differ
        const twilio = twilioModule.default || twilioModule;
        const validateRequest = typeof twilio.validateRequest === 'function'
            ? twilio.validateRequest
            : twilioModule.validateRequest;
        if (typeof validateRequest !== 'function') {
            console.error("[Twilio Webhook] validateRequest function not found in Twilio module");
            console.error("[Twilio Webhook] Module keys:", Object.keys(twilioModule));
            console.error("[Twilio Webhook] Default keys:", twilio ? Object.keys(twilio) : 'no default');
            throw new Error("Twilio validateRequest function not available");
        }
        // Construct the URL that Twilio used to calculate the signature
        // Behind proxies (reverse proxies, load balancers), req.protocol is 'http' but Twilio calls 'https'
        const protocol = req.headers["x-forwarded-proto"] || req.protocol;
        // Get the host - prefer X-Forwarded-Host, then configured domain, then req.get("host")
        const forwardedHost = req.headers["x-forwarded-host"];
        let host;
        if (forwardedHost) {
            // Extract just the first host if multiple are provided (comma-separated)
            host = forwardedHost.split(',')[0].trim();
        }
        else {
            // Try to get from environment/configured domain
            const devDomain = process.env.DEV_DOMAIN;
            const appDomain = process.env.APP_DOMAIN;
            if (process.env.NODE_ENV !== 'production' && devDomain) {
                // Remove protocol prefix if present in DEV_DOMAIN
                host = devDomain.replace(/^https?:\/\//, '');
            }
            else if (appDomain) {
                // Remove protocol prefix if present in APP_DOMAIN
                host = appDomain.replace(/^https?:\/\//, '');
            }
            else {
                host = req.get("host") || 'localhost';
            }
        }
        const url = `${protocol}://${host}${req.originalUrl}`;
        console.log(`[Twilio Webhook] Validating signature for URL: ${url}`);
        const isValid = validateRequest(authToken, twilioSignature, url, req.body);
        if (!isValid) {
            console.error(`[Twilio Webhook] Signature mismatch. URL used: ${url}`);
            throw new WebhookValidationError("twilio", "Invalid Twilio webhook signature");
        }
        console.log("[Twilio Webhook] Signature verified successfully");
        next();
    }
    catch (error) {
        if (error instanceof WebhookValidationError) {
            console.error(`[Twilio Webhook] Validation failed: ${error.message}`);
            res.status(401).json(error.toJSON());
        }
        else {
            next(error);
        }
    }
}
/**
 * Validates ElevenLabs webhook signatures using HMAC-SHA256.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export async function validateElevenLabsWebhook(req, res, next) {
    try {
        const signature = req.headers["x-elevenlabs-signature"];
        if (!signature) {
            console.warn("[ElevenLabs Webhook] No signature header found, skipping validation");
            return next();
        }
        const webhookSecretSetting = await storage.getGlobalSetting("elevenlabs_webhook_secret");
        const webhookSecret = webhookSecretSetting?.value;
        if (!webhookSecret || typeof webhookSecret !== "string") {
            console.warn("[ElevenLabs Webhook] No webhook secret configured, skipping signature verification");
            return next();
        }
        const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");
        if (expectedSignature !== signature) {
            throw new WebhookValidationError("elevenlabs", "Invalid webhook signature");
        }
        console.log("[ElevenLabs Webhook] Signature verified successfully");
        next();
    }
    catch (error) {
        if (error instanceof WebhookValidationError) {
            console.error(`[ElevenLabs Webhook] Validation failed: ${error.message}`);
            res.status(401).json(error.toJSON());
        }
        else {
            next(error);
        }
    }
}
/**
 * Generic HMAC-SHA256 webhook signature validator.
 * Can be configured for different providers.
 *
 * @param {object} config - Configuration for the validator
 * @param {string} config.provider - Name of the webhook provider
 * @param {string} config.signatureHeader - HTTP header containing the signature
 * @param {string} config.secretKey - Key name in global settings for webhook secret
 * @param {string} config.secretEnvVar - Environment variable name for webhook secret
 * @returns {Function} Express middleware function
 */
export function createHmacWebhookValidator(config) {
    return async (req, res, next) => {
        try {
            const signature = req.headers[config.signatureHeader.toLowerCase()];
            if (!signature) {
                console.warn(`[${config.provider} Webhook] No signature header found, skipping validation`);
                return next();
            }
            const secretSetting = await storage.getGlobalSetting(config.secretKey);
            const secretValue = secretSetting?.value || (config.secretEnvVar ? process.env[config.secretEnvVar] : undefined);
            if (!secretValue || typeof secretValue !== "string") {
                console.warn(`[${config.provider} Webhook] No secret configured, skipping signature verification`);
                return next();
            }
            const secret = secretValue;
            const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);
            const expectedSignature = crypto
                .createHmac("sha256", secret)
                .update(rawBody)
                .digest("hex");
            if (expectedSignature !== signature) {
                throw new WebhookValidationError(config.provider, "Invalid webhook signature");
            }
            console.log(`[${config.provider} Webhook] Signature verified successfully`);
            next();
        }
        catch (error) {
            if (error instanceof WebhookValidationError) {
                console.error(`[${config.provider} Webhook] Validation failed: ${error.message}`);
                res.status(401).json(error.toJSON());
            }
            else {
                next(error);
            }
        }
    };
}
/**
 * Logs webhook requests for debugging and auditing.
 *
 * @param {string} provider - Name of the webhook provider
 * @returns {Function} Express middleware function
 */
export function logWebhookRequest(provider) {
    return (req, _res, next) => {
        console.log(`[${provider} Webhook] Received request:`, {
            method: req.method,
            path: req.path,
            headers: {
                "content-type": req.headers["content-type"],
                "user-agent": req.headers["user-agent"]
            },
            timestamp: new Date().toISOString()
        });
        next();
    };
}
