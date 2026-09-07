import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { storage } from "../../storage";
import {
  automations,
  automationExecutions,
} from "@shared/whatsapp-schema";

import { executionService } from "../automation-execution-service";

export class AutomationTriggerService {
  async executeTrigger({
    channelId,
    storeId,
    trigger,
    triggerData,
  }: {
    channelId: string;
    storeId: string;
    trigger: string;
    triggerData: any;
  }) {
    console.log("\n========== AUTOMATION TRIGGER ==========");
    console.log({
      channelId,
      storeId,
      trigger,
      triggerData,
    });

    const flows = await db
  .select()
  .from(automations)
  .where(
    and(
      eq(automations.channelId, channelId),
      eq(automations.trigger, trigger),
      eq(automations.status, "active")
    )
  );

    console.log(
      `Found ${flows.length} automation(s) for trigger "${trigger}"`
    );

    if (!flows.length) {
      console.log("No active automation found.");
      return;
    }

    // -----------------------------------
    // Resolve Contact
    // -----------------------------------

    let contactId: string | null = null;

    const phone =
      triggerData.customerPhone ||
      triggerData.phone ||
      null;

    if (phone) {
      console.log("Searching contact by phone:", phone);

      const contact =
        await storage.getContactByPhoneAndChannel(
          phone,
          channelId
        );

      if (contact) {
        contactId = contact.id;

        console.log(
          "Contact found by phone:",
          contact.id
        );
      }
    }

    if (!contactId && triggerData.externalId) {
      console.log(
        "Searching contact by externalId:",
        triggerData.externalId
      );

      const contact =
        await storage.getContactByExternalId(
          storeId,
          String(triggerData.externalId)
        );

      if (contact) {
        contactId = contact.id;

        console.log(
          "Contact found by externalId:",
          contact.id
        );
      }
    }

    console.log("Resolved Contact ID:", contactId);

    // -----------------------------------
    // Create Executions
    // -----------------------------------

    for (const automation of flows) {
      const executionId = randomUUID();

      console.log(
        `Creating execution for automation ${automation.id}`
      );

      await db
        .insert(automationExecutions)
        .values({
          id: executionId,

          automationId: automation.id,

          contactId,

          status: "running",

          triggerData,

          startedAt: new Date(),
        });

      console.log(
        `Executing automation ${automation.id}`
      );

      await executionService.executeAutomation(
        executionId
      );
    }

    console.log("========== TRIGGER COMPLETE ==========\n");
  }
}

export const triggerService =
  new AutomationTriggerService();