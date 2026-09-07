// import { randomUUID } from "crypto";
// import { storage } from "../../storage";
// import { triggerService } from "../automation-execution-service";
// import { addMinutes, addHours, addDays } from "date-fns";

// export class AbandonedCartService {
//   async handleCheckout(shopDomain: string, checkout: any) {
//     try {
//       const store = await storage.getShopifyStoreByDomain(shopDomain);

//       if (!store) {
//         console.log("Store not found:", shopDomain);
//         return;
//       }

//       const phone =
//         checkout.phone ||
//         checkout.shipping_address?.phone ||
//         checkout.billing_address?.phone;

//       const email = checkout.email;

//       if (!phone && !email) {
//         console.log("No phone/email found for checkout");
//         return;
//       }

//       const customerName =
//         checkout.shipping_address?.name || checkout.billing_address?.name || "";

//       /**
//        * Create / Update Contact
//        */
//       let contactId: string | null = null;

//       if (phone) {
//         const contact = await storage.findOrCreateContact({
//           channelId: store.channelId!,
//           storeId: store.id,
//           phone,
//           email,
//           name: customerName,
//           createdBy: store.userId, // ya store.userId
//           externalId: String(checkout.customer?.id ?? ""),
//         });

//         contactId = contact.id;
//       }


//       console.log("========== SHOPIFY CHECKOUT ==========");
// console.log({
//   checkoutId: checkout.id,
//   checkoutToken: checkout.token,
//   cartToken: checkout.cart_token,
//   createdAt: checkout.created_at,
//   updatedAt: checkout.updated_at,
//   email: checkout.email,
// });

//       const existing = await storage.getAbandonedCartByToken(checkout.token);

//       console.log("========== EXISTING CART ==========");
// console.log({
//   checkoutToken: checkout.token,
//   existingCartId: existing?.id,
//   existingCheckoutToken: existing?.checkoutToken,
//   existingCartToken: existing?.cartToken,
//   existingCreatedAt: existing?.createdAt,
// });

//       const productData =
//         checkout.line_items?.map((item: any) => ({
//           productId: item.product_id,
//           variantId: item.variant_id,
//           title: item.title,
//           variantTitle: item.variant_title,
//           vendor: item.vendor,
//           sku: item.sku,
//           quantity: item.quantity,
//           price: item.price,
//           image: item.image_url || item.image?.src || null,
//           productUrl: item.product_url || null,
//         })) || [];

//       const payload = {
//         storeId: store.id,
//         channelId: store.channelId!,
//         contactId,

//         checkoutToken: checkout.token,
//         cartToken: checkout.cart_token,

//         phone,
//         email,
//         customerName,

//         abandonedCheckoutUrl: checkout.abandoned_checkout_url,

//         platform: "shopify",

//         totalPrice: checkout.total_price,
//         currency: checkout.currency,

//         productData,

//         status: checkout.completed_at ? "completed" : "pending",

//         updatedAt: new Date(),
//       };

//       let cartId: string;
//       const baseTime = existing?.createdAt ?? new Date();

//       if (existing) {
//         console.log("🟡 Updating existing cart:", existing.id);
//         await storage.updateAbandonedCart(existing.id, payload);

//         cartId = existing.id;

//         console.log("[abandoned_cart] Updated:", cartId);
//       } else {
//          console.log("🟢 Creating new cart");
//         cartId = randomUUID();

//         await storage.createAbandonedCart({
//           id: cartId,
//           createdAt: baseTime,
//           ...payload,
//         });

//         console.log("[abandoned_cart] Created:", cartId);
//       }

//       /**
//        * Schedule reminders
//        */
//       if (!checkout.completed_at && contactId) {
//         const automations = await storage.getAutomationsByTrigger(
//           store.channelId!,
//           "abandoned_cart",
//         );

//         console.log(
//           `[abandoned_cart] Active automations: ${automations.length}`,
//         );

//         for (const automation of automations) {
//           const reminders = automation.triggerConfig?.reminders || [];

//           for (const reminder of reminders) {
//             const reminderExists = await storage.getAbandonedCartReminder(
//               cartId,
//               reminder.id,
//             );

//             if (reminderExists) {
//               continue;
//             }

//             let scheduledAt = baseTime;

//             switch (reminder.unit) {
//               case "minutes":
//                 scheduledAt = addMinutes(baseTime, reminder.delay);
//                 break;

//               case "hours":
//                 scheduledAt = addHours(baseTime, reminder.delay);
//                 break;

//               case "days":
//                 scheduledAt = addDays(baseTime, reminder.delay);
//                 break;
//             }

//             console.log({
//               baseTime,
//               scheduledAt,
//               delay: reminder.delay,
//               unit: reminder.unit,
//             });

//             await storage.createAbandonedCartReminder({
//               cartId,
//               automationId: automation.id,
//               reminderId: reminder.id,
//               templateNodeId: reminder.templateNodeId,
//               scheduledAt,
//               status: "pending",
//             });

//             console.log(
//               `[abandoned_cart] Reminder scheduled (${reminder.delay} ${reminder.unit})`,
//             );
//           }
//         }
//       }
//     } catch (error) {
//       console.error("[abandoned_cart] Checkout error:", error);
//     }
//   }

//   async handleOrderCreated(shopDomain: string, order: any) {
//     const cart = await storage.getAbandonedCartByToken(order.checkout_token);

//     if (!cart) {
//       return;
//     }

//     await storage.updateAbandonedCart(cart.id, {
//       status: "completed",
//       completedAt: new Date(),
//     });

//     console.log("Abandoned cart completed:", cart.id);

//     await storage.markCartRemindersSkipped(cart.id);
//   }
// }

// export const abandonedCartService = new AbandonedCartService();






// abandoned-cart.service.ts

import { randomUUID } from "crypto";
import { storage } from "../../storage";
import { triggerService } from "../automation-execution-service";
import { addMinutes, addHours, addDays } from "date-fns";

export class AbandonedCartService {
  async handleCheckout(shopDomain: string, checkout: any) {
    try {
      const store = await storage.getShopifyStoreByDomain(shopDomain);

      if (!store) {
        console.log("Store not found:", shopDomain);
        return;
      }

      const phone =
        checkout.phone ||
        checkout.shipping_address?.phone ||
        checkout.billing_address?.phone;

      const email = checkout.email;

      if (!phone && !email) {
        console.log("No phone/email found for checkout");
        return;
      }

      const customerName =
        checkout.shipping_address?.name || checkout.billing_address?.name || "";

      /**
       * Create / Update Contact
       */
      let contactId: string | null = null;

      if (phone) {
        const contact = await storage.findOrCreateContact({
          channelId: store.channelId!,
          storeId: store.id,
          phone,
          email,
          name: customerName,
          createdBy: store.userId, // ya store.userId
          externalId: String(checkout.customer?.id ?? ""),
        });

        contactId = contact.id;
      }

      console.log("========== SHOPIFY CHECKOUT ==========");
      console.log({
        checkoutId: checkout.id,
        checkoutToken: checkout.token,
        cartToken: checkout.cart_token,
        createdAt: checkout.created_at,
        updatedAt: checkout.updated_at,
        email: checkout.email,
      });

      const existing = await storage.getAbandonedCartByToken(checkout.token);

      console.log("========== EXISTING CART ==========");
      console.log({
        checkoutToken: checkout.token,
        existingCartId: existing?.id,
        existingCheckoutToken: existing?.checkoutToken,
        existingCartToken: existing?.cartToken,
        existingCreatedAt: existing?.createdAt,
      });

      const productData =
        checkout.line_items?.map((item: any) => ({
          productId: item.product_id,
          variantId: item.variant_id,
          title: item.title,
          variantTitle: item.variant_title,
          vendor: item.vendor,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
          image: item.image_url || item.image?.src || null,
          productUrl: item.product_url || null,
        })) || [];

      /**
       * 🔑 Detect if cart CONTENT actually changed since last webhook.
       * This tells us whether this is a fresh "abandon cycle" (customer
       * modified cart) vs just a duplicate/no-op ping from Shopify.
       */
      const hasContentChanged =
        !!existing &&
        (JSON.stringify(existing.productData ?? []) !==
          JSON.stringify(productData) ||
          String(existing.totalPrice ?? "") !==
            String(checkout.total_price ?? ""));

      // 🔍 TEMP DEBUG — remove once root cause confirmed
      console.log("========== CONTENT CHANGE CHECK ==========");
      console.log({
        hasExisting: !!existing,
        existingTotalPrice: existing?.totalPrice,
        newTotalPrice: checkout.total_price,
        totalPriceChanged:
          String(existing?.totalPrice ?? "") !==
          String(checkout.total_price ?? ""),
        existingProductData: JSON.stringify(existing?.productData ?? []),
        newProductData: JSON.stringify(productData),
        productDataChanged:
          JSON.stringify(existing?.productData ?? []) !==
          JSON.stringify(productData),
        hasContentChanged,
      });

      const payload = {
        storeId: store.id,
        channelId: store.channelId!,
        contactId,

        checkoutToken: checkout.token,
        cartToken: checkout.cart_token,

        phone,
        email,
        customerName,

        abandonedCheckoutUrl: checkout.abandoned_checkout_url,

        platform: "shopify",

        totalPrice: checkout.total_price,
        currency: checkout.currency,

        productData,

        status: checkout.completed_at ? "completed" : "pending",

        updatedAt: new Date(),
      };

      let cartId: string;

      /**
       * 🔑 baseTime: naya cart ho ya existing cart ka content change ho,
       * to "abandon clock" fresh se start hoga (current time).
       * Same content ka duplicate webhook ping ho, to purana createdAt
       * hi use hoga.
       */
      const baseTime =
        !existing || hasContentChanged ? new Date() : existing.createdAt;

      if (existing) {
        console.log(
          "🟡 Updating existing cart:",
          existing.id,
          "| contentChanged:",
          hasContentChanged,
        );

        await storage.updateAbandonedCart(existing.id, payload);

        cartId = existing.id;

        console.log("[abandoned_cart] Updated:", cartId);
      } else {
        console.log("🟢 Creating new cart");
        cartId = randomUUID();

        await storage.createAbandonedCart({
          id: cartId,
          createdAt: baseTime,
          ...payload,
        });

        console.log("[abandoned_cart] Created:", cartId);
      }

      /**
       * Schedule / Reschedule reminders
       *
       * Strategy:
       * - Ek cart ke liye, har configured reminder ki sirf EK row hoti hai
       *   (no duplicates, no row explosion on repeated cart edits).
       * - Reminder na ho to create karo.
       * - Reminder ho aur abhi tak "pending" hai aur content change hua hai,
       *   to usi row ka scheduledAt update (reschedule) karo.
       * - Reminder already "sent" ho gaya hai, to use kabhi touch nahi karenge
       *   (history safe rehti hai, duplicate message nahi jayega).
       */
      if (!checkout.completed_at && contactId) {
        const automations = await storage.getAutomationsByTrigger(
          store.channelId!,
          "abandoned_cart",
        );

        console.log(
          `[abandoned_cart] Active automations: ${automations.length}`,
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
              // First time this reminder is being scheduled for this cart
              console.log({
                action: "create",
                baseTime,
                scheduledAt,
                delay: reminder.delay,
                unit: reminder.unit,
                reminderId: reminder.id,
              });

              await storage.createAbandonedCartReminder({
                cartId,
                automationId: automation.id,
                reminderId: reminder.id,
                templateNodeId: reminder.templateNodeId,
                scheduledAt,
                status: "pending",
              });

              console.log(
                `[abandoned_cart] Reminder scheduled (${reminder.delay} ${reminder.unit})`,
              );

              continue;
            }

            // Reminder row already exists for this cart.
            // Only touch it if cart content actually changed — content
            // unchanged (duplicate/no-op webhook ping) means leave it alone.
            if (hasContentChanged) {
              if (reminderExists.status === "pending") {
                // Not sent yet — just push its scheduled time forward.
                console.log({
                  action: "reschedule",
                  baseTime,
                  scheduledAt,
                  delay: reminder.delay,
                  unit: reminder.unit,
                  reminderId: reminder.id,
                });

                await storage.updateAbandonedCartReminder(reminderExists.id, {
                  scheduledAt,
                });

                console.log(
                  `[abandoned_cart] Reminder rescheduled (${reminder.delay} ${reminder.unit})`,
                );
              } else {
                // Any terminal state (sent / skipped / failed) — customer
                // modified the cart again after this reminder reached a
                // terminal state, so this is a genuinely new abandon cycle.
                // Reset it back to pending with a fresh schedule instead of
                // silently leaving stale data in the row.
                console.log({
                  action: "reset_and_reschedule",
                  previousStatus: reminderExists.status,
                  baseTime,
                  scheduledAt,
                  delay: reminder.delay,
                  unit: reminder.unit,
                  reminderId: reminder.id,
                });

                await storage.updateAbandonedCartReminder(reminderExists.id, {
                  scheduledAt,
                  status: "pending",
                  sentAt: null,
                  error: null,
                });

                console.log(
                  `[abandoned_cart] Reminder reset to pending & rescheduled (${reminder.delay} ${reminder.unit})`,
                );
              }
            }
            // else: content unchanged -> leave as is
          }
        }
      }
    } catch (error) {
      console.error("[abandoned_cart] Checkout error:", error);
    }
  }

  async handleOrderCreated(shopDomain: string, order: any) {
    const cart = await storage.getAbandonedCartByToken(order.checkout_token);

    if (!cart) {
      return;
    }

    await storage.updateAbandonedCart(cart.id, {
      status: "completed",
      completedAt: new Date(),
    });

    console.log("Abandoned cart completed:", cart.id);

    await storage.markCartRemindersSkipped(cart.id);
  }
}

export const abandonedCartService = new AbandonedCartService();