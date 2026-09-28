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
import { eq, desc, and } from "drizzle-orm";
import { count } from "drizzle-orm";
import { users, } from "@shared/whatsapp-schema";
import { Role } from "@shared/whatsapp-roles";
export class UserRepository {
    async getById(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user || undefined;
    }
    async getByPermissions(id) {
        const [result] = await db
            .select({ permissions: users.permissions })
            .from(users)
            .where(eq(users.id, id));
        return result?.permissions || [];
    }
    async getByUsername(username) {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user || undefined;
    }
    async create(insertUser) {
        const [user] = await db
            .insert(users)
            .values(insertUser)
            .returning();
        return user;
    }
    async getAll() {
        return await db.select().from(users).orderBy(desc(users.createdAt));
    }
    async getTeamUsersCountByCreator(createdBy) {
        const [row] = await db
            .select({ value: count() })
            .from(users)
            .where(and(eq(users.createdBy, createdBy), eq(users.role, Role.TEAM)));
        return Number(row?.value ?? 0);
    }
}
