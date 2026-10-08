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
import { whatsappDb as db } from "../config/database";
import { eq, desc, and, gte, sql, lt, inArray } from "drizzle-orm";
import { contacts, users } from "@shared/whatsapp-schema";
import { createWhatsAppContact, createWhatsAppContacts, deleteWhatsAppContacts, normalizePhone, updateWhatsAppContact } from "../services/contact-identity.service";
// Helper functions to replace date-fns
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}
function subWeeks(date, weeks) {
    const d = new Date(date);
    d.setDate(d.getDate() - (weeks * 7));
    return d;
}
export class ContactRepository {
    async getAll() {
        return await db.select().from(contacts).orderBy(desc(contacts.createdAt));
    }
    async getAllwithUsername() {
        return await db
            .select({
            id: contacts.id,
            channelId: contacts.channelId,
            name: contacts.name,
            phone: contacts.phone,
            email: contacts.email,
            groups: contacts.groups,
            tags: contacts.tags,
            status: contacts.status,
            source: contacts.source,
            lastContact: contacts.lastContact,
            createdAt: contacts.createdAt,
            updatedAt: contacts.updatedAt,
            createdBy: contacts.createdBy,
            // 👇 Full name of the creator
            createdByName: sql `
        CONCAT(
          COALESCE(${users.firstName}, ''), ' ', COALESCE(${users.lastName}, '')
        )
      `.as("createdByName"),
        })
            .from(contacts)
            .leftJoin(users, eq(users.id, contacts.createdBy))
            .orderBy(desc(contacts.createdAt));
    }
    async getByChannel(channelId) {
        return await db
            .select()
            .from(contacts)
            .where(eq(contacts.channelId, channelId))
            .orderBy(desc(contacts.createdAt));
    }
    async getContactsByUserId(userId, page = 1, limit = 10, filters = {}) {
        const offset = (page - 1) * limit;
        const conditions = [eq(contacts.createdBy, userId)];
        if (filters.channelId) {
            conditions.push(eq(contacts.channelId, filters.channelId));
        }
        if (filters.group) {
            conditions.push(sql `${contacts.groups}::jsonb @> ${JSON.stringify([filters.group])}::jsonb`);
        }
        const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
        // Get total count for pagination
        const totalResult = await db
            .select({ count: sql `count(*)` })
            .from(contacts)
            .where(whereClause);
        const total = totalResult[0]?.count ?? 0;
        // Fetch paginated data
        const data = await db
            .select()
            .from(contacts)
            .where(whereClause)
            .orderBy(desc(contacts.createdAt))
            .limit(limit)
            .offset(offset);
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            total,
            totalPages,
            page,
            limit,
        };
    }
    /**
     * Canonical tenancy uses `createdBy` (see replit.md). This helper is kept as
     * an alias so legacy callers continue to work; it treats `tenantId` as the
     * owning user id.
     */
    async getContactsByTenant(tenantId) {
        return await db
            .select()
            .from(contacts)
            .where(eq(contacts.createdBy, tenantId))
            .orderBy(desc(contacts.createdAt));
    }
    async getContactByEmail(email) {
        return await db
            .select()
            .from(contacts)
            .where(eq(contacts.email, email))
            .orderBy(desc(contacts.createdAt));
    }
    async getContactByPhone(phone) {
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone)
            return [];
        return await db
            .select()
            .from(contacts)
            .where(eq(contacts.phone, normalizedPhone))
            .orderBy(desc(contacts.createdAt));
    }
    async getContactStats(channelId) {
        const todayStart = startOfDay(new Date());
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday start
        const lastWeekStart = subWeeks(weekStart, 1);
        const lastWeekEnd = weekStart;
        // Build condition dynamically
        const channelFilter = channelId
            ? eq(contacts.channelId, channelId)
            : undefined;
        // Total
        const total = await db
            .select({ count: sql `count(*)` })
            .from(contacts)
            .where(channelFilter ?? sql `true`);
        // Today
        const today = await db
            .select({ count: sql `count(*)` })
            .from(contacts)
            .where(and(channelFilter ?? sql `true`, gte(contacts.createdAt, todayStart)));
        // This week
        const week = await db
            .select({ count: sql `count(*)` })
            .from(contacts)
            .where(and(channelFilter ?? sql `true`, gte(contacts.createdAt, weekStart)));
        // Last week
        const lastWeek = await db
            .select({ count: sql `count(*)` })
            .from(contacts)
            .where(and(channelFilter, gte(contacts.createdAt, lastWeekStart), lt(contacts.createdAt, lastWeekEnd)));
        return {
            totalCount: total[0]?.count ?? 0,
            todayCount: today[0]?.count ?? 0,
            weekCount: week[0]?.count ?? 0,
            lastWeekCount: lastWeek[0]?.count ?? 0,
        };
    }
    async getById(id) {
        const [contact] = await db
            .select()
            .from(contacts)
            .where(eq(contacts.id, id));
        return contact || undefined;
    }
    async getByIds(ids) {
        if (ids.length === 0)
            return [];
        return db
            .select()
            .from(contacts)
            .where(inArray(contacts.id, ids));
    }
    async getByPhone(phone) {
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone)
            return undefined;
        const [contact] = await db
            .select()
            .from(contacts)
            .where(eq(contacts.phone, normalizedPhone));
        return contact || undefined;
    }
    async getByPhoneAndChannel(phone, channelId) {
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone)
            return undefined;
        const results = await db
            .select()
            .from(contacts)
            .where(and(eq(contacts.channelId, channelId), eq(contacts.phone, normalizedPhone)));
        return results[0] || undefined;
    }
    // async create(insertContact: InsertContact): Promise<Contact> {
    //   const [contact] = await db
    //     .insert(contacts)
    //     .values(insertContact)
    //     .returning();
    //   return contact;
    // }
    async create(insertContact) {
        // Validation: channelId required
        if (!insertContact.channelId) {
            throw new Error("Cannot create contact without a channel. Please create a channel first.");
        }
        return createWhatsAppContact(insertContact);
    }
    async update(id, contact) {
        return updateWhatsAppContact(id, contact);
    }
    async delete(id) {
        return (await deleteWhatsAppContacts([id])) > 0;
    }
    async search(query) {
        const searchPattern = `%${query}%`;
        return await db
            .select()
            .from(contacts)
            .where(sql `${contacts.name} ILIKE ${searchPattern} OR ${contacts.phone} ILIKE ${searchPattern} OR ${contacts.email} ILIKE ${searchPattern}`);
    }
    async createBulk(insertContacts) {
        if (insertContacts.length === 0)
            return [];
        return createWhatsAppContacts(insertContacts, { skipExisting: true });
    }
    /** Which of `phones` (any format) are already on the channel; returned as given. */
    async checkExistingPhones(phones, channelId) {
        const byNormalized = new Map();
        for (const phone of phones || []) {
            const normalized = normalizePhone(phone);
            if (normalized && !byNormalized.has(normalized))
                byNormalized.set(normalized, phone);
        }
        if (!byNormalized.size)
            return [];
        const existingContacts = await db
            .select({ phone: contacts.phone })
            .from(contacts)
            .where(and(eq(contacts.channelId, channelId), inArray(contacts.phone, [...byNormalized.keys()])));
        return existingContacts.map((c) => byNormalized.get(c.phone));
    }
    async getTotalCount() {
        const result = await db
            .select({ count: sql `COUNT(*)`.mapWith(Number) })
            .from(contacts);
        return result[0]?.count || 0;
    }
}
