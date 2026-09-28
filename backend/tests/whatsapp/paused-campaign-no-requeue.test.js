import { describe, it, expect, beforeEach, vi } from "vitest";
const queryQueue = [];
function enqueue(...results) {
    queryQueue.push(...results);
}
const updateCalls = [];
function makeChain(label) {
    let captured = undefined;
    let table = "";
    const handler = {
        get(_t, prop) {
            if (prop === "from") {
                return (t) => {
                    table = t?._?.name || t?.tableName || "";
                    return proxy;
                };
            }
            if (prop === "set") {
                return (vals) => {
                    captured = vals;
                    return proxy;
                };
            }
            if (prop === "then") {
                if (label === "update" && captured !== undefined) {
                    updateCalls.push({ table, values: captured });
                }
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
    select: vi.fn(() => makeChain("select")),
    update: vi.fn(() => makeChain("update")),
};
vi.mock("../../src/config/database", () => ({ db: dbMock, whatsappDb: dbMock, dbRead: dbMock }));
vi.mock("../../src/services/whatsappCache", () => ({
    cacheGet: vi.fn(async (_key, _ttl, loader) => loader()),
    CACHE_KEYS: { channel: (id) => `channel:${id}` },
    CACHE_TTL: { channel: 60 },
}));
const sendTemplateMock = vi.fn();
vi.mock("../../src/integrations/whatsapp/api", () => ({
    WhatsAppApiService: {
        checkRateLimit: vi.fn(async () => true),
        sendTemplateMessage: sendTemplateMock,
    },
}));
vi.mock("../../src/services/whatsappRedis", () => ({
    isRedisAvailable: vi.fn(() => true),
    getRedisClient: vi.fn(() => null),
}));
const queueAddSpy = vi.fn(async () => undefined);
vi.mock("bullmq", () => ({
    Queue: vi.fn().mockImplementation(() => ({ add: queueAddSpy })),
    Worker: vi.fn(),
    QueueEvents: vi.fn(),
}));
beforeEach(() => {
    queryQueue.length = 0;
    updateCalls.length = 0;
    dbMock.select.mockClear();
    dbMock.update.mockClear();
    sendTemplateMock.mockReset();
    queueAddSpy.mockClear();
});
describe("processMessageJob — paused campaign behaviour", () => {
    it("leaves the row in queued state with cleared scheduledFor and never re-adds the job when the campaign is paused", async () => {
        // Order matches the SQL the worker emits: UPDATE processing, SELECT channel,
        // SELECT campaign status, UPDATE queued.
        enqueue([]);
        enqueue([{ id: "ch-1" }]);
        enqueue([{ status: "paused" }]);
        enqueue([]);
        const { processMessageJob } = await import("../../src/services/whatsappBullQueue");
        const job = {
            id: "j1",
            data: {
                messageId: "msg-1",
                channelId: "ch-1",
                recipientPhone: "+15555550001",
                templateName: "promo",
                templateParams: [],
                messageType: "marketing",
                campaignId: "camp-1",
            },
            attemptsMade: 0,
            opts: { attempts: 3 },
        };
        await processMessageJob(job);
        const queueUpdates = updateCalls.filter((c) => c.values?.status === "queued");
        expect(queueUpdates.length).toBe(1);
        expect(queueUpdates[0].values.scheduledFor).toBeNull();
        expect(sendTemplateMock).not.toHaveBeenCalled();
        // The exact regression: previously the worker re-added a delayed BullMQ job,
        // creating an infinite loop. The fix must NOT enqueue any new job.
        expect(queueAddSpy).not.toHaveBeenCalled();
        const sentUpdates = updateCalls.filter((c) => c.values?.status === "sent");
        expect(sentUpdates.length).toBe(0);
        const failedUpdates = updateCalls.filter((c) => c.values?.status === "failed");
        expect(failedUpdates.length).toBe(0);
    });
    it("proceeds to send when the campaign is active", async () => {
        // Order: UPDATE processing, SELECT channel, SELECT campaign status, UPDATE sent, UPDATE campaign sentCount.
        enqueue([]);
        enqueue([{ id: "ch-1" }]);
        enqueue([{ status: "active" }]);
        enqueue([]);
        enqueue([]);
        sendTemplateMock.mockResolvedValue({ messages: [{ id: "wa-1" }] });
        const { processMessageJob } = await import("../../src/services/whatsappBullQueue");
        const job = {
            id: "j2",
            data: {
                messageId: "msg-2",
                channelId: "ch-1",
                recipientPhone: "+15555550002",
                templateName: "promo",
                templateParams: [],
                messageType: "marketing",
                campaignId: "camp-2",
            },
            attemptsMade: 0,
            opts: { attempts: 3 },
        };
        await processMessageJob(job);
        expect(sendTemplateMock).toHaveBeenCalledTimes(1);
        const sentUpdates = updateCalls.filter((c) => c.values?.status === "sent");
        expect(sentUpdates.length).toBe(1);
    });
});
