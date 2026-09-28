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
'use strict';
import express from "express";
import path from "path";
import { createApp } from "./app";
import { registerRoutes } from "./src/routes";
import { db } from "./src/config/database";
import { sql } from "drizzle-orm";
function log(message, source = "express") {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
}
import { startPhoneBillingCron } from "./src/jobs/phone-billing-cron";
import { startCreditBackfillMonitor } from "./src/jobs/credit-backfill-monitor";
import { startPhoneReleaseRetryWorker } from "./src/jobs/phone-release-retry-worker";
import { runStartupHealthCheck } from "./src/services/startup-health-check";
import { setupGlobalHandlers, registerServer, signalReady } from "./src/services/graceful-shutdown";
import { startWatchdog } from "./src/services/resource-watchdog";
import { preloadJwtExpiry } from "./src/middleware/auth";
import { cleanupStaleMaintenanceFlag } from "./src/services/system-update-service";
import { storage } from "./src/storage";
import { initializeMigrationEngine } from "./src/integrations/elevenlabs-migration/index";
import { emailService } from "./src/services/email-service";
import { initializeDirectories } from "./src/utils/init-directories";
import { runAllSeeds } from "./src/database/seeders/seed-all";
export { db } from "./src/config/database";
import { resyncSipAgentTransferTools, resyncSipTrunkConfigs, resyncAppointmentWebhookUrls, resyncFormWebhookUrls, resyncMessagingWebhookUrls } from "./src/services/sip-transfer-resync";
import { CRMLeadProcessor } from "./src/integrations/crm/lead-processor.service";
import { deductCallCredits } from "./src/services/credit-service";
// Register CRMLeadProcessor globally so that dynamically loaded plugins can access it
global.CRMLeadProcessor = CRMLeadProcessor;
global.deductCallCredits = deductCallCredits;
// Setup global error handlers and shutdown signals FIRST
// This ensures crashes are caught even during initialization
setupGlobalHandlers();
// Ensure all required directories exist before starting
initializeDirectories();
// Diploy startup signature
console.log(`
====================================
Platform Initialized
©diploy
Unauthorized distribution prohibited
`);
const app = createApp();
(async () => {
    // Initialize Demo Mode if enabled (INTERNAL USE ONLY - not distributed to clients)
    // This folder is excluded from production ZIP packages
    if (process.env.DEMO_MODE === 'true') {
        try {
            const { initDemoMode, registerDemoModeRoutes } = await import('./src/demo-mode/index');
            initDemoMode(app);
            registerDemoModeRoutes(app);
        }
        catch (error) {
            console.error('[Demo Mode] Failed to initialize:', error);
        }
    }
    // Initialize email service from database settings FIRST (before health check)
    // This ensures database SMTP settings take precedence over env vars
    try {
        const emailInitialized = await emailService.reinitializeFromDatabase();
        if (emailInitialized) {
            console.log('📧 [Email] Service initialized from database settings');
        }
    }
    catch (error) {
        console.error('⚠️ [Email] Failed to initialize from database:', error);
    }
    // Run startup health checks before serving traffic
    try {
        await runStartupHealthCheck();
    }
    catch (error) {
        console.error('❌ [Startup] Health check failed:', error);
    }
    // Run database seeding on startup (safe - skips if data already exists)
    try {
        await runAllSeeds();
        console.log('✅ [Startup] Database seeding completed');
    }
    catch (error) {
        console.error('⚠️ [Startup] Database seeding failed (non-fatal):', error);
    }
    // Data fix: normalize phone number status 'assigned' → 'active'
    // The admin assign route previously set status='assigned' instead of 'active',
    // blocking those numbers from campaign execution. This corrects existing rows.
    try {
        await db.execute(sql `UPDATE phone_numbers SET status = 'active' WHERE status = 'assigned'`);
    }
    catch (error) {
        console.error('⚠️ [Startup] Phone status normalization failed (non-fatal):', error);
    }
    // Preload JWT expiry settings from database
    await preloadJwtExpiry(storage);
    // Clear any stale `.maintenance` flag left by a previous crashed update
    // so user traffic isn't blocked indefinitely.
    cleanupStaleMaintenanceFlag();
    // Resync SIP agents' transfer tools on startup (non-blocking)
    resyncSipAgentTransferTools().catch(err => {
        console.warn('[Startup] SIP transfer resync failed (non-fatal):', err);
    });
    // Resync SIP trunk configs (media encryption, addresses) on startup (non-blocking)
    resyncSipTrunkConfigs().catch(err => {
        console.warn('[Startup] SIP trunk config resync failed (non-fatal):', err);
    });
    // Resync appointment webhook URLs with current persisted secret (non-blocking)
    // Prevents "Invalid authentication token" errors when ElevenLabs agents have stale webhook URLs
    resyncAppointmentWebhookUrls().catch(err => {
        console.warn('[Startup] Appointment webhook resync failed (non-fatal):', err);
    });
    // Resync form submission webhook URLs with the now-stable HMAC-derived secret (non-blocking)
    // Repairs all existing flow agents that have stale form webhook URLs from the old random-secret era
    resyncFormWebhookUrls().catch(err => {
        console.warn('[Startup] Form webhook resync failed (non-fatal):', err);
    });
    // Resync messaging (WhatsApp/Email) webhook URLs with current context (non-blocking)
    // Repairs agents missing conversationId context or using stale secrets
    resyncMessagingWebhookUrls().catch(err => {
        console.warn('[Startup] Messaging webhook resync failed (non-fatal):', err);
    });
    // SIP Credit Guard: Disconnect agents from SIP numbers for users below credit threshold
    import('./src/services/sip-credit-guard').then(({ runStartupCreditGuardScan }) => {
        runStartupCreditGuardScan().catch(err => {
            console.warn('[Startup] SIP credit guard scan failed (non-fatal):', err);
        });
    }).catch(() => { });
    const server = await registerRoutes(app);
    // Global error handler - ALWAYS returns JSON for API routes
    app.use((err, req, res, _next) => {
        const status = err.status || err.statusCode || 500;
        const isProduction = process.env.NODE_ENV === 'production';
        const message = status >= 500 && isProduction
            ? "Internal Server Error"
            : (err.message || "Internal Server Error");
        const correlationId = req.correlationId;
        const errorResponse = {
            success: false,
            error: message,
            message
        };
        if (correlationId) {
            errorResponse.correlationId = correlationId;
        }
        console.error(`[Error Handler] ${req.method} ${req.path}:`, err.message || err);
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
            res.status(status).json(errorResponse);
        }
    });
    // API 404 handler - catches any /api/* route that wasn't matched
    // This MUST run before Vite catch-all to prevent HTML responses for API routes
    app.use('/api/*', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.status(404).json({
            success: false,
            error: "API endpoint not found",
            path: req.originalUrl,
            method: req.method
        });
    });
    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    const isProduction = app.get("env") === "production" || process.env.NODE_ENV === "production";
    // SEO meta tag injection middleware for social sharing (Facebook, WhatsApp, Twitter, etc.)
    // This injects og:image and other meta tags server-side since crawlers don't execute JavaScript
    const isPublicRoute = (pagePath) => {
        const normalized = pagePath.replace(/\/+$/, '') || '/';
        return seoPublicPaths.includes(normalized) || normalized.startsWith('/blog/');
    };
    const injectSeoMetaTags = async (html, baseUrl, pageUrl, pagePath) => {
        try {
            const [seoSettings, appNameSetting, appTaglineSetting] = await Promise.all([
                storage.getSeoSettings(),
                storage.getGlobalSetting('app_name'),
                storage.getGlobalSetting('app_tagline')
            ]);
            const escapeHtml = (str) => {
                return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };
            const siteName = String(appNameSetting?.value || 'AI Platform');
            const tagline = String(appTaglineSetting?.value || '');
            const title = String(seoSettings?.defaultTitle || siteName);
            const fullTitle = tagline ? `${title} - ${tagline}` : title;
            const description = String(seoSettings?.defaultDescription || tagline || 'AI-powered voice agents for automated calling');
            const isPublic = isPublicRoute(pagePath);
            if (isPublic) {
                html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`);
                html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(description)}" />`);
            }
            let ogImageUrl = String(seoSettings?.defaultOgImage || '/og-image.png');
            if (!ogImageUrl.startsWith('http')) {
                ogImageUrl = `${baseUrl}${ogImageUrl}`;
            }
            const ogImageExt = ogImageUrl.toLowerCase().split('.').pop()?.split('?')[0] || 'png';
            const ogImageType = ['jpg', 'jpeg'].includes(ogImageExt) ? 'image/jpeg'
                : ogImageExt === 'gif' ? 'image/gif'
                    : ogImageExt === 'webp' ? 'image/webp'
                        : 'image/png';
            const secureImageUrl = ogImageUrl.startsWith('https://') ? ogImageUrl : ogImageUrl.replace('http://', 'https://');
            let robotsTag = '';
            let canonicalTag = '';
            let verificationTags = '';
            if (isPublic) {
                robotsTag = `\n    <meta name="robots" content="index, follow" />`;
                const canonicalUrl = pageUrl.split('?')[0].split('#')[0];
                canonicalTag = `\n    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`;
                const googleVerification = seoSettings?.googleVerification;
                const bingVerification = seoSettings?.bingVerification;
                if (googleVerification) {
                    verificationTags += `\n    <meta name="google-site-verification" content="${escapeHtml(googleVerification)}" />`;
                }
                if (bingVerification) {
                    verificationTags += `\n    <meta name="msvalidate.01" content="${escapeHtml(bingVerification)}" />`;
                }
            }
            else {
                robotsTag = `\n    <meta name="robots" content="noindex, nofollow" />`;
            }
            const seoMetaTags = `
    <!-- Server-side SEO meta tags -->${robotsTag}${canonicalTag}${verificationTags}
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(secureImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="${ogImageType}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <!-- End server-side SEO meta tags -->`;
            return html.replace('</head>', `${seoMetaTags}\n  </head>`);
        }
        catch (error) {
            console.error('Error injecting SEO meta tags:', error);
            return html;
        }
    };
    // Crawler user agents that need server-rendered OG meta tags
    const crawlerUserAgents = [
        'facebookexternalhit',
        'Facebot',
        'WhatsApp',
        'Twitterbot',
        'LinkedInBot',
        'Slackbot',
        'Discordbot',
        'TelegramBot',
        'Pinterest',
        'Googlebot',
        'bingbot',
        'Applebot',
        'iMessageBot',
        'Apple-Messages'
    ];
    const isCrawler = (userAgent) => {
        if (!userAgent)
            return false;
        return crawlerUserAgents.some(crawler => userAgent.toLowerCase().includes(crawler.toLowerCase()));
    };
    // Middleware to serve SEO-optimized HTML for social media crawlers
    // This runs BEFORE Vite/static file serving to catch crawler requests
    app.use(async (req, res, next) => {
        const userAgent = req.headers['user-agent'];
        // Only intercept non-API HTML page requests from crawlers
        if (!req.path.startsWith('/api') && !req.path.includes('.') && isCrawler(userAgent)) {
            try {
                const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
                const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
                const baseUrl = `${protocol}://${host}`;
                const pageUrl = `${baseUrl}${req.originalUrl || req.path}`;
                // Read the appropriate HTML template based on environment
                const fs = await import('fs').then(m => m.promises);
                const prodPath = path.resolve(import.meta.dirname, 'public', 'index.html');
                const devPath = path.join(process.cwd(), 'frontend', 'index.html');
                // Use production build in production, dev template in development
                let indexPath = devPath;
                try {
                    await fs.access(prodPath);
                    if (isProduction) {
                        indexPath = prodPath;
                    }
                }
                catch {
                    // Production build doesn't exist, use dev path
                }
                let html = await fs.readFile(indexPath, 'utf-8');
                html = await injectSeoMetaTags(html, baseUrl, pageUrl, req.path);
                res.setHeader('Content-Type', 'text/html');
                res.send(html);
                return;
            }
            catch (error) {
                console.error('Error serving crawler-optimized HTML:', error);
            }
        }
        next();
    });
    if (!isProduction) {
        const devModule = "./src/vite";
        const { setupVite } = await import(/* @vite-ignore */ devModule);
        await setupVite(app, server);
        log("Hot reload enabled (UI updates instantly; backend restarts on server file changes)");
    }
    else {
        // Set NODE_ENV to production for proper middleware behavior
        process.env.NODE_ENV = "production";
        app.set("env", "production");
        log("Running in PRODUCTION mode");
        // In production, serve static files with SEO injection
        const fs = await import('fs');
        const distPath = path.resolve(import.meta.dirname, "public");
        if (!fs.existsSync(distPath)) {
            throw new Error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
        }
        app.use(express.static(distPath));
        // Serve index.html with SEO meta tags for all non-file routes
        app.use("*", async (req, res) => {
            try {
                const indexPath = path.resolve(distPath, "index.html");
                let html = await fs.promises.readFile(indexPath, 'utf-8');
                const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
                const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
                const baseUrl = `${protocol}://${host}`;
                const pageUrl = `${baseUrl}${req.originalUrl || req.path}`;
                const pagePath = req.originalUrl?.split('?')[0] || req.path;
                html = await injectSeoMetaTags(html, baseUrl, pageUrl, pagePath);
                res.setHeader('Content-Type', 'text/html');
                res.send(html);
            }
            catch (error) {
                console.error('Error serving index.html:', error);
                res.sendFile(path.resolve(distPath, "index.html"));
            }
        });
    }
    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    // Register the server for graceful shutdown
    registerServer(server);
    // In production ESM mode, Node.js can exit if the event loop appears empty
    // Set up keepalive BEFORE server.listen to ensure event loop stays active
    if (process.env.NODE_ENV === 'production') {
        const keepalive = setInterval(() => {
            // Heartbeat to keep process alive - do not use .unref()
            // This interval reference keeps the event loop active
        }, 30000);
        // Store reference to prevent garbage collection
        global.__keepalive = keepalive;
        console.log('🔄 [Production] Keepalive interval started before server.listen');
    }
    // Wrap server.listen in a Promise to ensure IIFE awaits server startup
    // This prevents premature exit in ESM mode on Cloud Run/containerized deployments
    await new Promise((resolve, reject) => {
        // Build listen options - reusePort is only supported on Linux/Unix, not Windows
        const listenOptions = {
            port,
            host: "0.0.0.0",
        };
        if (process.platform !== 'win32') {
            listenOptions.reusePort = true;
        }
        const startListening = () => {
            log(`serving on port ${port}`);
            // Start phone number billing cron job
            startPhoneBillingCron();
            // Start daily un-billed call detection sweep across all telephony engines.
            startCreditBackfillMonitor();
            // Start worker that retries failed provider phone-number releases
            startPhoneReleaseRetryWorker();
            // Start resource watchdog for auto-restart monitoring
            startWatchdog();
            // Start ElevenLabs migration engine (handles retry queue for capacity errors)
            initializeMigrationEngine();
            // Initialize BullMQ if enabled (opt-in via ENABLE_BULLMQ=true and REDIS_URL)
            // This runs async and won't block startup if Redis is unavailable
            import('./src/infrastructure/bullmq/index').then(async (bullmq) => {
                try {
                    const initialized = await bullmq.initializeBullMQ();
                    if (initialized) {
                        console.log('✅ [BullMQ] Queue system ready for campaign processing');
                    }
                }
                catch (error) {
                    console.warn('⚠️ [BullMQ] Failed to initialize (using fallback queues):', error.message);
                }
            }).catch(() => {
                // BullMQ module not available, continue without it
            });
            // Signal PM2 that the process is ready to receive connections
            signalReady();
            console.log('✅ [Production] Server fully initialized and listening');
            resolve();
        };
        const tryListen = (attempt = 0) => {
            const onError = (err) => {
                if (err.code === 'EADDRINUSE' && attempt < 10) {
                    const delay = 500 + attempt * 300;
                    console.warn(`⚠️ Port ${port} is in use, retrying in ${delay}ms (${attempt + 1}/10)`);
                    const retry = () => setTimeout(() => tryListen(attempt + 1), delay);
                    try {
                        server.close(retry);
                    }
                    catch {
                        retry();
                    }
                    return;
                }
                reject(err);
            };
            server.once('error', onError);
            server.listen(listenOptions, () => {
                server.removeListener('error', onError);
                startListening();
            });
        };
        tryListen();
    });
    // Keep the IIFE alive - this line is never reached because server runs indefinitely
    // but having an unresolved promise after await ensures the event loop stays active
    console.log('🔄 [Server] Main initialization complete, server running...');
})();
