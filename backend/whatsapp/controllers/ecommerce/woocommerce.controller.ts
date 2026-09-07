import { Request, Response } from "express";
import { storage } from "../../storage";
import { WooCommerceService } from "../../services/ecommerce/woocommerce.service";
import { createDefaultEcommerceTemplates } from "../../services/ecommerce/ecommerce-template.service";
import path from "path";
import fs from "fs";

class WooCommerceController {
  async connectStore(req: Request, res: Response) {
    try {
      const { channelId, storeUrl, consumerKey, consumerSecret } = req.body;

      const userId = req.user.id;

      if (!channelId || !storeUrl || !consumerKey || !consumerSecret) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      // Verify WooCommerce connection
      const info = await WooCommerceService.verifyConnection(
        storeUrl,
        consumerKey,
        consumerSecret,
      );

      // Only one WooCommerce store per channel
      const existing = await storage.getWooCommerceStoresByUser(
        userId,
        channelId,
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "A WooCommerce store is already connected to this channel.",
        });
      }

      const store = await storage.createWooCommerceStore({
        userId,
        channelId,
        storeName: info.environment.site_title,
        storeUrl,
        consumerKey,
        consumerSecret,
        isActive: true,
      });

      // Automatically sync customers
      // Automatically sync customers after store connection
      const customers = await WooCommerceService.getCustomers(
        storeUrl,
        consumerKey,
        consumerSecret,
      );

      console.log("Customers Count:", customers.length);
      console.log("Customers:", customers);

      let imported = 0;

      for (const customer of customers) {
        const phone = customer.billing?.phone?.trim();

        console.log("Customer:", {
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          email: customer.email,
          phone: customer.billing?.phone,
        });

        // Skip customers without phone
        if (!phone) continue;

        await storage.findOrCreateContact({
          channelId,
          storeId: store.id,
          phone,
          email: customer.email || "",
          name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
          createdBy: userId,
          externalId: String(customer.id),
          source: "woocommerce",
        });

        imported++;
      }

      // return res.json({
      //   success: true,
      //   data: store,
      // });


      const channel = await storage.getChannel(channelId);

if (channel) {
  await createDefaultEcommerceTemplates(channel, userId);
}

      return res.json({
        success: true,
        data: store,
        syncedCustomers: imported,
        message: `WooCommerce store connected successfully. ${imported} customers synced.`,
      });
    } catch (error: any) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: error.response?.data?.message || error.message,
      });
    }
  }

  async getStores(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const channelId = req.query.channelId as string;

      const stores = await storage.getWooCommerceStoresByUser(
        userId,
        channelId,
      );

      return res.json({
        success: true,
        data: stores,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
      });
    }
  }

  async deleteStore(req: Request, res: Response) {
    try {
      await storage.deleteWooCommerceStore(req.params.id);

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
      });
    }
  }

  async syncCustomers(req: Request, res: Response) {
    try {
      const store = await storage.getWooCommerceStoreById(req.params.id);

      if (!store) {
        return res.status(404).json({
          success: false,
          message: "Store not found",
        });
      }

      const result = await WooCommerceService.syncCustomers(store);

      await storage.updateWooCommerceStore(store.id, {
        lastSyncedAt: new Date(),
      });

      return res.json({
        success: true,
        ...result,
        message: `${result.imported} customers synced successfully.`,
      });
    } catch (error: any) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async download(req: Request, res: Response) {
    const filePath = path.join(
      process.cwd(),
      "server",
      "assets",
      "whatsway-woo-connector.zip",
    );

    if (!fs.existsSync(filePath)) {
      console.error("[Plugin Download] File not found at:", filePath);
      return res.status(404).json({
        success: false,
        message: "Plugin file not found on server. Contact support.",
      });
    }

    res.download(filePath, "whatsway-woo-connector.zip", (err) => {
      if (err) {
        console.error("[Plugin Download] error:", err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Download failed" });
        }
      }
    });
  }
}

export const woocommerceController = new WooCommerceController();
