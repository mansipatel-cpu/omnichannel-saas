import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export default defineConfig({
    root: __dirname,
    envDir: __dirname,
    plugins: [
        react(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
            "@wa": path.resolve(__dirname, "src", "features", "whatsapp"),
            "@shared/schema": path.resolve(repoRoot, "backend", "src", "config", "schema.js"),
            "@shared/whatsapp-schema": path.resolve(repoRoot, "backend", "src", "config", "whatsapp-schema.js"),
            "@shared": path.resolve(repoRoot, "packages", "shared"),
        },
    },
    build: {
        outDir: path.resolve(repoRoot, "dist/public"),
        emptyOutDir: true,
    },
    css: {
        postcss: path.join(__dirname, "postcss.config.js"),
    },
    server: {
        fs: {
            strict: true,
            allow: [repoRoot],
            deny: ["**/.*"],
        },
    },
});
