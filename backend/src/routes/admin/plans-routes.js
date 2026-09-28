'use strict';
import { storage } from '../../storage';
import { requireAdminPermission } from '../../middleware/admin-auth';
import { insertPlanSchema } from '@shared/schema';
import { db } from '../../config/database';
import { eq } from 'drizzle-orm';
function convertPriceFields(bodyData) {
    const result = { ...bodyData };
    const priceFields = [
        'monthlyPrice', 'yearlyPrice', 'razorpayMonthlyPrice', 'razorpayYearlyPrice',
        'paypalMonthlyPrice', 'paypalYearlyPrice', 'paystackMonthlyPrice', 'paystackYearlyPrice',
        'mercadopagoMonthlyPrice', 'mercadopagoYearlyPrice', 'yookassaMonthlyPrice', 'yookassaYearlyPrice'
    ];
    for (const field of priceFields) {
        if (typeof result[field] === 'number') {
            result[field] = result[field].toFixed(2);
        }
    }
    return result;
}
export function registerPlansRoutes(router) {
    router.get('/plans', requireAdminPermission('billing', 'plans', 'read'), async (req, res) => {
        try {
            const plans = await storage.getAllPlans();
            res.json(plans);
        }
        catch (error) {
            console.error('Error fetching plans:', error);
            res.status(500).json({ error: 'Failed to fetch plans' });
        }
    });
    router.post('/plans', requireAdminPermission('billing', 'plans', 'create'), async (req, res) => {
        try {
            const bodyData = convertPriceFields(req.body);
            let planData;
            try {
                planData = insertPlanSchema.parse(bodyData);
            }
            catch (validationError) {
                if (validationError.errors) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: validationError.errors
                    });
                }
                throw validationError;
            }
            const newPlan = await storage.createPlan(planData);
            res.json({ plan: newPlan });
        }
        catch (error) {
            console.error('Error creating plan:', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({ error: 'Validation failed', details: error.errors });
            }
            res.status(500).json({ error: 'Failed to create plan' });
        }
    });
    router.patch('/plans/:planId', requireAdminPermission('billing', 'plans', 'update'), async (req, res) => {
        try {
            const { planId } = req.params;
            // Convert price fields to strings (decimal fields expect strings)
            const bodyData = convertPriceFields(req.body);
            let updateData;
            try {
                updateData = insertPlanSchema.partial().parse(bodyData);
            }
            catch (validationError) {
                if (validationError.errors) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: validationError.errors
                    });
                }
                throw validationError;
            }
            const existingPlan = await storage.getPlan(planId);
            if (!existingPlan) {
                return res.status(404).json({ error: 'Plan not found' });
            }
            await storage.updatePlan(planId, updateData);
            const updatedPlan = await storage.getPlan(planId);
            res.json({ success: true, plan: updatedPlan });
        }
        catch (error) {
            console.error('Error updating plan:', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors
                });
            }
            res.status(500).json({
                error: 'Failed to update plan'
            });
        }
    });
    router.get('/plans/:planId/users', requireAdminPermission('billing', 'plans', 'read'), async (req, res) => {
        try {
            const { planId } = req.params;
            const plan = await storage.getPlan(planId);
            if (!plan) {
                return res.status(404).json({ error: 'Plan not found' });
            }
            const allUsers = await storage.getAllUsers();
            const usersOnPlan = allUsers.filter(user => {
                return user.planType && user.planType.toLowerCase() === plan.name.toLowerCase();
            });
            res.json({
                planId,
                planName: plan.displayName,
                userCount: usersOnPlan.length,
                users: usersOnPlan.map(u => ({ id: u.id, name: u.name, email: u.email }))
            });
        }
        catch (error) {
            console.error('Error fetching plan users:', error);
            res.status(500).json({ error: 'Failed to fetch plan users' });
        }
    });
    router.post('/plans/:planId/migrate', requireAdminPermission('billing', 'plans', 'update'), async (req, res) => {
        try {
            const { planId } = req.params;
            const { targetPlanId } = req.body;
            if (!targetPlanId) {
                return res.status(400).json({ error: 'Target plan ID is required' });
            }
            const sourcePlan = await storage.getPlan(planId);
            if (!sourcePlan) {
                return res.status(404).json({ error: 'Source plan not found' });
            }
            const targetPlan = await storage.getPlan(targetPlanId);
            if (!targetPlan) {
                return res.status(404).json({ error: 'Target plan not found' });
            }
            const allUsers = await storage.getAllUsers();
            const usersOnPlan = allUsers.filter(user => {
                return user.planType && user.planType.toLowerCase() === sourcePlan.name.toLowerCase();
            });
            if (usersOnPlan.length === 0) {
                return res.json({ success: true, migratedCount: 0 });
            }
            const { users } = await import('@shared/schema');
            for (const user of usersOnPlan) {
                await db.update(users)
                    .set({ planType: targetPlan.name })
                    .where(eq(users.id, user.id));
            }
            res.json({
                success: true,
                migratedCount: usersOnPlan.length,
                targetPlanName: targetPlan.displayName
            });
        }
        catch (error) {
            console.error('Error migrating users:', error);
            res.status(500).json({ error: 'Failed to migrate users' });
        }
    });
    router.delete('/plans/:planId', requireAdminPermission('billing', 'plans', 'delete'), async (req, res) => {
        try {
            const { planId } = req.params;
            const plan = await storage.getPlan(planId);
            if (!plan) {
                return res.status(404).json({ error: 'Plan not found' });
            }
            const allUsers = await storage.getAllUsers();
            const usersOnPlan = allUsers.filter(user => {
                return user.planType && user.planType.toLowerCase() === plan.name.toLowerCase();
            });
            if (usersOnPlan.length > 0) {
                return res.status(400).json({
                    error: 'USERS_NEED_MIGRATION',
                    userCount: usersOnPlan.length,
                    message: `${usersOnPlan.length} user(s) are currently subscribed to this plan. Please migrate them to another plan first.`
                });
            }
            await storage.deletePlan(planId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error deleting plan:', error);
            res.status(500).json({ error: 'Failed to delete plan' });
        }
    });
}
