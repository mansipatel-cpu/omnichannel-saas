import { Router } from "express";
import { shopifyController } from "../../controllers/whatsappShopify.controller";
import { woocommerceController } from "../../controllers/whatsappWoocommerce.controller";
import { woocommerceWebhookController } from "../../controllers/whatsappWoocommerceWebhook.controller";
import { CodVerificationService } from "../../services/whatsappCodVerification.service";
import { requireAuth } from "../../middleware/whatsappAuth";
import { codController } from "../../controllers/whatsappCod.controller";
const router = Router();
router.get("/shopify/install", requireAuth, shopifyController.install.bind(shopifyController));
router.get("/shopify/callback", shopifyController.callback.bind(shopifyController));
router.get("/shopify/stores", requireAuth, shopifyController.getStores.bind(shopifyController));
// ---- Webhook receivers (no auth — Shopify calls these directly) ----
// IMPORTANT: these routes need the raw request body for HMAC verification.
// In your main app setup, mount a raw-body parser for these specific paths
// BEFORE express.json(), e.g.:
//
//   app.use(
//     "/api/whatsapp/ecommerce/shopify/webhooks",
//     express.raw({ type: "application/json" }),
//     (req, res, next) => {
//       (req as any).rawBody = req.body;
//       req.body = JSON.parse(req.body.toString("utf8"));
//       next();
//     }
//   );
//
// This must run before this router is mounted, or before express.json()
// is applied globally to /api routes.
router.post("/shopify/webhooks/orders-create", shopifyController.ordersCreateWebhook);
router.post("/shopify/webhooks/orders-updated", shopifyController.ordersUpdatedWebhook);
router.post("/shopify/webhooks/orders-fulfilled", shopifyController.ordersFulfilledWebhook);
// router.post(
//   "/shopify/webhooks/customers-create",
//   shopifyController.customersCreateWebhook
// );
router.post("/shopify/webhooks/customers-create", (req, res, next) => {
    console.log("CUSTOMERS WEBHOOK HIT");
    next();
}, shopifyController.customersCreateWebhook);
router.post("/shopify/webhooks/checkouts-create", shopifyController.checkoutsCreateWebhook);
router.post("/shopify/webhooks/checkouts-update", shopifyController.checkoutsUpdateWebhook);
router.post("/shopify/webhooks/products-update", shopifyController.productsUpdateWebhook);
router.delete("/shopify/stores/:id", requireAuth, shopifyController.disconnect.bind(shopifyController));
router.post("/shopify/stores/:id/sync-customers", requireAuth, shopifyController.syncCustomers.bind(shopifyController));
router.get("/shopify/abandoned-carts", requireAuth, shopifyController.getAbandonedCarts.bind(shopifyController));
router.get("/shopify/abandoned-carts/:id", requireAuth, shopifyController.getAbandonedCart.bind(shopifyController));
// ==========================
// WooCommerce
// ==========================
router.post("/woocommerce/connect", requireAuth, woocommerceController.connectStore.bind(woocommerceController));
router.get("/woocommerce/stores", requireAuth, woocommerceController.getStores.bind(woocommerceController));
router.delete("/woocommerce/stores/:id", requireAuth, woocommerceController.deleteStore.bind(woocommerceController));
router.post("/woocommerce/stores/:id/sync-customers", requireAuth, woocommerceController.syncCustomers.bind(woocommerceController));
router.get("/woocommerce/plugin/download", woocommerceController.download);
router.post("/cod/confirm", codController.confirm);
router.post("/cod/cancel", codController.cancel);
router.get("/cod/verifications", codController.getVerifications);
router.post("/test-cod-reply", async (req, res) => {
    const { payload, phone } = req.body;
    const verification = await CodVerificationService.handleButtonReply(payload, phone);
    console.log(verification);
    if (!verification) {
        return res.status(404).json({
            success: false,
            message: "Verification not found",
        });
    }
    return res.json({
        success: true,
        verification,
    });
});
router.post("/woocommerce/webhook", woocommerceWebhookController.handle);
export default router;
