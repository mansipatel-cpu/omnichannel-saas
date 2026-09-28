import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const aliases = [
  { prefix: "@shared/schema", target: path.join(root, "backend", "src", "config", "schema.js"), exact: true },
  { prefix: "@shared/whatsapp-schema", target: path.join(root, "backend", "src", "config", "whatsapp-schema.js"), exact: true },
  { prefix: "@shared/", target: path.join(root, "packages", "shared") },
  { prefix: "@diploy/core", target: path.join(root, "packages", "diploy-core", "index.js"), exact: true },
];

function existingFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.json`,
    path.join(basePath, "index.js"),
    path.join(basePath, "index.jsx"),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // ignore unreadable candidates
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  for (const alias of aliases) {
    if (alias.exact && specifier === alias.prefix) {
      return {
        shortCircuit: true,
        url: pathToFileURL(alias.target).href,
      };
    }

    if (!alias.exact && specifier.startsWith(alias.prefix)) {
      const rest = specifier.slice(alias.prefix.length).replace(/\\/g, "/");
      const resolved = existingFile(path.join(alias.target, rest));
      if (resolved) {
        return {
          shortCircuit: true,
          url: pathToFileURL(resolved).href,
        };
      }
    }
  }

  const knownExtensions = new Set([".js", ".jsx", ".json", ".mjs", ".cjs", ".node"]);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    if (knownExtensions.has(path.extname(specifier))) {
      return nextResolve(specifier, context);
    }
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const resolved = existingFile(path.resolve(parentDir, specifier));
    if (resolved) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolved).href,
      };
    }
  }

  return nextResolve(specifier, context);
}
