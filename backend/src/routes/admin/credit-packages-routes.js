'use strict';
import { storage } from '../../storage';
import { requireAdminPermission } from '../../middleware/admin-auth';
import { insertCreditPackageSchema } from '@shared/schema';
export function registerCreditPackagesRoutes(router) {
    router.get('/credit-packages', requireAdminPermission('billing', 'credits', 'read'), async (req, res) => {
        try {
            const packages = await storage.getAllCreditPackages();
            res.json(packages);
        }
        catch (error) {
            console.error('Error fetching credit packages:', error);
            res.status(500).json({ error: 'Failed to fetch credit packages' });
        }
    });
    router.post('/credit-packages', requireAdminPermission('billing', 'credits', 'create'), async (req, res) => {
        try {
            const bodyData = { ...req.body };
            if (typeof bodyData.price === 'number') {
                bodyData.price = bodyData.price.toFixed(2);
            }
            if (typeof bodyData.razorpayPrice === 'number') {
                bodyData.razorpayPrice = bodyData.razorpayPrice.toFixed(2);
            }
            let packageData;
            try {
                packageData = insertCreditPackageSchema.parse(bodyData);
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
            const newPackage = await storage.createCreditPackage(packageData);
            res.json(newPackage);
        }
        catch (error) {
            console.error('Error creating credit package:', error);
            res.status(500).json({ error: 'Failed to create credit package' });
        }
    });
    router.patch('/credit-packages/:packageId', requireAdminPermission('billing', 'credits', 'update'), async (req, res) => {
        try {
            const { packageId } = req.params;
            const bodyData = { ...req.body };
            if (typeof bodyData.price === 'number') {
                bodyData.price = bodyData.price.toFixed(2);
            }
            if (typeof bodyData.razorpayPrice === 'number') {
                bodyData.razorpayPrice = bodyData.razorpayPrice.toFixed(2);
            }
            let updateData;
            try {
                updateData = insertCreditPackageSchema.partial().parse(bodyData);
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
            const existingPackage = await storage.getCreditPackage(packageId);
            if (!existingPackage) {
                return res.status(404).json({ error: 'Credit package not found' });
            }
            await storage.updateCreditPackage(packageId, updateData);
            const updatedPackage = await storage.getCreditPackage(packageId);
            res.json({ success: true, package: updatedPackage });
        }
        catch (error) {
            console.error('Error updating credit package:', error);
            res.status(500).json({ error: 'Failed to update credit package' });
        }
    });
}
