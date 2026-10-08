'use strict';
/**
 * Shared contact identity: one `contacts` row per owner + E.164 phone, holding
 * the person's name, phone, email, tags and source for every channel.
 * WhatsApp presence lives in whatsapp_contact_channels (read via the
 * `wa_contacts` view); campaign_contacts and leads link by contact_id.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/database";
import { users, sharedContacts, contactGroups, contactGroupMembers } from "@shared/schema";
import { channels, contacts as waContacts, whatsappContactChannels } from "@shared/whatsapp-schema";
import { AppError } from "../middleware/whatsappError";

const BULK_CHUNK_SIZE = 500;
const OWNER_CACHE_TTL_MS = 5 * 60 * 1000;
const channelOwnerCache = new Map();
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * E.164 phone, or null when the input can't be one. Numbers without a country
 * code are Indian (+91). Must stay in sync with normalize_contact_phone()
 * in migrations 0011 / 0016.
 */
export function normalizePhone(phone) {
    if (phone === null || phone === undefined)
        return null;
    const raw = String(phone).trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits)
        return null;
    let e164 = null;
    if (raw.startsWith("+"))
        e164 = `+${digits}`;
    else if (digits.startsWith("00") && digits.length > 2)
        e164 = `+${digits.slice(2)}`;
    else if (digits.length === 10)
        e164 = `+91${digits}`;
    else if (digits.length === 11 && digits.startsWith("0"))
        e164 = `+91${digits.slice(1)}`;
    else if (digits.length > 10)
        e164 = `+${digits}`;
    return e164 && E164.test(e164) ? e164 : null;
}

export function splitName(fullName) {
    const trimmed = (fullName || "").trim();
    if (!trimmed)
        return { firstName: null, lastName: null };
    const [first, ...rest] = trimmed.split(/\s+/);
    return { firstName: first || null, lastName: rest.join(" ") || null };
}

function displayName({ name, firstName, lastName }) {
    const full = (name || [firstName, lastName].filter(Boolean).join(" ")).trim();
    return full || null;
}

/** A "name" that is just the phone number again (common for inbound/unknown senders) is no name. */
function realName(name, phone) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed)
        return null;
    return normalizePhone(trimmed) && normalizePhone(trimmed) === phone ? null : trimmed;
}

function tagList(tags) {
    return Array.isArray(tags) ? tags.filter((t) => t !== null && t !== undefined && t !== "") : [];
}

/** Account owner for a session user: team members act on behalf of their parent account. */
export function ownerIdForUser(user) {
    if (!user)
        return null;
    if (user.role === "team" && user.createdBy)
        return user.createdBy;
    return user.id || null;
}

export async function getChannelOwnerId(channelId) {
    if (!channelId)
        return null;
    const cached = channelOwnerCache.get(channelId);
    if (cached && cached.expiresAt > Date.now())
        return cached.ownerId;
    const [row] = await db
        .select({ ownerId: users.id })
        .from(channels)
        .innerJoin(users, eq(users.id, channels.createdBy))
        .where(eq(channels.id, channelId))
        .limit(1);
    const ownerId = row?.ownerId || null;
    channelOwnerCache.set(channelId, { ownerId, expiresAt: Date.now() + OWNER_CACHE_TTL_MS });
    return ownerId;
}

/** Owner of a WhatsApp contact: channel owner, else tenant, else the creator's account. */
export async function resolveOwnerId({ channelId, user, tenantId, createdBy } = {}) {
    const channelOwner = await getChannelOwnerId(channelId);
    if (channelOwner)
        return channelOwner;
    const sessionOwner = ownerIdForUser(user);
    if (sessionOwner)
        return sessionOwner;
    const candidate = tenantId || createdBy;
    if (!candidate)
        return null;
    const [row] = await db
        .select({ id: users.id, role: users.role, createdBy: users.createdBy })
        .from(users)
        .where(eq(users.id, candidate))
        .limit(1);
    if (!row)
        return null;
    return row.role === "team" && row.createdBy ? row.createdBy : row.id;
}

function upsertValues(userId, input) {
    const phone = normalizePhone(input.phone);
    if (!userId || !phone)
        return null;
    const name = realName(input.name, phone);
    const split = input.firstName || input.lastName ? {} : splitName(name);
    const firstName = input.firstName || split.firstName || null;
    const lastName = input.lastName || split.lastName || null;
    return {
        userId,
        phone,
        name: displayName({ name, firstName, lastName }),
        firstName,
        lastName,
        email: input.email || null,
        source: input.source ? String(input.source).slice(0, 50) : null,
    };
}

const fillMissingOnConflict = {
    target: [sharedContacts.userId, sharedContacts.phone],
    set: {
        name: sql`coalesce(${sharedContacts.name}, excluded.name)`,
        firstName: sql`coalesce(${sharedContacts.firstName}, excluded.first_name)`,
        lastName: sql`coalesce(${sharedContacts.lastName}, excluded.last_name)`,
        email: sql`coalesce(${sharedContacts.email}, excluded.email)`,
        deletedAt: sql`NULL`,
        updatedAt: sql`now()`,
    },
};

/** Find-or-create the shared contact for (userId, phone). Returns its id, or null if the phone is unusable. */
export async function ensureSharedContact(userId, input, executor = db) {
    const values = upsertValues(userId, input);
    if (!values)
        return null;
    const [row] = await executor
        .insert(sharedContacts)
        .values(values)
        .onConflictDoUpdate(fillMissingOnConflict)
        .returning({ id: sharedContacts.id });
    return row?.id || null;
}

/** Bulk find-or-create. Returns Map<normalizedPhone, sharedContactId>. */
export async function ensureSharedContacts(userId, inputs, executor = db) {
    const byPhone = new Map();
    for (const input of inputs) {
        const values = upsertValues(userId, input);
        if (values && !byPhone.has(values.phone))
            byPhone.set(values.phone, values);
    }
    const ids = new Map();
    const rows = [...byPhone.values()];
    for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + BULK_CHUNK_SIZE);
        const inserted = await executor
            .insert(sharedContacts)
            .values(chunk)
            .onConflictDoUpdate(fillMissingOnConflict)
            .returning({ id: sharedContacts.id, phone: sharedContacts.phone });
        for (const row of inserted)
            ids.set(row.phone, row.id);
    }
    return ids;
}

async function mergeSharedTags(contactId, tags, executor = db) {
    const list = tagList(tags);
    if (!contactId || !list.length)
        return;
    await executor
        .update(sharedContacts)
        .set({
        tags: sql`(SELECT coalesce(jsonb_agg(DISTINCT t), '[]'::jsonb)
                   FROM jsonb_array_elements(
                       CASE WHEN jsonb_typeof(${sharedContacts.tags}) = 'array' THEN ${sharedContacts.tags} ELSE '[]'::jsonb END
                       || ${JSON.stringify(list)}::jsonb) t)`,
        updatedAt: new Date(),
    })
        .where(eq(sharedContacts.id, contactId));
}

// ---------------------------------------------------------------------------
// WhatsApp contacts (shared contact + whatsapp_contact_channels row)
// ---------------------------------------------------------------------------

/** WhatsApp contacts by id, in the old wa_contacts shape. */
export async function getWhatsAppContactsByIds(ids, executor = db) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (!unique.length)
        return [];
    const rows = [];
    for (let i = 0; i < unique.length; i += BULK_CHUNK_SIZE) {
        rows.push(...await executor.select().from(waContacts).where(inArray(waContacts.id, unique.slice(i, i + BULK_CHUNK_SIZE))));
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    return unique.map((id) => byId.get(id)).filter(Boolean);
}

export async function getWhatsAppContact(id, executor = db) {
    const [row] = await getWhatsAppContactsByIds([id], executor);
    return row;
}

/** The WhatsApp contact for a phone (any format) on a channel. */
export async function findWhatsAppContactByPhone(channelId, phone) {
    const normalized = normalizePhone(phone);
    if (!channelId || !normalized)
        return undefined;
    const [row] = await db
        .select()
        .from(waContacts)
        .where(and(eq(waContacts.channelId, channelId), eq(waContacts.phone, normalized)))
        .limit(1);
    return row;
}

/**
 * Create WhatsApp contacts. Each input is { channelId, phone, name?, email?, tags?,
 * groups?, status?, source?, storeId?, externalId?, lastContact?, createdBy?, tenantId? }.
 * A contact already on the channel is returned as is, or left out with
 * `skipExisting`. Pass `executor` to run inside an open transaction.
 * Returns rows in the wa_contacts shape.
 */
export async function createWhatsAppContacts(inputs, { user, skipExisting = false, executor = db } = {}) {
    const rows = (inputs || []).filter(Boolean);
    if (!rows.length)
        return [];
    const byOwner = new Map();
    for (const row of rows) {
        if (!row.channelId)
            throw new AppError("Cannot create contact without a channel. Please create a channel first.", 400);
        if (!normalizePhone(row.phone))
            throw new AppError(`Invalid phone number: ${row.phone}`, 400);
        const ownerId = await resolveOwnerId({ channelId: row.channelId, user, tenantId: row.tenantId, createdBy: row.createdBy });
        if (!ownerId)
            throw new AppError("Cannot determine which account owns this contact", 400);
        if (!byOwner.has(ownerId))
            byOwner.set(ownerId, []);
        byOwner.get(ownerId).push(row);
    }
    const ids = [];
    const withGroups = [];
    for (const [ownerId, ownerRows] of byOwner) {
        await executor.transaction(async (tx) => {
            const shared = await ensureSharedContacts(ownerId, ownerRows.map((r) => ({
                phone: r.phone,
                name: r.name,
                email: r.email,
                source: r.source || "whatsapp",
            })), tx);
            const details = new Map();
            for (const r of ownerRows) {
                const contactId = shared.get(normalizePhone(r.phone));
                const key = `${r.channelId}:${contactId}`;
                if (!contactId || details.has(key))
                    continue;
                details.set(key, { input: r, contactId });
            }
            for (const { input, contactId } of details.values())
                await mergeSharedTags(contactId, input.tags, tx);
            const values = [...details.values()].map(({ input, contactId }) => ({
                userId: ownerId,
                contactId,
                channelId: input.channelId,
                status: input.status || "active",
                storeId: input.storeId || null,
                externalId: input.externalId || null,
                lastContact: input.lastContact || null,
                createdBy: input.createdBy || user?.id || null,
            }));
            for (let i = 0; i < values.length; i += BULK_CHUNK_SIZE) {
                const insert = tx.insert(whatsappContactChannels).values(values.slice(i, i + BULK_CHUNK_SIZE));
                const target = [whatsappContactChannels.channelId, whatsappContactChannels.contactId];
                const inserted = skipExisting
                    ? await insert.onConflictDoNothing({ target }).returning({ id: whatsappContactChannels.id, contactId: whatsappContactChannels.contactId, channelId: whatsappContactChannels.channelId })
                    : await insert.onConflictDoUpdate({ target, set: { updatedAt: sql`now()` } }).returning({ id: whatsappContactChannels.id, contactId: whatsappContactChannels.contactId, channelId: whatsappContactChannels.channelId });
                for (const row of inserted) {
                    ids.push(row.id);
                    const input = details.get(`${row.channelId}:${row.contactId}`)?.input;
                    if (input && Array.isArray(input.groups) && input.groups.length)
                        withGroups.push({ ...row, tenantId: ownerId, createdBy: input.createdBy, groups: input.groups });
                }
            }
        });
    }
    await applyWhatsAppContactGroups(withGroups, { user });
    return getWhatsAppContactsByIds(ids, executor);
}

export async function createWhatsAppContact(input, options) {
    const [row] = await createWhatsAppContacts([input], options);
    return row;
}

const DETAIL_FIELDS = ["status", "storeId", "externalId", "lastContact", "createdBy"];

/**
 * Update a WhatsApp contact. Name, email, tags, source and notes go to the shared
 * contact (every channel sees them); a new phone re-points the row at the shared
 * contact for that number. Returns the row in the wa_contacts shape.
 */
export async function updateWhatsAppContact(id, changes = {}, { user } = {}) {
    const current = await getWhatsAppContact(id);
    if (!current)
        return undefined;
    const ownerId = current.userId;
    let contactId = current.contactId;
    if (changes.phone !== undefined && normalizePhone(changes.phone) !== current.phone) {
        contactId = await ensureSharedContact(ownerId, {
            phone: changes.phone,
            name: changes.name ?? current.name,
            email: changes.email ?? current.email,
            source: current.source || "whatsapp",
        });
        if (!contactId)
            throw new AppError(`Invalid phone number: ${changes.phone}`, 400);
    }
    const shared = {};
    if (changes.name !== undefined) {
        const name = realName(changes.name, normalizePhone(changes.phone ?? current.phone));
        const split = splitName(name);
        shared.name = name;
        shared.firstName = split.firstName;
        shared.lastName = split.lastName;
    }
    if (changes.email !== undefined)
        shared.email = changes.email || null;
    if (changes.tags !== undefined)
        shared.tags = tagList(changes.tags);
    if (changes.source !== undefined)
        shared.source = changes.source ? String(changes.source).slice(0, 50) : null;
    if (changes.notes !== undefined)
        shared.customFields = sql`coalesce(${sharedContacts.customFields}, '{}'::jsonb) || jsonb_build_object('notes', ${String(changes.notes)}::text)`;
    const detail = {};
    for (const field of DETAIL_FIELDS) {
        if (changes[field] !== undefined)
            detail[field] = changes[field];
    }
    if (contactId !== current.contactId)
        detail.contactId = contactId;
    await db.transaction(async (tx) => {
        if (Object.keys(shared).length)
            await tx.update(sharedContacts).set({ ...shared, updatedAt: new Date() }).where(eq(sharedContacts.id, contactId));
        await tx.update(whatsappContactChannels).set({ ...detail, updatedAt: new Date() }).where(eq(whatsappContactChannels.id, id));
    });
    if (Array.isArray(changes.groups))
        await setWhatsAppContactGroups({ ...current, contactId }, changes.groups, { user });
    return getWhatsAppContact(id);
}

/** Remove WhatsApp contacts from their channel; the shared contact is kept. Returns the number removed. */
export async function deleteWhatsAppContacts(ids, { channelId } = {}) {
    const list = [...new Set((ids || []).filter(Boolean))];
    if (!list.length)
        return 0;
    const conditions = [inArray(whatsappContactChannels.id, list)];
    if (channelId)
        conditions.push(eq(whatsappContactChannels.channelId, channelId));
    const removed = await db.delete(whatsappContactChannels).where(and(...conditions)).returning({ id: whatsappContactChannels.id });
    return removed.length;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function findGroup({ ownerId, id, name }) {
    const conditions = [];
    if (ownerId)
        conditions.push(eq(contactGroups.userId, ownerId));
    if (id)
        conditions.push(eq(contactGroups.id, id));
    if (name)
        conditions.push(eq(contactGroups.name, name));
    if (!id && !name)
        return null;
    const [group] = await db.select().from(contactGroups).where(and(...conditions)).limit(1);
    return group || null;
}

/** Find a group by name for the owner, creating it if it doesn't exist. */
export async function ensureGroup(ownerId, name, { channelId, createdBy, description } = {}) {
    const trimmed = (name || "").trim();
    if (!ownerId || !trimmed)
        return null;
    await db
        .insert(contactGroups)
        .values({ userId: ownerId, name: trimmed, channelId: channelId || null, createdBy: createdBy || null, description: description || null })
        .onConflictDoNothing({ target: [contactGroups.userId, contactGroups.name] });
    return findGroup({ ownerId, name: trimmed });
}

/** Resolve a JSONB-style group reference (name or id) to a group row. */
export async function resolveGroupRef(ownerId, ref, options) {
    if (!ref)
        return null;
    const byId = await findGroup({ ownerId, id: String(ref) });
    return byId || ensureGroup(ownerId, String(ref), options);
}

/** Shared contact ids for WhatsApp contact ids (optionally limited to one channel). */
export async function sharedIdsForWhatsAppContacts(waContactIds, { channelId } = {}) {
    if (!waContactIds?.length)
        return new Map();
    const conditions = [inArray(whatsappContactChannels.id, waContactIds)];
    if (channelId)
        conditions.push(eq(whatsappContactChannels.channelId, channelId));
    const rows = await db
        .select({ id: whatsappContactChannels.id, contactId: whatsappContactChannels.contactId })
        .from(whatsappContactChannels)
        .where(and(...conditions));
    return new Map(rows.map((r) => [r.id, r.contactId]));
}

export async function addContactsToGroup(groupId, sharedContactIds, executor = db) {
    const ids = [...new Set(sharedContactIds.filter(Boolean))];
    if (!groupId || !ids.length)
        return 0;
    const inserted = await executor
        .insert(contactGroupMembers)
        .values(ids.map((contactId) => ({ groupId, contactId })))
        .onConflictDoNothing()
        .returning({ contactId: contactGroupMembers.contactId });
    return inserted.length;
}

export async function removeContactsFromGroup(groupId, sharedContactIds, executor = db) {
    const ids = [...new Set(sharedContactIds.filter(Boolean))];
    if (!groupId || !ids.length)
        return 0;
    const removed = await executor
        .delete(contactGroupMembers)
        .where(and(eq(contactGroupMembers.groupId, groupId), inArray(contactGroupMembers.contactId, ids)))
        .returning({ contactId: contactGroupMembers.contactId });
    return removed.length;
}

export async function groupMemberIds(groupId, executor = db) {
    const rows = await executor
        .select({ contactId: contactGroupMembers.contactId })
        .from(contactGroupMembers)
        .where(eq(contactGroupMembers.groupId, groupId));
    return rows.map((r) => r.contactId);
}

export async function renameGroup(groupId, { name, description }) {
    const [updated] = await db
        .update(contactGroups)
        .set({
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        updatedAt: new Date(),
    })
        .where(eq(contactGroups.id, groupId))
        .returning();
    return updated || null;
}

export async function deleteGroup(groupId) {
    const [deleted] = await db.delete(contactGroups).where(eq(contactGroups.id, groupId)).returning();
    return deleted || null;
}

/** Replace a WhatsApp contact's group list (names or ids). Never throws. */
export async function setWhatsAppContactGroups(waContact, groupRefs, { user } = {}) {
    if (!waContact?.contactId || !Array.isArray(groupRefs))
        return;
    try {
        const ownerId = waContact.userId || await resolveOwnerId({ channelId: waContact.channelId, user, tenantId: waContact.tenantId, createdBy: waContact.createdBy });
        if (!ownerId)
            return;
        const wanted = [];
        for (const ref of groupRefs) {
            const group = await resolveGroupRef(ownerId, ref, { channelId: waContact.channelId, createdBy: user?.id });
            if (group)
                wanted.push(group.id);
        }
        await db.transaction(async (tx) => {
            const current = await tx
                .select({ groupId: contactGroupMembers.groupId })
                .from(contactGroupMembers)
                .innerJoin(contactGroups, eq(contactGroups.id, contactGroupMembers.groupId))
                .where(and(eq(contactGroupMembers.contactId, waContact.contactId), eq(contactGroups.userId, ownerId)));
            const currentIds = new Set(current.map((r) => r.groupId));
            const toRemove = [...currentIds].filter((id) => !wanted.includes(id));
            if (toRemove.length) {
                await tx
                    .delete(contactGroupMembers)
                    .where(and(eq(contactGroupMembers.contactId, waContact.contactId), inArray(contactGroupMembers.groupId, toRemove)));
            }
            const toAdd = wanted.filter((id) => !currentIds.has(id));
            if (toAdd.length) {
                await tx
                    .insert(contactGroupMembers)
                    .values(toAdd.map((groupId) => ({ groupId, contactId: waContact.contactId })))
                    .onConflictDoNothing();
            }
        });
    }
    catch (error) {
        console.error("[ContactIdentity] Failed to set contact groups:", error.message);
    }
}

/**
 * Add WhatsApp contacts to the groups named in their `groups` arrays (additive).
 * Rows need contactId and channelId. Never throws.
 */
export async function applyWhatsAppContactGroups(rows, { user } = {}) {
    const withGroups = (rows || []).filter((r) => r?.contactId && Array.isArray(r.groups) && r.groups.length);
    if (!withGroups.length)
        return;
    try {
        const groupCache = new Map();
        const membersByGroup = new Map();
        for (const row of withGroups) {
            const ownerId = await resolveOwnerId({ channelId: row.channelId, user, tenantId: row.tenantId, createdBy: row.createdBy });
            if (!ownerId)
                continue;
            for (const ref of row.groups) {
                const key = `${ownerId}:${ref}`;
                if (!groupCache.has(key))
                    groupCache.set(key, await resolveGroupRef(ownerId, ref, { channelId: row.channelId, createdBy: user?.id }));
                const group = groupCache.get(key);
                if (!group)
                    continue;
                if (!membersByGroup.has(group.id))
                    membersByGroup.set(group.id, []);
                membersByGroup.get(group.id).push(row.contactId);
            }
        }
        for (const [groupId, contactIds] of membersByGroup) {
            for (let i = 0; i < contactIds.length; i += BULK_CHUNK_SIZE)
                await addContactsToGroup(groupId, contactIds.slice(i, i + BULK_CHUNK_SIZE));
        }
    }
    catch (error) {
        console.error("[ContactIdentity] Failed to apply contact groups:", error.message);
    }
}

/** Groups visible to an owner, with member counts. */
export async function listGroupsWithCounts(ownerId) {
    const conditions = ownerId ? sql`WHERE g.user_id = ${ownerId}` : sql``;
    const result = await db.execute(sql`
        SELECT g.id, g.user_id AS "userId", g.channel_id AS "channelId", g.name, g.description,
               g.created_by AS "createdBy", g.created_at AS "createdAt", g.updated_at AS "updatedAt",
               count(m.contact_id)::int AS contact_count
        FROM contact_groups g
        LEFT JOIN contact_group_members m ON m.group_id = g.id
        ${conditions}
        GROUP BY g.id
        ORDER BY g.created_at DESC
    `);
    return result.rows;
}
