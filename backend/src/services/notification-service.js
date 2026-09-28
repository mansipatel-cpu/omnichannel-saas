'use strict';
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
import { storage } from "../storage";
// Default fallbacks - only used if database is unavailable
const DEFAULT_LOW_CREDITS_THRESHOLD = 50;
const DEFAULT_APP_NAME = '';
// Cache for low credits threshold to avoid repeated DB calls
let cachedLowCreditsThreshold = null;
let thresholdCacheTime = 0;
const THRESHOLD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// Cache for app name
let cachedAppName = null;
let appNameCacheTime = 0;
async function getLowCreditsThreshold() {
    const now = Date.now();
    if (cachedLowCreditsThreshold !== null && (now - thresholdCacheTime) < THRESHOLD_CACHE_TTL) {
        return cachedLowCreditsThreshold;
    }
    try {
        const setting = await storage.getGlobalSetting('low_credits_threshold');
        const threshold = typeof setting?.value === 'number' ? setting.value : DEFAULT_LOW_CREDITS_THRESHOLD;
        cachedLowCreditsThreshold = threshold;
        thresholdCacheTime = now;
        return threshold;
    }
    catch (error) {
        console.error('[NotificationService] Failed to fetch low_credits_threshold, using default:', error);
        return DEFAULT_LOW_CREDITS_THRESHOLD;
    }
}
async function getAppName() {
    const now = Date.now();
    if (cachedAppName !== null && (now - appNameCacheTime) < THRESHOLD_CACHE_TTL) {
        return cachedAppName;
    }
    try {
        const setting = await storage.getGlobalSetting('app_name');
        const appName = typeof setting?.value === 'string' ? setting.value : DEFAULT_APP_NAME;
        cachedAppName = appName;
        appNameCacheTime = now;
        return appName;
    }
    catch (error) {
        console.error('[NotificationService] Failed to fetch app_name, using default:', error);
        return DEFAULT_APP_NAME;
    }
}
export const NotificationService = {
    async create(options) {
        try {
            await storage.createNotification({
                userId: options.userId,
                type: options.type,
                title: options.title,
                message: options.message,
                link: options.link || null,
                icon: options.icon || null,
                displayType: options.displayType || 'bell',
                priority: options.priority ?? 0,
                dismissible: options.dismissible ?? true,
                expiresAt: options.expiresAt || null,
            });
        }
        catch (error) {
            console.error("Failed to create notification:", error);
        }
    },
    async notifyLowCredits(userId, currentCredits) {
        await this.create({
            userId,
            type: "low_credits",
            title: "Low Credits Warning",
            message: `Your credit balance is low (${currentCredits} credits remaining). Purchase more credits to continue using phone numbers and making calls.`,
            link: "/settings",
        });
    },
    async notifyMembershipUpgraded(userId, planName) {
        await this.create({
            userId,
            type: "membership_upgraded",
            title: "Welcome to Pro",
            message: `Your membership has been upgraded to ${planName}. You now have unlimited agents, campaigns, and contacts!`,
            link: "/settings",
        });
    },
    async notifyMembershipCancelled(userId) {
        await this.create({
            userId,
            type: "membership_expiry",
            title: "Membership Cancelled",
            message: "Your Pro membership has been cancelled. You'll continue to have Pro access until the end of your billing period.",
            link: "/settings",
        });
    },
    async notifyCampaignCompleted(userId, campaignId, campaignName, callCount) {
        await this.create({
            userId,
            type: "campaign_completed",
            title: "Campaign Completed",
            message: `Campaign "${campaignName}" has completed with ${callCount} calls made.`,
            link: `/app/campaigns/${campaignId}`,
        });
    },
    async notifyCampaignFailed(userId, campaignId, campaignName, error) {
        await this.create({
            userId,
            type: "campaign_failed",
            title: "Campaign Failed",
            message: `Campaign "${campaignName}" failed: ${error}`,
            link: `/app/campaigns/${campaignId}`,
        });
    },
    async notifyCampaignPaused(userId, campaignId, campaignName, reason) {
        await this.create({
            userId,
            type: "campaign_paused",
            title: "Campaign Paused",
            message: `Campaign "${campaignName}" has been paused: ${reason}`,
            link: `/app/campaigns/${campaignId}`,
        });
    },
    async notifyPhoneBillingSuccess(userId, phoneNumber, creditsCharged) {
        await this.create({
            userId,
            type: "phone_billing_success",
            title: "Phone Number Renewed",
            message: `Phone number ${phoneNumber} has been renewed for ${creditsCharged} credits.`,
            link: "/app/phone-numbers",
        });
    },
    async notifyPhoneBillingFailed(userId, phoneNumber, reason) {
        await this.create({
            userId,
            type: "phone_billing_failed",
            title: "Phone Number Billing Failed",
            message: `Phone number ${phoneNumber} billing failed: ${reason}. The number has been released.`,
            link: "/app/phone-numbers",
        });
    },
    async notifyCallCreditFailed(userId, options) {
        const { callId, creditsRequired, currentBalance, durationSeconds } = options;
        const durationText = durationSeconds && durationSeconds > 0
            ? ` (${Math.ceil(durationSeconds / 60)} min call)`
            : '';
        await this.create({
            userId,
            type: "call_credit_failed",
            title: "Call Could Not Be Billed",
            message: `A call ended but your credit balance was too low to bill it${durationText}. Required ${creditsRequired} credits, balance ${currentBalance}. Top up to keep new calls running.`,
            link: `/app/calls/${callId}`,
            icon: "alert-triangle",
            priority: 70,
            displayType: 'both',
        });
    },
    async notifyPhoneReleased(userId, phoneNumber) {
        await this.create({
            userId,
            type: "phone_released",
            title: "Phone Number Released",
            message: `Phone number ${phoneNumber} has been released due to insufficient credits.`,
            link: "/app/phone-numbers",
        });
    },
    async notifyWelcome(userId, userName) {
        const appName = await getAppName();
        await this.create({
            userId,
            type: "welcome",
            title: `Welcome to ${appName}, ${userName}`,
            message: "Your account includes Voice calling and WhatsApp messaging. Create an AI agent for calls, then connect a WhatsApp channel to start campaigns. Both tools share this login.",
            link: "/app",
        });
    },
    async createNotificationForAllAdmins(options) {
        try {
            // Get all admin users
            const adminUsers = await storage.getAllAdminUsers();
            // Create a notification for each admin
            for (const admin of adminUsers) {
                await this.create({
                    ...options,
                    userId: admin.id,
                });
            }
        }
        catch (error) {
            console.error("Failed to create admin notifications:", error);
        }
    },
    async notifyAdmins(title, message, severity = 'info') {
        const icon = severity === 'critical' ? 'alert-triangle' : severity === 'warning' ? 'alert-circle' : 'info';
        await this.createNotificationForAllAdmins({
            type: `admin_${severity}`,
            title,
            message,
            icon,
            priority: severity === 'critical' ? 100 : severity === 'warning' ? 50 : 0,
            displayType: severity === 'critical' ? 'both' : 'bell',
        });
    },
    async notifyPaymentFailed(userId) {
        await this.create({
            userId,
            type: "payment_failed",
            title: "Payment Failed",
            message: "Your subscription payment failed. Please update your payment method to maintain your Pro membership.",
            link: "/settings",
            icon: "credit-card",
            priority: 80,
            displayType: 'both',
        });
    },
    async notifySubscriptionPastDue(userId) {
        await this.create({
            userId,
            type: "subscription_past_due",
            title: "Payment Overdue",
            message: "Your subscription is past due. Please update your payment method to avoid losing access to Pro features.",
            link: "/settings",
            icon: "alert-triangle",
            priority: 90,
            displayType: 'both',
        });
    },
    async shouldNotifyLowCredits(currentCredits) {
        const threshold = await getLowCreditsThreshold();
        return currentCredits > 0 && currentCredits <= threshold;
    },
    // Utility to get current threshold (for email service, etc.)
    async getLowCreditsThreshold() {
        return getLowCreditsThreshold();
    },
};
