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
import { automations, automationNodes, automationExecutions, automationExecutionLogs } from "@shared/whatsapp-schema";
import { automationEdges, } from "@shared/whatsapp-schema";
import { eq, and, desc } from "drizzle-orm";
export class AutomationRepository {
    // Automations CRUD
    async create(data) {
        const [automation] = await db.insert(automations).values(data).returning();
        return automation;
    }
    async findById(id) {
        const [automation] = await db
            .select()
            .from(automations)
            .where(eq(automations.id, id));
        return automation;
    }
    async findByChannel(channelId) {
        if (!channelId) {
            // Return all automations if no channelId is provided
            return await db
                .select()
                .from(automations)
                .orderBy(desc(automations.createdAt));
        }
        return await db
            .select()
            .from(automations)
            .where(eq(automations.channelId, channelId))
            .orderBy(desc(automations.createdAt));
    }
    async update(id, data) {
        const [automation] = await db
            .update(automations)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(automations.id, id))
            .returning();
        return automation;
    }
    async delete(id) {
        await db.delete(automations).where(eq(automations.id, id));
    }
    // Automation Nodes CRUD
    async createNode(data) {
        const [node] = await db.insert(automationNodes).values(data).returning();
        return node;
    }
    async createNodes(data) {
        if (data.length === 0)
            return [];
        return await db.insert(automationNodes).values(data).returning();
    }
    async findNodesByAutomation(automationId) {
        return await db
            .select()
            .from(automationNodes)
            .where(eq(automationNodes.automationId, automationId));
    }
    async updateNode(id, data) {
        const [node] = await db
            .update(automationNodes)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(automationNodes.id, id))
            .returning();
        return node;
    }
    async deleteNodesByAutomation(automationId) {
        await db.delete(automationNodes).where(eq(automationNodes.automationId, automationId));
    }
    // Automation Executions
    async createExecution(data) {
        const [execution] = await db.insert(automationExecutions).values(data).returning();
        return execution;
    }
    async findExecutionById(id) {
        const [execution] = await db
            .select()
            .from(automationExecutions)
            .where(eq(automationExecutions.id, id));
        return execution;
    }
    async findExecutionsByAutomation(automationId, limit = 50) {
        return await db
            .select()
            .from(automationExecutions)
            .where(eq(automationExecutions.automationId, automationId))
            .orderBy(desc(automationExecutions.startedAt))
            .limit(limit);
    }
    async updateExecution(id, data) {
        const [execution] = await db
            .update(automationExecutions)
            .set(data)
            .where(eq(automationExecutions.id, id))
            .returning();
        return execution;
    }
    // Execution Logs
    async createExecutionLog(data) {
        const [log] = await db.insert(automationExecutionLogs).values(data).returning();
        return log;
    }
    async findExecutionLogs(executionId) {
        return await db
            .select()
            .from(automationExecutionLogs)
            .where(eq(automationExecutionLogs.executionId, executionId))
            .orderBy(automationExecutionLogs.executedAt);
    }
    // Helper methods
    async getActiveAutomationsByTrigger(trigger, channelId) {
        const conditions = [
            eq(automations.trigger, trigger),
            eq(automations.status, 'active')
        ];
        if (channelId) {
            conditions.push(eq(automations.channelId, channelId));
        }
        return await db
            .select()
            .from(automations)
            .where(and(...conditions));
    }
    async incrementExecutionCount(id) {
        const [automation] = await db
            .select()
            .from(automations)
            .where(eq(automations.id, id));
        if (automation) {
            await db
                .update(automations)
                .set({
                executionCount: automation.executionCount !== null ? automation.executionCount + 1 : null,
                lastExecutedAt: new Date()
            })
                .where(eq(automations.id, id));
        }
    }
    async findByIdWithNodes(id) {
        const [automation] = await db
            .select()
            .from(automations)
            .where(eq(automations.id, id));
        if (!automation)
            return undefined;
        const nodes = await db
            .select()
            .from(automationNodes)
            .where(eq(automationNodes.automationId, id));
        const edges = await db
            .select()
            .from(automationEdges)
            .where(eq(automationEdges.automationId, id));
        return {
            ...automation,
            nodes,
            edges,
        };
    }
}
