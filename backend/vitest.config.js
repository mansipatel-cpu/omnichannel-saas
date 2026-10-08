import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(backendDir, "..");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@shared\/schema$/, replacement: path.join(backendDir, "src/config/schema.js") },
      { find: /^@shared\/whatsapp-schema$/, replacement: path.join(backendDir, "src/config/whatsapp-schema.js") },
      { find: /^@shared\//, replacement: path.join(repoRoot, "packages/shared") + "/" },
      { find: /^@diploy\/core$/, replacement: path.join(repoRoot, "packages/diploy-core/index.js") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
