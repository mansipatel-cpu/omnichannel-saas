/**
 * ============================================================
 * Plugin Registry System
 *
 * Provides a runtime registry for plugins to self-register their
 * UI components. Core code renders from this registry, enabling
 * zero static imports for plugins.
 *
 * Usage:
 *   - Plugins call registerSettingsTab(), registerRoute(), etc.
 *   - Core components use usePluginRegistry() to get registered items
 * ============================================================
 */
import { createContext, useContext, useState, useCallback } from 'react';
const PluginRegistryContext = createContext(null);
export function PluginRegistryProvider({ children }) {
    const [state, setState] = useState({
        settingsTabs: [],
        routes: [],
        phoneNumbersTabs: [],
        adminMenuItems: [],
        adminSettingsTabs: [],
        loadedPlugins: new Set(),
    });
    const registerSettingsTab = useCallback((tab) => {
        setState(prev => {
            if (prev.settingsTabs.some(t => t.id === tab.id))
                return prev;
            const newTabs = [...prev.settingsTabs, tab].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
            return { ...prev, settingsTabs: newTabs };
        });
    }, []);
    const registerRoute = useCallback((route) => {
        setState(prev => {
            if (prev.routes.some(r => r.id === route.id))
                return prev;
            return { ...prev, routes: [...prev.routes, route] };
        });
    }, []);
    const registerPhoneNumbersTab = useCallback((tab) => {
        setState(prev => {
            if (prev.phoneNumbersTabs.some(t => t.id === tab.id))
                return prev;
            const newTabs = [...prev.phoneNumbersTabs, tab].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
            return { ...prev, phoneNumbersTabs: newTabs };
        });
    }, []);
    const registerAdminMenuItem = useCallback((item) => {
        setState(prev => {
            if (prev.adminMenuItems.some(i => i.id === item.id))
                return prev;
            const newItems = [...prev.adminMenuItems, item].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
            return { ...prev, adminMenuItems: newItems };
        });
    }, []);
    const registerAdminSettingsTab = useCallback((tab) => {
        setState(prev => {
            if (prev.adminSettingsTabs.some(t => t.id === tab.id))
                return prev;
            const newTabs = [...prev.adminSettingsTabs, tab].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
            return { ...prev, adminSettingsTabs: newTabs };
        });
    }, []);
    const markPluginLoaded = useCallback((pluginName) => {
        setState(prev => {
            const newSet = new Set(prev.loadedPlugins);
            newSet.add(pluginName);
            return { ...prev, loadedPlugins: newSet };
        });
    }, []);
    const isPluginLoaded = useCallback((pluginName) => {
        return state.loadedPlugins.has(pluginName);
    }, [state.loadedPlugins]);
    const unregisterPlugin = useCallback((pluginName) => {
        setState(prev => {
            const newSet = new Set(prev.loadedPlugins);
            newSet.delete(pluginName);
            return {
                ...prev,
                settingsTabs: prev.settingsTabs.filter(t => t.pluginName !== pluginName),
                routes: prev.routes.filter(r => r.pluginName !== pluginName),
                phoneNumbersTabs: prev.phoneNumbersTabs.filter(t => t.pluginName !== pluginName),
                adminMenuItems: prev.adminMenuItems.filter(i => i.pluginName !== pluginName),
                adminSettingsTabs: prev.adminSettingsTabs.filter(t => t.pluginName !== pluginName),
                loadedPlugins: newSet,
            };
        });
    }, []);
    const getSettingsTabs = useCallback(() => state.settingsTabs, [state.settingsTabs]);
    const getRoutes = useCallback(() => state.routes, [state.routes]);
    const getPhoneNumbersTabs = useCallback(() => state.phoneNumbersTabs, [state.phoneNumbersTabs]);
    const getAdminMenuItems = useCallback(() => state.adminMenuItems, [state.adminMenuItems]);
    const getAdminSettingsTabs = useCallback(() => state.adminSettingsTabs, [state.adminSettingsTabs]);
    const api = {
        registerSettingsTab,
        registerRoute,
        registerPhoneNumbersTab,
        registerAdminMenuItem,
        registerAdminSettingsTab,
        markPluginLoaded,
        isPluginLoaded,
        unregisterPlugin,
        getSettingsTabs,
        getRoutes,
        getPhoneNumbersTabs,
        getAdminMenuItems,
        getAdminSettingsTabs,
    };
    return (<PluginRegistryContext.Provider value={api}>
      {children}
    </PluginRegistryContext.Provider>);
}
export function usePluginRegistry() {
    const context = useContext(PluginRegistryContext);
    if (!context) {
        throw new Error('usePluginRegistry must be used within a PluginRegistryProvider');
    }
    return context;
}
export function exposePluginRegistry(api) {
    if (typeof window !== 'undefined') {
        window.__AGENTLABS_PLUGIN_REGISTRY__ = api;
    }
}
export function getGlobalPluginRegistry() {
    if (typeof window !== 'undefined') {
        return window.__AGENTLABS_PLUGIN_REGISTRY__;
    }
    return undefined;
}
