// server/services/ecommerce/woocommerce-cod.service.ts
import axios from "axios";
import https from "https";
export class WooCommerceCodService {
    static async updateOrderStatus(storeUrl, consumerKey, consumerSecret, orderId, status) {
        const isLocalDev = storeUrl.includes(".local");
        const wcStatus = status === "confirmed" ? "processing" : "cancelled";
        await axios.put(`${storeUrl}/wp-json/wc/v3/orders/${orderId}`, { status: wcStatus, customer_note: `COD ${status} via WhatsApp verification` }, {
            auth: { username: consumerKey.trim(), password: consumerSecret.trim() },
            httpsAgent: isLocalDev ? new https.Agent({ rejectUnauthorized: false }) : undefined,
        });
    }
}
