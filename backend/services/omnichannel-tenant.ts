'use strict';
/**
 * One tenant (users.id) for the whole marketing tool.
 * Voice calling and WhatsApp stay as separate product sections,
 * but both are provisioned from the same user on register/login.
 */
import { db } from "../db";
import { users, plans as voicePlans, userSubscriptions } from "@shared/schema";
import { plans as waPlans, subscriptions as waSubscriptions } from "@shared/whatsapp-schema";
import { and, eq, or } from "drizzle-orm";
import { logger } from "../utils/logger";

export const DEFAULT_WA_PERMISSIONS = [
  "contacts:view",
  "contacts:create",
  "contacts:edit",
  "contacts:delete",
  "contacts:export",
  "campaigns:view",
  "campaigns:create",
  "campaigns:edit",
  "campaigns:delete",
  "templates:view",
  "templates:create",
  "templates:edit",
  "templates:delete",
  "templates:sync",
  "analytics:view",
  "team:view",
  "settings:view",
  "inbox:view",
  "inbox:send",
  "inbox:assign",
  "automations:view",
  "automations:create",
  "automations:edit",
  "automations:delete",
];

function splitName(name: string | null | undefined): { firstName: string; lastName?: string } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "User" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || undefined,
  };
}

export async function provisionOmnichannelTenant(userId: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    logger.warn(`Omnichannel provision skipped: user ${userId} not found`, undefined, "OmnichannelTenant");
    return;
  }

  const { firstName, lastName } = splitName(user.name);
  const permissions =
    Array.isArray(user.permissions) && user.permissions.length > 0
      ? user.permissions
      : DEFAULT_WA_PERMISSIONS;

  await db
    .update(users)
    .set({
      username: user.username || user.email,
      firstName: user.firstName || firstName,
      lastName: user.lastName || lastName || null,
      status: user.status || "active",
      isEmailVerified: true,
      permissions,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await ensureVoiceFreePlan(userId, user.credits ?? 0);
  await ensureWhatsAppFreePlan(userId);
}

async function ensureVoiceFreePlan(userId: string, currentCredits: number): Promise<void> {
  const [existing] = await db
    .select({ id: userSubscriptions.id })
    .from(userSubscriptions)
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, "active")))
    .limit(1);

  if (existing) return;

  const [freePlan] = await db
    .select()
    .from(voicePlans)
    .where(or(eq(voicePlans.name, "free"), eq(voicePlans.name, "Free")))
    .limit(1);

  if (!freePlan) {
    logger.warn("Omnichannel provision: voice Free plan missing", undefined, "OmnichannelTenant");
    return;
  }

  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  await db.insert(userSubscriptions).values({
    userId,
    planId: freePlan.id,
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: oneYearFromNow,
    billingPeriod: "monthly",
  });

  const included = freePlan.includedCredits ?? 0;
  if (included > 0 && currentCredits < included) {
    await db.update(users).set({ credits: included, planType: "free" }).where(eq(users.id, userId));
  }

  logger.info(`Omnichannel provision: voice Free plan for ${userId}`, undefined, "OmnichannelTenant");
}

async function ensureWhatsAppFreePlan(userId: string): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: waSubscriptions.id })
      .from(waSubscriptions)
      .where(and(eq(waSubscriptions.userId, userId), eq(waSubscriptions.status, "active")))
      .limit(1);

    if (existing) return;

    const [freePlan] = await db
      .select()
      .from(waPlans)
      .where(or(eq(waPlans.name, "Free"), eq(waPlans.name, "free")))
      .limit(1);

    if (!freePlan) {
      logger.warn("Omnichannel provision: WhatsApp Free plan missing (run WhatsApp seed)", undefined, "OmnichannelTenant");
      return;
    }

    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    await db.insert(waSubscriptions).values({
      userId,
      planId: freePlan.id,
      planData: freePlan,
      status: "active",
      billingCycle: "monthly",
      startDate: now,
      endDate: oneYearFromNow,
      autoRenew: true,
    });

    logger.info(`Omnichannel provision: WhatsApp Free plan for ${userId}`, undefined, "OmnichannelTenant");
  } catch (error: any) {
    logger.warn(
      `Omnichannel provision: WhatsApp subscription skipped (${error?.message || error})`,
      undefined,
      "OmnichannelTenant",
    );
  }
}
