/**
 * Team Management Plugin Adapter
 *
 * Provides optional dynamic loading of the Team Management plugin.
 * Returns no-op stubs when the plugin is not installed, allowing
 * the core application to function without the plugin.
 *
 * Uses async dynamic import() for ES module compatibility.
 * Supports both .ts (development) and .js (production) files.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_DIR = path.resolve(__dirname, '..', '..', 'plugins', 'team-management');
let pluginAvailable = null;
let cachedServices = {};
let loadAttempted = false;
function isPluginInstalled() {
    if (pluginAvailable === null) {
        try {
            pluginAvailable = fs.existsSync(PLUGIN_DIR) &&
                fs.existsSync(path.join(PLUGIN_DIR, 'services'));
        }
        catch {
            pluginAvailable = false;
        }
    }
    return pluginAvailable;
}
function resolveModulePath(basePath) {
    const extensions = ['.ts', '.js', '.mjs'];
    for (const ext of extensions) {
        const fullPath = basePath + ext;
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    if (fs.existsSync(basePath)) {
        return basePath;
    }
    return null;
}
async function dynamicImport(basePath) {
    const resolvedPath = resolveModulePath(basePath);
    if (!resolvedPath) {
        throw new Error(`Module not found: ${basePath}`);
    }
    const fileUrl = pathToFileURL(resolvedPath).href;
    return import(fileUrl);
}
async function loadServices() {
    if (!isPluginInstalled()) {
        return false;
    }
    try {
        const teamAuthBase = path.join(PLUGIN_DIR, 'services', 'team-auth.service');
        const adminTeamBase = path.join(PLUGIN_DIR, 'services', 'admin-team.service');
        const teamBase = path.join(PLUGIN_DIR, 'services', 'team.service');
        const results = await Promise.allSettled([
            dynamicImport(teamAuthBase),
            dynamicImport(adminTeamBase),
            dynamicImport(teamBase),
        ]);
        if (results[0].status === 'fulfilled') {
            cachedServices.TeamAuthService = results[0].value.TeamAuthService;
        }
        if (results[1].status === 'fulfilled') {
            cachedServices.AdminTeamService = results[1].value.AdminTeamService;
        }
        if (results[2].status === 'fulfilled') {
            cachedServices.TeamService = results[2].value.TeamService;
        }
        const anyLoaded = results.some(r => r.status === 'fulfilled');
        if (anyLoaded) {
            console.log('[TeamManagementAdapter] Services loaded successfully');
        }
        return anyLoaded;
    }
    catch (error) {
        console.warn('[TeamManagementAdapter] Failed to load services:', error);
        return false;
    }
}
async function loadMiddleware() {
    if (!isPluginInstalled()) {
        return false;
    }
    try {
        const middlewareBase = path.join(PLUGIN_DIR, 'middleware', 'team-auth.middleware');
        const module = await dynamicImport(middlewareBase);
        cachedServices.applyTeamContext = module.applyTeamContext;
        console.log('[TeamManagementAdapter] Middleware loaded successfully');
        return true;
    }
    catch (error) {
        console.warn('[TeamManagementAdapter] Failed to load middleware:', error);
        return false;
    }
}
export async function initializeAdapter() {
    if (loadAttempted && Object.keys(cachedServices).length > 0) {
        return;
    }
    loadAttempted = true;
    await Promise.all([loadServices(), loadMiddleware()]);
}
export function getTeamAuthService() {
    return cachedServices.TeamAuthService || null;
}
export function getAdminTeamService() {
    return cachedServices.AdminTeamService || null;
}
export function getTeamService() {
    return cachedServices.TeamService || null;
}
export function getApplyTeamContext() {
    return cachedServices.applyTeamContext || null;
}
export function getTeamContextMiddleware() {
    const applyTeamContext = getApplyTeamContext();
    if (applyTeamContext) {
        return applyTeamContext();
    }
    return (_req, _res, next) => {
        next();
    };
}
export async function validateUserTeamSession(token) {
    if (!cachedServices.TeamAuthService && !loadAttempted) {
        await loadServices();
    }
    const TeamAuthService = getTeamAuthService();
    if (!TeamAuthService) {
        return null;
    }
    try {
        return await TeamAuthService.validateSession(token);
    }
    catch (error) {
        console.error('[TeamManagementAdapter] User team session validation error:', error);
        return null;
    }
}
export async function validateAdminTeamSession(token) {
    if (!cachedServices.AdminTeamService && !loadAttempted) {
        await loadServices();
    }
    const AdminTeamService = getAdminTeamService();
    if (!AdminTeamService) {
        return null;
    }
    try {
        const session = await AdminTeamService.validateSession(token);
        if (!session) {
            return null;
        }
        return {
            memberId: session.memberId,
            teamId: session.teamId,
            userId: session.adminId,
            roleId: session.roleId,
            roleName: session.roleName,
            permissions: session.permissions,
            isAdminTeam: true,
            adminId: session.adminId,
        };
    }
    catch (error) {
        console.error('[TeamManagementAdapter] Admin team session validation error:', error);
        return null;
    }
}
export function isTeamManagementInstalled() {
    return isPluginInstalled();
}
export function clearCache() {
    pluginAvailable = null;
    cachedServices = {};
    loadAttempted = false;
}
