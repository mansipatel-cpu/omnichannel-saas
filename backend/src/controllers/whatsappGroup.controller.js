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
import { contactGroups } from "@shared/schema";
import { db } from "../config/database";
import { addContactsToGroup as addMembers, deleteGroup as removeGroup, findGroup, listGroupsWithCounts, removeContactsFromGroup as removeMembers, renameGroup, resolveOwnerId, sharedIdsForWhatsAppContacts, } from "../services/contact-identity.service";

function isSuperadmin(user) {
    return user?.role === "superadmin";
}

async function requestOwnerId(req, channelId) {
    const user = req.session?.user;
    if (isSuperadmin(user) && !channelId)
        return null;
    return resolveOwnerId({ channelId, user });
}

async function findOwnedGroup(req, { id, name, channelId }) {
    const user = req.session?.user;
    const ownerId = await requestOwnerId(req, channelId);
    if (!ownerId && !isSuperadmin(user))
        return null;
    return findGroup({ ownerId, id, name });
}

function errorMessage(e) {
    return e instanceof Error ? e.message : "Something went wrong";
}

export const createGroup = async (req, res) => {
    try {
        const user = req.session?.user;
        const { name, description, channelId } = req.body;
        if (!channelId) {
            return res.status(400).json({ error: "channelId is required" });
        }
        if (!name?.trim()) {
            return res.status(400).json({ error: "name is required" });
        }
        const ownerId = await requestOwnerId(req, channelId);
        if (!ownerId) {
            return res.status(404).json({ error: "Channel not found" });
        }
        const [group] = await db
            .insert(contactGroups)
            .values({ userId: ownerId, channelId, name: name.trim(), description, createdBy: user?.id })
            .onConflictDoNothing({ target: [contactGroups.userId, contactGroups.name] })
            .returning();
        if (!group) {
            return res.status(409).json({ error: "A group with this name already exists" });
        }
        res.json({ success: true, group });
    }
    catch (e) {
        res.status(500).json({ error: errorMessage(e) });
    }
};
export const getGroups = async (req, res) => {
    try {
        const user = req.session?.user;
        const { channelId } = req.query;
        if (!channelId && !isSuperadmin(user)) {
            return res.status(400).json({ success: false, error: "channelId is required" });
        }
        const ownerId = await requestOwnerId(req, channelId ? String(channelId) : undefined);
        if (!ownerId && !isSuperadmin(user)) {
            return res.json({ success: true, groups: [] });
        }
        const groups = await listGroupsWithCounts(ownerId);
        return res.json({ success: true, groups });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};
export const getGroupById = async (req, res) => {
    try {
        const group = await findOwnedGroup(req, { id: req.params.id });
        if (!group)
            return res.status(404).json({ error: "Group not found" });
        res.json({ success: true, group });
    }
    catch (e) {
        res.status(500).json({ error: errorMessage(e) });
    }
};
export const updateGroup = async (req, res) => {
    try {
        const { name, description } = req.body;
        const group = await findOwnedGroup(req, { id: req.params.id });
        if (!group)
            return res.status(404).json({ error: "Group not found" });
        if (name !== undefined && name.trim() !== group.name) {
            const clash = await findGroup({ ownerId: group.userId, name: name.trim() });
            if (clash)
                return res.status(409).json({ error: "A group with this name already exists" });
        }
        const updated = await renameGroup(group.id, { name, description });
        res.json({ success: true, updated });
    }
    catch (e) {
        res.status(500).json({ error: errorMessage(e) });
    }
};
export const deleteGroup = async (req, res) => {
    try {
        const group = await findOwnedGroup(req, { id: req.params.id });
        if (!group)
            return res.json({ success: true, deleted: undefined });
        const deleted = await removeGroup(group.id);
        res.json({ success: true, deleted });
    }
    catch (e) {
        res.status(500).json({ error: errorMessage(e) });
    }
};
export const addContactsToGroup = async (req, res) => {
    try {
        const { contactIds, groupName, channelId } = req.body;
        if (!contactIds?.length || !groupName || !channelId) {
            return res.status(400).json({ error: "contactIds, groupName, and channelId are required" });
        }
        const group = await findOwnedGroup(req, { name: groupName, channelId });
        if (!group) {
            return res.status(404).json({ error: "Group not found in this channel" });
        }
        const sharedIds = await sharedIdsForWhatsAppContacts(contactIds, { user: req.session?.user, channelId });
        const updatedCount = await addMembers(group.id, [...sharedIds.values()]);
        res.json({ success: true, updatedCount });
    }
    catch (e) {
        res.status(500).json({ error: errorMessage(e) });
    }
};
export const removeContactsFromGroup = async (req, res) => {
    try {
        const { contactIds, groupName, channelId } = req.body;
        if (!contactIds?.length || !groupName || !channelId) {
            return res.status(400).json({ error: "contactIds, groupName, and channelId are required" });
        }
        const group = await findOwnedGroup(req, { name: groupName, channelId });
        if (!group) {
            return res.json({ success: true, updatedCount: 0 });
        }
        const sharedIds = await sharedIdsForWhatsAppContacts(contactIds, { user: req.session?.user, channelId });
        const updatedCount = await removeMembers(group.id, [...sharedIds.values()]);
        res.json({ success: true, updatedCount });
    }
    catch (e) {
        res.status(500).json({ error: errorMessage(e) });
    }
};
export const moveContactsBetweenGroups = async (req, res) => {
    try {
        const { contactIds, fromGroup, toGroup, channelId } = req.body;
        if (!contactIds?.length || !fromGroup || !toGroup || !channelId) {
            return res
                .status(400)
                .json({ error: "contactIds, fromGroup, toGroup, and channelId are required" });
        }
        if (fromGroup === toGroup) {
            return res
                .status(400)
                .json({ error: "Source and destination groups must be different" });
        }
        const destination = await findOwnedGroup(req, { name: toGroup, channelId });
        if (!destination) {
            return res.status(404).json({ error: "Destination group not found in this channel" });
        }
        const source = await findOwnedGroup(req, { name: fromGroup, channelId });
        const sharedIds = [...(await sharedIdsForWhatsAppContacts(contactIds, { user: req.session?.user, channelId })).values()];
        let movedCount = 0;
        await db.transaction(async (tx) => {
            const removed = source ? await removeMembers(source.id, sharedIds, tx) : 0;
            const added = await addMembers(destination.id, sharedIds, tx);
            movedCount = Math.max(removed, added);
        });
        res.json({ success: true, movedCount, fromGroup, toGroup });
    }
    catch (e) {
        res.status(500).json({ error: errorMessage(e) });
    }
};
export const getGroupContactCount = async (req, res) => {
    try {
        const { channelId } = req.query;
        if (!channelId) {
            return res.status(400).json({ error: "channelId is required" });
        }
        const ownerId = await requestOwnerId(req, String(channelId));
        const groups = ownerId ? await listGroupsWithCounts(ownerId) : [];
        const counts = {};
        for (const group of groups) {
            counts[group.name] = Number(group.contact_count || 0);
        }
        res.json({ success: true, counts });
    }
    catch (e) {
        res.status(500).json({ error: errorMessage(e) });
    }
};
