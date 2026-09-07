import { db } from "../../db";
import { codVerifications } from "@shared/whatsapp-schema";
import { eq, and } from "drizzle-orm";
import { storage } from "../../storage";
import { ShopifyCodService } from "./shopify-cod.service";
import { WooCommerceCodService } from "./woocommerce-cod.service";

interface CodOrderInput {
  channelId: string;
  storeId: string;
  platform: "shopify" | "woocommerce";
  orderId: string;
  orderNumber: string;
  customerPhone: string;
  customerName: string;
  totalPrice: string;
  currency?: string;
}

export class CodVerificationService {
  static isCod(paymentMethod: string): boolean {
    if (!paymentMethod) return false;

    const codKeywords = [
      "cod",
      "cash on delivery",
      "cashondelivery",
    ];

    return codKeywords.some((keyword) =>
      paymentMethod.toLowerCase().includes(keyword)
    );
  }

  /**
   * Create COD verification record only.
   * WhatsApp message will be sent by Automation.
   */
  static async create(order: CodOrderInput) {
    if (!order.customerPhone) {
      console.warn(
        `[COD] No phone for order ${order.orderNumber}, skipping COD record creation`
      );
      return null;
    }

    const [existing] = await db
      .select()
      .from(codVerifications)
      .where(
        and(
          eq(codVerifications.platform, order.platform),
          eq(codVerifications.storeId, order.storeId),
          eq(codVerifications.orderId, order.orderId)
        )
      );

    if (existing) {
      return existing;
    }

    const [record] = await db
      .insert(codVerifications)
      .values({
        channelId: order.channelId,
        platform: order.platform,
        storeId: order.storeId,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customerPhone: order.customerPhone,
        customerName: order.customerName,
        totalPrice: order.totalPrice,
        status: "pending",
      })
      .returning();

    return record;
  }

  static async handleButtonReply(
    payload: string,
    fromPhone: string
  ) {
    const isConfirm = payload.startsWith("COD_CONFIRM_");
    const isCancel = payload.startsWith("COD_CANCEL_");

    if (!isConfirm && !isCancel) {
      return null;
    }

    const verificationId = payload
      .replace("COD_CONFIRM_", "")
      .replace("COD_CANCEL_", "");

    const newStatus = isConfirm
      ? "confirmed"
      : "cancelled";

    const [record] = await db
      .select()
      .from(codVerifications)
      .where(
        and(
          eq(codVerifications.id, verificationId),
          eq(
            codVerifications.customerPhone,
            fromPhone.replace(/\D/g, "")
          )
        )
      );

    if (!record || record.status !== "pending") {
      return null;
    }

    await db
      .update(codVerifications)
      .set({
        status: newStatus,
        respondedAt: new Date(),
      })
      .where(eq(codVerifications.id, record.id));



/**
 * Sync status with ecommerce platform
 */
if (record.platform === "shopify") {
  const store = await storage.getShopifyStoreById(record.storeId);

  if (store) {
    await ShopifyCodService.updateOrderTag(
      store.shopDomain,
      store.accessToken,
      record.orderId,
      newStatus
    );
  }
} else if (record.platform === "woocommerce") {
  const store = await storage.getWooCommerceStoreById(record.storeId);

  if (store) {
    await WooCommerceCodService.updateOrderStatus(
      store.storeUrl,
      store.consumerKey,
      store.consumerSecret,
      record.orderId,
      newStatus
    );
  }
}

return {
  ...record,
  status: newStatus,
  respondedAt: new Date(),
};




    // return {
    //   ...record,
    //   status: newStatus,
    // };
  }
}