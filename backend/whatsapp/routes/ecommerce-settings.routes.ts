import { Router } from "express";
import { ecommerceSettingsController } from "../controllers/ecommerce/ecommerce-settings.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get(
  "/:provider",
  requireAuth,
  ecommerceSettingsController.getSettings.bind(
    ecommerceSettingsController
  )
);

router.post(
  "/:provider",
  requireAuth,
  ecommerceSettingsController.saveSettings.bind(
    ecommerceSettingsController
  )
);

router.post(
  "/:provider/test",
  requireAuth,
  ecommerceSettingsController.testConnection.bind(
    ecommerceSettingsController
  )
);

export default router;