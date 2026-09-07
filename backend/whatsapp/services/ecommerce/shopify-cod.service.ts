// server/services/ecommerce/shopify-cod.service.ts
import axios from "axios";

export class ShopifyCodService {
  static async updateOrderTag(
    shopDomain: string,
    accessToken: string,
    orderId: string,
    status: "confirmed" | "cancelled"
  ) {
    const tag = status === "confirmed" ? "cod-confirmed" : "cod-cancelled";
console.log("Updating tag...");

    await axios.put(
      `https://${shopDomain}/admin/api/2026-04/orders/${orderId}.json`,
      { order: { id: orderId, tags: tag } },
      { headers: { "X-Shopify-Access-Token": accessToken } }
    );

    console.log("Tag updated");

    if (status === "cancelled") {

        console.log("Cancelling order...");
     const response = await axios.post(
        `https://${shopDomain}/admin/api/2026-04/orders/${orderId}/cancel.json`,
        { reason: "customer", email: false },
        { headers: { "X-Shopify-Access-Token": accessToken } }
      );

      console.log("Cancel response:", response.data);
    }
  }
}