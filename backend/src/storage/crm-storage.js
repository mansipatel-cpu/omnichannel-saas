'use strict';
/**
 * ============================================================
 * CRM Storage Interface
 * Isolated storage layer for CRM module
 * ============================================================
 */
import { db } from '../config/database';
import { leads, leadStages, leadNotes, leadActivities, campaigns, incomingConnections, AI_LEAD_CATEGORIES, crmCategoryPreferences } from '@shared/schema';
import { eq, and, desc, asc, sql, ilike, or, inArray, notInArray, gte, lte, count, isNotNull } from 'drizzle-orm';
// Default stages with colors (created per user on first access)
export const DEFAULT_STAGES = [
    { name: 'New Lead', color: '#9CA3AF', order: 0, stage: 'new' },
    { name: 'Hot Lead', color: '#EF4444', order: 1, stage: 'hot' },
    { name: 'Appointment Booked', color: '#22C55E', order: 2, stage: 'appointment' },
    { name: 'Form Submitted', color: '#3B82F6', order: 3, stage: 'form_submitted' },
    { name: 'Needs Follow-up', color: '#F59E0B', order: 4, stage: 'follow_up' },
    { name: 'Not Interested', color: '#6B7280', order: 5, stage: 'not_interested' },
    { name: 'No Answer', color: '#D1D5DB', order: 6, stage: 'no_answer' },
];
export class CRMStorage {
    // ============================================================
    // Lead Stages
    // ============================================================
    static async getStagesByUser(userId) {
        return db
            .select()
            .from(leadStages)
            .where(eq(leadStages.userId, userId))
            .orderBy(asc(leadStages.order));
    }
    static async ensureDefaultStages(userId) {
        const existing = await this.getStagesByUser(userId);
        if (existing.length > 0) {
            return existing;
        }
        const stagesToInsert = DEFAULT_STAGES.map((s) => ({
            userId,
            name: s.name,
            color: s.color,
            order: s.order,
            isDefault: true,
            isCustom: false,
        }));
        const inserted = await db
            .insert(leadStages)
            .values(stagesToInsert)
            .returning();
        return inserted;
    }
    static async createStage(data) {
        const maxOrder = await db
            .select({ maxOrder: sql `COALESCE(MAX("order"), 0)` })
            .from(leadStages)
            .where(eq(leadStages.userId, data.userId));
        const [stage] = await db
            .insert(leadStages)
            .values({
            ...data,
            order: (maxOrder[0]?.maxOrder || 0) + 1,
            isDefault: false,
            isCustom: true,
        })
            .returning();
        return stage;
    }
    static async updateStage(id, userId, data) {
        const [stage] = await db
            .update(leadStages)
            .set({ ...data, updatedAt: new Date() })
            .where(and(eq(leadStages.id, id), eq(leadStages.userId, userId)))
            .returning();
        return stage || null;
    }
    static async deleteStage(id, userId) {
        const result = await db
            .delete(leadStages)
            .where(and(eq(leadStages.id, id), eq(leadStages.userId, userId), eq(leadStages.isCustom, true)))
            .returning();
        return result.length > 0;
    }
    static async reorderStages(userId, stageIds) {
        for (let i = 0; i < stageIds.length; i++) {
            await db
                .update(leadStages)
                .set({ order: i, updatedAt: new Date() })
                .where(and(eq(leadStages.id, stageIds[i]), eq(leadStages.userId, userId)));
        }
    }
    // ============================================================
    // Leads
    // ============================================================
    static async getLeadById(id, userId) {
        const [lead] = await db
            .select()
            .from(leads)
            .where(and(eq(leads.id, id), eq(leads.userId, userId)));
        return lead || null;
    }
    static async getLeadsBySource(userId, sourceType, sourceId, filters) {
        const conditions = [
            eq(leads.userId, userId),
            eq(leads.sourceType, sourceType),
        ];
        if (sourceType === 'campaign') {
            conditions.push(eq(leads.campaignId, sourceId));
        }
        else {
            conditions.push(eq(leads.incomingConnectionId, sourceId));
        }
        if (filters?.stage) {
            conditions.push(eq(leads.stage, filters.stage));
        }
        if (filters?.minScore) {
            conditions.push(gte(leads.leadScore, filters.minScore));
        }
        if (filters?.maxScore) {
            conditions.push(lte(leads.leadScore, filters.maxScore));
        }
        if (filters?.startDate) {
            conditions.push(gte(leads.createdAt, filters.startDate));
        }
        if (filters?.endDate) {
            conditions.push(lte(leads.createdAt, filters.endDate));
        }
        if (filters?.search) {
            conditions.push(or(ilike(leads.firstName, `%${filters.search}%`), ilike(leads.lastName, `%${filters.search}%`), ilike(leads.phone, `%${filters.search}%`), ilike(leads.email, `%${filters.search}%`), ilike(leads.company, `%${filters.search}%`)));
        }
        // Apply hideLeadsWithoutPhone filter
        if (filters?.hideLeadsWithoutPhone) {
            conditions.push(isNotNull(leads.phone));
            conditions.push(sql `TRIM(${leads.phone}) != ''`);
            conditions.push(sql `LOWER(TRIM(${leads.phone})) != 'unknown'`);
        }
        return db
            .select()
            .from(leads)
            .where(and(...conditions))
            .orderBy(desc(leads.createdAt));
    }
    static async getAllLeads(userId, filters) {
        const conditions = [eq(leads.userId, userId)];
        if (filters?.stage) {
            conditions.push(eq(leads.stage, filters.stage));
        }
        if (filters?.minScore) {
            conditions.push(gte(leads.leadScore, filters.minScore));
        }
        if (filters?.maxScore) {
            conditions.push(lte(leads.leadScore, filters.maxScore));
        }
        if (filters?.startDate) {
            conditions.push(gte(leads.createdAt, filters.startDate));
        }
        if (filters?.endDate) {
            conditions.push(lte(leads.createdAt, filters.endDate));
        }
        if (filters?.search) {
            conditions.push(or(ilike(leads.firstName, `%${filters.search}%`), ilike(leads.lastName, `%${filters.search}%`), ilike(leads.phone, `%${filters.search}%`), ilike(leads.email, `%${filters.search}%`), ilike(leads.company, `%${filters.search}%`)));
        }
        // Apply hideLeadsWithoutPhone filter
        if (filters?.hideLeadsWithoutPhone) {
            conditions.push(isNotNull(leads.phone));
            conditions.push(sql `TRIM(${leads.phone}) != ''`);
            conditions.push(sql `LOWER(TRIM(${leads.phone})) != 'unknown'`);
        }
        return db
            .select()
            .from(leads)
            .where(and(...conditions))
            .orderBy(desc(leads.createdAt));
    }
    static async getLeadsBySourceType(userId, sourceType, filters) {
        const conditions = [
            eq(leads.userId, userId),
            eq(leads.sourceType, sourceType),
        ];
        if (filters?.stage) {
            conditions.push(eq(leads.stage, filters.stage));
        }
        if (filters?.minScore) {
            conditions.push(gte(leads.leadScore, filters.minScore));
        }
        if (filters?.maxScore) {
            conditions.push(lte(leads.leadScore, filters.maxScore));
        }
        if (filters?.startDate) {
            conditions.push(gte(leads.createdAt, filters.startDate));
        }
        if (filters?.endDate) {
            conditions.push(lte(leads.createdAt, filters.endDate));
        }
        if (filters?.search) {
            conditions.push(or(ilike(leads.firstName, `%${filters.search}%`), ilike(leads.lastName, `%${filters.search}%`), ilike(leads.phone, `%${filters.search}%`), ilike(leads.email, `%${filters.search}%`), ilike(leads.company, `%${filters.search}%`)));
        }
        // Apply hideLeadsWithoutPhone filter
        if (filters?.hideLeadsWithoutPhone) {
            conditions.push(isNotNull(leads.phone));
            conditions.push(sql `TRIM(${leads.phone}) != ''`);
            conditions.push(sql `LOWER(TRIM(${leads.phone})) != 'unknown'`);
        }
        return db
            .select()
            .from(leads)
            .where(and(...conditions))
            .orderBy(desc(leads.createdAt));
    }
    static async getLeadsGroupedByStage(userId, sourceType, sourceId, options) {
        const allLeads = await this.getLeadsBySource(userId, sourceType, sourceId, {
            hideLeadsWithoutPhone: options?.hideLeadsWithoutPhone,
        });
        const grouped = new Map();
        for (const lead of allLeads) {
            const stage = lead.stage;
            if (!grouped.has(stage)) {
                grouped.set(stage, []);
            }
            grouped.get(stage).push(lead);
        }
        return grouped;
    }
    // ============================================================
    // AI-Categorized Leads (Paginated) - Only qualified prospects
    // ============================================================
    /**
     * Get paginated leads filtered by AI category
     * Only returns leads that have been categorized (not null aiCategory)
     * Now also respects user's filter preferences (hideLeadsWithoutPhone, hiddenCategories)
     */
    static async getPaginatedLeadsByCategory(userId, options) {
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const conditions = [
            eq(leads.userId, userId),
            isNotNull(leads.aiCategory), // Only categorized leads
        ];
        if (options.aiCategory) {
            conditions.push(eq(leads.aiCategory, options.aiCategory));
        }
        // Apply hidden categories filter - exclude leads in hidden categories
        if (options.hiddenCategories && options.hiddenCategories.length > 0) {
            // If filtering by a specific category that is hidden, return empty
            if (options.aiCategory && options.hiddenCategories.includes(options.aiCategory)) {
                return { leads: [], total: 0, hasMore: false };
            }
            // When fetching all categories (no specific aiCategory), exclude hidden ones
            if (!options.aiCategory) {
                conditions.push(notInArray(leads.aiCategory, options.hiddenCategories));
            }
        }
        // Apply hideLeadsWithoutPhone filter
        if (options.hideLeadsWithoutPhone) {
            // Only include leads that have a valid phone (not null, not empty, not 'Unknown')
            conditions.push(isNotNull(leads.phone));
            conditions.push(sql `TRIM(${leads.phone}) != ''`);
            conditions.push(sql `LOWER(TRIM(${leads.phone})) != 'unknown'`);
        }
        if (options.sourceType) {
            conditions.push(eq(leads.sourceType, options.sourceType));
            if (options.sourceId) {
                if (options.sourceType === 'campaign') {
                    conditions.push(eq(leads.campaignId, options.sourceId));
                }
                else {
                    conditions.push(eq(leads.incomingConnectionId, options.sourceId));
                }
            }
        }
        if (options.search) {
            conditions.push(or(ilike(leads.firstName, `%${options.search}%`), ilike(leads.lastName, `%${options.search}%`), ilike(leads.phone, `%${options.search}%`), ilike(leads.email, `%${options.search}%`), ilike(leads.company, `%${options.search}%`)));
        }
        // Get total count
        const [countResult] = await db
            .select({ count: count() })
            .from(leads)
            .where(and(...conditions));
        const total = countResult?.count || 0;
        // Determine sort order
        let orderBy;
        switch (options.sortBy) {
            case 'oldest':
                orderBy = asc(leads.createdAt);
                break;
            case 'score-high':
                orderBy = desc(leads.leadScore);
                break;
            case 'score-low':
                orderBy = asc(leads.leadScore);
                break;
            default:
                orderBy = desc(leads.createdAt);
        }
        // Get paginated leads
        const results = await db
            .select()
            .from(leads)
            .where(and(...conditions))
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset);
        return {
            leads: results,
            total,
            hasMore: offset + results.length < total,
        };
    }
    /**
     * Get lead counts grouped by AI category
     * Now also respects user's filter preferences (hideLeadsWithoutPhone, hiddenCategories)
     */
    static async getLeadCountsByCategory(userId, options) {
        const conditions = [
            eq(leads.userId, userId),
            isNotNull(leads.aiCategory),
        ];
        // Apply hideLeadsWithoutPhone filter
        if (options?.hideLeadsWithoutPhone) {
            conditions.push(isNotNull(leads.phone));
            conditions.push(sql `TRIM(${leads.phone}) != ''`);
            conditions.push(sql `LOWER(TRIM(${leads.phone})) != 'unknown'`);
        }
        // Exclude hidden categories from the query for efficiency
        if (options?.hiddenCategories && options.hiddenCategories.length > 0) {
            conditions.push(notInArray(leads.aiCategory, options.hiddenCategories));
        }
        if (options?.sourceType) {
            conditions.push(eq(leads.sourceType, options.sourceType));
            if (options.sourceId) {
                if (options.sourceType === 'campaign') {
                    conditions.push(eq(leads.campaignId, options.sourceId));
                }
                else {
                    conditions.push(eq(leads.incomingConnectionId, options.sourceId));
                }
            }
        }
        const results = await db
            .select({
            category: leads.aiCategory,
            count: count(),
        })
            .from(leads)
            .where(and(...conditions))
            .groupBy(leads.aiCategory);
        // Initialize all categories with 0
        const counts = {
            [AI_LEAD_CATEGORIES.WARM]: 0,
            [AI_LEAD_CATEGORIES.HOT]: 0,
            [AI_LEAD_CATEGORIES.NEUTRAL]: 0,
            [AI_LEAD_CATEGORIES.COLD]: 0,
            [AI_LEAD_CATEGORIES.APPOINTMENT_BOOKED]: 0,
            [AI_LEAD_CATEGORIES.FORM_SUBMITTED]: 0,
            [AI_LEAD_CATEGORIES.CALL_TRANSFER]: 0,
            [AI_LEAD_CATEGORIES.NEED_FOLLOW_UP]: 0,
        };
        for (const row of results) {
            if (row.category && row.category in counts) {
                counts[row.category] = row.count;
            }
        }
        return counts;
    }
    /**
     * Get leads grouped by AI category for Kanban view (paginated per column)
     * Now also respects user's filter preferences (hideLeadsWithoutPhone, hiddenCategories)
     */
    static async getLeadsByAICategory(userId, category, options) {
        return this.getPaginatedLeadsByCategory(userId, {
            aiCategory: category,
            sourceType: options?.sourceType,
            sourceId: options?.sourceId,
            limit: options?.limit || 20,
            offset: options?.offset || 0,
            hideLeadsWithoutPhone: options?.hideLeadsWithoutPhone,
            hiddenCategories: options?.hiddenCategories,
        });
    }
    static async createLead(data) {
        const [lead] = await db
            .insert(leads)
            .values(data)
            .returning();
        return lead;
    }
    static async updateLead(id, userId, data) {
        const [lead] = await db
            .update(leads)
            .set({ ...data, updatedAt: new Date() })
            .where(and(eq(leads.id, id), eq(leads.userId, userId)))
            .returning();
        return lead || null;
    }
    static async updateLeadStage(id, userId, stage, stageId) {
        const [lead] = await db
            .update(leads)
            .set({
            stage,
            stageId: stageId || null,
            updatedAt: new Date()
        })
            .where(and(eq(leads.id, id), eq(leads.userId, userId)))
            .returning();
        return lead || null;
    }
    static async deleteLead(id, userId) {
        const result = await db
            .delete(leads)
            .where(and(eq(leads.id, id), eq(leads.userId, userId)))
            .returning();
        return result.length > 0;
    }
    static async bulkDeleteLeads(ids, userId) {
        if (ids.length === 0)
            return 0;
        const result = await db
            .delete(leads)
            .where(and(eq(leads.userId, userId), inArray(leads.id, ids)))
            .returning();
        return result.length;
    }
    static async bulkUpdateStage(ids, userId, stage, stageId) {
        const result = await db
            .update(leads)
            .set({
            stage,
            stageId: stageId || null,
            updatedAt: new Date()
        })
            .where(and(inArray(leads.id, ids), eq(leads.userId, userId)))
            .returning();
        return result.length;
    }
    static async bulkAddTags(ids, userId, newTags) {
        const leadsToUpdate = await db
            .select()
            .from(leads)
            .where(and(inArray(leads.id, ids), eq(leads.userId, userId)));
        let updated = 0;
        for (const lead of leadsToUpdate) {
            const existingTags = lead.tags || [];
            const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
            await db
                .update(leads)
                .set({ tags: mergedTags, updatedAt: new Date() })
                .where(eq(leads.id, lead.id));
            updated++;
        }
        return updated;
    }
    static async bulkAssign(ids, userId, assignedUserId) {
        const result = await db
            .update(leads)
            .set({
            assignedUserId,
            updatedAt: new Date()
        })
            .where(and(inArray(leads.id, ids), eq(leads.userId, userId)))
            .returning();
        return result.length;
    }
    static async getLeadCountsByStage(userId, sourceType, sourceId, options) {
        const conditions = [
            eq(leads.userId, userId),
            eq(leads.sourceType, sourceType),
        ];
        if (sourceType === 'campaign') {
            conditions.push(eq(leads.campaignId, sourceId));
        }
        else {
            conditions.push(eq(leads.incomingConnectionId, sourceId));
        }
        // Apply hideLeadsWithoutPhone filter
        if (options?.hideLeadsWithoutPhone) {
            conditions.push(isNotNull(leads.phone));
            conditions.push(sql `TRIM(${leads.phone}) != ''`);
            conditions.push(sql `LOWER(TRIM(${leads.phone})) != 'unknown'`);
        }
        const counts = await db
            .select({
            stage: leads.stage,
            count: sql `COUNT(*)::int`,
        })
            .from(leads)
            .where(and(...conditions))
            .groupBy(leads.stage);
        return counts;
    }
    // ============================================================
    // Lead Notes
    // ============================================================
    static async getNotesByLead(leadId) {
        return db
            .select()
            .from(leadNotes)
            .where(eq(leadNotes.leadId, leadId))
            .orderBy(desc(leadNotes.createdAt));
    }
    /**
     * Get notes count for multiple leads at once (batch operation)
     */
    static async getNotesCountByLeadIds(leadIds) {
        if (leadIds.length === 0)
            return new Map();
        const counts = await db
            .select({
            leadId: leadNotes.leadId,
            count: sql `COUNT(*)::int`,
        })
            .from(leadNotes)
            .where(inArray(leadNotes.leadId, leadIds))
            .groupBy(leadNotes.leadId);
        const map = new Map();
        for (const row of counts) {
            map.set(row.leadId, row.count);
        }
        return map;
    }
    /**
     * Enrich leads with notes count
     */
    static async enrichLeadsWithNotesCount(leadsList) {
        if (leadsList.length === 0)
            return [];
        const leadIds = leadsList.map(l => l.id);
        const notesCounts = await this.getNotesCountByLeadIds(leadIds);
        return leadsList.map(lead => ({
            ...lead,
            notesCount: notesCounts.get(lead.id) || 0,
        }));
    }
    static async createNote(data) {
        const [note] = await db
            .insert(leadNotes)
            .values(data)
            .returning();
        return note;
    }
    static async updateNote(id, userId, content) {
        const [note] = await db
            .update(leadNotes)
            .set({ content, updatedAt: new Date() })
            .where(and(eq(leadNotes.id, id), eq(leadNotes.userId, userId)))
            .returning();
        return note || null;
    }
    static async deleteNote(id, userId) {
        const result = await db
            .delete(leadNotes)
            .where(and(eq(leadNotes.id, id), eq(leadNotes.userId, userId)))
            .returning();
        return result.length > 0;
    }
    // ============================================================
    // Source Data Helpers
    // ============================================================
    static async getUserCampaigns(userId) {
        const campaignList = await db
            .select({
            id: campaigns.id,
            name: campaigns.name,
        })
            .from(campaigns)
            .where(eq(campaigns.userId, userId))
            .orderBy(desc(campaigns.createdAt));
        const result = [];
        for (const c of campaignList) {
            const [countResult] = await db
                .select({ count: sql `COUNT(*)::int` })
                .from(leads)
                .where(and(eq(leads.campaignId, c.id), eq(leads.userId, userId)));
            result.push({
                id: c.id,
                name: c.name,
                totalLeads: countResult?.count || 0,
            });
        }
        return result;
    }
    static async getUserIncomingConnections(userId) {
        const connections = await db
            .select()
            .from(incomingConnections)
            .where(eq(incomingConnections.userId, userId));
        const result = [];
        for (const conn of connections) {
            const [countResult] = await db
                .select({ count: sql `COUNT(*)::int` })
                .from(leads)
                .where(and(eq(leads.incomingConnectionId, conn.id), eq(leads.userId, userId)));
            result.push({
                id: conn.id,
                name: `Incoming - ${conn.id.slice(0, 8)}`,
                phoneNumber: conn.phoneNumberId,
                totalLeads: countResult?.count || 0,
            });
        }
        return result;
    }
    // ============================================================
    // Lead Creation from Call Completion
    // ============================================================
    static async createOrUpdateLeadFromCall(userId, callData) {
        // Determine stage based on call outcome
        let stage = 'new';
        if (callData.hasAppointment) {
            stage = 'appointment';
        }
        else if (callData.hasFormSubmission) {
            stage = 'form_submitted';
        }
        else if (callData.hasCallback) {
            stage = 'follow_up';
        }
        else if (callData.hasTransfer) {
            stage = 'hot';
        }
        else if (callData.leadScore && callData.leadScore >= 70) {
            stage = 'hot';
        }
        else if (callData.sentiment === 'negative') {
            stage = 'not_interested';
        }
        const leadData = {
            userId,
            phone: callData.phone,
            firstName: callData.firstName,
            lastName: callData.lastName,
            email: callData.email,
            company: callData.company,
            customFields: callData.customFields,
            sourceType: callData.sourceType,
            campaignId: callData.campaignId,
            incomingConnectionId: callData.incomingConnectionId,
            stage,
            callId: callData.callId,
            plivoCallId: callData.plivoCallId,
            twilioOpenaiCallId: callData.twilioOpenaiCallId,
            sipCallId: callData.sipCallId,
            aiSummary: callData.aiSummary,
            leadScore: callData.leadScore,
            aiNextAction: callData.aiNextAction,
            sentiment: callData.sentiment,
            hasAppointment: callData.hasAppointment || false,
            hasFormSubmission: callData.hasFormSubmission || false,
            hasTransfer: callData.hasTransfer || false,
            hasCallback: callData.hasCallback || false,
            appointmentDate: callData.appointmentDate,
            appointmentDetails: callData.appointmentDetails,
            formData: callData.formData,
            transferredTo: callData.transferredTo,
            callbackScheduled: callData.callbackScheduled,
            lastCallAt: new Date(),
        };
        const lead = await this.createLead(leadData);
        return lead;
    }
    // ============================================================
    // Lead Activities - Activity Timeline
    // ============================================================
    static async getActivitiesByLead(leadId, userId) {
        return db
            .select()
            .from(leadActivities)
            .where(and(eq(leadActivities.leadId, leadId), eq(leadActivities.userId, userId)))
            .orderBy(desc(leadActivities.createdAt));
    }
    static async createActivity(data) {
        const [activity] = await db
            .insert(leadActivities)
            .values(data)
            .returning();
        return activity;
    }
    static async logStageChange(leadId, userId, fromStage, toStage, fromStageName, toStageName) {
        return this.createActivity({
            leadId,
            userId,
            activityType: 'stage_change',
            title: `Stage changed to ${toStageName || toStage}`,
            description: `Moved from "${fromStageName || fromStage}" to "${toStageName || toStage}"`,
            metadata: { fromStage, toStage, fromStageName, toStageName },
        });
    }
    static async logNoteAdded(leadId, userId, noteId, noteContent) {
        return this.createActivity({
            leadId,
            userId,
            activityType: 'note',
            title: 'Note added',
            description: noteContent.substring(0, 200) + (noteContent.length > 200 ? '...' : ''),
            metadata: { noteId, noteContent: noteContent.substring(0, 500) },
        });
    }
    static async logCallActivity(leadId, userId, callId, callDuration, callStatus) {
        const durationStr = callDuration > 60
            ? `${Math.floor(callDuration / 60)}m ${callDuration % 60}s`
            : `${callDuration}s`;
        return this.createActivity({
            leadId,
            userId,
            activityType: 'call',
            title: `Call ${callStatus}`,
            description: `Duration: ${durationStr}`,
            metadata: { callId, callDuration, callStatus },
        });
    }
    static async logTagChange(leadId, userId, action, tagName) {
        return this.createActivity({
            leadId,
            userId,
            activityType: action === 'added' ? 'tag_added' : 'tag_removed',
            title: `Tag ${action}: ${tagName}`,
            metadata: { tagName },
        });
    }
    static async logLeadCreated(leadId, userId, source) {
        return this.createActivity({
            leadId,
            userId,
            activityType: 'created',
            title: 'Lead created',
            description: `Source: ${source}`,
        });
    }
    // ============================================================
    // Analytics & Export
    // ============================================================
    static async getLeadsWithDetails(userId) {
        const allLeads = await this.getAllLeads(userId);
        const leadsWithDetails = await Promise.all(allLeads.map(async (lead) => {
            const [notes, activities] = await Promise.all([
                this.getNotesByLead(lead.id),
                this.getActivitiesByLead(lead.id, userId),
            ]);
            return { ...lead, notes, activities };
        }));
        return leadsWithDetails;
    }
    static async getAnalytics(userId) {
        // Total leads count
        const [totalResult] = await db
            .select({ count: count() })
            .from(leads)
            .where(eq(leads.userId, userId));
        const totalLeads = totalResult?.count || 0;
        // Leads by AI category (primary grouping)
        const categoryResults = await db
            .select({ category: leads.aiCategory, count: count() })
            .from(leads)
            .where(and(eq(leads.userId, userId), isNotNull(leads.aiCategory)))
            .groupBy(leads.aiCategory);
        const leadsByCategory = categoryResults.map(r => ({
            category: r.category || 'uncategorized',
            count: Number(r.count)
        }));
        // Leads by stage (legacy - kept for backward compatibility)
        const stageResults = await db
            .select({ stage: leads.stage, count: count() })
            .from(leads)
            .where(eq(leads.userId, userId))
            .groupBy(leads.stage);
        const leadsByStage = stageResults.map(r => ({ stage: r.stage, count: Number(r.count) }));
        // Leads by source
        const sourceResults = await db
            .select({ sourceType: leads.sourceType, count: count() })
            .from(leads)
            .where(eq(leads.userId, userId))
            .groupBy(leads.sourceType);
        const leadsBySource = sourceResults.map(r => ({ sourceType: r.sourceType, count: Number(r.count) }));
        // Leads by date (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateResults = await db
            .select({
            date: sql `DATE(${leads.createdAt})`,
            count: count(),
        })
            .from(leads)
            .where(and(eq(leads.userId, userId), gte(leads.createdAt, thirtyDaysAgo)))
            .groupBy(sql `DATE(${leads.createdAt})`)
            .orderBy(sql `DATE(${leads.createdAt})`);
        const leadsByDate = dateResults.map(r => ({ date: r.date, count: Number(r.count) }));
        // Average lead score
        const [scoreResult] = await db
            .select({ avg: sql `COALESCE(AVG(${leads.leadScore}), 0)` })
            .from(leads)
            .where(and(eq(leads.userId, userId), sql `${leads.leadScore} IS NOT NULL`));
        const avgLeadScore = Math.round(scoreResult?.avg || 0);
        // Sentiment breakdown
        const sentimentResults = await db
            .select({ sentiment: leads.sentiment, count: count() })
            .from(leads)
            .where(and(eq(leads.userId, userId), sql `${leads.sentiment} IS NOT NULL`))
            .groupBy(leads.sentiment);
        const sentimentBreakdown = sentimentResults.map(r => ({
            sentiment: r.sentiment || 'unknown',
            count: Number(r.count),
        }));
        // Conversion rates (based on stage changes in activities)
        const stageChanges = await db
            .select()
            .from(leadActivities)
            .where(and(eq(leadActivities.userId, userId), eq(leadActivities.activityType, 'stage_change')));
        const conversionMap = new Map();
        for (const change of stageChanges) {
            const metadata = change.metadata;
            if (metadata?.fromStage && metadata?.toStage) {
                const key = metadata.fromStage;
                if (!conversionMap.has(key)) {
                    conversionMap.set(key, { total: 0, conversions: new Map() });
                }
                const data = conversionMap.get(key);
                data.total++;
                data.conversions.set(metadata.toStage, (data.conversions.get(metadata.toStage) || 0) + 1);
            }
        }
        const conversionRates = [];
        Array.from(conversionMap.entries()).forEach(([fromStage, data]) => {
            Array.from(data.conversions.entries()).forEach(([toStage, cnt]) => {
                conversionRates.push({
                    fromStage,
                    toStage,
                    rate: Math.round((cnt / data.total) * 100),
                });
            });
        });
        return {
            totalLeads,
            leadsByStage,
            leadsByCategory,
            leadsBySource,
            leadsByDate,
            conversionRates,
            avgLeadScore,
            sentimentBreakdown,
        };
    }
    static async getAllUniqueTags(userId) {
        const allLeads = await db
            .select({ tags: leads.tags })
            .from(leads)
            .where(eq(leads.userId, userId));
        const tagsSet = new Set();
        for (const lead of allLeads) {
            if (lead.tags) {
                for (const tag of lead.tags) {
                    tagsSet.add(tag);
                }
            }
        }
        return Array.from(tagsSet).sort();
    }
    // ============================================================
    // CRM Category Preferences
    // ============================================================
    static async getCategoryPreferences(userId) {
        const [prefs] = await db
            .select()
            .from(crmCategoryPreferences)
            .where(eq(crmCategoryPreferences.userId, userId));
        return prefs || null;
    }
    static async getOrCreateCategoryPreferences(userId) {
        const existing = await this.getCategoryPreferences(userId);
        if (existing)
            return existing;
        const [created] = await db
            .insert(crmCategoryPreferences)
            .values({ userId })
            .returning();
        return created;
    }
    static async updateCategoryPreferences(userId, updates) {
        const existing = await this.getOrCreateCategoryPreferences(userId);
        const updateData = { updatedAt: new Date() };
        if (updates.columnOrder !== undefined) {
            updateData.columnOrder = updates.columnOrder;
        }
        if (updates.colorOverrides !== undefined) {
            updateData.colorOverrides = updates.colorOverrides;
        }
        if (updates.columnSortPreferences !== undefined) {
            updateData.columnSortPreferences = updates.columnSortPreferences;
        }
        if (updates.hideLeadsWithoutPhone !== undefined) {
            updateData.hideLeadsWithoutPhone = updates.hideLeadsWithoutPhone;
        }
        if (updates.categoryPipelineMappings !== undefined) {
            updateData.categoryPipelineMappings = updates.categoryPipelineMappings;
        }
        if (updates.hotScoreThreshold !== undefined) {
            updateData.hotScoreThreshold = updates.hotScoreThreshold;
        }
        if (updates.warmScoreThreshold !== undefined) {
            updateData.warmScoreThreshold = updates.warmScoreThreshold;
        }
        if (updates.hiddenCategories !== undefined) {
            updateData.hiddenCategories = updates.hiddenCategories;
        }
        const [updated] = await db
            .update(crmCategoryPreferences)
            .set(updateData)
            .where(eq(crmCategoryPreferences.id, existing.id))
            .returning();
        return updated;
    }
    static async updateCategoryColor(userId, categoryId, color) {
        const prefs = await this.getOrCreateCategoryPreferences(userId);
        const colorOverrides = { ...(prefs.colorOverrides || {}), [categoryId]: color };
        return this.updateCategoryPreferences(userId, { colorOverrides });
    }
    static async updateColumnOrder(userId, columnOrder) {
        return this.updateCategoryPreferences(userId, { columnOrder });
    }
    static async updateColumnSort(userId, categoryId, sortBy) {
        const prefs = await this.getOrCreateCategoryPreferences(userId);
        const columnSortPreferences = { ...(prefs.columnSortPreferences || {}), [categoryId]: sortBy };
        return this.updateCategoryPreferences(userId, { columnSortPreferences });
    }
}
