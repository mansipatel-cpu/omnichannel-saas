import axios from "axios";
import { storage } from "../storage/whatsappStorage";
const REQUIRED_WEBHOOKS = [
    { topic: "orders/create", path: "/api/whatsapp/ecommerce/shopify/webhooks/orders-create" },
    { topic: "orders/updated", path: "/api/whatsapp/ecommerce/shopify/webhooks/orders-updated" },
    { topic: "orders/fulfilled", path: "/api/whatsapp/ecommerce/shopify/webhooks/orders-fulfilled" },
    { topic: "customers/create", path: "/api/whatsapp/ecommerce/shopify/webhooks/customers-create" },
    // Shopify has no direct "cart updated" webhook topic.
    // Checkouts create/update is the standard equivalent for abandoned-cart tracking.
    { topic: "checkouts/create", path: "/api/whatsapp/ecommerce/shopify/webhooks/checkouts-create" },
    { topic: "checkouts/update", path: "/api/whatsapp/ecommerce/shopify/webhooks/checkouts-update" },
    // Optional
    { topic: "products/update", path: "/api/whatsapp/ecommerce/shopify/webhooks/products-update" },
];
const SHOPIFY_API_VERSION = "2026-04";
export class ShopifyOAuthService {
    async getSettings() {
        const settings = await storage.getEcommerceSettings("shopify");
        if (!settings) {
            throw new Error("Shopify settings are not configured. Please configure them in Settings > E-Commerce > Shopify.");
        }
        if (!settings.clientId || !settings.clientSecret || !settings.callbackUrl) {
            throw new Error("Shopify settings are incomplete. Client ID, Client Secret and Callback URL are required.");
        }
        return {
            clientId: settings.clientId,
            clientSecret: settings.clientSecret,
            appUrl: settings.appUrl || "",
            callbackUrl: settings.callbackUrl,
            webhookUrl: settings.webhookUrl || "",
            scopes: settings.scopes ||
                "read_products,write_products,read_orders,write_orders,read_customers,write_customers,read_inventory",
        };
    }
    /**
     * Normalizes user input into a valid *.myshopify.com domain.
     * Accepts: "my-store", "my-store.myshopify.com", "https://my-store.myshopify.com/admin"
     */
    normalizeShopDomain(rawShop) {
        let shop = rawShop.trim().toLowerCase();
        shop = shop.replace(/^https?:\/\//, "");
        shop = shop.split("/")[0];
        if (!shop.endsWith(".myshopify.com")) {
            shop = `${shop}.myshopify.com`;
        }
        return shop;
    }
    isValidShopDomain(shop) {
        return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
    }
    async generateInstallUrl(shop, userId) {
        const scopes = "read_products,read_orders,read_customers,read_inventory";
        // const redirectUri = encodeURIComponent(
        //   process.env.SHOPIFY_REDIRECT_URI!
        // );
        // const state = userId;
        // return `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
        const settings = await this.getSettings();
        const redirectUri = encodeURIComponent(settings.callbackUrl);
        const state = userId;
        console.log("@@@@@@", `https://${shop}/admin/oauth/authorize?client_id=${settings.clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`);
        return `https://${shop}/admin/oauth/authorize?client_id=${settings.clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
    }
    async exchangeCodeForToken(shop, code) {
        const settings = await this.getSettings();
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: settings.clientId,
            client_secret: settings.clientSecret,
            code,
        });
        return response.data;
    }
    async saveStore(data) {
        const existing = await storage.getShopifyStoreByDomain(data.shopDomain);
        if (existing) {
            return storage.updateShopifyStore(existing.id, {
                accessToken: data.accessToken,
                scopes: data.scope || "",
                channelId: data.channelId,
                isActive: true,
                installedAt: new Date(),
                uninstalledAt: null,
            });
        }
        return storage.createShopifyStore({
            userId: data.userId,
            channelId: data.channelId,
            shopDomain: data.shopDomain,
            accessToken: data.accessToken,
            scopes: data.scope || "",
            isActive: true,
            installedAt: new Date(),
            uninstalledAt: null,
        });
    }
    /**
     * Registers all required webhooks for a store via the REST Admin API.
     * Safe to call multiple times — it first fetches existing webhooks
     * and skips topics that are already registered for this app.
     */
    async registerWebhooks(shop, accessToken) {
        const settings = await this.getSettings();
        const baseUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`;
        // const appBaseUrl = process.env.SHOPIFY_REDIRECT_URI
        //   ? process.env.SHOPIFY_REDIRECT_URI.replace(
        //       "/api/whatsapp/ecommerce/shopify/callback",
        //       ""
        //     )
        //   : process.env.APP_BASE_URL;
        const appBaseUrl = settings.appUrl ||
            settings.callbackUrl.replace("/api/whatsapp/ecommerce/shopify/callback", "");
        const headers = {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
        };
        // 1. Fetch existing webhooks so we don't create duplicates
        let existingTopics = new Set();
        try {
            const existing = await axios.get(baseUrl, { headers });
            existingTopics = new Set((existing.data.webhooks || []).map((w) => w.topic));
        }
        catch (err) {
            console.error("Failed to fetch existing webhooks", err);
        }
        const results = [];
        for (const hook of REQUIRED_WEBHOOKS) {
            if (existingTopics.has(hook.topic)) {
                results.push({ topic: hook.topic, status: "skipped" });
                continue;
            }
            try {
                await axios.post(baseUrl, {
                    webhook: {
                        topic: hook.topic,
                        address: `${appBaseUrl}${hook.path}`,
                        format: "json",
                    },
                }, { headers });
                results.push({ topic: hook.topic, status: "created" });
            }
            catch (err) {
                console.error(`Failed to register webhook ${hook.topic}`, err?.response?.data || err);
                results.push({
                    topic: hook.topic,
                    status: "failed",
                    error: err?.response?.data?.errors
                        ? JSON.stringify(err.response.data.errors)
                        : err.message,
                });
            }
        }
        return results;
    }
    async disconnectStore(storeId) {
        const store = await storage.getShopifyStoreById(storeId);
        if (!store) {
            throw new Error("Store not found");
        }
        try {
            const headers = {
                "X-Shopify-Access-Token": store.accessToken,
                "Content-Type": "application/json",
            };
            const webhooks = await axios.get(`https://${store.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, { headers });
            for (const webhook of webhooks.data.webhooks || []) {
                await axios.delete(`https://${store.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks/${webhook.id}.json`, { headers });
            }
        }
        catch (error) {
            console.error("Webhook cleanup failed", error);
        }
        await storage.updateShopifyStore(storeId, {
            status: "disconnected",
            isActive: false,
            uninstalledAt: new Date(),
        });
        return true;
    }
    async getCustomers(shop, accessToken) {
        const response = await axios.get(`https://${shop}/admin/api/2026-04/customers.json`, {
            headers: {
                "X-Shopify-Access-Token": accessToken,
            },
        });
        return response.data.customers;
    }
}
export const shopifyOAuthService = new ShopifyOAuthService();
