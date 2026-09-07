import { storage } from "../../storage";
import { shopifyOAuthService } from "./shopify-oauth.service";

export class ShopifyCustomerService {
  async handleCustomerCreate(
    shopDomain: string,
    customer: any
  ) {
    const store =
      await storage.getShopifyStoreByDomain(
        shopDomain
      );

    if (!store) {
      console.log(
        "Store not found for domain:",
        shopDomain
      );
      return;
    }

    const phone =
      customer.phone ||
      customer.default_address?.phone;

    if (!phone) {
      console.log(
        "Customer has no phone number"
      );
      return;
    }

    const existing =
      await storage.getContactByExternalId(
        store.id,
        String(customer.id)
      );

    const payload = {
      channelId: store.channelId!,
      createdBy: store.userId,
      name:
        `${customer.first_name || ""} ${
          customer.last_name || ""
        }`.trim(),
      phone,
      email: customer.email,
      source: "shopify",
      storeId: store.id,
      externalId: String(customer.id),
    };

    let contact;

    if (existing) {
      contact =
        await storage.updateContact(
          existing.id,
          payload
        );
    } else {
      contact =
        await storage.createContact(
          payload
        );
    }

    console.log(
      "Shopify customer synced:",
      contact?.id
    );

    // Next Step:
    // automationService.trigger({
    //   event: "customer_created",
    //   channelId: store.channelId,
    //   contactId: contact.id,
    // });
  }




  async syncStoreCustomers(
    storeId: string
  ) {
    const store =
      await storage.getShopifyStoreById(
        storeId
      );

    if (!store) {
      throw new Error("Store not found");
    }

    const customers =
      await shopifyOAuthService.getCustomers(
        store.shopDomain,
        store.accessToken
      );

    let synced = 0;

    for (const customer of customers) {
      await this.handleCustomerCreate(
        store.shopDomain,
        customer
      );

      synced++;
    }

    return synced;
  }

}

export const shopifyCustomerService = new ShopifyCustomerService();