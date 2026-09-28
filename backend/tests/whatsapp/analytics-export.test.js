import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import express from "express";
import request from "supertest";
// ---------- Mocks for the controller's deps ----------
//
// The export controller uses drizzle's chainable query builder against
// `db` / `dbRead`, plus `storage.getChannelsByUserId` and
// `storage.getCampaign`. We replace them with hand-rolled mocks so we can
// assert HTTP-level access-control behavior (403/404/200) without a real DB.
const queryQueue = [];
function enqueue(...results) {
    queryQueue.push(...results);
}
// Build a Proxy that pretends to be a drizzle chain: every method call
// returns the same proxy, and `await` triggers `.then` which dequeues the
// next staged result.
function makeChain() {
    const handler = {
        get(_target, prop) {
            if (prop === "then") {
                const result = queryQueue.shift();
                const value = result === undefined ? [] : result;
                const p = Promise.resolve(value);
                return p.then.bind(p);
            }
            if (prop === "catch" || prop === "finally")
                return undefined;
            return () => proxy;
        },
    };
    const proxy = new Proxy(function () { }, handler);
    return proxy;
}
const dbMock = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
};
const storageMock = {
    getChannelsByUserId: vi.fn(async (_userId) => []),
    getCampaign: vi.fn(async (_id) => null),
};
vi.mock("../../src/config/database", () => ({ db: dbMock, dbRead: dbMock, whatsappDb: dbMock }));
vi.mock("../../src/storage/whatsappStorage", () => ({ storage: storageMock }));
vi.mock("../../src/storage/whatsappStorage", () => ({ storage: storageMock }));
// ---------- Test app wiring ----------
let currentSession = {};
let app;
const SUPERADMIN = {
    id: "u-super",
    role: "superadmin",
    username: "super",
    email: "super@example.com",
};
const ADMIN_OWNER = {
    id: "u-owner",
    role: "admin",
    username: "owner",
    email: "owner@example.com",
};
const TEAM_MEMBER = {
    id: "u-team",
    role: "team",
    createdBy: "u-owner",
    username: "teammate",
    email: "teammate@example.com",
};
const DEMO_ADMIN = {
    id: "u-demo",
    role: "admin",
    username: "demoadmin",
    email: "demo@example.com",
};
beforeAll(async () => {
    const { exportAnalytics } = await import("../../src/controllers/whatsappAnalytics.controller");
    const { requireAuth } = await import("../../src/middleware/whatsappAuth");
    const { errorHandler } = await import("../../src/middleware/whatsappError");
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.session = currentSession;
        next();
    });
    app.get("/api/whatsapp/analytics/export", requireAuth, exportAnalytics);
    app.use(errorHandler);
});
beforeEach(() => {
    queryQueue.length = 0;
    currentSession = {};
    storageMock.getChannelsByUserId.mockReset();
    storageMock.getChannelsByUserId.mockResolvedValue([]);
    storageMock.getCampaign.mockReset();
    storageMock.getCampaign.mockResolvedValue(null);
    dbMock.select.mockClear();
    dbMock.insert.mockClear();
    dbMock.delete.mockClear();
    dbMock.update.mockClear();
});
// Queue results for a successful workspace-wide CSV export.
// Order matches awaited dbRead calls in fetchAnalyticsExportSections:
//   overall, avg-response, daily, messageRows, campaignRows.
function enqueueWorkspaceExportResults() {
    enqueue([{ totalMessages: 0, totalOutbound: 0, totalInbound: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, totalReplied: 0, uniqueContacts: 0 }], // overall
    [{ avgResponseMs: null }], // avg response time
    [], // daily rollup
    [], // message rows
    []);
}
// ---------- Demo accounts are blocked outright ----------
describe("GET /api/analytics/export — demo account guard", () => {
    it("returns 403 for demo accounts before touching the DB", async () => {
        currentSession = { user: DEMO_ADMIN };
        const res = await request(app).get("/api/whatsapp/analytics/export").query({ format: "csv" });
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/demo/i);
        expect(storageMock.getChannelsByUserId).not.toHaveBeenCalled();
        expect(dbMock.select).not.toHaveBeenCalled();
    });
});
// ---------- Workspace-wide export: channel-scope behavior ----------
describe("GET /api/analytics/export — workspace channel scoping", () => {
    it("superadmin: no channelId restriction, getChannelsByUserId is not called", async () => {
        currentSession = { user: SUPERADMIN };
        enqueueWorkspaceExportResults();
        const res = await request(app).get("/api/whatsapp/analytics/export").query({ format: "csv" });
        expect(res.status).toBe(200);
        expect(storageMock.getChannelsByUserId).not.toHaveBeenCalled();
    });
    it("regular admin without channelId: scope restricted to their owned channels", async () => {
        currentSession = { user: ADMIN_OWNER };
        storageMock.getChannelsByUserId.mockResolvedValue([
            { id: "ch-mine-1" },
            { id: "ch-mine-2" },
        ]);
        enqueueWorkspaceExportResults();
        const res = await request(app).get("/api/whatsapp/analytics/export").query({ format: "csv" });
        expect(res.status).toBe(200);
        expect(storageMock.getChannelsByUserId).toHaveBeenCalledTimes(1);
        expect(storageMock.getChannelsByUserId).toHaveBeenCalledWith(ADMIN_OWNER.id);
    });
    it("team member without channelId: inherits owner's channels via createdBy", async () => {
        currentSession = { user: TEAM_MEMBER };
        storageMock.getChannelsByUserId.mockResolvedValue([{ id: "ch-owner" }]);
        enqueueWorkspaceExportResults();
        const res = await request(app).get("/api/whatsapp/analytics/export").query({ format: "csv" });
        expect(res.status).toBe(200);
        expect(storageMock.getChannelsByUserId).toHaveBeenCalledWith(TEAM_MEMBER.createdBy);
        expect(storageMock.getChannelsByUserId).not.toHaveBeenCalledWith(TEAM_MEMBER.id);
    });
    it("admin with no accessible channels: succeeds but scope is empty (no leakage)", async () => {
        currentSession = { user: ADMIN_OWNER };
        storageMock.getChannelsByUserId.mockResolvedValue([]); // owns nothing
        enqueueWorkspaceExportResults();
        const res = await request(app).get("/api/whatsapp/analytics/export").query({ format: "csv" });
        // Endpoint must NOT 500 or leak — it should succeed with the empty-scope
        // sentinel (`FALSE` filter) applied inside fetchAnalyticsExportSections.
        expect(res.status).toBe(200);
        expect(storageMock.getChannelsByUserId).toHaveBeenCalledWith(ADMIN_OWNER.id);
    });
    it("returns 403 when an admin requests a channelId they do not own", async () => {
        currentSession = { user: ADMIN_OWNER };
        storageMock.getChannelsByUserId.mockResolvedValue([{ id: "ch-mine" }]);
        const res = await request(app)
            .get("/api/whatsapp/analytics/export")
            .query({ format: "csv", channelId: "ch-other-tenant" });
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/access denied/i);
        // Must short-circuit before any data fetching.
        expect(dbMock.select).not.toHaveBeenCalled();
    });
});
// ---------- Per-campaign export ----------
describe("GET /api/analytics/export — per-campaign", () => {
    it("returns 404 when the requested campaign does not exist", async () => {
        currentSession = { user: ADMIN_OWNER };
        // fetchCampaignExportSections starts with a campaign lookup → empty.
        enqueue([]);
        const res = await request(app)
            .get("/api/whatsapp/analytics/export")
            .query({ format: "csv", type: "campaigns", campaignId: "missing" });
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/campaign not found/i);
    });
    it("returns 403 when the campaign belongs to a channel the user cannot access", async () => {
        currentSession = { user: ADMIN_OWNER };
        // 1) campaign row → exists, but on a foreign channel.
        enqueue([
            {
                id: "camp-1",
                name: "Foreign Campaign",
                channelId: "ch-other-tenant",
                type: "marketing",
                campaignType: "template",
                status: "completed",
                templateName: null,
                createdAt: new Date(),
                scheduledAt: null,
                completedAt: new Date(),
                recipientCount: 0,
                sentCount: 0,
                deliveredCount: 0,
                readCount: 0,
                repliedCount: 0,
                failedCount: 0,
            },
        ]);
        // 2) recipients, 3) daily, 4) errors — all empty so the section build succeeds.
        enqueue([], [], []);
        // userCanAccessChannel will then be called → user does NOT own ch-other-tenant.
        storageMock.getChannelsByUserId.mockResolvedValue([{ id: "ch-mine" }]);
        const res = await request(app)
            .get("/api/whatsapp/analytics/export")
            .query({ format: "csv", type: "campaigns", campaignId: "camp-1" });
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/access denied/i);
        expect(storageMock.getChannelsByUserId).toHaveBeenCalledWith(ADMIN_OWNER.id);
    });
});
