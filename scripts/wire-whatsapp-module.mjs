/**
 * One-time wiring: namespace WhatsWay copies so they can live inside AgentLabs.
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const waSchema = path.join(root, "shared", "whatsapp-schema.ts");
const serverMod = path.join(root, "server", "modules", "whatsapp");
const clientMod = path.join(root, "client", "src", "whatsapp");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function rewriteFile(file, replacers) {
  let text = fs.readFileSync(file, "utf8");
  const orig = text;
  for (const [from, to] of replacers) {
    text = typeof from === "string" ? text.split(from).join(to) : text.replace(from, to);
  }
  if (text !== orig) {
    fs.writeFileSync(file, text);
    return true;
  }
  return false;
}

// --- schema namespace ---
let schema = fs.readFileSync(waSchema, "utf8");
schema = schema.replace('from "./roles"', 'from "./whatsapp-roles"');
schema = schema.replace(
  'export { Role, ROLE_VALUES, UserStatus, CampaignStatus, MessageStatus } from "./roles";',
  'export { Role, ROLE_VALUES, UserStatus, CampaignStatus, MessageStatus } from "./whatsapp-roles";\nimport { users as platformUsers } from "./schema";\nexport const users = platformUsers;'
);

// Remove the original users pgTable block (starts at export const users = pgTable( and ends before shopifyStores)
schema = schema.replace(
  /export const users = pgTable\(\s*"users",[\s\S]*?\);\s*\n\s*\n\s*\nexport const shopifyStores/,
  "export const shopifyStores"
);

const tableRenames = [
  ['pgTable(\n  "contacts",', 'pgTable(\n  "wa_contacts",'],
  ['pgTable(\n  "campaigns",', 'pgTable(\n  "wa_campaigns",'],
  ['pgTable(\n  "notifications",', 'pgTable(\n  "wa_notifications",'],
  ['pgTable("plans",', 'pgTable("wa_plans",'],
  ['pgTable("otp_verifications",', 'pgTable("wa_otp_verifications",'],
  ['pgTable("platform_languages",', 'pgTable("wa_platform_languages",'],
  ['pgTable("session",', 'pgTable("wa_session",'],
  ['index(\n      "contacts_channel_idx"', 'index(\n      "wa_contacts_channel_idx"'],
  ['index(\n      "contacts_phone_idx"', 'index(\n      "wa_contacts_phone_idx"'],
  ['index("campaigns_channel_idx")', 'index("wa_campaigns_channel_idx")'],
  ['index("campaigns_status_idx")', 'index("wa_campaigns_status_idx")'],
  ['index("campaigns_created_idx")', 'index("wa_campaigns_created_idx")'],
  ['index("notifications_channel_idx")', 'index("wa_notifications_channel_idx")'],
];
for (const [from, to] of tableRenames) schema = schema.split(from).join(to);
fs.writeFileSync(waSchema, schema);
console.log("updated shared/whatsapp-schema.ts");

// --- server module replacements ---
const serverFiles = walk(serverMod).filter((f) => /\.(ts|js)$/.test(f));
let serverChanged = 0;
for (const file of serverFiles) {
  const changed = rewriteFile(file, [
    ['from "@shared/schema"', 'from "@shared/whatsapp-schema"'],
    ["from '@shared/schema'", "from '@shared/whatsapp-schema'"],
    ['from "@shared/roles"', 'from "@shared/whatsapp-roles"'],
    ['from "@shared/payment-currencies"', 'from "@shared/whatsapp-payment-currencies"'],
    ['from "@shared/update-log"', 'from "@shared/whatsapp-update-log"'],
    [/"\/api\/(?!whatsapp\/)/g, '"/api/whatsapp/'],
    [/'\/api\/(?!whatsapp\/)/g, "'/api/whatsapp/"],
    [/`\/api\/(?!whatsapp\/)/g, "`/api/whatsapp/"],
    ['path: "/ws"', 'path: "/ws/whatsapp"'],
    ['path: \'/ws\'', 'path: "/ws/whatsapp"'],
  ]);
  if (changed) serverChanged++;
}
console.log(`updated ${serverChanged} server module files`);

// --- client module replacements ---
const clientFiles = walk(clientMod).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
let clientChanged = 0;
for (const file of clientFiles) {
  let text = fs.readFileSync(file, "utf8");
  const orig = text;
  text = text.replaceAll('from "@shared/schema"', 'from "@shared/whatsapp-schema"');
  text = text.replaceAll("from '@shared/schema'", "from '@shared/whatsapp-schema'");
  text = text.replaceAll('from "@shared/roles"', 'from "@shared/whatsapp-roles"');
  // Keep shadcn-style ui on the host app; remap everything else to @wa
  text = text.replaceAll('from "@/components/ui/', 'from "@/__keep_ui__/');
  text = text.replaceAll('from "@/', 'from "@wa/');
  text = text.replaceAll('from "@/__keep_ui__/', 'from "@/components/ui/');
  text = text.replace(/["'`]\/api\/(?!whatsapp\/)/g, (m) => m[0] + "/api/whatsapp/");
  if (text !== orig) {
    fs.writeFileSync(file, text);
    clientChanged++;
  }
}
console.log(`updated ${clientChanged} client whatsapp files`);
console.log("done");
