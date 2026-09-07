/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */

import { diployLogger, HTTP_STATUS, DIPLOY_BRAND } from "@diploy/core";
import {
  getAllProviders,
  getActiveProviders,
  getProviderById,
  getProviderByKey,
  createProvider,
  updateProvider,
  toggleProviderStatus,
  deleteProvider,
  getCurrencyGatewayMap,
} from "../controllers/payment.providers.controller";

// Transactions Controllers
import {
  getAllTransactions,
  getTransactionById,
  getTransactionsByUserId,
  createTransaction,
  updateTransactionStatus,
  completeTransaction,
  refundTransaction,
  initiatePayment,
  verifyRazorpayPayment,
  verifyStripePayment,
  verifyPayPalPayment,
  verifyPaystackPayment,
  verifyMercadoPagoPayment,
  getPaymentStatus,
  getTransactionStats,
  exportTransactions,
} from "../controllers/transactions.controller";

// Subscriptions Controllers
import {
  getAllSubscriptions,
  getSubscriptionById,
  getSubscriptionsByUserId,
  getActiveSubscriptionByUserId,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  renewSubscription,
  toggleAutoRenew,
  checkExpiredSubscriptions,
  changePlan,
} from "../controllers/subscriptions.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import type { Express } from "express";

export function registerPaymentsRoutes(app: Express) {
  // ==================== PAYMENT PROVIDERS ROUTES ====================

  // Read endpoints used by the customer-facing plan upgrade flow must be
  // reachable by every authenticated role (admin, team, etc) — not just
  // superadmin. The controllers strip `config` (API secrets) from the
  // response for non-superadmin callers.
  app.get("/api/whatsapp/payment-providers", requireAuth, getAllProviders);
  app.get("/api/whatsapp/payment-providers/active", requireAuth, getActiveProviders);
  app.get("/api/whatsapp/payment-providers/currency-map", requireAuth, getCurrencyGatewayMap);
  app.get("/api/whatsapp/payment-providers/:id", requireAuth, requireRole("superadmin"), getProviderById);
  app.get("/api/whatsapp/payment-providers/key/:key", requireAuth, requireRole("superadmin"), getProviderByKey);
  app.post("/api/whatsapp/payment-providers", requireAuth, requireRole("superadmin"), createProvider);
  app.put("/api/whatsapp/payment-providers/:id", requireAuth, requireRole("superadmin"), updateProvider);
  app.patch("/api/whatsapp/payment-providers/:id/toggle-status", requireAuth, requireRole("superadmin"), toggleProviderStatus);
  app.delete("/api/whatsapp/payment-providers/:id", requireAuth, requireRole("superadmin"), deleteProvider);

  // ==================== TRANSACTIONS ROUTES ====================

  app.get("/api/whatsapp/transactions", requireAuth, requireRole("superadmin"), getAllTransactions);
  app.get("/api/whatsapp/transactions/stats", requireAuth, requireRole("superadmin"), getTransactionStats);
  app.get("/api/whatsapp/transactions/export", requireAuth, requireRole("superadmin"), exportTransactions);
  app.get("/api/whatsapp/transactions/:id", requireAuth, getTransactionById);
  app.get("/api/whatsapp/transactions/user/:userId", requireAuth, getTransactionsByUserId);
  app.post("/api/whatsapp/transactions", requireAuth, createTransaction);
  app.patch("/api/whatsapp/transactions/:id/status", requireAuth, requireRole("superadmin"), updateTransactionStatus);
  app.post("/api/whatsapp/transactions/:id/complete", requireAuth, requireRole("superadmin"), completeTransaction);
  app.post("/api/whatsapp/transactions/:id/refund", requireAuth, requireRole("superadmin"), refundTransaction);
  app.post("/api/whatsapp/payment/initiate", requireAuth, initiatePayment);
  app.post("/api/whatsapp/payment/verify/razorpay", requireAuth, verifyRazorpayPayment);
  app.post("/api/whatsapp/payment/verify/stripe", requireAuth, verifyStripePayment);
  app.post("/api/whatsapp/payment/verify/paypal", requireAuth, verifyPayPalPayment);
  app.post("/api/whatsapp/payment/verify/paystack", requireAuth, verifyPaystackPayment);
  app.post("/api/whatsapp/payment/verify/mercadopago", requireAuth, verifyMercadoPagoPayment);
  app.get("/api/whatsapp/payment/status/:transactionId", requireAuth, getPaymentStatus);

  // ==================== SUBSCRIPTIONS ROUTES ====================

  app.get("/api/whatsapp/subscriptions", requireAuth, requireRole("superadmin"), getAllSubscriptions);
  app.get("/api/whatsapp/subscriptions/:id", requireAuth, getSubscriptionById);
  app.get("/api/whatsapp/subscriptions/user/:userId", requireAuth, getSubscriptionsByUserId);
  app.get("/api/whatsapp/subscriptions/user/:userId/active", requireAuth, getActiveSubscriptionByUserId);
  app.post("/api/whatsapp/subscriptions", requireAuth, requireRole("superadmin"), createSubscription);
  app.put("/api/whatsapp/subscriptions/:id", requireAuth, requireRole("superadmin"), updateSubscription);
  app.patch("/api/whatsapp/subscriptions/:id/cancel", requireAuth, cancelSubscription);
  app.post("/api/whatsapp/subscriptions/:id/renew", requireAuth, renewSubscription);
  app.patch("/api/whatsapp/subscriptions/:id/auto-renew", requireAuth, toggleAutoRenew);
  app.post("/api/whatsapp/subscriptions/change-plan", requireAuth, changePlan);
  app.post("/api/whatsapp/subscriptions/check-expired", requireAuth, requireRole("superadmin"), checkExpiredSubscriptions);
}
