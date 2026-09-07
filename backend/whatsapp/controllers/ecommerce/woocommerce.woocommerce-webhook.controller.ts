/**
 * WooCommerce Webhook Receiver — single entry point for all plugin events.
 * ---------------------------------------------------------------------
 * Route: POST /api/ecommerce/woocommerce/webhook   (PUBLIC — no auth middleware)
 *
 * Payload always includes: { storeId, secret, channelId, event, platform, ...data }
 * Verified via storeId + consumerSecret match (same as connectStore flow).
 */

import { Request, Response } from "express";
import { storage } from "../../storage";
import { randomUUID } from "crypto";
import { addMinutes, addHours, addDays } from "date-fns";
import { triggerService } from "../../services/ecommerce/automation-trigger.service";
import { CodVerificationService } from "../../services/ecommerce/cod-verification.service";

function isCompletePhoneNumber(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

class WooCommerceWebhookController {
  async handle(req: Request, res: Response) {
    try {
      const { storeId, secret, channelId, event } = req.body;

      console.log("WEBHOOK HIT");
      console.log(req.body);

      if (!storeId || !secret || !event) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
      }

      const store = await storage.getWooCommerceStoreById(storeId);
      if (!store || store.consumerSecret !== secret) {
        console.warn("[WooCommerce Webhook] Auth failed for storeId:", storeId);
        return res
          .status(401)
          .json({ success: false, message: "Invalid store credentials" });
      }

      console.log(
        `[WooCommerce Webhook] event="${event}" storeId=${storeId} channelId=${channelId}`,
        req.body,
      );

      switch (event) {
        case "customer.created":
        case "customer.updated": {
          const { customerId, email, phone, firstName, lastName } = req.body;
          if (!phone) break;

          await storage.findOrCreateContact({
            channelId,
            storeId,
            phone,
            email: email || "",
            name: `${firstName || ""} ${lastName || ""}`.trim(),
            createdBy: store.userId,
            externalId: String(customerId),
            source: "woocommerce",
          });
          break;
        }

        case "order.created":
        case "order.updated": {
          const {
            email,
            phone,
            customerName,
            cartToken,
            orderNumber,
            orderTotal,
            orderCurrency,
            orderStatus,
            paymentStatus,
            paymentMethod,
            paymentMethodTitle,
            isPaid: orderIsPaid,
            datePaid,
            trackingNumber,
            fulfillmentStatus,
          } = req.body;

          if (phone) {
            await storage.findOrCreateContact({
              channelId,
              storeId,
              phone,
              email: email || "",
              name: customerName || "",
              createdBy: store.userId,
              source: "woocommerce",
            });
          }

          // Order placed -> matching abandoned cart is no longer abandoned
          if (cartToken) {
            const cart = await storage.getAbandonedCartByToken(cartToken);
            if (cart && cart.status !== "completed") {
              await storage.updateAbandonedCart(cart.id, {
                status: "completed",
                completedAt: new Date(),
              });
            }
          }

          const resolvedPaymentMethod =
            paymentMethod || req.body.payment_method || "";

          const isCod = ["cod", "cash on delivery", "cashondelivery"].some(
            (keyword) => resolvedPaymentMethod.toLowerCase().includes(keyword),
          );

          const isCancelled =
            orderStatus === "cancelled" || req.body.status === "cancelled";

          const isPaid =
            orderIsPaid === true ||
            orderIsPaid === "true" ||
            paymentStatus === "paid";

          const commonTriggerData = {
            orderNumber: orderNumber ?? req.body.orderId ?? req.body.id ?? "",
            orderTotal:
              orderTotal ?? req.body.total ?? req.body.totalPrice ?? "",
            orderCurrency: orderCurrency ?? req.body.currency ?? "INR",
            orderStatus: orderStatus ?? req.body.status ?? "",
            paymentStatus: paymentStatus ?? "",
            trackingNumber: trackingNumber ?? "",
            fulfillmentStatus: fulfillmentStatus ?? "",
            customerName: customerName || "",
            customerEmail: email || "",
            customerPhone: phone || "",
            storeName: store.storeName || store.storeUrl || "",
          };

          if (event === "order.created") {
            // 1. Every order should trigger order_created
            await triggerService.executeTrigger({
              channelId,
              storeId,
              trigger: "order_created",
              triggerData: commonTriggerData,
            });

            // 2. COD orders should ALSO trigger order_cod_pending
            if (isCod && phone) {
              console.log(
                `[WooCommerce COD] COD order detected: ${commonTriggerData.orderNumber}`,
                {
                  paymentMethod: resolvedPaymentMethod,
                  paymentMethodTitle,
                  isPaid,
                },
              );

              const verification = await CodVerificationService.create({
                channelId,
                storeId,
                platform: "woocommerce",
                orderId: String(req.body.orderId ?? req.body.id ?? ""),
                orderNumber: commonTriggerData.orderNumber,
                customerPhone: commonTriggerData.customerPhone,
                customerName: commonTriggerData.customerName,
                totalPrice: commonTriggerData.orderTotal,
                currency: commonTriggerData.orderCurrency,
              });
              await triggerService.executeTrigger({
                channelId,
                storeId,
                trigger: "order_cod_pending",
                triggerData: {
                  ...commonTriggerData,
                  orderId: String(req.body.orderId ?? req.body.id ?? ""),
                  platform: "woocommerce",
                  paymentMethod: resolvedPaymentMethod,
                  paymentMethodTitle: paymentMethodTitle || "",
                  codVerificationId: verification?.id,
                },
              });
            }
          }

          // if (isPaid) {
          //   await triggerService.executeTrigger({
          //     channelId,
          //     storeId,
          //     trigger: "order_paid",
          //     triggerData: commonTriggerData,
          //   });
          // }

          if (event === "order.updated" && isPaid && !isCod) {
            console.log(
              `[WooCommerce] Paid non-COD order detected: ${commonTriggerData.orderNumber}`,
            );

            await triggerService.executeTrigger({
              channelId,
              storeId,
              trigger: "order_paid",
              triggerData: commonTriggerData,
            });
          }

          if (isCancelled) {
            await triggerService.executeTrigger({
              channelId,
              storeId,
              trigger: "order_cancelled",
              triggerData: commonTriggerData,
            });
          }

          break;
        }

        case "cart.updated": {
          const {
            cartToken,
            currency,
            subtotalPrice,
            totalPrice,
            productData,
          } = req.body;

          const cart = await storage.getAbandonedCartByToken(cartToken);
          if (cart) {
            await storage.updateAbandonedCart(cart.id, {
              currency,
              subtotalPrice,
              totalPrice,
              productData,
            });
          }
          break;
        }

        case "checkout.started": {
          break;
        }

        case "abandoned_cart": {
          const {
            cartToken,
            email,
            phone,
            customerName,
            currency,
            subtotalPrice,
            totalPrice,
            productData,
          } = req.body;

          // 1) Resolve/create contact and KEEP the id
          let contactId: string | null = null;
          if (isCompletePhoneNumber(phone)) {
            const contact = await storage.findOrCreateContact({
              channelId,
              storeId,
              phone,
              email: email || "",
              name: customerName || "",
              createdBy: store.userId,
              source: "woocommerce",
            });
            contactId = contact.id;
          } else if (phone) {
            console.log(
              `[WooCommerce Webhook] Ignoring incomplete phone "${phone}" — likely mid-typing, skipping contact create/update`,
            );
          }

          const existing = await storage.getAbandonedCartByToken(cartToken);
          const newProductData = Array.isArray(productData) ? productData : [];

          // 🆕 Same content-change detection as Shopify's abandoned-cart
          // service: tells us whether this is a genuinely new abandon cycle
          // (customer changed the cart) vs a duplicate/no-op webhook ping.
          const hasContentChanged =
            !!existing &&
            (JSON.stringify(existing.productData ?? []) !==
              JSON.stringify(newProductData) ||
              String(existing.totalPrice ?? "") !== String(totalPrice ?? ""));

          let cartId: string;
          const baseTime =
            !existing || hasContentChanged ? new Date() : existing.createdAt;

          if (existing) {
            await storage.updateAbandonedCart(existing.id, {
              contactId: contactId ?? existing.contactId ?? null,
              email: email || existing.email,
              phone: phone || existing.phone,
              customerName: customerName || existing.customerName,
              currency,
              subtotalPrice,
              totalPrice,
              productData: newProductData.length
                ? newProductData
                : existing.productData,
            });
            cartId = existing.id;
            console.log(
              `[WooCommerce Webhook] abandoned_cart UPDATED — cartToken=${cartToken} | contentChanged=${hasContentChanged}`,
            );
          } else {
            cartId = randomUUID();
            await storage.createAbandonedCart({
              id: cartId,
              storeId,
              channelId,
              contactId,
              checkoutToken: cartToken,
              cartToken,
              email: email || "",
              phone: phone || "",
              customerName: customerName || "",
              currency: currency || "INR",
              subtotalPrice: subtotalPrice ?? null,
              totalPrice,
              productData: newProductData,
              platform: "woocommerce",
              status: "pending",
              createdAt: baseTime,
            } as any);
            console.log(
              `[WooCommerce Webhook] abandoned_cart CREATED — cartToken=${cartToken}`,
            );
          }

          // 2) Schedule / reschedule reminders
          if (contactId) {
            const automations = await storage.getAutomationsByTrigger(
              channelId,
              "abandoned_cart",
            );
            console.log(
              `[WooCommerce Webhook] Active automations: ${automations.length}`,
            );

            for (const automation of automations) {
              const reminders = automation.triggerConfig?.reminders || [];

              for (const reminder of reminders) {
                let scheduledAt = baseTime;
                switch (reminder.unit) {
                  case "minutes":
                    scheduledAt = addMinutes(baseTime, reminder.delay);
                    break;
                  case "hours":
                    scheduledAt = addHours(baseTime, reminder.delay);
                    break;
                  case "days":
                    scheduledAt = addDays(baseTime, reminder.delay);
                    break;
                }

                const reminderExists = await storage.getAbandonedCartReminder(
                  cartId,
                  reminder.id,
                );

                if (!reminderExists) {
                  await storage.createAbandonedCartReminder({
                    cartId,
                    automationId: automation.id,
                    reminderId: reminder.id,
                    templateNodeId: reminder.templateNodeId,
                    scheduledAt,
                    status: "pending",
                  });

                  console.log(
                    `[WooCommerce Webhook] Reminder scheduled (${reminder.delay} ${reminder.unit})`,
                  );
                  continue;
                }

                // Reminder row already exists — only touch it if cart
                // content actually changed. Unchanged (duplicate/no-op
                // webhook ping) means leave it exactly as-is.
                if (hasContentChanged) {
                  if (reminderExists.status === "pending") {
                    await storage.updateAbandonedCartReminder(
                      reminderExists.id,
                      { scheduledAt },
                    );
                    console.log(
                      `[WooCommerce Webhook] Reminder rescheduled (${reminder.delay} ${reminder.unit})`,
                    );
                  } else {
                    // Terminal state (sent/skipped/failed) — customer
                    // modified the cart again after this reminder already
                    // finished, so this is a genuinely new abandon cycle.
                    await storage.updateAbandonedCartReminder(
                      reminderExists.id,
                      {
                        scheduledAt,
                        status: "pending",
                        sentAt: null,
                        error: null,
                      },
                    );
                    console.log(
                      `[WooCommerce Webhook] Reminder reset to pending & rescheduled (${reminder.delay} ${reminder.unit})`,
                    );
                  }
                }
              }
            }
          } else {
            console.log(
              "[WooCommerce Webhook] No contactId resolved — skipping reminder scheduling (no phone on payload?)",
            );
          }

          break;
        }

        case "abandoned_cart.completed": {
          const { cartToken } = req.body;
          const cart = await storage.getAbandonedCartByToken(cartToken);
          if (cart && cart.status !== "completed") {
            await storage.updateAbandonedCart(cart.id, {
              status: "completed",
              completedAt: new Date(),
            });
          }
          break;
        }

        default:
          console.warn("[WooCommerce Webhook] Unknown event:", event);
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error("[WooCommerce Webhook] error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

export const woocommerceWebhookController = new WooCommerceWebhookController();

/*
  routes.ts — add this ONE route, no auth middleware:

  import { woocommerceWebhookController } from "./controllers/ecommerce/woocommerce-webhook.controller";

  router.post(
    "/api/whatsapp/ecommerce/woocommerce/webhook",
    woocommerceWebhookController.handle
  );
*/
