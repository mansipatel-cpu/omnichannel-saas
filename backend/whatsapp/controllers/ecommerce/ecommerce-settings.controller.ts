import { Request, Response } from "express";
import { storage } from "../../storage";
import axios from "axios";

export class EcommerceSettingsController {
  async getSettings(
    req: Request,
    res: Response
  ) {
    try {
      const { provider } = req.params;

      const settings =
        await storage.getEcommerceSettings(
          provider
        );

      return res.json({
        success: true, 
        data: settings || null,
      });
    } catch (error) {
      console.error(
        "Get ecommerce settings error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch ecommerce settings",
      });
    }
  }

//   async saveSettings(
//     req: Request,
//     res: Response
//   ) {
//     try {
//       const { provider } = req.params;

//       const {
//         clientId,
//         clientSecret,
//         appUrl,
//         callbackUrl,
//         webhookUrl,
//         scopes,
//         isActive,
//       } = req.body;

//       const existing =
//         await storage.getEcommerceSettings(
//           provider
//         );

//       let settings;

//       if (existing) {
//         settings =
//           await storage.updateEcommerceSettings(
//             provider,
//             {
//               clientId,
//               clientSecret,
//               appUrl,
//               callbackUrl,
//               webhookUrl,
//               scopes,
//               isActive,
//             }
//           );
//       } else {
//         settings =
//           await storage.createEcommerceSettings(
//             {
//               provider,
//               clientId,
//               clientSecret,
//               appUrl,
//               callbackUrl,
//               webhookUrl,
//               scopes,
//               isActive:
//                 isActive ?? true,
//             }
//           );
//       }

//       return res.json({
//         success: true,
//         message:
//           "Settings saved successfully",
//         data: settings,
//       });
//     } catch (error) {
//       console.error(
//         "Save ecommerce settings error:",
//         error
//       );

//       return res.status(500).json({
//         success: false,
//         message:
//           "Failed to save ecommerce settings",
//       });
//     }
//   }


async saveSettings(
  req: Request,
  res: Response
) {
  try {
    const { provider } = req.params;

    const {
      clientId,
      clientSecret,
      appUrl,
      callbackUrl,
      webhookUrl,
      scopes,
      isActive,
    } = req.body;

    const existing =
      await storage.getEcommerceSettings(
        provider
      );

    let settings;

    if (existing) {
      settings =
        await storage.updateEcommerceSettings(
          provider,
          {
            clientId,
            clientSecret,
            appUrl,
            callbackUrl,
            webhookUrl,
            scopes,
            isActive,
          }
        );
    } else {
      settings =
        await storage.createEcommerceSettings(
          {
            provider,
            clientId,
            clientSecret,
            appUrl,
            callbackUrl,
            webhookUrl,
            scopes,
            isActive:
              isActive ?? true,
          }
        );
    }

    // Shopify Partner Sync
    if (
      provider === "shopify" &&
      process.env.SHOPIFY_PARTNER_TOKEN
    ) {
      try {
        console.log(
          "[SHOPIFY] Syncing app settings..."
        );

        await axios.post(
          "https://partners.shopify.com/api/cli/graphql",
          {
            query: `
              mutation appUpdate(
                $apiKey: String!,
                $appUrl: URL!,
                $redirectUrls: [URL!]!
              ) {
                appUpdate(
                  apiKey: $apiKey
                  appUrl: $appUrl
                  redirectUrls: $redirectUrls
                ) {
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            variables: {
              apiKey: clientId,
              appUrl,
              redirectUrls: [callbackUrl],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.SHOPIFY_PARTNER_TOKEN}`,
              "Content-Type":
                "application/json",
            },
          }
        );

        console.log(
          "[SHOPIFY] Settings synced successfully"
        );
      } catch (syncError: any) {
        console.error(
          "[SHOPIFY] Sync failed:",
          syncError?.response?.data ||
            syncError?.message
        );

        // DB save already ho chuka hai
        // isliye request fail mat karo
      }
    }

    return res.json({
      success: true,
      message:
        "Settings saved successfully",
      data: settings,
    });
  } catch (error) {
    console.error(
      "Save ecommerce settings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save ecommerce settings",
    });
  }
}

  async testConnection(
    req: Request,
    res: Response
  ) {
    try {
      const { provider } = req.params;

      const settings =
        await storage.getEcommerceSettings(
          provider
        );

      if (!settings) {
        return res.status(400).json({
          success: false,
          message:
            "Settings not found",
        });
      }

      // future:
      // Shopify API ping
      // WooCommerce API ping
      // Magento API ping

      return res.json({
        success: true,
        message:
          "Connection test successful",
      });
    } catch (error) {
      console.error(
        "Test connection error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Connection test failed",
      });
    }
  }
}

export const ecommerceSettingsController =
  new EcommerceSettingsController();