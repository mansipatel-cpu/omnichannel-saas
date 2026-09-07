import axios from "axios";
import https from "https";

export class WooCommerceService {
  static async verifyConnection(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ) {
    const isLocalDev = storeUrl.includes(".local");

    const { data } = await axios.get(
      `${storeUrl}/wp-json/wc/v3/system_status`,
      {
        auth: {
          username: consumerKey.trim(),
          password: consumerSecret.trim(),
        },
        httpsAgent: isLocalDev
          ? new https.Agent({ rejectUnauthorized: false })
          : undefined,
      }
    );

    return data;
  }





  static async getCustomers(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string
) {
  const isLocalDev = storeUrl.includes(".local");

  const customers: any[] = [];
  let page = 1;

  while (true) {
    const { data } = await axios.get(
      `${storeUrl}/wp-json/wc/v3/customers`,
      {
        auth: {
          username: consumerKey.trim(),
          password: consumerSecret.trim(),
        },
        params: {
          per_page: 100,
          page,
        },
        httpsAgent: isLocalDev
          ? new https.Agent({
              rejectUnauthorized: false,
            })
          : undefined,
      }
    );

    if (!data.length) break;

    customers.push(...data);
    page++;
  }

  return customers;
}



static async syncCustomers(
  store: any
) {
  const customers = await this.getCustomers(
    store.storeUrl,
    store.consumerKey,
    store.consumerSecret
  );

  let imported = 0;
  let skipped = 0;

  for (const customer of customers) {
    const phone = customer.billing?.phone?.trim();

    if (!phone) {
      skipped++;
      continue;
    }

    await storage.findOrCreateContact({
      channelId: store.channelId,
      storeId: store.id,
      phone,
      email: customer.email || "",
      name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
      createdBy: store.userId,
      externalId: String(customer.id),
      source: "woocommerce",
    });

    imported++;
  }

  return {
    total: customers.length,
    imported,
    skipped,
  };
}
}