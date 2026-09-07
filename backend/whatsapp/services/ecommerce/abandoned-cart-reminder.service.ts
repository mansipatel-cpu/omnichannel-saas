import { storage } from "../../storage";
import { triggerService, executionService } from "../automation-execution-service";

export class AbandonedCartReminderService {
  async processPendingReminders() {
    try {
      const reminders =
        await storage.getPendingAbandonedCartReminders();

      console.log(
        `[abandoned_cart] Pending reminders: ${reminders.length}`
      );

      for (const reminder of reminders) {
        try {
          /**
           * Get cart
           */
          const cart =
            await storage.getAbandonedCartById(
              reminder.cartId
            );

          if (!cart) {
            console.log(
              `[abandoned_cart] Cart not found ${reminder.cartId}`
            );

            await storage.markAbandonedCartReminderFailed(
              reminder.id,
              "Cart not found"
            );

            continue;
          }

          /**
           * Cart completed
           */
          if (cart.status === "completed") {
            console.log(
              `[abandoned_cart] Cart completed ${cart.id}`
            );

            await storage.markAbandonedCartReminderSkipped(
              reminder.id
            );

            continue;
          }

          /**
           * Get automation
           */
          const automation =
            await storage.getAutomation(
              reminder.automationId
            );

          if (!automation) {
            console.log(
              `[abandoned_cart] Automation not found ${reminder.automationId}`
            );

            await storage.markAbandonedCartReminderFailed(
              reminder.id,
              "Automation not found"
            );

            continue;
          }

          /**
           * Execute reminder
           */

if (!cart.contactId) {
  await storage.markAbandonedCartReminderFailed(
    reminder.id,
    "Contact not found"
  );

  continue;
}

await executionService.executeReminder({
  automationId: reminder.automationId,
  templateNodeId: reminder.templateNodeId,
  contactId: cart.contactId!,
  cartId: cart.id,
});

          /**
           * Success
           */
          await storage.markAbandonedCartReminderSent(
            reminder.id
          );

          console.log(
            `[abandoned_cart] Reminder sent ${reminder.id}`
          );
        } catch (err: any) {
          console.error(
            `[abandoned_cart] Reminder failed ${reminder.id}`,
            err
          );

          await storage.markAbandonedCartReminderFailed(
            reminder.id,
            err?.message || "Unknown error"
          );
        }
      }
    } catch (err) {
      console.error(
        "[abandoned_cart] processPendingReminders failed",
        err
      );
    }
  }
}

export const abandonedCartReminderService = new AbandonedCartReminderService();