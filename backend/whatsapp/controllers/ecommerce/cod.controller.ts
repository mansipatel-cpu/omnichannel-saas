import { Request, Response } from "express";
import { storage } from "../../storage";
import { ShopifyCodService } from "../../services/ecommerce/shopify-cod.service";
import { WooCommerceCodService } from "../../services/ecommerce/woocommerce-cod.service";
import { db } from "../../db";
import { codVerifications } from "@shared/whatsapp-schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";

class CodController {
  private async pushStatus(orderId: string, platform: string, storeId: string, status: "confirmed" | "cancelled") {
    if (platform === "shopify") {
      const store = await storage.getShopifyStoreById(storeId);
      if (!store) throw new Error("Shopify store not found");
      await ShopifyCodService.updateOrderTag(store.shopDomain, store.accessToken, orderId, status);
    } else {
      const store = await storage.getWooCommerceStoreById(storeId);
      if (!store) throw new Error("WooCommerce store not found");
      await WooCommerceCodService.updateOrderStatus(
        store.storeUrl, store.consumerKey, store.consumerSecret, orderId, status
      );
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const { orderId, platform, storeId } = req.body;
      if (!orderId || !platform || !storeId) {
        return res.status(400).json({ success: false, message: "Missing orderId/platform/storeId" });
      }
      await this.pushStatus(orderId, platform, storeId, "confirmed");
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[COD confirm] error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  cancel = async (req: Request, res: Response) => {
    try {
      const { orderId, platform, storeId } = req.body;
      if (!orderId || !platform || !storeId) {
        return res.status(400).json({ success: false, message: "Missing orderId/platform/storeId" });
      }
      await this.pushStatus(orderId, platform, storeId, "cancelled");
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[COD cancel] error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };





   getVerifications = async (req: Request, res: Response) => {
    try {
      const channelId = req.query.channelId as string;
      const search = (req.query.search as string) || "";
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const offset = (page - 1) * limit;

      if (!channelId) {
        return res.status(400).json({ success: false, message: "channelId is required" });
      }

      const searchCondition = search
        ? or(
            ilike(codVerifications.customerName, `%${search}%`),
            ilike(codVerifications.customerPhone, `%${search}%`),
            ilike(codVerifications.orderNumber, `%${search}%`)
          )
        : undefined;

      const whereClause = searchCondition
        ? and(eq(codVerifications.channelId, channelId), searchCondition)
        : eq(codVerifications.channelId, channelId);

      const [rows, totalRow, pendingRow, confirmedRow, cancelledRow] = await Promise.all([
        db
          .select()
          .from(codVerifications)
          .where(whereClause)
          .orderBy(desc(codVerifications.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(codVerifications).where(eq(codVerifications.channelId, channelId)),
        db.select({ count: sql<number>`count(*)` }).from(codVerifications).where(and(eq(codVerifications.channelId, channelId), eq(codVerifications.status, "pending"))),
        db.select({ count: sql<number>`count(*)` }).from(codVerifications).where(and(eq(codVerifications.channelId, channelId), eq(codVerifications.status, "confirmed"))),
        db.select({ count: sql<number>`count(*)` }).from(codVerifications).where(and(eq(codVerifications.channelId, channelId), eq(codVerifications.status, "cancelled"))),
      ]);

      return res.json({
        success: true,
        data: rows,
        stats: {
          total: Number(totalRow[0]?.count || 0),
          pending: Number(pendingRow[0]?.count || 0),
          confirmed: Number(confirmedRow[0]?.count || 0),
          cancelled: Number(cancelledRow[0]?.count || 0),
        },
        page,
        limit,
      });
    } catch (error: any) {
      console.error("[COD getVerifications] error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };
}

export const codController = new CodController();
