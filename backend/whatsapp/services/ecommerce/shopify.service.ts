import axios from "axios";

export class ShopifyService {
  static generateInstallUrl(shop: string) {
    const scopes =
      "read_orders,read_customers,read_products";

    const redirectUri =
      process.env.SHOPIFY_REDIRECT_URI;

    return (
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${process.env.SHOPIFY_API_KEY}` +
      `&scope=${scopes}` +
      `&redirect_uri=${redirectUri}`
    );
  }

  static async exchangeAccessToken(
    shop: string,
    code: string
  ) {
    const response = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }
    );

    return response.data.access_token;
  }
}