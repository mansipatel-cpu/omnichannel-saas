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
import { whatsappDb as db } from '../config/database';
import { eq } from 'drizzle-orm';
import { plans } from '@shared/whatsapp-schema';
import { cacheGet, cacheInvalidate, CACHE_KEYS, CACHE_TTL } from '../services/whatsappCache';
export const getAllPlans = async (req, res) => {
    try {
        const allPlans = await cacheGet(CACHE_KEYS.subscriptionPlans(), CACHE_TTL.subscriptionPlans, async () => {
            return db.select().from(plans);
        });
        res.status(200).json({ success: true, data: allPlans });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching plans', error });
    }
};
export const getPlanById = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await db.select().from(plans).where(eq(plans.id, id));
        if (plan.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        res.status(200).json({ success: true, data: plan[0] });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching plan', error });
    }
};
export const createPlan = async (req, res) => {
    try {
        const { name, description, icon, popular, badge, color, buttonColor, monthlyPrice, annualPrice, multiCurrencyPrices, permissions, features } = req.body;
        const newPlan = await db.insert(plans).values({
            name,
            description,
            icon,
            popular: popular || false,
            badge,
            color,
            buttonColor,
            monthlyPrice,
            annualPrice,
            multiCurrencyPrices: multiCurrencyPrices || {},
            permissions,
            features
        }).returning();
        await cacheInvalidate(CACHE_KEYS.subscriptionPlans());
        res.status(201).json({ success: true, data: newPlan[0] });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error creating plan', error });
    }
};
export const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const existing = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        const updatedPlan = await db
            .update(plans)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(plans.id, id))
            .returning();
        if (updatedPlan.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        await cacheInvalidate(CACHE_KEYS.subscriptionPlans());
        await cacheInvalidate(CACHE_KEYS.planById(id));
        res.status(200).json({ success: true, data: updatedPlan[0] });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error updating plan', error });
    }
};
export const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedPlan = await db
            .delete(plans)
            .where(eq(plans.id, id))
            .returning();
        if (deletedPlan.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        await cacheInvalidate(CACHE_KEYS.subscriptionPlans());
        await cacheInvalidate(CACHE_KEYS.planById(id));
        res.status(200).json({ success: true, message: 'Plan deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting plan', error });
    }
};
