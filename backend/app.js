import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import { correlationIdMiddleware } from "./src/middleware/correlation-id";
import { getHealthStatus } from "./src/services/startup-health-check";

function log(message, source = "express") {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
}

export function createApp() {
    const app = express();
    app.use(compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
            if (req.headers["x-no-compression"]) {
                return false;
            }
            return compression.filter(req, res);
        },
    }));
    app.use(express.json({
        limit: "50mb",
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }));
    app.use(express.urlencoded({ extended: false, limit: "50mb" }));
    app.use(cookieParser());
    const staticCacheOptions = { maxAge: "7d", etag: true, lastModified: true };
    app.use("/uploads", (_req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Disposition", "attachment");
        next();
    }, express.static(path.join(process.cwd(), "storage", "uploads"), staticCacheOptions), express.static(path.join(process.cwd(), "frontend", "public", "uploads"), staticCacheOptions));
    app.use("/images", express.static(path.join(process.cwd(), "frontend", "public", "images"), staticCacheOptions));
    app.use("/audio", express.static(path.join(process.cwd(), "frontend", "public", "audio"), staticCacheOptions));
    app.use("/widget", (req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        if (req.method === "OPTIONS") {
            return res.sendStatus(200);
        }
        next();
    }, express.static(path.join(process.cwd(), "frontend", "public", "widget")));
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        hsts: { maxAge: 31536000, includeSubDomains: true },
    }));
    app.disable("x-powered-by");
    const seoPublicPaths = ["/", "/pricing", "/features", "/use-cases", "/integrations", "/blog", "/contact", "/about", "/privacy", "/terms", "/sitemap.xml", "/robots.txt"];
    app.use((req, res, next) => {
        const p = req.path.replace(/\/+$/, "") || "/";
        if (seoPublicPaths.includes(p) || p.startsWith("/blog/")) {
            res.setHeader("X-Robots-Tag", "index, follow");
        }
        next();
    });
    app.use(correlationIdMiddleware);
    app.get("/health", (_req, res) => {
        res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    });
    app.get("/health/detailed", async (_req, res) => {
        try {
            const status = await getHealthStatus();
            const httpStatus = status.status === "unhealthy" ? 503 : 200;
            res.status(httpStatus).json({
                status: status.status,
                timestamp: new Date().toISOString(),
            });
        }
        catch {
            res.status(503).json({ status: "unhealthy" });
        }
    });
    app.use((req, res, next) => {
        const start = Date.now();
        const requestPath = req.path;
        let capturedJsonResponse;
        const originalResJson = res.json;
        res.json = function (bodyJson, ...args) {
            capturedJsonResponse = bodyJson;
            return originalResJson.apply(res, [bodyJson, ...args]);
        };
        res.on("finish", () => {
            const duration = Date.now() - start;
            if (requestPath.startsWith("/api")) {
                const correlationPrefix = req.correlationId ? `[${req.correlationId.slice(0, 8)}] ` : "";
                let logLine = `${correlationPrefix}${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
                if (capturedJsonResponse) {
                    logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
                }
                if (logLine.length > 90) {
                    logLine = `${logLine.slice(0, 89)}…`;
                }
                log(logLine);
            }
        });
        next();
    });
    return app;
}
