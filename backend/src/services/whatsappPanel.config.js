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
import { panelConfig } from "@shared/whatsapp-schema";
import { whatsappDb as db } from "../config/database";
import { eq, desc } from "drizzle-orm";
import { cacheGet, cacheInvalidate, CACHE_KEYS, CACHE_TTL } from './whatsappCache';
export const createPanelConfig = async (data) => {
    const result = await db.insert(panelConfig).values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
    }).returning();
    await cacheInvalidate(CACHE_KEYS.panelConfig());
    return result[0];
};
export const getPanelConfigs = async () => {
    return cacheGet(CACHE_KEYS.panelConfig(), CACHE_TTL.panelConfig, async () => {
        return db.select().from(panelConfig).orderBy(desc(panelConfig.createdAt));
    });
};
export const getPanelConfigById = async (id) => {
    const result = await db.select().from(panelConfig).where(eq(panelConfig.id, id));
    return result[0] || null;
};
export const updatePanelConfig = async (id, data) => {
    const updateData = {
        ...data,
        updatedAt: new Date()
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
            delete updateData[key];
        }
    });
    const result = await db.update(panelConfig)
        .set(updateData)
        .where(eq(panelConfig.id, id))
        .returning();
    await cacheInvalidate(CACHE_KEYS.panelConfig());
    return result[0] || null;
};
export const deletePanelConfig = async (id) => {
    await db.delete(panelConfig).where(eq(panelConfig.id, id));
    await cacheInvalidate(CACHE_KEYS.panelConfig());
    return true;
};
// Helper functions for brand settings compatibility
export const getFirstPanelConfig = async () => {
    const result = await db.select().from(panelConfig).orderBy(desc(panelConfig.createdAt)).limit(1);
    return result[0] || null;
};
export const updateFirstPanelConfig = async (data) => {
    // Try to get the first config
    const existingConfig = await getFirstPanelConfig();
    if (existingConfig) {
        // Update existing config
        return updatePanelConfig(existingConfig.id, data);
    }
    else {
        // Create new config if none exists
        const newConfigData = {
            name: data.name || "Your App Name",
            tagline: data.tagline || "",
            description: data.description || "",
            companyName: data.companyName || "",
            companyWebsite: data.companyWebsite || "",
            supportEmail: data.supportEmail || "",
            defaultLanguage: data.defaultLanguage || "en",
            supportedLanguages: data.supportedLanguages || ["en"],
            logo: data.logo,
            favicon: data.favicon,
        };
        return createPanelConfig(newConfigData);
    }
};
