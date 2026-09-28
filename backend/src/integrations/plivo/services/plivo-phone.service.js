'use strict';
/**
 * ============================================================
 * Plivo Phone Number Service
 *
 * Manages phone number inventory:
 * - Search available numbers by country/region
 * - Purchase numbers
 * - Release numbers
 * - Admin pricing configuration
 * - KYC status tracking for India numbers
 * ============================================================
 */
import * as plivo from 'plivo';
import { db } from "../../../config/database";
import { plivoPhoneNumbers, plivoCredentials, plivoPhonePricing, users, creditTransactions, globalSettings } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from '../../../utils/logger';
export class PlivoPhoneService {
    static plivoClients = new Map();
    /**
     * Get or create a Plivo client for a given credential
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
        if (!this.plivoClients.has(credential.id)) {
            const client = new plivo.Client(credential.authId, credential.authToken);
            this.plivoClients.set(credential.id, client);
        }
        return {
            client: this.plivoClients.get(credential.id),
            credential,
        };
    }
    /**
     * Search available phone numbers from Plivo
     * API: GET https://api.plivo.com/v1/Account/{auth_id}/PhoneNumber/
     * SDK: client.numbers.search(country_iso, options)
     *
     * Response structure:
     * {
     *   api_id: string,
     *   meta: { limit, offset, total_count, next, previous },
     *   objects: [{
     *     number: string,
     *     type: 'fixed' | 'mobile' | 'tollfree',
     *     sub_type: 'local' | 'national' | null,
     *     city: string,
     *     region: string,
     *     country: string,
     *     voice_enabled: boolean,
     *     sms_enabled: boolean,
     *     monthly_rental_rate: string,
     *     setup_rate: string,
     *     voice_rate: string,
     *     sms_rate: string
     *   }]
     * }
     */
    static async searchAvailableNumbers(params) {
        logger.info(`Searching numbers in ${params.countryCode}`, undefined, 'PlivoPhone');
        const { credential } = await this.getPlivoClient();
        const limit = params.limit || 20;
        const countryCode = params.countryCode.toUpperCase();
        const authHeader = 'Basic ' + Buffer.from(`${credential.authId}:${credential.authToken}`).toString('base64');
        // Build type filter
        let typeFilter = 'local';
        let isLocalSearch = false;
        if (params.type === 'toll_free') {
            typeFilter = 'tollfree';
        }
        else if (params.type === 'national') {
            typeFilter = 'national';
        }
        else if (params.type === 'local' || !params.type) {
            typeFilter = 'local';
            isLocalSearch = true;
        }
        const makeRequest = async (typeVal) => {
            const searchParams = new URLSearchParams();
            searchParams.append('country_iso', countryCode);
            searchParams.append('limit', limit.toString());
            searchParams.append('type', typeVal);
            if (params.region)
                searchParams.append('region', params.region);
            if (params.pattern)
                searchParams.append('pattern', params.pattern);
            const url = `https://api.plivo.com/v1/Account/${credential.authId}/PhoneNumber/?${searchParams.toString()}`;
            const res = await fetch(url, {
                headers: { 'Authorization': authHeader }
            });
            if (!res.ok) {
                throw new Error(`Plivo API returned status ${res.status}: ${res.statusText}`);
            }
            const body = await res.json();
            if (body.error) {
                throw new Error(body.error);
            }
            return body.objects || [];
        };
        try {
            let objects = [];
            let lastError = null;
            try {
                objects = await makeRequest(typeFilter);
            }
            catch (err) {
                lastError = err;
            }
            // Fallback: If searching for local numbers returned 0 results and no error, try with type='fixed'
            // Many countries (especially India) classify local numbers as 'fixed' type with 'local' sub_type
            if (isLocalSearch && objects.length === 0 && !lastError) {
                logger.info(`No results with type='local', retrying with type='fixed'`, undefined, 'PlivoPhone');
                try {
                    objects = await makeRequest('fixed');
                }
                catch (retryError) {
                    logger.error(`Retry search failed: ${retryError.message}`, retryError, 'PlivoPhone');
                }
            }
            if (lastError && objects.length === 0) {
                throw lastError;
            }
            if (objects.length === 0) {
                logger.info(`No numbers found for ${countryCode}`, undefined, 'PlivoPhone');
            }
            else {
                logger.info(`Sample number object`, objects[0], 'PlivoPhone');
            }
            // Map Plivo response to our interface
            return objects.map((num) => {
                // Determine our numberType from Plivo's type/sub_type
                let numberType = 'local';
                const plivoType = (num.type ?? '').toLowerCase();
                const plivoSubType = (num.sub_type ?? '').toLowerCase();
                if (plivoType === 'tollfree') {
                    numberType = 'toll_free';
                }
                else if (plivoSubType === 'national') {
                    numberType = 'national';
                }
                else if (plivoType === 'mobile') {
                    numberType = 'mobile';
                }
                else if (plivoType === 'fixed') {
                    numberType = 'fixed';
                }
                else if (plivoSubType === 'local' || plivoType === 'local') {
                    numberType = 'local';
                }
                return {
                    phoneNumber: num.number,
                    country: countryCode,
                    region: num.region || null,
                    city: num.city || null,
                    numberType,
                    subType: num.sub_type ?? null,
                    capabilities: {
                        voice: num.voice_enabled === true,
                        sms: num.sms_enabled === true,
                    },
                    monthlyRentalRate: parseFloat(num.monthly_rental_rate ?? '0'),
                    setupRate: parseFloat(num.setup_rate ?? '0'),
                    voiceRate: parseFloat(num.voice_rate ?? '0'),
                    smsRate: parseFloat(num.sms_rate ?? '0'),
                };
            });
        }
        catch (error) {
            logger.error(`Search failed: ${error?.message || error}`, error, 'PlivoPhone');
            if (error?.message?.includes('not found') || error?.statusCode === 404) {
                logger.info(`No numbers available for ${params.countryCode}`, undefined, 'PlivoPhone');
                return [];
            }
            throw new Error(error.message || `Failed to search phone numbers`);
        }
    }
    /**
     * Purchase a phone number for a user
     * API: POST https://api.plivo.com/v1/Account/{auth_id}/PhoneNumber/{number}/
     * SDK: client.numbers.buy(number)
     *
     * Response: { api_id, message, numbers: [{ number, status }], status }
     * Note: SDK response structure may vary - handle both old and new formats
     */
    static async purchaseNumber(params) {
        logger.info(`Purchasing ${params.phoneNumber} for user ${params.userId}`, undefined, 'PlivoPhone');
        // Get user and validate credits
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, params.userId))
            .limit(1);
        if (!user) {
            throw new Error('User not found');
        }
        // Get admin pricing for the country
        const pricing = await this.getAdminPricingRecord(params.country.toUpperCase());
        if (!pricing) {
            throw new Error(`Phone numbers not available for country: ${params.country}. Contact admin.`);
        }
        if (!pricing.isActive) {
            throw new Error(`Phone numbers are disabled for ${pricing.countryName}`);
        }
        // Check user credits
        if (user.credits < pricing.purchaseCredits) {
            throw new Error(`Insufficient credits. Required: ${pricing.purchaseCredits}, Available: ${user.credits}`);
        }
        // Get Plivo client and purchase the number
        const { client, credential } = await this.getPlivoClient();
        let plivoNumberId;
        try {
            // SDK: client.numbers.buy(phoneNumber)
            // Response: { api_id, message, numbers: [{ number, status }], status } or { number, status, message }
            const response = await client.numbers.buy(params.phoneNumber);
            logger.info(`Buy response`, response, 'PlivoPhone');
            // Handle different response formats
            const responseAny = response;
            if (responseAny?.numbers && Array.isArray(responseAny.numbers)) {
                plivoNumberId = responseAny.numbers[0]?.number ?? params.phoneNumber;
            }
            else if (responseAny?.number) {
                plivoNumberId = responseAny.number;
            }
            else {
                // Fallback to input phone number
                plivoNumberId = params.phoneNumber;
            }
            logger.info(`Successfully purchased ${params.phoneNumber} via Plivo, ID: ${plivoNumberId}`, undefined, 'PlivoPhone');
        }
        catch (error) {
            logger.error('Plivo purchase failed', error, 'PlivoPhone');
            // Check for KYC-related errors
            if (error?.message?.includes('KYC') || error?.message?.includes('verification') || error?.message?.includes('compliance')) {
                throw new Error(`KYC verification required to purchase numbers in ${params.country}. Please complete verification first.`);
            }
            throw new Error(`Failed to purchase number: ${error.message}`);
        }
        // Calculate next billing date (1 month from now)
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        // Create phone number record - use passed capabilities from search, default to true
        const capabilities = params.capabilities || { voice: true, sms: true };
        const [phoneRecord] = await db
            .insert(plivoPhoneNumbers)
            .values({
            userId: params.userId,
            plivoCredentialId: credential.id,
            phoneNumber: params.phoneNumber,
            plivoNumberId: plivoNumberId,
            friendlyName: params.phoneNumber,
            country: params.country.toUpperCase(),
            region: params.region || null,
            numberType: params.numberType || 'local',
            capabilities,
            status: pricing.kycRequired ? 'pending' : 'active',
            kycStatus: pricing.kycRequired ? 'pending' : null,
            purchaseCredits: pricing.purchaseCredits,
            monthlyCredits: pricing.monthlyCredits,
            nextBillingDate,
            purchasedAt: new Date(),
        })
            .returning();
        // Deduct credits
        await db
            .update(users)
            .set({
            credits: sql `GREATEST(0, ${users.credits} - ${pricing.purchaseCredits})`,
        })
            .where(eq(users.id, params.userId));
        // Record credit transaction
        await db.insert(creditTransactions).values({
            userId: params.userId,
            type: 'usage',
            amount: -pricing.purchaseCredits,
            description: `Phone number purchase: ${params.phoneNumber} (${pricing.countryName})`,
            reference: phoneRecord.id,
        });
        logger.info(`Deducted ${pricing.purchaseCredits} credits for number ${params.phoneNumber}`, undefined, 'PlivoPhone');
        return {
            success: true,
            phoneNumber: phoneRecord,
            creditsDeducted: pricing.purchaseCredits,
            kycRequired: pricing.kycRequired,
        };
    }
    /**
     * Release a phone number (cancel and remove)
     */
    static async releaseNumber(phoneNumberId) {
        logger.info(`Releasing number ${phoneNumberId}`, undefined, 'PlivoPhone');
        const [phoneRecord] = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .limit(1);
        if (!phoneRecord) {
            throw new Error('Phone number not found');
        }
        // Get Plivo client
        const { client } = await this.getPlivoClient(phoneRecord.plivoCredentialId || undefined);
        // Release from Plivo
        // Note: The Plivo SDK does not export the 'unrent' method in its TypeScript types,
        // but it exists at runtime per their API documentation
        try {
            await client.numbers.unrent(phoneRecord.plivoNumberId);
            logger.info(`Released ${phoneRecord.phoneNumber} from Plivo`, undefined, 'PlivoPhone');
        }
        catch (error) {
            logger.error('Plivo release failed (may already be released)', error, 'PlivoPhone');
            // Continue to update our records even if Plivo fails
        }
        // Update status in database
        await db
            .update(plivoPhoneNumbers)
            .set({
            status: 'released',
            updatedAt: new Date(),
        })
            .where(eq(plivoPhoneNumbers.id, phoneNumberId));
        logger.info(`Number ${phoneNumberId} marked as released`, undefined, 'PlivoPhone');
    }
    /**
     * Get all phone numbers for a user
     */
    static async getUserNumbers(userId) {
        const numbers = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(and(eq(plivoPhoneNumbers.userId, userId), sql `${plivoPhoneNumbers.status} != 'released'`))
            .orderBy(desc(plivoPhoneNumbers.createdAt));
        return numbers;
    }
    /**
     * Get a single phone number by ID
     */
    static async getPhoneNumberById(phoneNumberId) {
        const [number] = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .limit(1);
        return number || null;
    }
    /**
     * Get a phone number by phone number string
     */
    static async getPhoneNumberByNumber(phoneNumber) {
        const [number] = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(eq(plivoPhoneNumbers.phoneNumber, phoneNumber))
            .limit(1);
        return number || null;
    }
    /**
     * Configure webhook URLs for a phone number (for incoming calls)
     *
     * Plivo requires creating an Application with webhook URLs, then
     * assigning that application's app_id to the phone number.
     *
     * SDK methods:
     * - client.applications.create(params) - creates app with answer_url, etc.
     * - client.numbers.update(number, { app_id }) - assigns app to number
     */
    static async configureWebhooks(phoneNumberId, baseUrl) {
        logger.info(`Configuring webhooks for ${phoneNumberId}`, undefined, 'PlivoPhone');
        const [phoneRecord] = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .limit(1);
        if (!phoneRecord) {
            throw new Error('Phone number not found');
        }
        const { client } = await this.getPlivoClient(phoneRecord.plivoCredentialId || undefined);
        try {
            const answerUrl = `${baseUrl}/api/plivo/incoming`;
            const hangupUrl = `${baseUrl}/api/plivo/voice/status`;
            const appNameSettingResult = await db.select().from(globalSettings).where(eq(globalSettings.key, 'app_name')).limit(1);
            const appNameRaw = appNameSettingResult[0]?.value;
            const platformName = (typeof appNameRaw === 'string' ? appNameRaw.trim() : '') || 'platform';
            const appName = `${platformName}-${phoneRecord.phoneNumber}`;
            // Create or update a Plivo Application with the webhook URLs
            let appId;
            // First, try to find and delete any existing app with this name
            // This ensures a clean configuration
            try {
                const appsResponse = await client.applications.list({ limit: 100 });
                const appsList = Array.isArray(appsResponse) ? appsResponse : (appsResponse?.objects || []);
                const existingApp = appsList.find((app) => app.app_name === appName || app.appName === appName);
                if (existingApp) {
                    const existingAppId = existingApp.appId || existingApp.app_id;
                    logger.info(`Deleting existing application ${existingAppId}`, undefined, 'PlivoPhone');
                    try {
                        await client.applications.delete(existingAppId);
                        logger.info(`Deleted old application ${existingAppId}`, undefined, 'PlivoPhone');
                    }
                    catch (deleteError) {
                        logger.info(`Could not delete app (may be in use): ${deleteError.message}`, undefined, 'PlivoPhone');
                    }
                }
            }
            catch (listError) {
                logger.info(`Could not list apps: ${listError.message}`, undefined, 'PlivoPhone');
            }
            // Now create a fresh application
            try {
                const appResponse = await client.applications.create(appName, // app_name
                {
                    answerUrl,
                    answerMethod: 'POST',
                    hangupUrl,
                    hangupMethod: 'POST',
                    fallbackAnswerUrl: answerUrl,
                    fallbackMethod: 'POST',
                });
                appId = appResponse.appId || appResponse.app_id || '';
                logger.info(`Created new application ${appId} for ${phoneRecord.phoneNumber}`, undefined, 'PlivoPhone');
            }
            catch (createError) {
                // If creation still fails (app not deleted), find and update existing
                logger.info(`Could not create app, finding existing: ${createError.message}`, undefined, 'PlivoPhone');
                const appsResponse = await client.applications.list({ limit: 100 });
                const appsList = Array.isArray(appsResponse) ? appsResponse : (appsResponse?.objects || []);
                const existingApp = appsList.find((app) => app.app_name === appName || app.appName === appName);
                if (existingApp) {
                    appId = existingApp.appId || existingApp.app_id || '';
                    logger.info(`Using existing application ${appId}`, undefined, 'PlivoPhone');
                    // Update the existing app with new URLs
                    await client.applications.update(appId, {
                        answerUrl,
                        answerMethod: 'POST',
                        hangupUrl,
                        hangupMethod: 'POST',
                    });
                    logger.info(`Updated application URLs`, undefined, 'PlivoPhone');
                }
                else {
                    throw createError;
                }
            }
            // Assign the application to the phone number
            // NOTE: Plivo SDK expects snake_case 'app_id', not camelCase 'appId'
            logger.info(`Assigning app ${appId} to number ${phoneRecord.plivoNumberId}`, undefined, 'PlivoPhone');
            const updateResult = await client.numbers.update(phoneRecord.plivoNumberId, {
                appId: appId,
            });
            logger.info(`Number update result`, updateResult, 'PlivoPhone');
            logger.info(`Webhooks configured for ${phoneRecord.phoneNumber} via app ${appId}`, undefined, 'PlivoPhone');
        }
        catch (error) {
            logger.error('Webhook configuration failed', error, 'PlivoPhone');
            throw new Error(`Failed to configure webhooks: ${error.message}`);
        }
    }
    /**
     * Assign an incoming agent to a phone number
     */
    static async assignAgent(phoneNumberId, agentId) {
        logger.info(`Assigning agent ${agentId} to number ${phoneNumberId}`, undefined, 'PlivoPhone');
        const [updatedNumber] = await db
            .update(plivoPhoneNumbers)
            .set({
            assignedAgentId: agentId,
            updatedAt: new Date(),
        })
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .returning();
        if (!updatedNumber) {
            throw new Error('Phone number not found');
        }
        return updatedNumber;
    }
    /**
     * Unassign agent from a phone number
     */
    static async unassignAgent(phoneNumberId) {
        logger.info(`Unassigning agent from number ${phoneNumberId}`, undefined, 'PlivoPhone');
        const [updatedNumber] = await db
            .update(plivoPhoneNumbers)
            .set({
            assignedAgentId: null,
            updatedAt: new Date(),
        })
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .returning();
        if (!updatedNumber) {
            throw new Error('Phone number not found');
        }
        return updatedNumber;
    }
    /**
     * Clear webhooks from a phone number (for when removing an incoming connection)
     * This removes the application assignment from the number on Plivo
     */
    static async clearWebhooks(phoneNumberId) {
        logger.info(`Clearing webhooks for ${phoneNumberId}`, undefined, 'PlivoPhone');
        const [phoneRecord] = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .limit(1);
        if (!phoneRecord) {
            throw new Error('Phone number not found');
        }
        const { client } = await this.getPlivoClient(phoneRecord.plivoCredentialId || undefined);
        try {
            // Note: Plivo SDK doesn't export types for numbers.update method
            const clientAny = client;
            // Remove app assignment from phone number by setting app_id to empty
            await clientAny.numbers.update(phoneRecord.plivoNumberId, {
                appId: '',
            });
            logger.info(`Webhooks cleared for ${phoneRecord.phoneNumber}`, undefined, 'PlivoPhone');
        }
        catch (error) {
            logger.error('Failed to clear webhooks', error, 'PlivoPhone');
            // Don't throw - allow unassignment even if Plivo update fails
        }
    }
    // ============================================================
    // Admin Pricing Management
    // ============================================================
    /**
     * Get admin pricing record for a country (internal)
     */
    static async getAdminPricingRecord(countryCode) {
        const [pricing] = await db
            .select()
            .from(plivoPhonePricing)
            .where(eq(plivoPhonePricing.countryCode, countryCode.toUpperCase()))
            .limit(1);
        return pricing || null;
    }
    /**
     * Get admin pricing for a country (public API)
     */
    static async getAdminPricing(countryCode) {
        const pricing = await this.getAdminPricingRecord(countryCode);
        if (!pricing)
            return null;
        return {
            purchaseCredits: pricing.purchaseCredits,
            monthlyCredits: pricing.monthlyCredits,
            kycRequired: pricing.kycRequired,
            countryName: pricing.countryName,
            isActive: pricing.isActive,
        };
    }
    /**
     * Get all admin pricing records
     */
    static async getAllAdminPricing() {
        const pricing = await db
            .select()
            .from(plivoPhonePricing)
            .orderBy(plivoPhonePricing.countryName);
        return pricing;
    }
    /**
     * Set admin pricing for a country
     */
    static async setAdminPricing(countryCode, pricing) {
        logger.info(`Setting pricing for ${countryCode}`, undefined, 'PlivoPhone');
        const code = countryCode.toUpperCase();
        // Check if pricing exists
        const existing = await this.getAdminPricingRecord(code);
        if (existing) {
            // Update existing
            const [updated] = await db
                .update(plivoPhonePricing)
                .set({
                countryName: pricing.countryName,
                purchaseCredits: pricing.purchaseCredits,
                monthlyCredits: pricing.monthlyCredits,
                kycRequired: pricing.kycRequired ?? existing.kycRequired,
                isActive: pricing.isActive ?? existing.isActive,
                updatedAt: new Date(),
            })
                .where(eq(plivoPhonePricing.id, existing.id))
                .returning();
            return updated;
        }
        else {
            // Create new
            const [created] = await db
                .insert(plivoPhonePricing)
                .values({
                countryCode: code,
                countryName: pricing.countryName,
                purchaseCredits: pricing.purchaseCredits,
                monthlyCredits: pricing.monthlyCredits,
                kycRequired: pricing.kycRequired ?? false,
                isActive: pricing.isActive ?? true,
            })
                .returning();
            return created;
        }
    }
    /**
     * Delete admin pricing for a country
     */
    static async deleteAdminPricing(countryCode) {
        logger.info(`Deleting pricing for ${countryCode}`, undefined, 'PlivoPhone');
        await db
            .delete(plivoPhonePricing)
            .where(eq(plivoPhonePricing.countryCode, countryCode.toUpperCase()));
    }
    // ============================================================
    // Monthly Billing
    // ============================================================
    /**
     * Process monthly billing for all active phone numbers
     * Called by cron job
     */
    static async processMonthlyBilling() {
        logger.info(`Processing monthly billing`, undefined, 'PlivoPhone');
        const now = new Date();
        const results = { processed: 0, suspended: 0, errors: [] };
        // Get all numbers due for billing
        const numbersDue = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(and(eq(plivoPhoneNumbers.status, 'active'), sql `${plivoPhoneNumbers.nextBillingDate} <= ${now}`));
        for (const number of numbersDue) {
            if (!number.userId) {
                results.errors.push(`Number ${number.phoneNumber} has no owner`);
                continue;
            }
            try {
                // Get user credits
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, number.userId))
                    .limit(1);
                if (!user) {
                    results.errors.push(`User not found for number ${number.phoneNumber}`);
                    continue;
                }
                if (user.credits < number.monthlyCredits) {
                    // Insufficient credits - suspend number
                    await db
                        .update(plivoPhoneNumbers)
                        .set({
                        status: 'suspended',
                        updatedAt: new Date(),
                    })
                        .where(eq(plivoPhoneNumbers.id, number.id));
                    results.suspended++;
                    logger.info(`Suspended ${number.phoneNumber} - insufficient credits`, undefined, 'PlivoPhone');
                    continue;
                }
                // Deduct monthly credits
                await db
                    .update(users)
                    .set({
                    credits: sql `GREATEST(0, ${users.credits} - ${number.monthlyCredits})`,
                })
                    .where(eq(users.id, number.userId));
                // Record transaction
                await db.insert(creditTransactions).values({
                    userId: number.userId,
                    type: 'usage',
                    amount: -number.monthlyCredits,
                    description: `Monthly phone rental: ${number.phoneNumber}`,
                    reference: number.id,
                });
                // Update next billing date
                const nextBilling = new Date();
                nextBilling.setMonth(nextBilling.getMonth() + 1);
                await db
                    .update(plivoPhoneNumbers)
                    .set({
                    nextBillingDate: nextBilling,
                    updatedAt: new Date(),
                })
                    .where(eq(plivoPhoneNumbers.id, number.id));
                results.processed++;
                logger.info(`Billed ${number.monthlyCredits} credits for ${number.phoneNumber}`, undefined, 'PlivoPhone');
            }
            catch (error) {
                results.errors.push(`Error billing ${number.phoneNumber}: ${error.message}`);
            }
        }
        logger.info(`Billing complete: ${results.processed} processed, ${results.suspended} suspended`, undefined, 'PlivoPhone');
        return results;
    }
    /**
     * Reactivate a suspended number after user adds credits
     */
    static async reactivateNumber(phoneNumberId) {
        logger.info(`Reactivating number ${phoneNumberId}`, undefined, 'PlivoPhone');
        const [number] = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .limit(1);
        if (!number) {
            throw new Error('Phone number not found');
        }
        if (number.status !== 'suspended') {
            throw new Error('Number is not suspended');
        }
        // Get user and verify credits
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, number.userId))
            .limit(1);
        if (!user || user.credits < number.monthlyCredits) {
            throw new Error('Insufficient credits to reactivate');
        }
        // Deduct monthly credits for immediate billing
        await db
            .update(users)
            .set({
            credits: sql `GREATEST(0, ${users.credits} - ${number.monthlyCredits})`,
        })
            .where(eq(users.id, number.userId));
        // Record transaction
        await db.insert(creditTransactions).values({
            userId: number.userId,
            type: 'usage',
            amount: -number.monthlyCredits,
            description: `Phone reactivation: ${number.phoneNumber}`,
            reference: number.id,
        });
        // Calculate next billing date
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        // Reactivate
        const [updated] = await db
            .update(plivoPhoneNumbers)
            .set({
            status: 'active',
            nextBillingDate: nextBilling,
            updatedAt: new Date(),
        })
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .returning();
        logger.info(`Reactivated ${number.phoneNumber}`, undefined, 'PlivoPhone');
        return updated;
    }
    /**
     * Get phone number statistics for admin dashboard
     */
    static async getPhoneStats() {
        const numbers = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(sql `${plivoPhoneNumbers.status} != 'released'`);
        const stats = {
            total: numbers.length,
            active: 0,
            pending: 0,
            suspended: 0,
            byCountry: {},
        };
        for (const num of numbers) {
            if (num.status === 'active')
                stats.active++;
            else if (num.status === 'pending')
                stats.pending++;
            else if (num.status === 'suspended')
                stats.suspended++;
            stats.byCountry[num.country] = (stats.byCountry[num.country] || 0) + 1;
        }
        return stats;
    }
    /**
     * Clear cached Plivo clients (useful when credentials are updated)
     */
    static clearClientCache() {
        this.plivoClients.clear();
        logger.info('Cleared Plivo client cache', undefined, 'PlivoPhone');
    }
    /**
     * List all phone numbers from Plivo account (admin sync)
     * API Docs: https://www.plivo.com/docs/numbers/api/account-phone-number/list-all-my-numbers
     */
    static async listAccountNumbers() {
        logger.info('Fetching account numbers for sync', undefined, 'PlivoPhone');
        const { client, credential } = await this.getPlivoClient();
        try {
            // Paginate through all numbers from Plivo account
            const allPlivoNumbers = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            while (hasMore) {
                // Plivo SDK: numbers.list() returns rented numbers
                // API: GET https://api.plivo.com/v1/Account/{auth_id}/Number/
                logger.info(`Calling Plivo numbers.list with limit=${limit}, offset=${offset}`, undefined, 'PlivoPhone');
                let response;
                try {
                    response = await client.numbers.list({ limit, offset });
                    logger.info(`Plivo API raw response type: ${typeof response}, keys: ${response ? Object.keys(response) : 'null'}`, undefined, 'PlivoPhone');
                    logger.info(`Plivo API response:`, JSON.stringify(response, null, 2).substring(0, 500), 'PlivoPhone');
                }
                catch (apiError) {
                    logger.error(`Plivo numbers.list API error: ${apiError.message}`, apiError, 'PlivoPhone');
                    throw apiError;
                }
                // Handle different response formats from Plivo SDK
                let pageNumbers = [];
                if (Array.isArray(response)) {
                    pageNumbers = response;
                }
                else if (response?.objects && Array.isArray(response.objects)) {
                    pageNumbers = response.objects;
                }
                else if (response && typeof response === 'object') {
                    // Try to extract numbers from the response
                    const keys = Object.keys(response);
                    logger.info(`Response keys: ${keys.join(', ')}`, undefined, 'PlivoPhone');
                    if (response.meta && response.objects === undefined) {
                        pageNumbers = [];
                    }
                }
                allPlivoNumbers.push(...pageNumbers);
                logger.info(`Fetched ${pageNumbers.length} numbers (offset: ${offset})`, undefined, 'PlivoPhone');
                // Check if there are more pages
                if (pageNumbers.length < limit) {
                    hasMore = false;
                }
                else {
                    offset += limit;
                }
            }
            const plivoNumbers = allPlivoNumbers;
            logger.info(`Found ${plivoNumbers.length} total numbers in Plivo account`, undefined, 'PlivoPhone');
            // Get existing numbers in our database
            const existingNumbers = await db
                .select()
                .from(plivoPhoneNumbers)
                .where(eq(plivoPhoneNumbers.plivoCredentialId, credential.id));
            const existingSet = new Set(existingNumbers.map(n => n.phoneNumber));
            const newNumbers = [];
            const formattedNumbers = plivoNumbers.map((num) => {
                const numberData = {
                    number: num.number,
                    country: num.country || 'US',
                    region: num.region || num.city || null,
                    numberType: num.number_type || num.type || 'local',
                    voiceEnabled: num.voice_enabled === true,
                    smsEnabled: num.sms_enabled === true,
                    monthlyRentalRate: parseFloat(num.monthly_rental_rate || '0'),
                };
                if (!existingSet.has(num.number)) {
                    newNumbers.push(num.number);
                }
                return numberData;
            });
            return {
                numbers: formattedNumbers,
                syncedCount: plivoNumbers.length,
                newNumbers,
            };
        }
        catch (error) {
            logger.error('Failed to list account numbers', error, 'PlivoPhone');
            throw new Error(`Failed to fetch Plivo account numbers: ${error.message}`);
        }
    }
    /**
     * Sync Plivo account numbers to database (admin)
     * Full bidirectional sync:
     * - Imports new numbers from Plivo that aren't tracked
     * - Updates existing numbers with changed properties
     * - Marks numbers as released that no longer exist in Plivo
     */
    static async syncAccountNumbers() {
        logger.info('Starting full account number sync', undefined, 'PlivoPhone');
        const { credential } = await this.getPlivoClient();
        const { numbers: plivoNumbers } = await this.listAccountNumbers();
        // Create a map of Plivo numbers for quick lookup
        const plivoNumberMap = new Map();
        for (const num of plivoNumbers) {
            plivoNumberMap.set(num.number, num);
        }
        // Get existing numbers from database for this credential
        const existingNumbers = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(eq(plivoPhoneNumbers.plivoCredentialId, credential.id));
        const existingMap = new Map();
        for (const num of existingNumbers) {
            existingMap.set(num.phoneNumber, num);
        }
        let imported = 0;
        let updated = 0;
        let removed = 0;
        let skipped = 0;
        const errors = [];
        // 1. Process numbers from Plivo (import new, update existing)
        for (const num of plivoNumbers) {
            const existing = existingMap.get(num.number);
            if (existing) {
                // Number exists in both - check if update needed
                try {
                    // Normalize numberType for comparison
                    const normalizedType = (num.numberType || 'local');
                    const needsUpdate = existing.country !== (num.country || 'US') ||
                        existing.region !== (num.region || null) ||
                        existing.numberType !== normalizedType ||
                        existing.status === 'released' || // Reactivate if was released
                        existing.status === 'suspended' || // Reactivate if was suspended
                        JSON.stringify(existing.capabilities) !== JSON.stringify({ voice: num.voiceEnabled, sms: num.smsEnabled });
                    if (needsUpdate) {
                        await db
                            .update(plivoPhoneNumbers)
                            .set({
                            country: num.country || 'US',
                            region: num.region || null,
                            numberType: normalizedType,
                            capabilities: { voice: num.voiceEnabled, sms: num.smsEnabled },
                            status: 'active', // Reactivate if it was released/suspended but is back in Plivo
                            updatedAt: new Date(),
                        })
                            .where(eq(plivoPhoneNumbers.id, existing.id));
                        updated++;
                        logger.info(`Updated ${num.number}`, undefined, 'PlivoPhone');
                    }
                    else {
                        skipped++;
                    }
                }
                catch (err) {
                    errors.push(`Update ${num.number}: ${err.message}`);
                }
            }
            else {
                // New number - import it
                try {
                    await db.insert(plivoPhoneNumbers).values({
                        plivoCredentialId: credential.id,
                        phoneNumber: num.number,
                        plivoNumberId: num.number,
                        friendlyName: num.number,
                        country: num.country || 'US',
                        region: num.region || null,
                        numberType: (num.numberType || 'local'),
                        capabilities: {
                            voice: num.voiceEnabled,
                            sms: num.smsEnabled
                        },
                        status: 'active',
                        purchaseCredits: 0,
                        monthlyCredits: 0,
                        purchasedAt: new Date(),
                        isSystemPool: true,
                    });
                    imported++;
                    logger.info(`Imported ${num.number}`, undefined, 'PlivoPhone');
                }
                catch (err) {
                    errors.push(`Import ${num.number}: ${err.message}`);
                }
            }
        }
        // 2. Mark numbers as released that exist in DB but not in Plivo
        // Also clear relationships (user, agent, webhooks) to prevent stale references
        for (const existing of existingNumbers) {
            // Skip if already released or if it exists in Plivo
            if (existing.status === 'released' || plivoNumberMap.has(existing.phoneNumber)) {
                continue;
            }
            try {
                await db
                    .update(plivoPhoneNumbers)
                    .set({
                    status: 'released',
                    userId: null, // Clear user assignment
                    assignedAgentId: null, // Clear agent assignment
                    openaiCredentialId: null, // Clear OpenAI credential link
                    updatedAt: new Date(),
                })
                    .where(eq(plivoPhoneNumbers.id, existing.id));
                removed++;
                logger.info(`Marked ${existing.phoneNumber} as released and cleared relationships (not in Plivo)`, undefined, 'PlivoPhone');
            }
            catch (err) {
                errors.push(`Remove ${existing.phoneNumber}: ${err.message}`);
            }
        }
        logger.info(`Sync complete: ${imported} imported, ${updated} updated, ${removed} removed, ${skipped} unchanged, ${errors.length} errors`, undefined, 'PlivoPhone');
        return { imported, updated, removed, skipped, errors };
    }
    /**
     * Unrent (release) a number from Plivo account
     * API Docs: https://www.plivo.com/docs/numbers/api/account-phone-number/unrent-a-number
     */
    static async unrentNumber(phoneNumberId) {
        logger.info(`Unrenting number ${phoneNumberId}`, undefined, 'PlivoPhone');
        const [phoneRecord] = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .limit(1);
        if (!phoneRecord) {
            throw new Error('Phone number not found');
        }
        const { client } = await this.getPlivoClient(phoneRecord.plivoCredentialId || undefined);
        try {
            // Note: Plivo SDK doesn't export types for numbers.unrent method
            await client.numbers.unrent(phoneRecord.phoneNumber);
            logger.info(`Successfully unrented ${phoneRecord.phoneNumber} from Plivo`, undefined, 'PlivoPhone');
        }
        catch (error) {
            // If the number is already released, just log and continue
            if (error?.statusCode === 404 || error?.message?.includes('not found')) {
                logger.info(`Number ${phoneRecord.phoneNumber} already released from Plivo`, undefined, 'PlivoPhone');
            }
            else {
                logger.error('Unrent failed', error, 'PlivoPhone');
                throw new Error(`Failed to unrent number: ${error.message}`);
            }
        }
        // Update status in database
        await db
            .update(plivoPhoneNumbers)
            .set({
            status: 'released',
            updatedAt: new Date(),
        })
            .where(eq(plivoPhoneNumbers.id, phoneNumberId));
        logger.info(`Number ${phoneRecord.phoneNumber} marked as released`, undefined, 'PlivoPhone');
    }
    /**
     * Get all Plivo phone numbers in the system (admin view)
     */
    static async getAllNumbers() {
        const numbers = await db
            .select()
            .from(plivoPhoneNumbers)
            .where(sql `${plivoPhoneNumbers.status} != 'released'`)
            .orderBy(desc(plivoPhoneNumbers.createdAt));
        return numbers;
    }
    /**
     * Assign a phone number to a user or mark as system pool
     */
    static async assignNumberToUser(phoneNumberId, userId, isSystemPool = false) {
        logger.info(`Assigning number ${phoneNumberId} to user ${userId || 'system pool'}`, undefined, 'PlivoPhone');
        const [updated] = await db
            .update(plivoPhoneNumbers)
            .set({
            userId: userId || null,
            updatedAt: new Date(),
        })
            .where(eq(plivoPhoneNumbers.id, phoneNumberId))
            .returning();
        if (!updated) {
            throw new Error('Phone number not found');
        }
        return updated;
    }
}
