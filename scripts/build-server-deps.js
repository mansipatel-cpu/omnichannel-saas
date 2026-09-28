#!/usr/bin/env node

/**
 * Verify shared server files exist as JavaScript modules for plugin imports.
 * The app is JavaScript-only, so no TypeScript compile step is required.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "backend/src/config/schema.js",
  "backend/src/config/database.js",
  "backend/src/storage.js",
  "backend/src/storage/index.js",
  "backend/src/storage/analytics-helpers.js",
  "backend/src/services/contact-upload-service.js",
  "backend/src/utils/batch-utils.js",
  "backend/src/services/google-calendar/google-calendar.service.js",
  "backend/src/services/google-sheets/google-sheets.service.js",
  "backend/src/services/rag-knowledge.js",
  "backend/src/utils/logger.js",
  "backend/src/services/webhook-delivery.js",
  "backend/src/utils/url-validator.js",
  "backend/src/utils/domain.js",
  "backend/src/services/appointment-elevenlabs-tool.js",
  "backend/src/services/play-audio-elevenlabs-tool.js",
  "backend/src/services/rag-elevenlabs-tool.js",
  "backend/src/services/form-elevenlabs-tool.js",
];

let missing = 0;
for (const relativePath of requiredFiles) {
  const fullPath = path.join(projectRoot, relativePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${relativePath}`);
  } else {
    console.error(`❌ Missing ${relativePath}`);
    missing += 1;
  }
}

if (missing > 0) {
  process.exit(1);
}
