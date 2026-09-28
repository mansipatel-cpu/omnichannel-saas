#!/usr/bin/env node
/**
 * Local setup: ensure backend/.env and frontend/.env exist,
 * and generate SESSION_SECRET / JWT_SECRET in the backend env.
 * Usage: npm run setup
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendEnvPath = path.join(root, "backend", ".env");
const backendExamplePath = path.join(root, "backend", ".env.example");
const frontendEnvPath = path.join(root, "frontend", ".env");
const frontendExamplePath = path.join(root, "frontend", ".env.example");
const legacyRootEnvPath = path.join(root, ".env");

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

if (!fs.existsSync(backendEnvPath)) {
  if (fs.existsSync(legacyRootEnvPath)) {
    fs.copyFileSync(legacyRootEnvPath, backendEnvPath);
    console.log("Created backend/.env from existing root .env");
  } else if (fs.existsSync(backendExamplePath)) {
    fs.copyFileSync(backendExamplePath, backendEnvPath);
    console.log("Created backend/.env from backend/.env.example");
  } else {
    console.error("Missing backend/.env and backend/.env.example. Cannot continue.");
    process.exit(1);
  }
}

if (!fs.existsSync(frontendEnvPath)) {
  if (!fs.existsSync(frontendExamplePath)) {
    console.error("Missing frontend/.env.example. Cannot continue.");
    process.exit(1);
  }
  fs.copyFileSync(frontendExamplePath, frontendEnvPath);
  console.log("Created frontend/.env from frontend/.env.example");
}

let env = fs.readFileSync(backendEnvPath, "utf8");
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

fs.writeFileSync(backendEnvPath, env, "utf8");

if (generated.length > 0) {
  console.log(`Generated: ${generated.join(", ")}`);
} else {
  console.log("Security secrets were already present.");
}

console.log("\nNext:");
console.log("  1. Edit backend/.env with your database URL and API keys");
console.log("  2. Edit frontend/.env if the UI needs a public origin");
console.log("  3. npm run db:push");
console.log("  4. npm run db:seed   (optional)");
console.log("  5. npm run dev");
