/**
 * Structural check for the JavaScript monorepo.
 * Verifies syntax of entry points and that relocated modules resolve.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const root = process.cwd();
const failures = [];

function exists(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required path: ${rel}`);
    return false;
  }
  return true;
}

function syntaxCheck(rel) {
  if (!exists(rel)) return;
  const result = spawnSync(process.execPath, ["--check", path.join(root, rel)], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push(`Syntax error in ${rel}:\n${result.stderr || result.stdout}`);
  }
}

const requiredPaths = [
  "backend/index.js",
  "backend/app.js",
  "backend/package.json",
  "backend/drizzle.config.js",
  "backend/src/config/database.js",
  "backend/src/config/schema.js",
  "backend/src/config/whatsapp-schema.js",
  "backend/src/routes.js",
  "backend/src/jobs/phone-billing-cron.js",
  "backend/src/jobs/credit-backfill-monitor.js",
  "backend/src/jobs/phone-release-retry-worker.js",
  "backend/src/routes/google-sheets.routes.js",
  "backend/src/routes/google-calendar.routes.js",
  "backend/src/integrations/whatsapp/api.js",
  "backend/src/routes/whatsapp/register.js",
  "frontend/package.json",
  "frontend/vite.config.js",
  "frontend/src/App.jsx",
  "frontend/src/shared/layouts/AppShell.jsx",
  "frontend/src/shared/layouts/PublicLayout.jsx",
  "frontend/src/features/whatsapp/WhatsAppApp.jsx",
  "frontend/src/features/agents/components/AgentCreationWizard.jsx",
  "frontend/src/features/campaigns/components/CreateCallingCampaignForm.jsx",
  "frontend/src/features/admin/components/SettingsPage.jsx",
  "frontend/src/features/landing/components/HeroSection.jsx",
  "frontend/src/shared/services/api.js",
  "frontend/src/shared/utils/formatters.js",
  "backend/.env.example",
  "frontend/.env.example",
  "infra/docker/Dockerfile",
  "backend/docker-compose.yml",
  "packages/shared/whatsapp-roles.js",
  "packages/diploy-core/index.js",
  "docs/INSTALLATION.md",
  "infra/pm2/ecosystem.config.cjs",
];

const removedPaths = [
  "vite.config.js",
  "tailwind.config.js",
  "postcss.config.js",
  "components.json",
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
  "backend/src/integrations/payment/index.js",
  "backend/src/routes/stripe-routes.js",
  "backend/src/routes/razorpay-routes.js",
  "backend/src/routes/paypal-routes.js",
  "backend/src/routes/paystack-routes.js",
  "backend/src/routes/mercadopago-routes.js",
  "frontend/src/whatsapp",
  "backend/src/services/phone-billing-cron.js",
  "backend/src/services/google-sheets/google-sheets.routes.js",
  "scripts/wire-whatsapp-module.mjs",
  "backend/Dockerfile",
  "ecosystem.config.cjs",
  "INSTALLATION.md",
  "shared",
];

for (const rel of requiredPaths) {
  exists(rel);
}

for (const rel of removedPaths) {
  if (fs.existsSync(path.join(root, rel))) {
    failures.push(`Expected relocated/removed path to be gone: ${rel}`);
  }
}

const jsToCheck = requiredPaths.filter((rel) => rel.endsWith(".js"));
for (const rel of jsToCheck) {
  syntaxCheck(rel);
}

if (failures.length) {
  console.error("check failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("check passed: required structure exists and JS entry modules parse.");
