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
import { UserRepository } from "../repositories/user.repository";
import { ContactRepository } from "../repositories/contact.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ChannelRepository } from "../repositories/channel.repository";
import { TemplateRepository } from "../repositories/template.repository";
import { ConversationRepository } from "../repositories/conversation.repository";
import { MessageRepository } from "../repositories/message.repository";
import { AutomationRepository } from "../repositories/automation.repository";
import { AnalyticsRepository } from "../repositories/analytics.repository";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository";
import { MessageQueueRepository } from "../repositories/message-queue.repository";
import { ApiLogRepository } from "../repositories/api-log.repository";
import { WhatsappChannelRepository } from "../repositories/whatsapp-channel.repository";
import { getActivePaidUsersCount } from "../controllers/whatsappSubscriptions.controller";
import { templates as templatesTable } from "@shared/whatsapp-schema";
import { sites, trainingQaPairs, shopifyStores, contacts, abandonedCarts, automations, ecommerceSettings, abandonedCartReminders, woocommerceStores, } from "@shared/whatsapp-schema";
import { whatsappDb as db } from "../config/database";
import { desc, eq, and, lte, sql, inArray } from "drizzle-orm";
export class DatabaseStorage {
    userRepo = new UserRepository();
    contactRepo = new ContactRepository();
    campaignRepo = new CampaignRepository();
    channelRepo = new ChannelRepository();
    templateRepo = new TemplateRepository();
    conversationRepo = new ConversationRepository();
    messageRepo = new MessageRepository();
    automationRepo = new AutomationRepository();
    analyticsRepo = new AnalyticsRepository();
    webhookConfigRepo = new WebhookConfigRepository();
    messageQueueRepo = new MessageQueueRepository();
    apiLogRepo = new ApiLogRepository();
    whatsappChannelRepo = new WhatsappChannelRepository();
    // Sites
    async getSite(id) {
        const [site] = await db.select().from(sites).where(eq(sites.id, id));
        return site || undefined;
    }
    async getScheduledCampaigns(now) {
        return this.campaignRepo.getScheduledCampaigns(now);
    }
    async getSites() {
        return await db.select().from(sites);
    }
    async getSitesByChannel(channelId) {
        return await db.select().from(sites).where(eq(sites.channelId, channelId));
    }
    async createSite(insertSite) {
        const widgetCode = `wc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // Wrap site insert + default FAQ seed in one transaction so we never
        // end up with a site row that is missing its seed Q&A pairs.
        return await db.transaction(async (tx) => {
            const [site] = await tx
                .insert(sites)
                .values({ ...insertSite, widgetCode })
                .returning();
            const defaultFaqs = [
                {
                    siteId: site.id,
                    channelId: insertSite.channelId || null,
                    question: "How do I get started with your platform?",
                    answer: "Getting started is easy! Simply create an account, connect your WhatsApp Business API, and you'll be ready to send messages and manage conversations within minutes. Our setup wizard will guide you through each step.",
                    category: "Getting Started",
                },
                {
                    siteId: site.id,
                    channelId: insertSite.channelId || null,
                    question: "What are your support hours?",
                    answer: "Our support team is available Monday through Friday, 9 AM to 6 PM (EST). For urgent issues outside business hours, you can reach us via email and we'll respond within 24 hours.",
                    category: "Support",
                },
                {
                    siteId: site.id,
                    channelId: insertSite.channelId || null,
                    question: "How can I track my campaign performance?",
                    answer: "Navigate to the Analytics dashboard to view real-time metrics including delivery rates, open rates, click-through rates, and customer engagement. You can filter by date range, campaign type, and audience segments.",
                    category: "Analytics",
                },
                {
                    siteId: site.id,
                    channelId: insertSite.channelId || null,
                    question: "Can I automate my WhatsApp messages?",
                    answer: "Yes! Our automation engine lets you create message flows with triggers, conditions, and actions. Set up welcome messages, follow-ups, appointment reminders, and more using our visual flow builder.",
                    category: "Automation",
                },
                {
                    siteId: site.id,
                    channelId: insertSite.channelId || null,
                    question: "How do I manage my contact lists?",
                    answer: "You can import contacts via CSV, add them manually, or sync from your CRM. Organize contacts into groups, apply tags, and segment your audience for targeted campaigns.",
                    category: "Contacts",
                },
            ];
            await tx.insert(trainingQaPairs).values(defaultFaqs);
            return site;
        });
    }
    async updateSite(id, data) {
        const [site] = await db.update(sites).set(data).where(eq(sites.id, id)).returning();
        return site;
    }
    // Returns statistics of message queue
    async getMessageQueueStats() {
        return { queued: 0, processing: 0, sent: 0, delivered: 0, failed: 0 };
    }
    // Returns queued messages
    async getQueuedMessages(limit = 10) {
        return [];
    }
    // Returns message queue object (stub)
    async getMessageQueue() {
        return {};
    }
    // Logs API request
    async logApiRequest(log) {
        return null;
    }
    async getAutomationByChannel(channelId) {
        // implement your logic
        return [];
    }
    async getWhatsappChannels() {
        // implement your logic
        return [];
    }
    async deleteWhatsappChannel(id) {
        await this.whatsappChannelRepo.delete(id);
    }
    // ==========================
    // SHOPIFY METHODS
    // ==========================
    async createShopifyStore(data) {
        const [store] = await db
            .insert(shopifyStores)
            .values(data)
            .returning();
        return store;
    }
    async getShopifyStoreByShopDomain(shopDomain) {
        const [store] = await db
            .select()
            .from(shopifyStores)
            .where(eq(shopifyStores.shopDomain, shopDomain));
        return store;
    }
    async getShopifyStoreById(id) {
        const [store] = await db
            .select()
            .from(shopifyStores)
            .where(eq(shopifyStores.id, id));
        return store;
    }
    // async getShopifyStoresByUser(
    //   userId: string
    // ): Promise<ShopifyStore[]> {
    //   return await db
    //     .select()
    //     .from(shopifyStores)
    //     .where(eq(shopifyStores.userId, userId));
    // }
    async getShopifyStoresByUser(userId, channelId) {
        return await db
            .select()
            .from(shopifyStores)
            .where(and(eq(shopifyStores.userId, userId), eq(shopifyStores.channelId, channelId), eq(shopifyStores.isActive, true)));
    }
    async updateShopifyStore(id, data) {
        const [store] = await db
            .update(shopifyStores)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where(eq(shopifyStores.id, id))
            .returning();
        return store;
    }
    async deleteShopifyStore(id) {
        await db
            .delete(shopifyStores)
            .where(eq(shopifyStores.id, id));
        return true;
    }
    async getContactByExternalId(storeId, externalId) {
        const [contact] = await db
            .select()
            .from(contacts)
            .where(and(eq(contacts.storeId, storeId), eq(contacts.externalId, externalId)));
        return contact;
    }
    async getShopifyStoreByDomain(shopDomain) {
        const [store] = await db
            .select()
            .from(shopifyStores)
            .where(eq(shopifyStores.shopDomain, shopDomain));
        return store;
    }
    // ==========================
    // ABANDONED CART METHODS
    // ==========================
    async createAbandonedCart(data) {
        const [cart] = await db
            .insert(abandonedCarts)
            .values(data)
            .returning();
        return cart;
    }
    async getAbandonedCartByToken(checkoutToken) {
        const [cart] = await db
            .select()
            .from(abandonedCarts)
            .where(eq(abandonedCarts.checkoutToken, checkoutToken));
        return cart;
    }
    async updateAbandonedCart(id, data) {
        const [cart] = await db
            .update(abandonedCarts)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where(eq(abandonedCarts.id, id))
            .returning();
        return cart;
    }
    async getPendingAbandonedCarts() {
        return await db
            .select()
            .from(abandonedCarts)
            .where(eq(abandonedCarts.status, "pending"));
    }
    async getAbandonedCarts() {
        return db
            .select()
            .from(abandonedCarts)
            .orderBy(desc(abandonedCarts.createdAt));
    }
    // async getAbandonedCartsWithReminders(
    //   page: number = 1,
    //   limit: number = 20
    // ) {
    //   const offset = (page - 1) * limit;
    //   const [{ count }] = await db
    //     .select({
    //       count: sql<number>`count(*)`,
    //     })
    //     .from(abandonedCarts);
    //   const carts = await db
    //     .select()
    //     .from(abandonedCarts)
    //     .limit(limit)
    //     .offset(offset)
    //     .orderBy(desc(abandonedCarts.createdAt));
    //   const cartIds = carts.map(c => c.id);
    //   const reminders =
    //     cartIds.length > 0
    //       ? await db
    //           .select()
    //           .from(abandonedCartReminders)
    //           .where(
    //             inArray(
    //               abandonedCartReminders.cartId,
    //               cartIds
    //             )
    //           )
    //       : [];
    //   return {
    //     data: carts.map(cart => ({
    //       ...cart,
    //       reminders: reminders.filter(
    //         r => r.cartId === cart.id
    //       ),
    //     })),
    //     pagination: {
    //       page,
    //       limit,
    //       total: Number(count),
    //       totalPages: Math.ceil(Number(count) / limit),
    //     },
    //   };
    // }
    async getAbandonedCartsWithReminders(channelId, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const [{ count }] = await db
            .select({
            count: sql `count(*)`,
        })
            .from(abandonedCarts)
            .where(eq(abandonedCarts.channelId, channelId)); // 👈 NEW
        const carts = await db
            .select()
            .from(abandonedCarts)
            .where(eq(abandonedCarts.channelId, channelId)) // 👈 NEW
            .limit(limit)
            .offset(offset)
            .orderBy(desc(abandonedCarts.createdAt));
        const cartIds = carts.map(c => c.id);
        const reminders = cartIds.length > 0
            ? await db
                .select()
                .from(abandonedCartReminders)
                .where(inArray(abandonedCartReminders.cartId, cartIds))
            : [];
        return {
            data: carts.map(cart => ({
                ...cart,
                reminders: reminders.filter(r => r.cartId === cart.id),
            })),
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit),
            },
        };
    }
    async getAbandonedCartById(id) {
        const [cart] = await db
            .select()
            .from(abandonedCarts)
            .where(eq(abandonedCarts.id, id));
        return cart;
    }
    async getAutomationsByTrigger(channelId, trigger) {
        return await db
            .select()
            .from(automations)
            .where(and(eq(automations.channelId, channelId), eq(automations.trigger, trigger), eq(automations.status, "active")));
    }
    async getAbandonedCartReminder(cartId, reminderId) {
        const [row] = await db
            .select()
            .from(abandonedCartReminders)
            .where(and(eq(abandonedCartReminders.cartId, cartId), eq(abandonedCartReminders.reminderId, reminderId)));
        return row;
    }
    async getEcommerceSettings(provider) {
        const [settings] = await db
            .select()
            .from(ecommerceSettings)
            .where(eq(ecommerceSettings.provider, provider));
        return settings;
    }
    async createEcommerceSettings(data) {
        const [settings] = await db
            .insert(ecommerceSettings)
            .values(data)
            .returning();
        return settings;
    }
    async updateEcommerceSettings(provider, data) {
        const [settings] = await db
            .update(ecommerceSettings)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where(eq(ecommerceSettings.provider, provider))
            .returning();
        return settings;
    }
    async createAbandonedCartReminder(reminder) {
        const [result] = await db
            .insert(abandonedCartReminders)
            .values(reminder)
            .returning();
        return result;
    }
    async markCartRemindersSkipped(cartId) {
        await db
            .update(abandonedCartReminders)
            .set({
            status: "skipped",
            updatedAt: new Date(),
        })
            .where(and(eq(abandonedCartReminders.cartId, cartId), eq(abandonedCartReminders.status, "pending")));
    }
    async createWooCommerceStore(data) {
        const [store] = await db
            .insert(woocommerceStores)
            .values(data)
            .returning();
        return store;
    }
    async getWooCommerceStoresByUser(userId, channelId) {
        return await db
            .select()
            .from(woocommerceStores)
            .where(and(eq(woocommerceStores.userId, userId), eq(woocommerceStores.channelId, channelId), eq(woocommerceStores.isActive, true)));
    }
    async getWooCommerceStoreById(id) {
        const [store] = await db
            .select()
            .from(woocommerceStores)
            .where(eq(woocommerceStores.id, id));
        return store;
    }
    async updateWooCommerceStore(id, data) {
        const [store] = await db
            .update(woocommerceStores)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where(eq(woocommerceStores.id, id))
            .returning();
        return store;
    }
    async deleteWooCommerceStore(id) {
        await db
            .delete(woocommerceStores)
            .where(eq(woocommerceStores.id, id));
        return true;
    }
    async findContactByPhone(channelId, phone) {
        const normalizedPhone = phone.replace(/\D/g, "");
        const [contact] = await db
            .select()
            .from(contacts)
            .where(and(eq(contacts.channelId, channelId), sql `regexp_replace(${contacts.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`))
            .limit(1);
        return contact;
    }
    // async findOrCreateContact(data: {
    //   channelId: string;
    //   storeId?: string;
    //   phone: string;
    //   email?: string;
    //   name?: string;
    //   createdBy?: string;
    //   externalId?: string;
    //   source?: string;
    // }): Promise<Contact> {
    //   const {
    //     channelId,
    //     storeId,
    //     email,
    //     name,
    //     createdBy,
    //     externalId,
    //     source = "shopify"
    //   } = data;
    //   const phone = data.phone.replace(/\D/g, "");
    //   const [existing] = await db
    //     .select()
    //     .from(contacts)
    //     .where(
    //       and(
    //         eq(contacts.channelId, channelId),
    //         sql`regexp_replace(${contacts.phone}, '[^0-9]', '', 'g') = ${phone}`
    //       )
    //     )
    //     .limit(1);
    //   if (existing) {
    //     const existingPhone = existing.phone.replace(/\D/g, "");
    //     const updateData: Partial<typeof contacts.$inferInsert> = {};
    //     if (name && (!existing.name || existing.name !== name)) {
    //       updateData.name = name;
    //     }
    //     if (email && (!existing.email || existing.email !== email)) {
    //       updateData.email = email;
    //     }
    //     if (storeId && existing.storeId !== storeId) {
    //       updateData.storeId = storeId;
    //     }
    //     if (createdBy && existing.createdBy !== createdBy) {
    //       updateData.createdBy = createdBy;
    //     }
    //     if (externalId && existing.externalId !== externalId) {
    //       updateData.externalId = externalId;
    //     }
    //     if (existingPhone !== phone) {
    //       updateData.phone = phone;
    //     }
    //     // Always update last contact
    //     updateData.lastContact = new Date();
    //     if (Object.keys(updateData).length > 0) {
    //       updateData.updatedAt = new Date();
    //       const [updated] = await db
    //         .update(contacts)
    //         .set(updateData)
    //         .where(eq(contacts.id, existing.id))
    //         .returning();
    //       return updated;
    //     }
    //     return existing;
    //   }
    //   const [contact] = await db
    //     .insert(contacts)
    //     .values({
    //       channelId,
    //       storeId,
    //       name: name || phone,
    //       phone,
    //       email,
    //       source,
    //       status: "active",
    //       createdBy,
    //       externalId,
    //       lastContact: new Date(),
    //       createdAt: new Date(),
    //       updatedAt: new Date(),
    //     })
    //     .returning();
    //   return contact;
    // }
    async findOrCreateContact(data) {
        const { channelId, storeId, email, name, createdBy, externalId, source = "shopify" } = data;
        const phone = data.phone.replace(/\D/g, "");
        const [existing] = await db
            .select()
            .from(contacts)
            .where(and(eq(contacts.channelId, channelId), sql `(
          regexp_replace(${contacts.phone}, '[^0-9]', '', 'g') = ${phone}
          OR (${email}::text IS NOT NULL AND lower(${contacts.email}) = lower(${email}))
        )`))
            .limit(1);
        if (existing) {
            const [updated] = await db
                .update(contacts)
                .set({
                name: name || existing.name,
                email: email || existing.email,
                phone,
                storeId: storeId || existing.storeId,
                createdBy: createdBy || existing.createdBy,
                externalId: externalId || existing.externalId,
                lastContact: new Date(),
                updatedAt: new Date(),
            })
                .where(eq(contacts.id, existing.id))
                .returning();
            return updated;
        }
        const [contact] = await db
            .insert(contacts)
            .values({
            channelId,
            storeId,
            name: name || phone,
            phone,
            email,
            source,
            status: "active",
            createdBy,
            externalId,
            lastContact: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        })
            .returning();
        return contact;
    }
    async getAbandonedCartReminders(cartId) {
        return await db
            .select()
            .from(abandonedCartReminders)
            .where(eq(abandonedCartReminders.cartId, cartId))
            .orderBy(abandonedCartReminders.scheduledAt);
    }
    async getPendingAbandonedCartReminders() {
        const now = new Date();
        console.log("NOW:", now.toISOString());
        const reminders = await db
            .select()
            .from(abandonedCartReminders)
            .where(and(eq(abandonedCartReminders.status, "pending"), lte(abandonedCartReminders.scheduledAt, now)));
        console.log("Due reminders:", reminders.map(r => ({
            id: r.id,
            scheduledAt: r.scheduledAt,
            status: r.status,
        })));
        return reminders;
    }
    async markAbandonedCartReminderSent(id) {
        await db
            .update(abandonedCartReminders)
            .set({
            status: "sent",
            sentAt: new Date(),
            updatedAt: new Date(),
        })
            .where(eq(abandonedCartReminders.id, id));
    }
    async markAbandonedCartReminderSkipped(id) {
        await db
            .update(abandonedCartReminders)
            .set({
            status: "skipped",
            updatedAt: new Date(),
        })
            .where(eq(abandonedCartReminders.id, id));
    }
    async markAbandonedCartReminderFailed(id, error) {
        await db
            .update(abandonedCartReminders)
            .set({
            status: "failed",
            error,
            updatedAt: new Date(),
        })
            .where(eq(abandonedCartReminders.id, id));
    }
    async updateAbandonedCartReminder(id, data) {
        const [result] = await db
            .update(abandonedCartReminders)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where(eq(abandonedCartReminders.id, id))
            .returning();
        return result;
    }
    // Users
    async getUser(id) {
        return this.userRepo.getById(id);
    }
    async getPermissions(id) {
        return this.userRepo.getByPermissions(id); // this now makes sense
    }
    async getUserByUsername(username) {
        return this.userRepo.getByUsername(username);
    }
    async createUser(insertUser) {
        return this.userRepo.create(insertUser);
    }
    async getAllUsers() {
        return this.userRepo.getAll();
    }
    // Contacts
    async getContacts() {
        return this.contactRepo.getAll();
    }
    async getContactsByUser(userId, page = 1, limit = 10, filters = {}) {
        return this.contactRepo.getContactsByUserId(userId, page, limit, filters);
    }
    async getContactsByChannel(channelId) {
        return this.contactRepo.getByChannel(channelId);
    }
    async getContactsByTenant(tenantId) {
        return this.contactRepo.getContactsByTenant(tenantId);
    }
    async getContactByEmail(email) {
        return this.contactRepo.getContactByEmail(email);
    }
    async getContactsByPhone(phone) {
        return this.contactRepo.getContactByPhone(phone);
    }
    async searchContactsByChannel(channelId) {
        return this.contactRepo.getByChannel(channelId);
    }
    async getContact(id) {
        return this.contactRepo.getById(id);
    }
    async getContactsByIds(ids) {
        return this.contactRepo.getByIds(ids);
    }
    async getContactByPhone(phone) {
        return this.contactRepo.getByPhone(phone);
    }
    async getContactByPhoneAndChannel(phone, channelId) {
        return this.contactRepo.getByPhoneAndChannel(phone, channelId);
    }
    // async createContact(insertContact: InsertContact): Promise<Contact> {
    //   return this.contactRepo.create(insertContact);
    // }
    async createContact(insertContact) {
        if (!insertContact.channelId) {
            throw new Error("Cannot create contact without a channel. Please create a channel first.");
        }
        return this.contactRepo.create(insertContact);
    }
    async updateContact(id, contact) {
        return this.contactRepo.update(id, contact);
    }
    async deleteContact(id) {
        return this.contactRepo.delete(id);
    }
    async searchContacts(query) {
        return this.contactRepo.search(query);
    }
    async createBulkContacts(insertContacts) {
        return this.contactRepo.createBulk(insertContacts);
    }
    async checkExistingPhones(phones, channelId) {
        return this.contactRepo.checkExistingPhones(phones, channelId);
    }
    // Campaigns
    async getCampaigns(page = 1, limit = 10) {
        return this.campaignRepo.getAll(page, limit);
    }
    async getCampaignsByChannel(channelId, page = 1, limit = 10) {
        return this.campaignRepo.getByChannel(channelId, page, limit);
    }
    async getCampaign(id) {
        return this.campaignRepo.getById(id);
    }
    async getCampaignByUserId(userId, page = 1, limit = 10) {
        return this.campaignRepo.getCampaignByUserId(userId, page, limit);
    }
    async createCampaign(insertCampaign) {
        return this.campaignRepo.create(insertCampaign);
    }
    async updateCampaign(id, campaign) {
        return this.campaignRepo.update(id, campaign);
    }
    async incrementCampaignSentCount(id) {
        return this.campaignRepo.incrementSentCount(id);
    }
    async incrementCampaignFailedCount(id) {
        return this.campaignRepo.incrementFailedCount(id);
    }
    async deleteCampaign(id) {
        // Soft-delete only (status → deleted) so the campaign can be restored
        // like auto-calling campaigns. Do not wipe the message queue.
        return this.campaignRepo.delete(id);
    }
    async getDeletedCampaigns(page = 1, limit = 100) {
        return this.campaignRepo.getDeleted(page, limit);
    }
    async getDeletedCampaignsByChannel(channelId, page = 1, limit = 100) {
        return this.campaignRepo.getDeletedByChannel(channelId, page, limit);
    }
    async getDeletedCampaignsByChannelIds(channelIds, page = 1, limit = 100) {
        return this.campaignRepo.getDeletedByChannelIds(channelIds, page, limit);
    }
    async getDeletedCampaignsByUserId(userId, page = 1, limit = 100) {
        return this.campaignRepo.getDeletedByUserId(userId, page, limit);
    }
    async getCampaignIncludingDeleted(id) {
        return this.campaignRepo.getByIdIncludingDeleted(id);
    }
    async restoreCampaign(id) {
        return this.campaignRepo.restore(id);
    }
    // Channels
    async getChannels() {
        return this.channelRepo.getAll();
    }
    async getChannel(id) {
        return this.channelRepo.getById(id);
    }
    async getChannelsByUserId(userId) {
        return this.channelRepo.getAllByUserId(userId);
    }
    async getActiveChannelByUserId(userId) {
        return this.channelRepo.getActiveByUserId(userId);
    }
    async getChannelsByUser(userId, page = 1, limit = 10) {
        return this.channelRepo.getByUser(userId, page, limit);
    }
    async getChannelByPhoneNumberId(phoneNumberId) {
        return this.channelRepo.getByPhoneNumberId(phoneNumberId);
    }
    async getChannelsByPhoneNumber(phoneNumber) {
        return this.channelRepo.getByPhoneNumber(phoneNumber);
    }
    async createChannel(insertChannel) {
        return this.channelRepo.create(insertChannel);
    }
    async updateChannel(id, channel) {
        return this.channelRepo.update(id, channel);
    }
    async deleteChannel(id) {
        return this.channelRepo.delete(id);
    }
    async getActiveChannel() {
        return this.channelRepo.getActive();
    }
    // Templates
    // async getTemplates(): Promise<Template[]> {
    //   return this.templateRepo.getAll();
    // }
    // database-storage.ts
    async getTemplates(page = 1, limit = 10) {
        const result = await this.templateRepo.getAll(page, limit);
        return {
            data: result.data,
            pagination: result.pagination,
        };
    }
    async getTemplatesByUserId(userId, page = 1, limit = 10) {
        return this.templateRepo.getTemplateByUserID(userId, page, limit);
    }
    async getTemplatesByChannelAndUser(channelId, userId) {
        const channel = await this.getChannel(channelId);
        if (!channel || channel.createdBy !== userId) {
            return [];
        }
        return await db
            .select()
            .from(templatesTable)
            .where(eq(templatesTable.channelId, channelId))
            .orderBy(desc(templatesTable.createdAt));
    }
    // in DatabaseStorage
    async getAllTemplatesByChannel(channelId) {
        return await db
            .select()
            .from(templatesTable)
            .where(eq(templatesTable.channelId, channelId));
    }
    async getTemplatesByChannelOLd(channelId) {
        return this.templateRepo.getByChannel(channelId);
    }
    async getTemplatesByChannel(channelId, page = 1, limit = 10) {
        return this.templateRepo.getByChannel(channelId, page, limit);
    }
    async getTemplatesByName(name) {
        const templates = await this.templateRepo.getByName(name);
        return templates ? (Array.isArray(templates) ? templates : [templates]) : [];
    }
    async getTemplateByNameAndChannel(name, channelId) {
        return this.templateRepo.getByNameAndChannel(name, channelId);
    }
    async getTemplate(id) {
        return this.templateRepo.getById(id);
    }
    async createTemplate(insertTemplate) {
        return this.templateRepo.create(insertTemplate);
    }
    async updateTemplate(id, template) {
        return this.templateRepo.update(id, template);
    }
    async deleteTemplate(id) {
        return this.templateRepo.delete(id);
    }
    // Conversations
    async getConversations() {
        return this.conversationRepo.getAll();
    }
    async getConversationBySessionId(sessionId) {
        return this.conversationRepo.getBySessionId(sessionId);
    }
    async getConversationsByChannel(channelId) {
        return this.conversationRepo.getByChannel(channelId);
    }
    async getConversationsByContact(contactId) {
        return this.conversationRepo.getByContact(contactId);
    }
    async getConversationsNew() {
        return this.conversationRepo.getAllNew();
    }
    async getConversationsByChannelNew(channelId) {
        return this.conversationRepo.getByChannelNew(channelId);
    }
    async getConversation(id) {
        return this.conversationRepo.getById(id);
    }
    async getConversationByPhone(phone) {
        return this.conversationRepo.getByPhone(phone);
    }
    async getConversationByPhoneAndChannel(phone, channelId) {
        return this.conversationRepo.getByPhoneAndChannel(phone, channelId);
    }
    async createConversation(insertConversation) {
        return this.conversationRepo.create(insertConversation);
    }
    async updateConversation(id, conversation) {
        return this.conversationRepo.update(id, conversation);
    }
    async deleteConversation(id) {
        return this.conversationRepo.delete(id);
    }
    async getUnreadConversationsCount() {
        return this.conversationRepo.getUnreadCount();
    }
    // Messages
    async getMessages(conversationId, limit = 100, beforeTs, beforeId) {
        return this.messageRepo.getByConversation(conversationId, limit, beforeTs, beforeId);
    }
    async createMessage(insertMessage) {
        return this.messageRepo.create(insertMessage);
    }
    async updateMessage(id, message) {
        return this.messageRepo.update(id, message);
    }
    async getMessageByWhatsAppId(whatsappMessageId) {
        return this.messageRepo.getByWhatsAppId(whatsappMessageId);
    }
    async getConversationMessages(conversationId) {
        return this.messageRepo.getConversationMessages(conversationId);
    }
    async getMessage(id) {
        return this.messageRepo.getById(id);
    }
    // Automations
    async getAutomations() {
        // Get all automations by not filtering by channel
        return this.automationRepo.findByChannel("");
    }
    async getAutomationsByChannel(channelId) {
        return this.automationRepo.findByChannel(channelId);
    }
    async getAutomation(id) {
        return this.automationRepo.findById(id);
    }
    async getAutomationWithNodes(id) {
        return this.automationRepo.findByIdWithNodes(id);
    }
    async createAutomation(insertAutomation) {
        return this.automationRepo.create(insertAutomation);
    }
    async updateAutomation(id, automation) {
        const result = await this.automationRepo.update(id, automation);
        return result || undefined;
    }
    async deleteAutomation(id) {
        await this.automationRepo.delete(id);
        return true;
    }
    // Analytics
    // async getAnalytics(days?: number): Promise<Analytics[]> {
    //   return this.analyticsRepo.getAnalytics(days);
    // }
    async createOrUpdateAnalytics(insertAnalytics) {
        return this.analyticsRepo.createOrUpdate(insertAnalytics);
    }
    async deleteOldAnalytics(daysToKeep) {
        return this.analyticsRepo.deleteOldAnalytics(daysToKeep);
    }
    // WhatsApp Channels
    async getWhatsappChannel(channelId) {
        return this.whatsappChannelRepo.getByChannelId(channelId);
    }
    async createWhatsappChannel(insertChannel) {
        return this.whatsappChannelRepo.create(insertChannel);
    }
    async updateWhatsappChannel(id, channel) {
        return this.whatsappChannelRepo.update(id, channel);
    }
    // Webhook Configs
    async getWebhookConfigs() {
        return this.webhookConfigRepo.getAll();
    }
    async getWebhookConfig(id) {
        return this.webhookConfigRepo.getById(id);
    }
    async createWebhookConfig(insertConfig) {
        return this.webhookConfigRepo.create(insertConfig);
    }
    async updateWebhookConfig(id, config) {
        return this.webhookConfigRepo.update(id, config);
    }
    async deleteWebhookConfig(id) {
        return this.webhookConfigRepo.delete(id);
    }
    // Message Queue
    async getMessageQueueByChannel(channelId) {
        return this.messageQueueRepo.getByChannel(channelId);
    }
    async getPendingMessages() {
        return this.messageQueueRepo.getPending();
    }
    // async getMessagesToCheck(): Promise<MessageQueue[]> {
    //   return this.messageQueueRepo.getMessagesToCheck();
    // }
    async createMessageQueueItem(insertMessage) {
        return this.messageQueueRepo.create(insertMessage);
    }
    async createBulkMessageQueue(insertMessages) {
        return this.messageQueueRepo.createBulk(insertMessages);
    }
    async updateMessageQueueItem(id, message) {
        return this.messageQueueRepo.update(id, message);
    }
    async updateMessageQueueByWhatsAppId(whatsappMessageId, updates) {
        return this.messageQueueRepo.updateByWhatsAppId(whatsappMessageId, updates);
    }
    async getMessageQueueByCampaign(campaignId) {
        return this.messageQueueRepo.getByCampaign(campaignId);
    }
    // async getMessagesForRetry(limit: number = 100): Promise<MessageQueue[]> {
    //   return this.messageQueueRepo.getForRetry(limit);
    // }
    // API Logs
    async createApiLog(insertLog) {
        return this.apiLogRepo.create(insertLog);
    }
    async getApiLogs(channelId, limit) {
        return this.apiLogRepo.getByChannel(channelId, limit);
    }
    // Analytics
    async getAnalyticsByChannel(channelId, days) {
        return this.analyticsRepo.getAnalyticsByChannel(channelId, days);
    }
    async getAnalytics() {
        return this.analyticsRepo.getAnalytics();
    }
    async createAnalytics(insertAnalytics) {
        return this.analyticsRepo.createOrUpdate(insertAnalytics);
    }
    // Dashboard Stats
    async getDashboardStats() {
        const { totalCount, todayCount, weekCount, lastWeekCount } = await this.contactRepo.getContactStats();
        const totalCampaigns = await this.campaignRepo
            .getAllCampaignCount();
        const totalTemplates = await this.templateRepo
            .getAll()
            .then((t) => t.length);
        const messageStats = await this.messageQueueRepo.getMessageStats();
        const totalUsers = await this.userRepo.getAll().then(users => users.filter(user => user.role === "admin").length);
        const totalActiveUsers = ((await this.userRepo.getAll().then(users => users.filter(user => user.role === "admin" && user.status === 'active'))).length);
        const totalBlockedUsers = ((await this.userRepo.getAll().then(users => users.filter(user => user.role === "admin" && user.status === 'blocked'))).length);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const users = await this.userRepo.getAll();
        const todaySignups = users.filter(user => user.role === "admin" &&
            new Date(user.createdAt) >= today &&
            new Date(user.createdAt) < tomorrow).length;
        const totalChannels = await this.channelRepo.getAll()
            .then((c) => c.length);
        const totalPaidUsers = await getActivePaidUsersCount();
        return {
            totalContacts: totalCount,
            todayContacts: todayCount,
            weekContacts: weekCount,
            lastWeekContacts: lastWeekCount,
            totalCampaigns,
            totalTemplates,
            totalUsers,
            totalActiveUsers,
            totalBlockedUsers,
            todaySignups,
            totalChannels,
            totalPaidUsers,
            ...messageStats,
        };
    }
    async getDashboardStatsByChannel(channelId, userId) {
        const { totalCount, todayCount, weekCount, lastWeekCount } = await this.contactRepo.getContactStats(channelId);
        const totalCampaigns = await this.campaignRepo
            .getByChannel(channelId)
            .then((c) => c.total ?? 0);
        const totalTemplates = await this.templateRepo.getByChannel(channelId).then((t) => t.total ?? 0);
        const totalTemplatesByUserId = await this.templateRepo.getTemplateByUserID(userId);
        const messageStats = await this.messageQueueRepo.getMessageStatsByChannel(channelId);
        const totalChannels = await this.channelRepo.getTotalChannelsByUser(userId);
        const totalTeamMembers = await this.userRepo.getTeamUsersCountByCreator(userId);
        return {
            totalContacts: Number(totalCount),
            todayContacts: Number(todayCount),
            weekContacts: Number(weekCount),
            lastWeekContacts: Number(lastWeekCount),
            totalCampaigns,
            totalTemplates,
            totalChannels,
            totalTeamMembers,
            totalTemplatesByUserId: totalTemplatesByUserId.total,
            ...messageStats,
        };
    }
}
