#!/usr/bin/env node
/**
 * Local setup: ensure .env exists and generate SESSION_SECRET / JWT_SECRET.
 * Usage: npm run setup
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

const PLACEHOLDER = "WILL_BE_AUTO_GENERATED_BY_SETUP";
const SECRET_KEYS = ["SESSION_SECRET", "JWT_SECRET"];

function randomSecret() {
  return crypto.randomBytes(32).toString("hex");
}

function isUnset(value) {
  if (!value) return true;
  const trimmed = value.trim();
  return (
    trimmed.length === 0 ||
    trimmed === PLACEHOLDER ||
    trimmed.startsWith("your_") ||
    trimmed.includes("change_me")
  );
}

if (!fs.existsSync(envPath)) {
  if (!fs.existsSync(examplePath)) {
    console.error("Missing .env and .env.example. Cannot continue.");
    process.exit(1);
  }
  fs.copyFileSync(examplePath, envPath);
  console.log("Created .env from .env.example");
}

let env = fs.readFileSync(envPath, "utf8");
const generated = [];

for (const key of SECRET_KEYS) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  const current = match ? match[1] : "";

  if (!isUnset(current)) {
    console.log(`${key} already set — leaving as-is`);
    continue;
  }

  const secret = randomSecret();
  if (match) {
    env = env.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${secret}`);
  } else {
    env += `\n${key}=${secret}\n`;
  }
  generated.push(key);
}

fs.writeFileSync(envPath, env, "utf8");

if (generated.length > 0) {
  console.log(`Generated: ${generated.join(", ")}`);
} else {
  console.log("Security secrets were already present.");
}

console.log("\nNext:");
console.log("  1. Edit .env with your database URL and API keys");
console.log("  2. npm run db:push");
console.log("  3. npm run db:seed   (optional)");
console.log("  4. npm run dev");
