import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(repoRoot);
dotenv.config({ path: path.join(repoRoot, "backend", ".env") });

const loaderPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "esm-path-loader.mjs");
register(pathToFileURL(loaderPath).href);

