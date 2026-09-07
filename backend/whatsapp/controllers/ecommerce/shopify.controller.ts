import { Request, Response } from "express";
import crypto from "crypto";
import { shopifyOAuthService } from "../../services/ecommerce/shopify-oauth.service";
import { triggerService } from "../../services/ecommerce/automation-trigger.service";
import { storage } from "../../storage";
import { shopifyCustomerService } from "../../services/ecommerce/shopify-customer.service";
import { abandonedCartService } from "../../services/ecommerce/abandoned-cart.service";
import { CodVerificationService } from "../../services/ecommerce/cod-verification.service";
import { createDefaultEcommerceTemplates } from "../../services/ecommerce/ecommerce-template.service";

import axios from "axios";

export class ShopifyController {
  async install(req: Request, res: Response) {
    try {
      const { shop, channelId } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          message: "Shop is required",
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const normalizedShop = shopifyOAuthService.normalizeShopDomain(
        String(shop),
      );

      if (!shopifyOAuthService.isValidShopDomain(normalizedShop)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid shop domain. Use the format: your-store.myshopify.com",
        });
      }

      const state = Buffer.from(
        JSON.stringify({
          userId: req.user.id,
          channelId,
        }),
      ).toString("base64");

      const url = await shopifyOAuthService.generateInstallUrl(
        normalizedShop,
        state,
      );

      return res.redirect(url);
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
      });
    }
  }

  async callback(req: Request, res: Response) {
    try {
      const { shop, code, state } = req.query;

      if (!shop || !code) {
        return res.status(400).json({
          success: false,
          query: req.query,
          message: "Missing shop or code",
        });
      }

      const shopDomain = String(shop);

      // 1. Exchange code for access token
      const tokenResponse = await shopifyOAuthService.exchangeCodeForToken(
        shopDomain,
        String(code),
      );

      // 2. Save store + token
      const stateData = JSON.parse(
        Buffer.from(String(state), "base64").toString(),
      );

      const store = await shopifyOAuthService.saveStore({
        userId: stateData.userId,
        channelId: stateData.channelId,
        shopDomain,
        accessToken: tokenResponse.access_token,
        scope: tokenResponse.scope,
      });

      // 3. Register required webhooks (non-blocking for the redirect,
      //    but we await it so we can surface failures in logs immediately)
      const webhookResults = await shopifyOAuthService.registerWebhooks(
        shopDomain,
        tokenResponse.access_token,
      );

      console.log("WEBHOOK REGISTRATION RESULTS =>", webhookResults);

      await shopifyCustomerService.syncStoreCustomers(store.id);

      const channel = await storage.getChannel(store.channelId!);

if (channel) {
  await createDefaultEcommerceTemplates(channel, stateData.userId);
}

      const clientUrl = process.env.CLIENT_URL;

      return res.redirect(`/ecommerce/stores`);
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
      });
    }
  }

  async getStores(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const channelId = req.query.channelId as string;

    const stores = await storage.getShopifyStoresByUser(
      userId,
      channelId
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

  /**
   * Verifies the X-Shopify-Hmac-Sha256 header against the raw request body.
   * Requires the raw body to be available on req (see route setup notes).
   * Client secret is fetched from DB settings (same source used for OAuth),
   * not from .env, since settings are now configured via the Settings UI.
   */
  private async verifyWebhookHmac(req: Request): Promise<boolean> {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    if (!hmacHeader) return false;

    const rawBody = (req as any).rawBody;
    if (!rawBody) return false;

    const settings = await storage.getEcommerceSettings("shopify");
    if (!settings?.clientSecret) {
      console.error(
        "Cannot verify webhook HMAC: Shopify client secret not configured in DB",
      );
      return false;
    }

    const generatedHash = crypto
      .createHmac("sha256", settings.clientSecret)
      .update(rawBody)
      .digest("base64");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(generatedHash),
        Buffer.from(hmacHeader),
      );
    } catch {
      // Buffer length mismatch also means invalid signature
      return false;
    }
  }

  private handleWebhook(topic: string) {
    return async (req: Request, res: Response) => {
      try {
        console.log("=================================");
        console.log("WEBHOOK RECEIVED");
        console.log("TOPIC =>", topic);
        console.log("SHOP =>", req.get("X-Shopify-Shop-Domain"));
        console.log("BODY =>", req.body);
        console.log("=================================");
        if (!(await this.verifyWebhookHmac(req))) {
          console.warn(`Webhook HMAC verification failed for topic: ${topic}`);
          return res.status(401).send("Invalid HMAC");
        }

        const shopDomain = req.get("X-Shopify-Shop-Domain");
        console.log(`Webhook received [${topic}] from ${shopDomain}`);

        // NOTE: every case below is wrapped in its own block ({ ... }).
        // Without that, `const`/`let` declared in one case is hoisted
        // (in TDZ) across the *entire* switch block, since a switch
        // statement is normally a single shared lexical scope. That was
        // the root cause of the "Cannot access 'store' before
        // initialization" crash: a `const store` declared inside the
        // `customers/create` case (previously brace-less) got hoisted
        // into the shared scope, and the `orders/create` case below it
        // referenced that same TDZ'd binding instead of declaring its
        // own. Keep every case braced to avoid this class of bug.
        switch (topic) {
          case "customers/create": {
            console.log("CUSTOMER WEBHOOK PAYLOAD", req.body);

            await shopifyCustomerService.handleCustomerCreate(
              shopDomain!,
              req.body,
            );

            const store = await storage.getShopifyStoreByDomain(shopDomain!);

            if (store) {
              await triggerService.executeTrigger({
                channelId: store.channelId!,
                storeId: store.id,
                trigger: "customer_created",
                triggerData: {
                  customerName:
                    `${req.body.first_name ?? ""} ${req.body.last_name ?? ""}`.trim(),
                  customerFirstName: req.body.first_name,
                  customerLastName: req.body.last_name,
                  customerEmail: req.body.email,
                  customerPhone:
                    req.body.phone || req.body.default_address?.phone,
                  externalId: String(req.body.id),
                  storeDomain: shopDomain,
                   // ✅ ADD THIS
                  storeName: store.storeName || store.shopName || shopDomain,
                },
              });
            }
            break;
          }
          case "orders/updated": {
            const store = await storage.getShopifyStoreByDomain(shopDomain!);

            if (!store) break;

            if (req.body.financial_status === "paid") {
              await triggerService.executeTrigger({
                channelId: store.channelId!,
                storeId: store.id,
                trigger: "order_paid",
                triggerData: {
                  orderNumber: req.body.name,
                  orderTotal: req.body.total_price,
                  orderCurrency: req.body.currency,
                  paymentStatus: req.body.financial_status,
                  customerName:
                    `${req.body.customer?.first_name ?? ""} ${req.body.customer?.last_name ?? ""}`.trim(),
                  customerEmail: req.body.email,
                  customerPhone:
                    req.body.phone || req.body.billing_address?.phone,
                   // ✅ ADD THIS
                  storeName: store.storeName || store.shopName || shopDomain,  
                },
              });
            }

            if (req.body.cancelled_at) {
              await triggerService.executeTrigger({
                channelId: store.channelId!,
                storeId: store.id,
                trigger: "order_cancelled",
                triggerData: {
                  orderNumber: req.body.name,
                  cancelReason: req.body.cancel_reason,
                  customerName:
                    `${req.body.customer?.first_name ?? ""} ${req.body.customer?.last_name ?? ""}`.trim(),
                  customerEmail: req.body.email,
                  customerPhone:
                    req.body.phone || req.body.billing_address?.phone,
                   // ✅ ADD THIS
                  storeName: store.storeName || store.shopName || shopDomain,  
                },
              });
            }

            break;
          }
          case "orders/fulfilled": {
            const store = await storage.getShopifyStoreByDomain(shopDomain!);

            if (!store) break;

            await triggerService.executeTrigger({
              channelId: store.channelId!,
              storeId: store.id,
              trigger: "order_fulfilled",
              triggerData: {
                orderNumber: req.body.name,
                trackingNumber:
                  req.body.fulfillments?.[0]?.tracking_number || "",
                fulfillmentStatus: req.body.fulfillment_status,
                customerName:
                  `${req.body.customer?.first_name ?? ""} ${req.body.customer?.last_name ?? ""}`.trim(),
                customerEmail: req.body.email,
                customerPhone:
                  req.body.phone || req.body.billing_address?.phone,
                 // ✅ ADD THIS
                storeName: store.storeName || store.shopName || shopDomain,  
              },
            });

            break;
          }
          case "checkouts/create": {
            console.log(JSON.stringify(req.body, null, 2));

            await abandonedCartService.handleCheckout(shopDomain!, req.body);
            break;
          }
          case "checkouts/update": {
            console.log(JSON.stringify(req.body, null, 2));
            await abandonedCartService.handleCheckout(shopDomain!, req.body);
            break;
          }

          case "orders/create": {
            await abandonedCartService.handleOrderCreated(
              shopDomain!,
              req.body,
            );

            const store = await storage.getShopifyStoreByDomain(shopDomain!);

            if (store) {
              await triggerService.executeTrigger({
                channelId: store.channelId!,
                storeId: store.id,
                trigger: "order_created",
                triggerData: {
                  orderNumber: req.body.name,
                  orderTotal: req.body.total_price,
                  orderCurrency: req.body.currency,
                  orderStatus: req.body.fulfillment_status,
                  paymentStatus: req.body.financial_status,

                  customerName:
                    `${req.body.customer?.first_name ?? ""} ${req.body.customer?.last_name ?? ""}`.trim(),

                  customerFirstName: req.body.customer?.first_name,

                  customerLastName: req.body.customer?.last_name,

                  customerEmail: req.body.email,

                  customerPhone:
                    req.body.phone ||
                    req.body.customer?.phone ||
                    req.body.billing_address?.phone,

                  trackingNumber:
                    req.body.fulfillments?.[0]?.tracking_number || "",

                  fulfillmentStatus: req.body.fulfillment_status,

                  storeDomain: shopDomain,
                   // ✅ ADD THIS
                  storeName: store.storeName || store.shopName || shopDomain,
                },
              });


              
   // 👇 NEW — COD trigger (agar payment method COD hai)
const paymentMethod = req.body.payment_gateway_names?.[0] || req.body.gateway || "";
// const isCod = ["cod", "cash on delivery", "cashondelivery"].some(k =>
//   paymentMethod.toLowerCase().includes(k)
// );

const isCod = CodVerificationService.isCod(paymentMethod);

if (isCod) {

   // Create COD verification record
  await CodVerificationService.create({
    channelId: store.channelId!,
    storeId: store.id,
    platform: "shopify",
    orderId: String(req.body.id),
    orderNumber: req.body.name,
    customerPhone:
      req.body.phone ||
      req.body.customer?.phone ||
      req.body.billing_address?.phone,
    customerName:
      `${req.body.customer?.first_name ?? ""} ${req.body.customer?.last_name ?? ""}`.trim(),
    totalPrice: req.body.total_price,
    currency: req.body.currency,
  });
  await triggerService.executeTrigger({
    channelId: store.channelId!,
    storeId: store.id,
    trigger: "order_cod_pending",
    triggerData: {
      orderId: String(req.body.id),
      orderNumber: req.body.name,
      orderTotal: req.body.total_price,
      orderCurrency: req.body.currency,
      platform: "shopify",
      customerName: `${req.body.customer?.first_name ?? ""} ${req.body.customer?.last_name ?? ""}`.trim(),
      customerPhone: req.body.phone || req.body.customer?.phone || req.body.billing_address?.phone,
      storeName: store.storeName || store.shopName || shopDomain,
    },
  });
}
  }
  break;
}
          case "products/update": {
            // await productSyncService.handle(shopDomain, req.body);
            break;
          }
        }

        return res.status(200).send("OK");
      } catch (error) {
        console.error(`Error handling webhook [${topic}]`, error);
        return res.status(500).send("Webhook handler error");
      }
    };
  }

  async disconnect(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const store = await storage.getShopifyStoreById(id);

      if (!store) {
        return res.status(404).json({
          success: false,
          message: "Store not found",
        });
      }

      if (store.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        });
      }

      await shopifyOAuthService.disconnectStore(id);

      return res.json({
        success: true,
        message: "Store disconnected",
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
      const { id } = req.params;

      const store = await storage.getShopifyStoreById(id);

      if (!store) {
        return res.status(404).json({
          success: false,
        });
      }

      const webhooks = await axios.get(
        `https://${store.shopDomain}/admin/api/2026-04/webhooks.json`,
        {
          headers: {
            "X-Shopify-Access-Token": store.accessToken,
          },
        },
      );

      console.log(
        "SHOPIFY WEBHOOKS =>",
        JSON.stringify(webhooks.data, null, 2),
      );

      const customers = await shopifyOAuthService.getCustomers(
        store.shopDomain,
        store.accessToken,
      );

      let synced = 0;




for (const customer of customers) {
  const phone = customer.phone || customer.default_address?.phone;

  if (!phone) continue;

  // Check by phone
  const existing = await storage.findContactByPhone(
    store.channelId,
    phone
  );

  // Contact already exists → skip
  if (existing) {
    console.log(
      `Contact already exists (${phone}). Skipping...`
    );
    continue;
  }

  // Create only if phone doesn't exist
  await storage.createContact({
    channelId: store.channelId,
    name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
    phone,
    email: customer.email,
    source: "shopify",
    storeId: store.id,
    externalId: String(customer.id),
    createdBy: store.userId,
  });

  synced++;
}


await storage.updateShopifyStore(store.id, { lastSyncedAt: new Date() });

      return res.json({
        success: true,
        synced,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
      });
    }
  }




async getAbandonedCarts(req: Request, res: Response) {
  try {
    const channelId = req.query.channelId as string;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    if (!channelId) {
      return res.status(400).json({
        success: false,
        message: "channelId is required",
      });
    }

    const result = await storage.getAbandonedCartsWithReminders(
      channelId,   // 👈 NEW — pass channelId through
      page,
      limit
    );

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
    });
  }
}

  async getAbandonedCart(req: Request, res: Response) {
    try {
      const cart = await storage.getAbandonedCartById(req.params.id);

      if (!cart) {
        return res.status(404).json({
          success: false,
          message: "Cart not found",
        });
      }

      return res.json({
        success: true,
        data: cart,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
      });
    }
  }

  ordersCreateWebhook = this.handleWebhook("orders/create");
  ordersUpdatedWebhook = this.handleWebhook("orders/updated");
  ordersFulfilledWebhook = this.handleWebhook("orders/fulfilled");
  customersCreateWebhook = this.handleWebhook("customers/create");
  checkoutsCreateWebhook = this.handleWebhook("checkouts/create");
  checkoutsUpdateWebhook = this.handleWebhook("checkouts/update");
  productsUpdateWebhook = this.handleWebhook("products/update");
}

export const shopifyController = new ShopifyController();