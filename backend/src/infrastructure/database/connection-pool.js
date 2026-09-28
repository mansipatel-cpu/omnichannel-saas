import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { globalSettings } from "@shared/schema";
export class DatabasePoolManager {
    pool = null;
    isInitialized = false;
    settings = {
        minConnections: 2,
        maxConnections: 20,
        idleTimeoutMs: 30000,
    };
    async initialize() {
        if (this.isInitialized) {
            console.log("[DB Pool] Already initialized, skipping");
            return;
        }
        console.log("[DB Pool] Initializing connection pool...");
        await this.loadSettings();
        await this.createPool();
        this.isInitialized = true;
        console.log("[DB Pool] Initialization complete");
    }
    async loadSettings() {
        console.log("[DB Pool] Loading settings from globalSettings table...");
        try {
            const settings = await db
                .select()
                .from(globalSettings)
                .where(eq(globalSettings.key, "db_pool_min_connections"));
            const minConnectionsSetting = settings[0];
            const maxConnectionsResult = await db
                .select()
                .from(globalSettings)
                .where(eq(globalSettings.key, "db_pool_max_connections"));
            const idleTimeoutResult = await db
                .select()
                .from(globalSettings)
                .where(eq(globalSettings.key, "db_pool_idle_timeout_ms"));
            if (minConnectionsSetting?.value) {
                this.settings.minConnections = Number(minConnectionsSetting.value);
            }
            if (maxConnectionsResult[0]?.value) {
                this.settings.maxConnections = Number(maxConnectionsResult[0].value);
            }
            if (idleTimeoutResult[0]?.value) {
                this.settings.idleTimeoutMs = Number(idleTimeoutResult[0].value);
            }
            console.log(`[DB Pool] Settings loaded: min=${this.settings.minConnections}, max=${this.settings.maxConnections}, idleTimeout=${this.settings.idleTimeoutMs}ms`);
        }
        catch (error) {
            console.log(`[DB Pool] Failed to load settings, using defaults: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async createPool() {
        if (!process.env.DATABASE_URL) {
            throw new Error("[DB Pool] DATABASE_URL environment variable is not set");
        }
        console.log("[DB Pool] Creating pool with dynamic configuration...");
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            min: this.settings.minConnections,
            max: this.settings.maxConnections,
            idleTimeoutMillis: this.settings.idleTimeoutMs,
        });
        this.setupEventListeners();
        console.log("[DB Pool] Pool created successfully");
    }
    setupEventListeners() {
        if (!this.pool)
            return;
        this.pool.on("connect", (client) => {
            console.log("[DB Pool] New client connected");
        });
        this.pool.on("acquire", (client) => {
            console.log("[DB Pool] Client acquired from pool");
        });
        this.pool.on("remove", (client) => {
            console.log("[DB Pool] Client removed from pool");
        });
        this.pool.on("error", (err, client) => {
            console.log(`[DB Pool] Error on idle client: ${err.message}`);
        });
        console.log("[DB Pool] Event listeners configured");
    }
    async healthCheck() {
        if (!this.pool) {
            return {
                healthy: false,
                message: "Pool not initialized",
            };
        }
        try {
            const client = await this.pool.connect();
            const result = await client.query("SELECT 1 as health_check");
            client.release();
            if (result.rows[0]?.health_check === 1) {
                const stats = this.getStats();
                console.log("[DB Pool] Health check passed");
                return {
                    healthy: true,
                    message: "Database connection is healthy",
                    stats,
                };
            }
            return {
                healthy: false,
                message: "Health check query returned unexpected result",
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`[DB Pool] Health check failed: ${message}`);
            return {
                healthy: false,
                message: `Health check failed: ${message}`,
            };
        }
    }
    getStats() {
        if (!this.pool) {
            return {
                total: 0,
                idle: 0,
                waiting: 0,
            };
        }
        return {
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount,
        };
    }
    async shutdown() {
        if (!this.pool) {
            console.log("[DB Pool] No pool to shut down");
            return;
        }
        console.log("[DB Pool] Initiating graceful shutdown...");
        try {
            await this.pool.end();
            this.pool = null;
            this.isInitialized = false;
            console.log("[DB Pool] Graceful shutdown complete");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`[DB Pool] Shutdown error: ${message}`);
            throw error;
        }
    }
    getPool() {
        return this.pool;
    }
    getDrizzle() {
        if (!this.pool) {
            throw new Error("[DB Pool] Pool not initialized. Call initialize() first.");
        }
        return drizzle(this.pool);
    }
    getSettings() {
        return { ...this.settings };
    }
    isReady() {
        return this.isInitialized && this.pool !== null;
    }
}
export const databasePoolManager = new DatabasePoolManager();
