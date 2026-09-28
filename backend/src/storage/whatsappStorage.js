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
import { randomUUID } from "crypto";
export class MemStorage {
    users = new Map();
    contacts = new Map();
    campaigns = new Map();
    channels = new Map();
    templates = new Map();
    conversations = new Map();
    messages = new Map();
    automations = new Map();
    analytics = new Map();
    whatsappChannels = new Map();
    webhookConfigs = new Map();
    messageQueues = new Map();
    apiLogs = new Map();
    constructor() {
        this.initializeSampleData();
    }
    initializeSampleData() {
        // Initialize with some basic structure - no mock data
        const today = new Date();
        const analyticsEntry = {
            id: randomUUID(),
            channelId: "default-channel",
            date: today,
            messagesSent: 0,
            messagesDelivered: 0,
            messagesRead: 0,
            messagesReplied: 0,
            newContacts: 0,
            activeCampaigns: 0,
            createdAt: today,
        };
        this.analytics.set(analyticsEntry.id, analyticsEntry);
        // Initialize a default channel for the user to work with
        const defaultChannel = {
            id: randomUUID(),
            name: "Main WhatsApp Channel",
            phoneNumberId: "153851404474202", // User's provided phone number ID
            accessToken: "Bearer EAAxxxxxxx", // User needs to update this with their actual token
            whatsappBusinessAccountId: "123456789012345", // User needs to update this with actual WABA ID
            phoneNumber: "+1234567890", // User needs to update with actual phone number
            isActive: true,
            healthStatus: "unknown", // ✅ added
            lastHealthCheck: null, // ✅ added
            healthDetails: null, // ✅ added
            createdAt: today,
            updatedAt: today,
        };
        this.channels.set(defaultChannel.id, defaultChannel);
    }
    // Dashboard stats by channel
    async getDashboardStatsByChannel(channelId) {
        const campaigns = Array.from(this.campaigns.values()).filter(c => c.channelId === channelId);
        const contacts = Array.from(this.contacts.values()).filter(c => c.channelId === channelId);
        const conversations = Array.from(this.conversations.values()).filter(c => c.channelId === channelId);
        const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
        const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
        const totalDelivered = campaigns.reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
        const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const newLeads = contacts.filter(c => c.createdAt && c.createdAt >= weekAgo).length;
        const unreadChats = conversations.filter(c => c.status === 'open').length;
        return {
            totalMessages: totalSent,
            activeCampaigns,
            deliveryRate: Math.round(deliveryRate * 10) / 10,
            newLeads,
            messagesGrowth: 12.5,
            campaignsRunning: activeCampaigns,
            unreadChats,
        };
    }
    // Find channel by phoneNumberId
    async getChannelByPhoneNumberId(phoneNumberId) {
        return Array.from(this.channels.values()).find(c => c.phoneNumberId === phoneNumberId);
    }
    async getChannelsByPhoneNumber(phoneNumber) {
        return Array.from(this.channels.values()).filter(c => c.phoneNumber === phoneNumber);
    }
    // Return message queue (stub)
    async getMessageQueue() {
        return {};
    }
    async getAutomationByChannel(channelId) {
        return Array.from(this.automations.values()).filter(a => a.channelId === channelId);
    }
    async getCampaignsByChannel(channelId) {
        return Array.from(this.campaigns.values()).filter(c => c.channelId === channelId);
    }
    async getTemplatesByChannel(channelId) {
        return Array.from(this.templates.values()).filter(t => t.channelId === channelId);
    }
    async getConversationsByChannel(channelId) {
        return Array.from(this.conversations.values()).filter(c => c.channelId === channelId);
    }
    async deleteConversation(id) {
        return this.conversations.delete(id);
    }
    async getAutomationsByChannel(channelId) {
        return Array.from(this.automations.values()).filter(a => a.channelId === channelId);
    }
    async getAnalyticsByChannel(channelId, days = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return Array.from(this.analytics.values())
            .filter(a => a.channelId === channelId && a.date >= cutoff);
    }
    // Users
    async getAllUsers() {
        return Array.from(this.users.values());
    }
    // Contacts
    async getContactsByChannel(channelId) {
        return Array.from(this.contacts.values()).filter(c => c.channelId === channelId);
    }
    async getContactByPhone(phone) {
        return Array.from(this.contacts.values()).find(c => c.phone === phone);
    }
    async getContactByPhoneAndChannel(phone, channelId) {
        return Array.from(this.contacts.values()).find(c => c.phone === phone && c.channelId === channelId);
    }
    async searchContactsByChannel(channelId, query) {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.contacts.values())
            .filter(c => c.channelId === channelId)
            .filter(c => c.name.toLowerCase().includes(lowerQuery) || c.phone.includes(query));
    }
    // Users
    async getUser(id) {
        return this.users.get(id);
    }
    async getUserByUsername(username) {
        return Array.from(this.users.values()).find(user => user.username === username);
    }
    async createUser(insertUser) {
        const id = randomUUID();
        const user = {
            ...insertUser,
            id,
            firstName: insertUser.firstName || null,
            lastName: insertUser.lastName || null,
            avatar: insertUser.avatar || null,
            role: insertUser.role || "agent",
            status: insertUser.status || "active",
            lastLogin: null,
            updatedAt: new Date(),
            createdAt: new Date(),
        };
        this.users.set(id, user);
        return user;
    }
    // Contacts
    async getContacts() {
        return Array.from(this.contacts.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
    async getContactsByUser(userId, page = 1, limit = 10, filters = {}) {
        let all = Array.from(this.contacts.values())
            .filter(c => c.createdBy === userId)
            .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
        if (filters.channelId) {
            all = all.filter(c => c.channelId === filters.channelId);
        }
        if (filters.group) {
            all = all.filter(c => Array.isArray(c.groups) && c.groups.includes(filters.group));
        }
        const total = all.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const offset = (page - 1) * limit;
        return { data: all.slice(offset, offset + limit), total, totalPages, page, limit };
    }
    async getContact(id) {
        return this.contacts.get(id);
    }
    async getContactsByIds(ids) {
        if (ids.length === 0)
            return [];
        return ids
            .map((id) => this.contacts.get(id))
            .filter((c) => c !== undefined);
    }
    async createContact(insertContact) {
        const id = randomUUID();
        const contact = {
            ...insertContact,
            id,
            channelId: insertContact.channelId || null,
            email: insertContact.email || null,
            groups: Array.isArray(insertContact.groups) ? insertContact.groups : [],
            tags: insertContact.tags || [],
            status: insertContact.status || "active",
            lastContact: null,
            updatedAt: new Date(),
            createdAt: new Date(),
        };
        this.contacts.set(id, contact);
        return contact;
    }
    async updateContact(id, updates) {
        const contact = this.contacts.get(id);
        if (!contact)
            return undefined;
        const updatedContact = { ...contact, ...updates };
        this.contacts.set(id, updatedContact);
        return updatedContact;
    }
    async deleteContact(id) {
        return this.contacts.delete(id);
    }
    async searchContacts(query) {
        const lowercaseQuery = query.toLowerCase();
        return Array.from(this.contacts.values()).filter(contact => contact.name.toLowerCase().includes(lowercaseQuery) ||
            contact.phone.includes(query) ||
            contact.email?.toLowerCase().includes(lowercaseQuery));
    }
    // Campaigns
    async getCampaigns() {
        return Array.from(this.campaigns.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
    async getScheduledCampaigns(now) {
        return Array.from(this.campaigns.values())
            .filter((campaign) => {
            return (campaign.status === "scheduled" &&
                campaign.scheduledAt &&
                campaign.scheduledAt <= now);
        })
            .sort((a, b) => (a.scheduledAt?.getTime() || 0) -
            (b.scheduledAt?.getTime() || 0));
    }
    async getCampaign(id) {
        return this.campaigns.get(id);
    }
    async getCampaignByUserId(userId) {
        return this.campaigns.get(userId);
    }
    async createCampaign(insertCampaign) {
        const id = randomUUID();
        const campaign = {
            ...insertCampaign,
            id,
            channelId: insertCampaign.channelId || null,
            status: insertCampaign.status || "draft",
            templateId: insertCampaign.templateId || null,
            templateLanguage: insertCampaign.templateLanguage || "en_US",
            templateName: insertCampaign.templateName || null,
            description: insertCampaign.description || null,
            apiKey: insertCampaign.apiKey || null,
            apiEndpoint: insertCampaign.apiEndpoint || null,
            variableMapping: insertCampaign.variableMapping || {},
            contactGroups: Array.isArray(insertCampaign.contactGroups) ? insertCampaign.contactGroups : [],
            csvData: insertCampaign.csvData || [],
            scheduledAt: insertCampaign.scheduledAt || null,
            recipientCount: insertCampaign.recipientCount || 0,
            sentCount: insertCampaign.sentCount || 0,
            readCount: insertCampaign.readCount || 0,
            repliedCount: insertCampaign.repliedCount || 0,
            failedCount: insertCampaign.failedCount || 0,
            deliveredCount: insertCampaign.deliveredCount || 0,
            completedAt: insertCampaign.completedAt || null,
            updatedAt: new Date(),
            createdAt: new Date(),
        };
        this.campaigns.set(id, campaign);
        return campaign;
    }
    async updateCampaign(id, updates) {
        const campaign = this.campaigns.get(id);
        if (!campaign)
            return undefined;
        const updatedCampaign = { ...campaign, ...updates };
        this.campaigns.set(id, updatedCampaign);
        return updatedCampaign;
    }
    async incrementCampaignSentCount(id) {
        const campaign = this.campaigns.get(id);
        if (campaign) {
            campaign.sentCount = (campaign.sentCount || 0) + 1;
            this.campaigns.set(id, campaign);
        }
    }
    async incrementCampaignFailedCount(id) {
        const campaign = this.campaigns.get(id);
        if (campaign) {
            campaign.failedCount = (campaign.failedCount || 0) + 1;
            this.campaigns.set(id, campaign);
        }
    }
    async deleteCampaign(id) {
        const campaign = this.campaigns.get(id);
        if (!campaign || campaign.status === "deleted")
            return false;
        this.campaigns.set(id, { ...campaign, status: "deleted", updatedAt: new Date() });
        return true;
    }
    async getCampaignIncludingDeleted(id) {
        return this.campaigns.get(id);
    }
    async restoreCampaign(id) {
        const campaign = this.campaigns.get(id);
        if (!campaign || campaign.status !== "deleted")
            return undefined;
        const recipientCount = Number(campaign.recipientCount) || 0;
        const sentCount = Number(campaign.sentCount) || 0;
        let status = "draft";
        if (campaign.completedAt || (recipientCount > 0 && sentCount >= recipientCount))
            status = "completed";
        else if (sentCount > 0)
            status = "paused";
        else if (campaign.scheduledAt && new Date(campaign.scheduledAt) > new Date())
            status = "scheduled";
        const restored = { ...campaign, status, updatedAt: new Date() };
        this.campaigns.set(id, restored);
        return restored;
    }
    async getDeletedCampaigns(page = 1, limit = 100) {
        const data = Array.from(this.campaigns.values()).filter((c) => c.status === "deleted");
        return { data, total: data.length, page, limit };
    }
    async getDeletedCampaignsByChannel(channelId, page = 1, limit = 100) {
        const data = Array.from(this.campaigns.values()).filter((c) => c.status === "deleted" && c.channelId === channelId);
        return { data, total: data.length, page, limit };
    }
    async getDeletedCampaignsByChannelIds(channelIds, page = 1, limit = 100) {
        const idSet = new Set(channelIds);
        const data = Array.from(this.campaigns.values()).filter((c) => c.status === "deleted" && c.channelId && idSet.has(c.channelId));
        return { data, total: data.length, page, limit };
    }
    async getDeletedCampaignsByUserId(userId, page = 1, limit = 100) {
        const data = Array.from(this.campaigns.values()).filter((c) => c.status === "deleted" && c.createdBy === userId);
        return { data, total: data.length, page, limit };
    }
    // Channels
    async getChannels() {
        return Array.from(this.channels.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
    async getChannelsByUser(userId) {
        return Array.from(this.channels.values())
            .filter(channel => channel.createdBy === userId)
            .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
    async getChannelsByUserId(userId) {
        return this.getChannelsByUser(userId);
    }
    async getChannel(id) {
        return this.channels.get(id);
    }
    async createChannel(insertChannel) {
        const id = randomUUID();
        const channel = {
            ...insertChannel,
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            whatsappBusinessAccountId: insertChannel.whatsappBusinessAccountId || null,
            phoneNumber: insertChannel.phoneNumber || null,
            isActive: insertChannel.isActive ?? true,
            healthStatus: insertChannel.healthStatus || "unknown",
            lastHealthCheck: null,
            healthDetails: null,
        };
        this.channels.set(id, channel);
        return channel;
    }
    async updateChannel(id, updates) {
        const channel = this.channels.get(id);
        if (!channel)
            return undefined;
        const updatedChannel = { ...channel, ...updates, updatedAt: new Date() };
        this.channels.set(id, updatedChannel);
        return updatedChannel;
    }
    async deleteChannel(id) {
        return this.channels.delete(id);
    }
    async getActiveChannel() {
        const channels = Array.from(this.channels.values());
        return channels.find(c => c.isActive) || channels[0];
    }
    // Templates
    async getTemplates() {
        return Array.from(this.templates.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
    async getTemplate(id) {
        return this.templates.get(id);
    }
    async getTemplatesByUserId(userId) {
        return Array.from(this.templates.values()).filter(t => t.createdBy === userId);
    }
    async getTemplatesByChannelAndUser(channelId, userId) {
        const channel = this.channels.get(channelId);
        if (!channel)
            return [];
        if (channel.createdBy !== userId)
            return [];
        return Array.from(this.templates.values())
            .filter(t => t.channelId === channelId)
            .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
    async createTemplate(insertTemplate) {
        const id = randomUUID();
        const template = {
            ...insertTemplate,
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: insertTemplate.status || "draft",
            channelId: insertTemplate.channelId || null,
            language: insertTemplate.language || "en_US",
            header: insertTemplate.header || null,
            footer: insertTemplate.footer || null,
            buttons: insertTemplate.buttons || [],
            variables: insertTemplate.variables || [],
            rejectionReason: insertTemplate.rejectionReason || null,
            whatsappTemplateId: insertTemplate.whatsappTemplateId || null,
            mediaType: insertTemplate.mediaType || "text",
            mediaUrl: insertTemplate.mediaUrl || null,
            mediaHandle: insertTemplate.mediaHandle || null,
            carouselCards: insertTemplate.carouselCards || [],
            usage_count: insertTemplate.usage_count ?? 0,
        };
        this.templates.set(id, template);
        return template;
    }
    //   async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    //   const id = randomUUID();
    //   const template: Template = {
    //     ...insertTemplate,
    //     id,
    //     createdAt: new Date(),
    //     updatedAt: new Date(),
    //     createdBy: insertTemplate.createdBy,  // ✅ ADD THIS
    //     status: insertTemplate.status || "draft",
    //     channelId: insertTemplate.channelId || null,
    //     language: insertTemplate.language || "en_US",
    //     header: insertTemplate.header || null,
    //     footer: insertTemplate.footer || null,
    //     buttons: insertTemplate.buttons || [],
    //     variables: insertTemplate.variables || [],
    //     rejectionReason: insertTemplate.rejectionReason || null,
    //     whatsappTemplateId: insertTemplate.whatsappTemplateId || null,
    //     mediaType: insertTemplate.mediaType || "text",
    //     mediaUrl: insertTemplate.mediaUrl || null,
    //     mediaHandle: insertTemplate.mediaHandle || null,
    //     carouselCards: insertTemplate.carouselCards || [],
    //     usage_count: insertTemplate.usage_count ?? 0,
    //   };
    //   this.templates.set(id, template);
    //   return template;
    // }
    async updateTemplate(id, updates) {
        const template = this.templates.get(id);
        if (!template)
            return undefined;
        const updatedTemplate = { ...template, ...updates };
        this.templates.set(id, updatedTemplate);
        return updatedTemplate;
    }
    async deleteTemplate(id) {
        return this.templates.delete(id);
    }
    // Conversations
    async getConversations() {
        return Array.from(this.conversations.values()).sort((a, b) => (b.lastMessageAt?.getTime() || b.createdAt?.getTime() || 0) -
            (a.lastMessageAt?.getTime() || a.createdAt?.getTime() || 0));
    }
    async getConversation(id) {
        return this.conversations.get(id);
    }
    async getConversationByPhone(phone) {
        return Array.from(this.conversations.values()).find(c => c.contactPhone === phone);
    }
    async getConversationByPhoneAndChannel(phone, channelId) {
        return Array.from(this.conversations.values()).find(c => c.contactPhone === phone && c.channelId === channelId);
    }
    async createConversation(insertConversation) {
        const id = randomUUID();
        const conversation = {
            ...insertConversation,
            id,
            channelId: insertConversation.channelId || null,
            contactId: insertConversation.contactId || null,
            contactPhone: insertConversation.contactPhone || null,
            contactName: insertConversation.contactName || null,
            assignedTo: insertConversation.assignedTo || null,
            tags: insertConversation.tags || [],
            unreadCount: 0,
            priority: insertConversation.priority || "normal",
            status: insertConversation.status || "open",
            lastMessageAt: insertConversation.lastMessageAt || null,
            lastMessageText: insertConversation.lastMessageText || null,
            updatedAt: new Date(),
            createdAt: new Date(),
        };
        this.conversations.set(id, conversation);
        return conversation;
    }
    async updateConversation(id, updates) {
        const conversation = this.conversations.get(id);
        if (!conversation)
            return undefined;
        const updatedConversation = { ...conversation, ...updates };
        this.conversations.set(id, updatedConversation);
        return updatedConversation;
    }
    async getConversationMessages(conversationId) {
        return Array.from(this.messages.values())
            .filter(message => message.conversationId === conversationId)
            .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
    }
    async getMessages(conversationId, limit = 100, beforeTs, beforeId) {
        let msgs = Array.from(this.messages.values())
            .filter(message => message.conversationId === conversationId);
        if (beforeTs) {
            const beforeDate = new Date(beforeTs);
            msgs = msgs.filter(m => {
                if (!m.createdAt)
                    return false;
                const t = m.createdAt.getTime();
                const bt = beforeDate.getTime();
                if (t < bt)
                    return true;
                if (t === bt && beforeId)
                    return m.id < beforeId;
                return false;
            });
        }
        msgs.sort((a, b) => {
            const td = (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
            if (td !== 0)
                return td;
            return b.id < a.id ? -1 : 1;
        });
        const hasMore = msgs.length > limit;
        const slice = hasMore ? msgs.slice(0, limit) : msgs;
        return { messages: slice.reverse(), hasMore };
    }
    async createMessage(insertMessage) {
        const id = randomUUID();
        const message = {
            ...insertMessage,
            id,
            conversationId: insertMessage.conversationId || null,
            fromUser: insertMessage.fromUser || false,
            direction: insertMessage.direction || "inbound",
            messageType: insertMessage.messageType || "text",
            whatsappMessageId: insertMessage.whatsappMessageId || null,
            mediaUrl: insertMessage.mediaUrl || null,
            mediaId: insertMessage.mediaId || null,
            mediaMimeType: insertMessage.mediaMimeType || null,
            mediaSha256: insertMessage.mediaSha256 || null,
            metadata: insertMessage.metadata || {},
            type: insertMessage.type || "text",
            status: insertMessage.status || "sent",
            deliveredAt: insertMessage.deliveredAt || null,
            readAt: insertMessage.readAt || null,
            errorCode: insertMessage.errorCode || null,
            errorMessage: insertMessage.errorMessage || null,
            errorDetails: insertMessage.errorDetails || null,
            campaignId: insertMessage.campaignId || null,
            timestamp: insertMessage.timestamp || new Date(),
            updatedAt: new Date(),
            createdAt: new Date(),
        };
        this.messages.set(id, message);
        // Update conversation last message time
        if (insertMessage.conversationId) {
            const conversation = this.conversations.get(insertMessage.conversationId);
            if (conversation) {
                this.conversations.set(conversation.id, {
                    ...conversation,
                    lastMessageAt: new Date(),
                });
            }
        }
        return message;
    }
    async updateMessage(id, updates) {
        const message = this.messages.get(id);
        if (!message)
            return undefined;
        const updatedMessage = { ...message, ...updates };
        this.messages.set(id, updatedMessage);
        return updatedMessage;
    }
    async getMessageByWhatsAppId(whatsappMessageId) {
        return Array.from(this.messages.values()).find(m => m.whatsappMessageId === whatsappMessageId);
    }
    // Automations
    async getAutomations() {
        return Array.from(this.automations.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
    async getAutomation(id) {
        return this.automations.get(id);
    }
    async createAutomation(insertAutomation) {
        const id = randomUUID();
        const automation = {
            ...insertAutomation,
            id,
            channelId: insertAutomation.channelId || null,
            description: insertAutomation.description || null,
            triggerConfig: insertAutomation.triggerConfig || {},
            executionCount: 0,
            lastExecutedAt: null,
            status: insertAutomation.status || "inactive",
            createdBy: insertAutomation.createdBy || null,
            updatedAt: new Date(),
            createdAt: new Date(),
        };
        this.automations.set(id, automation);
        return automation;
    }
    async updateAutomation(id, updates) {
        const automation = this.automations.get(id);
        if (!automation)
            return undefined;
        const updatedAutomation = { ...automation, ...updates };
        this.automations.set(id, updatedAutomation);
        return updatedAutomation;
    }
    async deleteAutomation(id) {
        return this.automations.delete(id);
    }
    // Analytics
    async getAnalytics(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return Array.from(this.analytics.values())
            .filter(analytics => analytics.date >= cutoffDate)
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    async createAnalytics(insertAnalytics) {
        const id = randomUUID();
        const analytics = {
            ...insertAnalytics,
            id,
            channelId: insertAnalytics.channelId || null,
            activeCampaigns: insertAnalytics.activeCampaigns || 0,
            newContacts: insertAnalytics.newContacts || 0,
            messagesDelivered: insertAnalytics.messagesDelivered || 0,
            messagesRead: insertAnalytics.messagesRead || 0,
            messagesSent: insertAnalytics.messagesSent || 0,
            messagesReplied: insertAnalytics.messagesReplied || 0,
            createdAt: new Date(),
        };
        this.analytics.set(id, analytics);
        return analytics;
    }
    async getDashboardStats() {
        const campaigns = await this.getCampaigns();
        const contacts = await this.getContacts();
        const conversations = await this.getConversations();
        const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
        const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
        const totalDelivered = campaigns.reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
        const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
        // Calculate new leads from last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const newLeads = contacts.filter(c => c.createdAt && c.createdAt >= weekAgo).length;
        const unreadChats = conversations.filter(c => c.status === 'open').length;
        return {
            totalMessages: totalSent,
            activeCampaigns,
            deliveryRate: Math.round(deliveryRate * 10) / 10,
            newLeads,
            messagesGrowth: 12.5, // Would be calculated from historical data
            campaignsRunning: activeCampaigns,
            unreadChats,
        };
    }
    // WhatsApp Channels
    async getWhatsappChannels() {
        return Array.from(this.whatsappChannels.values());
    }
    async getWhatsappChannel(id) {
        return this.whatsappChannels.get(id);
    }
    async createWhatsappChannel(insertChannel) {
        const id = randomUUID();
        const channel = {
            ...insertChannel,
            id,
            qualityRating: insertChannel.qualityRating || "green",
            businessAccountId: insertChannel.businessAccountId || null,
            rateLimitTier: insertChannel.rateLimitTier || "standard",
            lastHealthCheck: null,
            messageLimit: insertChannel.messageLimit || 0,
            messagesUsed: 0,
            errorMessage: null,
            status: insertChannel.status || "inactive",
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.whatsappChannels.set(id, channel);
        return channel;
    }
    async updateWhatsappChannel(id, updates) {
        const channel = this.whatsappChannels.get(id);
        if (channel) {
            const updated = { ...channel, ...updates, updatedAt: new Date() };
            this.whatsappChannels.set(id, updated);
            return updated;
        }
        return undefined;
    }
    async deleteWhatsappChannel(id) {
        this.whatsappChannels.delete(id);
        return;
    }
    // Webhook Configs
    async getWebhookConfigs() {
        return Array.from(this.webhookConfigs.values());
    }
    async getWebhookConfig(channelId) {
        return Array.from(this.webhookConfigs.values()).find(config => config.channelId === channelId);
    }
    async createWebhookConfig(insertConfig) {
        const id = randomUUID();
        const config = {
            ...insertConfig,
            id,
            events: insertConfig.events || [],
            lastPingAt: null,
            channelId: insertConfig.channelId || null,
            isActive: insertConfig.isActive ?? true,
            createdAt: new Date(),
        };
        this.webhookConfigs.set(id, config);
        return config;
    }
    async updateWebhookConfig(id, updates) {
        const config = this.webhookConfigs.get(id);
        if (config) {
            const updated = { ...config, ...updates };
            this.webhookConfigs.set(id, updated);
            return updated;
        }
        return undefined;
    }
    async deleteWebhookConfig(id) {
        return this.webhookConfigs.delete(id);
    }
    // Message Queue
    async getMessageQueueStats() {
        const stats = {
            queued: 0,
            processing: 0,
            sent: 0,
            delivered: 0,
            failed: 0,
        };
        this.messageQueues.forEach(message => {
            if (message.status) {
                stats[message.status] = (stats[message.status] || 0) + 1;
            }
        });
        return stats;
    }
    async getQueuedMessages(limit = 10) {
        return Array.from(this.messageQueues.values())
            .filter(msg => msg.status === 'queued')
            .slice(0, limit);
    }
    // API Logs
    async getApiLogs(channelId, limit = 100) {
        let logs = Array.from(this.apiLogs.values());
        if (channelId) {
            logs = logs.filter(log => log.channelId === channelId);
        }
        return logs.slice(-limit);
    }
    async logApiRequest(log) {
        try {
            const apiLog = {
                ...log,
                id: Date.now().toString(),
                channelId: log.channelId || null,
                responseStatus: log.responseStatus || 0,
                requestBody: log.requestBody || null,
                responseBody: log.responseBody || null,
                duration: log.duration || 0,
                createdAt: new Date(),
            };
            // Check if channel exists before logging
            if (log.channelId && !this.whatsappChannels.has(log.channelId)) {
                console.error("Channel not found for API log:", log.channelId);
                return null;
            }
            this.apiLogs.set(apiLog.id, apiLog);
            return apiLog;
        }
        catch (error) {
            console.error("Failed to log API request:", error);
            return null;
        }
    }
}
// export const storage = new MemStorage();
// Import DatabaseStorage and use it instead
import { DatabaseStorage } from "./whatsappDatabaseStorage";
export const storage = new DatabaseStorage();
