'use strict';
import { db } from "../config/database";
import { users, calls, campaigns, contacts, phoneNumbers, knowledgeBase, userSubscriptions, plans, incomingConnections, twilioOpenaiCalls, plivoCalls, sipCalls, appointments, forms, formSubmissions, webhookSubscriptions, promptTemplates } from "@shared/schema";
import { messages as waMessages, campaigns as waCampaigns, } from "@shared/whatsapp-schema";
import { eq, sql, and, gte, lt, desc, isNull, or, inArray } from "drizzle-orm";
const EMPTY_WHATSAPP_ANALYTICS = {
    totalMessages: 0,
    totalOutbound: 0,
    totalInbound: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    messagesFailed: 0,
    deliveryRate: 0,
    readRate: 0,
    totalWaCampaigns: 0,
    previousMessages: 0,
    previousWaCampaigns: 0,
    messageDayCounts: [],
    waCampaignDates: [],
};
async function calculateWhatsAppAnalytics(startDate, previousStartDate, previousEndDate, isAllTime) {
    try {
        const [stats] = await db
            .select({
            totalMessages: sql `count(*)::int`,
            totalOutbound: sql `count(case when ${waMessages.direction} = 'outbound' then 1 end)::int`,
            totalInbound: sql `count(case when ${waMessages.direction} = 'inbound' then 1 end)::int`,
            messagesDelivered: sql `count(case when ${waMessages.direction} = 'outbound' and ${waMessages.status} in ('delivered', 'read') then 1 end)::int`,
            messagesRead: sql `count(case when ${waMessages.direction} = 'outbound' and ${waMessages.status} = 'read' then 1 end)::int`,
            messagesFailed: sql `count(case when ${waMessages.direction} = 'outbound' and ${waMessages.status} = 'failed' then 1 end)::int`,
        })
            .from(waMessages)
            .where(gte(waMessages.createdAt, startDate));
        const [campaignRow] = await db
            .select({
            count: sql `count(*)::int`,
        })
            .from(waCampaigns)
            .where(gte(waCampaigns.createdAt, startDate));
        const dailyRows = await db
            .select({
            day: sql `(${waMessages.createdAt})::date`,
            count: sql `count(*)::int`,
        })
            .from(waMessages)
            .where(gte(waMessages.createdAt, startDate))
            .groupBy(sql `(${waMessages.createdAt})::date`);
        const campaignDateRows = await db
            .select({
            createdAt: waCampaigns.createdAt,
        })
            .from(waCampaigns)
            .where(gte(waCampaigns.createdAt, startDate));
        let previousMessages = 0;
        let previousWaCampaigns = 0;
        if (!isAllTime) {
            const [prevMsg] = await db
                .select({
                count: sql `count(*)::int`,
            })
                .from(waMessages)
                .where(and(gte(waMessages.createdAt, previousStartDate), lt(waMessages.createdAt, previousEndDate)));
            const [prevCampaign] = await db
                .select({
                count: sql `count(*)::int`,
            })
                .from(waCampaigns)
                .where(and(gte(waCampaigns.createdAt, previousStartDate), lt(waCampaigns.createdAt, previousEndDate)));
            previousMessages = Number(prevMsg?.count ?? 0);
            previousWaCampaigns = Number(prevCampaign?.count ?? 0);
        }
        const totalOutbound = Number(stats?.totalOutbound ?? 0);
        const messagesDelivered = Number(stats?.messagesDelivered ?? 0);
        const messagesRead = Number(stats?.messagesRead ?? 0);
        return {
            totalMessages: Number(stats?.totalMessages ?? 0),
            totalOutbound,
            totalInbound: Number(stats?.totalInbound ?? 0),
            messagesDelivered,
            messagesRead,
            messagesFailed: Number(stats?.messagesFailed ?? 0),
            deliveryRate: totalOutbound > 0 ? (messagesDelivered / totalOutbound) * 100 : 0,
            readRate: messagesDelivered > 0 ? (messagesRead / messagesDelivered) * 100 : 0,
            totalWaCampaigns: Number(campaignRow?.count ?? 0),
            previousMessages,
            previousWaCampaigns,
            messageDayCounts: dailyRows
                .filter((row) => row.day)
                .map((row) => ({
                createdAt: new Date(`${row.day}T00:00:00`),
                count: Number(row.count ?? 0),
            })),
            waCampaignDates: campaignDateRows
                .map((row) => row.createdAt)
                .filter((d) => !!d)
                .map((d) => new Date(d)),
        };
    }
    catch (error) {
        console.warn("[GlobalAnalytics] WhatsApp analytics unavailable:", error?.message || error);
        return EMPTY_WHATSAPP_ANALYTICS;
    }
}
export async function calculateGlobalAnalytics(timeRange) {
    const now = new Date();
    let startDate;
    let previousStartDate;
    let previousEndDate;
    let groupByWeek = false;
    let isAllTime = false;
    switch (timeRange) {
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            previousEndDate = new Date(startDate.getTime());
            previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            previousEndDate = new Date(startDate.getTime());
            previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
            break;
        case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            previousEndDate = new Date(startDate.getTime());
            previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            groupByWeek = true;
            break;
        case 'all':
            startDate = new Date(0);
            previousStartDate = new Date(0);
            previousEndDate = new Date(0);
            groupByWeek = true;
            isAllTime = true;
            break;
        default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            previousEndDate = new Date(startDate.getTime());
            previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }
    const allUsers = await db.select().from(users);
    const allPhoneNumbers = await db.select().from(phoneNumbers);
    const allContacts = await db.select().from(contacts);
    const allKnowledgeBases = await db.select().from(knowledgeBase);
    let filteredCalls = [];
    const filteredCampaigns = await db.select().from(campaigns).where(gte(campaigns.createdAt, startDate));
    const filteredUsers = await db.select().from(users).where(gte(users.createdAt, startDate));
    try {
        filteredCalls = await db.select().from(calls).where(gte(calls.createdAt, startDate));
    }
    catch (callFetchError) {
        if (callFetchError?.code === '42703') {
            console.warn('[GlobalAnalytics] Missing database column (run pre-upgrade-cleanup.sql then drizzle-kit push):', callFetchError.message);
        }
        else {
            console.error('[GlobalAnalytics] Error fetching filtered calls:', callFetchError.message);
        }
    }
    let previousUsers = [];
    let previousCalls = [];
    let previousCampaigns = [];
    if (!isAllTime) {
        previousUsers = await db.select().from(users).where(and(gte(users.createdAt, previousStartDate), lt(users.createdAt, previousEndDate)));
        try {
            previousCalls = await db.select().from(calls).where(and(gte(calls.createdAt, previousStartDate), lt(calls.createdAt, previousEndDate)));
        }
        catch (callFetchError) {
            if (callFetchError?.code === '42703') {
                console.warn('[GlobalAnalytics] Missing database column for previous calls:', callFetchError.message);
            }
            else {
                console.error('[GlobalAnalytics] Error fetching previous calls:', callFetchError.message);
            }
        }
        previousCampaigns = await db.select().from(campaigns).where(and(gte(campaigns.createdAt, previousStartDate), lt(campaigns.createdAt, previousEndDate)));
    }
    const calculateGrowthPercent = (current, previous) => {
        if (previous === 0) {
            return current > 0 ? 100 : 0;
        }
        return ((current - previous) / previous) * 100;
    };
    const userGrowthPercent = isAllTime ? 0 : calculateGrowthPercent(filteredUsers.length, previousUsers.length);
    const callGrowthPercent = isAllTime ? 0 : calculateGrowthPercent(filteredCalls.length, previousCalls.length);
    const campaignGrowthPercent = isAllTime ? 0 : calculateGrowthPercent(filteredCampaigns.length, previousCampaigns.length);
    const waAnalytics = await calculateWhatsAppAnalytics(startDate, previousStartDate, previousEndDate, isAllTime);
    const messageGrowthPercent = isAllTime
        ? 0
        : calculateGrowthPercent(waAnalytics.totalMessages, waAnalytics.previousMessages);
    const waCampaignGrowthPercent = isAllTime
        ? 0
        : calculateGrowthPercent(waAnalytics.totalWaCampaigns, waAnalytics.previousWaCampaigns);
    const totalCalls = filteredCalls.length;
    const completedCalls = filteredCalls.filter(c => c.status === 'completed').length;
    const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
    const qualifiedLeads = filteredCalls.filter(c => c.classification === 'hot' || c.classification === 'warm').length;
    const growthData = calculateGrowthData(filteredUsers, filteredCalls, filteredCampaigns, startDate, now, groupByWeek, isAllTime, waAnalytics.messageDayCounts, waAnalytics.waCampaignDates);
    const activeSubscriptions = await db
        .select({
        userId: userSubscriptions.userId,
        planName: plans.name,
        status: userSubscriptions.status,
        currentPeriodEnd: userSubscriptions.currentPeriodEnd,
    })
        .from(userSubscriptions)
        .innerJoin(plans, eq(userSubscriptions.planId, plans.id))
        .where(and(eq(userSubscriptions.status, 'active'), or(isNull(userSubscriptions.currentPeriodEnd), gte(userSubscriptions.currentPeriodEnd, now))));
    const proUserIds = new Set();
    for (const sub of activeSubscriptions) {
        if (sub.planName !== 'free') {
            proUserIds.add(sub.userId);
        }
    }
    const proPlanUsers = proUserIds.size;
    const freePlanUsers = allUsers.length - proPlanUsers;
    return {
        totalUsers: filteredUsers.length,
        totalCampaigns: filteredCampaigns.length,
        totalCalls,
        successRate,
        qualifiedLeads,
        activeUsers: filteredUsers.filter(u => u.isActive).length,
        proPlanUsers,
        freePlanUsers,
        totalPhoneNumbers: allPhoneNumbers.length,
        totalContacts: allContacts.length,
        totalKnowledgeBases: allKnowledgeBases.length,
        growthData,
        userGrowthPercent: Math.round(userGrowthPercent * 10) / 10,
        callGrowthPercent: Math.round(callGrowthPercent * 10) / 10,
        campaignGrowthPercent: Math.round(campaignGrowthPercent * 10) / 10,
        totalMessages: waAnalytics.totalMessages,
        totalOutbound: waAnalytics.totalOutbound,
        totalInbound: waAnalytics.totalInbound,
        messagesDelivered: waAnalytics.messagesDelivered,
        messagesRead: waAnalytics.messagesRead,
        messagesFailed: waAnalytics.messagesFailed,
        deliveryRate: Math.round(waAnalytics.deliveryRate * 10) / 10,
        readRate: Math.round(waAnalytics.readRate * 10) / 10,
        totalWaCampaigns: waAnalytics.totalWaCampaigns,
        messageGrowthPercent: Math.round(messageGrowthPercent * 10) / 10,
        waCampaignGrowthPercent: Math.round(waCampaignGrowthPercent * 10) / 10,
    };
}
function calculateGrowthData(filteredUsers, filteredCalls, filteredCampaigns, startDate, now, groupByWeek, isAllTime, messageDayCounts = [], waCampaignDates = []) {
    const growthMap = new Map();
    const getIsoDateKey = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
    };
    const getMonthKey = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const formatDateLabel = (isoDate, isMonthly = false) => {
        if (isMonthly) {
            const [year, month] = isoDate.split('-');
            const d = new Date(parseInt(year), parseInt(month) - 1, 1);
            return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        }
        const d = new Date(isoDate + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    let chartStartDate = startDate;
    let useMonthlyBuckets = false;
    if (isAllTime) {
        const allDates = [];
        for (const user of filteredUsers) {
            if (user.createdAt)
                allDates.push(new Date(user.createdAt));
        }
        for (const call of filteredCalls) {
            if (call.createdAt)
                allDates.push(new Date(call.createdAt));
        }
        for (const campaign of filteredCampaigns) {
            if (campaign.createdAt)
                allDates.push(new Date(campaign.createdAt));
        }
        for (const row of messageDayCounts) {
            if (row.createdAt)
                allDates.push(new Date(row.createdAt));
        }
        for (const date of waCampaignDates) {
            allDates.push(new Date(date));
        }
        if (allDates.length > 0) {
            chartStartDate = allDates.reduce((min, d) => d < min ? d : min, allDates[0]);
            chartStartDate = new Date(chartStartDate.getFullYear(), chartStartDate.getMonth(), 1);
        }
        else {
            chartStartDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        }
        useMonthlyBuckets = true;
    }
    const startDateIso = useMonthlyBuckets ? getMonthKey(chartStartDate) : getIsoDateKey(chartStartDate);
    const nowDateIso = useMonthlyBuckets ? getMonthKey(now) : getIsoDateKey(now);
    const bucketKeys = [];
    const currentDate = new Date(chartStartDate);
    currentDate.setHours(0, 0, 0, 0);
    if (useMonthlyBuckets) {
        while (getMonthKey(currentDate) <= nowDateIso) {
            bucketKeys.push(getMonthKey(currentDate));
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    }
    else {
        const interval = groupByWeek ? 7 : 1;
        while (getIsoDateKey(currentDate) <= nowDateIso) {
            bucketKeys.push(getIsoDateKey(currentDate));
            currentDate.setDate(currentDate.getDate() + interval);
        }
    }
    if (bucketKeys.length === 0) {
        bucketKeys.push(startDateIso);
    }
    for (const key of bucketKeys) {
        growthMap.set(key, { users: 0, calls: 0, campaigns: 0, messages: 0, waCampaigns: 0 });
    }
    const getBucketKey = (date) => {
        if (useMonthlyBuckets) {
            const monthKey = getMonthKey(date);
            if (monthKey < startDateIso || monthKey > nowDateIso) {
                return null;
            }
            return growthMap.has(monthKey) ? monthKey : null;
        }
        const dateKey = getIsoDateKey(date);
        if (dateKey < startDateIso || dateKey > nowDateIso) {
            return null;
        }
        if (groupByWeek) {
            for (let i = bucketKeys.length - 1; i >= 0; i--) {
                if (dateKey >= bucketKeys[i]) {
                    return bucketKeys[i];
                }
            }
            return bucketKeys[0];
        }
        else {
            return growthMap.has(dateKey) ? dateKey : null;
        }
    };
    for (const user of filteredUsers) {
        if (user.createdAt) {
            const bucketKey = getBucketKey(new Date(user.createdAt));
            if (bucketKey) {
                const entry = growthMap.get(bucketKey);
                if (entry)
                    entry.users++;
            }
        }
    }
    for (const call of filteredCalls) {
        if (call.createdAt) {
            const bucketKey = getBucketKey(new Date(call.createdAt));
            if (bucketKey) {
                const entry = growthMap.get(bucketKey);
                if (entry)
                    entry.calls++;
            }
        }
    }
    for (const campaign of filteredCampaigns) {
        if (campaign.createdAt) {
            const bucketKey = getBucketKey(new Date(campaign.createdAt));
            if (bucketKey) {
                const entry = growthMap.get(bucketKey);
                if (entry)
                    entry.campaigns++;
            }
        }
    }
    for (const row of messageDayCounts) {
        const bucketKey = getBucketKey(new Date(row.createdAt));
        if (bucketKey) {
            const entry = growthMap.get(bucketKey);
            if (entry)
                entry.messages += row.count;
        }
    }
    for (const date of waCampaignDates) {
        const bucketKey = getBucketKey(new Date(date));
        if (bucketKey) {
            const entry = growthMap.get(bucketKey);
            if (entry)
                entry.waCampaigns++;
        }
    }
    return Array.from(growthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([isoDate, data]) => ({
        date: formatDateLabel(isoDate, useMonthlyBuckets),
        ...data
    }));
}
export async function calculateUserAnalytics(userId, timeRange = '7days', callType = 'all') {
    const now = new Date();
    let startDate = new Date();
    switch (timeRange) {
        case '7days':
            startDate.setDate(now.getDate() - 7);
            break;
        case '30days':
            startDate.setDate(now.getDate() - 30);
            break;
        case '90days':
            startDate.setDate(now.getDate() - 90);
            break;
        case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        case 'all':
            startDate = new Date(0);
            break;
        default: startDate.setDate(now.getDate() - 7);
    }
    const userCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
    const campaignIds = userCampaigns.map(c => c.id);
    const userIncomingConnections = await db.select().from(incomingConnections).where(eq(incomingConnections.userId, userId));
    const incomingConnectionIds = userIncomingConnections.map(c => c.id);
    let allUserCalls = [];
    try {
        const directOwnershipCalls = await db.select()
            .from(calls)
            .where(and(eq(calls.userId, userId), gte(calls.createdAt, startDate)));
        allUserCalls.push(...directOwnershipCalls);
        if (campaignIds.length > 0) {
            const campaignCalls = await db.select()
                .from(calls)
                .where(and(inArray(calls.campaignId, campaignIds), gte(calls.createdAt, startDate)));
            for (const call of campaignCalls) {
                if (!allUserCalls.find(c => c.id === call.id)) {
                    allUserCalls.push(call);
                }
            }
        }
        if (incomingConnectionIds.length > 0) {
            const incomingCalls = await db.select()
                .from(calls)
                .where(and(inArray(calls.incomingConnectionId, incomingConnectionIds), gte(calls.createdAt, startDate)));
            for (const call of incomingCalls) {
                if (!allUserCalls.find(c => c.id === call.id)) {
                    allUserCalls.push(call);
                }
            }
        }
        const twilioOpenAICallsData = await db.select()
            .from(twilioOpenaiCalls)
            .where(and(eq(twilioOpenaiCalls.userId, userId), gte(twilioOpenaiCalls.createdAt, startDate)));
        for (const toc of twilioOpenAICallsData) {
            allUserCalls.push({
                id: toc.id,
                userId: toc.userId,
                campaignId: toc.campaignId,
                contactId: toc.contactId,
                phoneNumber: toc.fromNumber,
                status: toc.status,
                callDirection: toc.callDirection,
                duration: toc.duration,
                classification: null,
                sentiment: toc.sentiment,
                createdAt: toc.createdAt,
                metadata: toc.metadata,
                incomingConnectionId: null,
            });
        }
        const plivoAnalyticsCallsData = await db.select()
            .from(plivoCalls)
            .where(and(eq(plivoCalls.userId, userId), gte(plivoCalls.createdAt, startDate)));
        for (const pc of plivoAnalyticsCallsData) {
            allUserCalls.push({
                id: pc.id,
                userId: pc.userId,
                campaignId: pc.campaignId,
                contactId: pc.contactId,
                phoneNumber: pc.fromNumber,
                status: pc.status,
                callDirection: pc.callDirection,
                duration: pc.duration,
                classification: null,
                sentiment: pc.sentiment,
                createdAt: pc.createdAt,
                metadata: pc.metadata,
                incomingConnectionId: null,
            });
        }
        const sipCallsData = await db.select()
            .from(sipCalls)
            .where(and(eq(sipCalls.userId, userId), gte(sipCalls.createdAt, startDate)));
        for (const sc of sipCallsData) {
            allUserCalls.push({
                id: sc.id,
                userId: sc.userId,
                campaignId: sc.campaignId,
                contactId: sc.contactId,
                phoneNumber: sc.direction === 'inbound' ? sc.fromNumber : sc.toNumber,
                status: sc.status,
                callDirection: sc.direction === 'inbound' ? 'incoming' : 'outgoing',
                duration: sc.durationSeconds,
                classification: sc.classification || null,
                sentiment: sc.sentiment || null,
                createdAt: sc.createdAt,
                metadata: sc.metadata,
                incomingConnectionId: null,
            });
        }
        try {
            const veSessionsResult = await db.execute(sql `
        SELECT s.*, a.name as agent_name
        FROM ve_sessions s
        LEFT JOIN ve_voice_agents a ON s.agent_id = a.id
        WHERE s.user_id = ${userId} AND s.created_at >= ${startDate}
      `);
            for (const r of veSessionsResult.rows) {
                allUserCalls.push({
                    id: r.id,
                    userId: r.user_id,
                    campaignId: null,
                    contactId: null,
                    phoneNumber: r.direction === 'inbound' ? r.from_number : r.to_number,
                    status: r.status,
                    callDirection: r.direction === 'inbound' ? 'incoming' : 'outgoing',
                    duration: r.duration_seconds,
                    classification: r.classification || r.metadata?.classification || null,
                    sentiment: r.sentiment || null,
                    createdAt: new Date(r.created_at),
                    metadata: r.metadata || null,
                    incomingConnectionId: null,
                });
            }
        }
        catch (veErr) {
            console.error("[Analytics] Error fetching ve_sessions calls:", veErr.message);
        }
    }
    catch (callFetchError) {
        if (callFetchError?.code === '42703') {
            console.warn('[Analytics] Missing database column (run pre-upgrade-cleanup.sql then drizzle-kit push):', callFetchError.message);
        }
        else {
            console.error('[Analytics] Error fetching calls:', callFetchError.message);
        }
    }
    const isBatchCall = (c) => {
        const meta = c.metadata;
        return !!(meta?.batch_call || meta?.batchId || meta?.batch_calling);
    };
    const incomingDirections = ['incoming', 'inbound', 'bridged', 'simulcall'];
    const outgoingDirections = ['outgoing', 'outbound'];
    const isIncomingCall = (c) => incomingDirections.includes(c.callDirection || '') || !!c.incomingConnectionId;
    const isOutgoingCall = (c) => {
        if (isBatchCall(c))
            return false;
        if (outgoingDirections.includes(c.callDirection || ''))
            return true;
        if (c.campaignId && !c.incomingConnectionId && !incomingDirections.includes(c.callDirection || ''))
            return true;
        if (!isIncomingCall(c))
            return true;
        return false;
    };
    let filteredCalls = allUserCalls;
    if (callType === 'incoming')
        filteredCalls = allUserCalls.filter(isIncomingCall);
    else if (callType === 'outgoing')
        filteredCalls = allUserCalls.filter(isOutgoingCall);
    else if (callType === 'batch')
        filteredCalls = allUserCalls.filter(isBatchCall);
    const allCalls = filteredCalls;
    const typeBreakdown = {
        incoming: allUserCalls.filter(isIncomingCall).length,
        outgoing: allUserCalls.filter(isOutgoingCall).length,
        batch: allUserCalls.filter(isBatchCall).length,
        total: allUserCalls.length
    };
    const totalCalls = allCalls.length;
    const completedCalls = allCalls.filter(c => c.status === 'completed').length;
    const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
    const qualifiedLeads = allCalls.filter(c => c.classification === 'hot' || c.classification === 'warm').length;
    const totalDuration = allCalls.reduce((sum, call) => sum + (call.duration || 0), 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
    const leadCounts = {
        hot: allCalls.filter(c => c.classification === 'hot' || c.classification === 'qualified').length,
        warm: allCalls.filter(c => c.classification === 'warm' || c.classification === 'interested').length,
        cold: allCalls.filter(c => c.classification === 'cold' || c.classification === 'not_interested').length,
        lost: allCalls.filter(c => c.classification === 'lost' || c.classification === 'do_not_call').length
    };
    const leadDistribution = [
        { name: 'Hot', value: leadCounts.hot },
        { name: 'Warm', value: leadCounts.warm },
        { name: 'Cold', value: leadCounts.cold },
        { name: 'Lost', value: leadCounts.lost }
    ].filter(item => item.value > 0);
    const sentimentCounts = {
        positive: allCalls.filter(c => c.sentiment === 'positive').length,
        neutral: allCalls.filter(c => c.sentiment === 'neutral').length,
        negative: allCalls.filter(c => c.sentiment === 'negative').length
    };
    const sentimentDistribution = [
        { name: 'Positive', value: sentimentCounts.positive },
        { name: 'Neutral', value: sentimentCounts.neutral },
        { name: 'Negative', value: sentimentCounts.negative }
    ].filter(item => item.value > 0);
    const campaignPerformance = userCampaigns.map(campaign => {
        const campaignCalls = allCalls.filter(c => c.campaignId === campaign.id);
        const completed = campaignCalls.filter(c => c.status === 'completed').length;
        const total = campaignCalls.length;
        const rate = total > 0 ? (completed / total) * 100 : 0;
        return {
            name: campaign.name,
            value: parseFloat(rate.toFixed(1)),
            totalCalls: total,
            completedCalls: completed
        };
    });
    const dailyCalls = calculateDailyCalls(allCalls, timeRange);
    return {
        totalCalls,
        successRate: parseFloat(successRate.toFixed(1)),
        qualifiedLeads,
        avgDuration: Math.round(avgDuration),
        leadDistribution,
        sentimentDistribution,
        campaignPerformance,
        dailyCalls,
        typeBreakdown
    };
}
function calculateDailyCalls(allCalls, timeRange) {
    const dailyCalls = [];
    let daysToShow = 7;
    if (timeRange === '30days')
        daysToShow = 30;
    else if (timeRange === '90days')
        daysToShow = 90;
    else if (timeRange === 'year')
        daysToShow = 365;
    if (daysToShow <= 14) {
        for (let i = daysToShow - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            const dayCount = allCalls.filter(call => {
                const callDate = new Date(call.createdAt);
                return callDate >= date && callDate < nextDay;
            }).length;
            dailyCalls.push({ date: date.toISOString(), count: dayCount });
        }
    }
    else if (daysToShow <= 90) {
        const weeksToShow = Math.ceil(daysToShow / 7);
        for (let i = weeksToShow - 1; i >= 0; i--) {
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - (i * 7));
            weekEnd.setHours(23, 59, 59, 999);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 6);
            weekStart.setHours(0, 0, 0, 0);
            const weekCount = allCalls.filter(call => {
                const callDate = new Date(call.createdAt);
                return callDate >= weekStart && callDate <= weekEnd;
            }).length;
            dailyCalls.push({ date: weekStart.toISOString(), count: weekCount });
        }
    }
    else {
        for (let i = 11; i >= 0; i--) {
            const monthStart = new Date();
            monthStart.setMonth(monthStart.getMonth() - i);
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setDate(0);
            monthEnd.setHours(23, 59, 59, 999);
            const monthCount = allCalls.filter(call => {
                const callDate = new Date(call.createdAt);
                return callDate >= monthStart && callDate <= monthEnd;
            }).length;
            dailyCalls.push({ date: monthStart.toISOString(), count: monthCount });
        }
    }
    return dailyCalls;
}
export async function calculateDashboardData(userId) {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    const userCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
    const campaignIds = userCampaigns.map(c => c.id);
    const userIncomingConnections = await db.select().from(incomingConnections).where(eq(incomingConnections.userId, userId));
    const incomingConnectionIds = userIncomingConnections.map(c => c.id);
    let allUserCalls = [];
    try {
        const directOwnershipCalls = await db.select().from(calls).where(eq(calls.userId, userId));
        allUserCalls.push(...directOwnershipCalls);
        if (campaignIds.length > 0) {
            const campaignCalls = await db.select().from(calls).where(inArray(calls.campaignId, campaignIds));
            for (const call of campaignCalls) {
                if (!allUserCalls.find(c => c.id === call.id)) {
                    allUserCalls.push(call);
                }
            }
        }
        if (incomingConnectionIds.length > 0) {
            const incomingCalls = await db.select().from(calls).where(inArray(calls.incomingConnectionId, incomingConnectionIds));
            for (const call of incomingCalls) {
                if (!allUserCalls.find(c => c.id === call.id)) {
                    allUserCalls.push(call);
                }
            }
        }
        const twilioOpenAICallsData = await db.select().from(twilioOpenaiCalls).where(eq(twilioOpenaiCalls.userId, userId));
        for (const toc of twilioOpenAICallsData) {
            allUserCalls.push({
                id: toc.id,
                userId: toc.userId,
                campaignId: toc.campaignId,
                contactId: toc.contactId,
                phoneNumber: toc.fromNumber,
                status: toc.status,
                callDirection: toc.callDirection,
                duration: toc.duration,
                classification: toc.classification,
                sentiment: toc.sentiment,
                createdAt: toc.createdAt,
                metadata: toc.metadata,
                incomingConnectionId: null,
            });
        }
        const plivoCallsData = await db.select().from(plivoCalls).where(eq(plivoCalls.userId, userId));
        for (const pc of plivoCallsData) {
            allUserCalls.push({
                id: pc.id,
                userId: pc.userId,
                campaignId: pc.campaignId,
                contactId: pc.contactId,
                phoneNumber: pc.fromNumber,
                status: pc.status,
                callDirection: pc.callDirection,
                duration: pc.duration,
                classification: pc.classification,
                sentiment: pc.sentiment,
                createdAt: pc.createdAt,
                metadata: pc.metadata,
                incomingConnectionId: null,
            });
        }
        const sipCallsData = await db.select().from(sipCalls).where(eq(sipCalls.userId, userId));
        for (const sc of sipCallsData) {
            allUserCalls.push({
                id: sc.id,
                userId: sc.userId,
                campaignId: sc.campaignId,
                contactId: sc.contactId,
                phoneNumber: sc.direction === 'inbound' ? sc.fromNumber : sc.toNumber,
                status: sc.status,
                callDirection: sc.direction === 'inbound' ? 'incoming' : 'outgoing',
                duration: sc.durationSeconds,
                classification: null,
                sentiment: null,
                createdAt: sc.createdAt,
                metadata: sc.metadata,
            });
        }
        try {
            const veSessionsResult = await db.execute(sql `
        SELECT s.*, a.name as agent_name
        FROM ve_sessions s
        LEFT JOIN ve_voice_agents a ON s.agent_id = a.id
        WHERE s.user_id = ${userId}
      `);
            for (const r of veSessionsResult.rows) {
                allUserCalls.push({
                    id: r.id,
                    userId: r.user_id,
                    campaignId: null,
                    contactId: null,
                    phoneNumber: r.direction === 'inbound' ? r.from_number : r.to_number,
                    status: r.status,
                    callDirection: r.direction === 'inbound' ? 'incoming' : 'outgoing',
                    duration: r.duration_seconds,
                    classification: r.classification || r.metadata?.classification || null,
                    sentiment: r.sentiment || null,
                    createdAt: new Date(r.created_at),
                    metadata: r.metadata || null,
                    incomingConnectionId: null,
                });
            }
        }
        catch (veErr) {
            console.error("[Dashboard] Error fetching ve_sessions calls:", veErr.message);
        }
    }
    catch (callFetchError) {
        if (callFetchError?.code === '42703') {
            console.warn('[Dashboard] Missing database column (run pre-upgrade-cleanup.sql then drizzle-kit push):', callFetchError.message);
        }
        else {
            console.error('[Dashboard] Error fetching calls:', callFetchError.message);
        }
    }
    const incomingDirections = ['incoming', 'inbound', 'bridged', 'simulcall'];
    const outgoingDirections = ['outgoing', 'outbound'];
    const isBatchCall = (c) => {
        const meta = c.metadata;
        return !!(meta?.batch_call || meta?.batchId || meta?.batch_calling);
    };
    const isIncomingCall = (c) => incomingDirections.includes(c.callDirection || '') || !!c.incomingConnectionId;
    const isOutgoingCall = (c) => {
        if (isBatchCall(c))
            return false;
        if (outgoingDirections.includes(c.callDirection || ''))
            return true;
        if (c.campaignId && !c.incomingConnectionId && !incomingDirections.includes(c.callDirection || ''))
            return true;
        if (!isIncomingCall(c))
            return true;
        return false;
    };
    const prevWeekStart = new Date();
    prevWeekStart.setDate(now.getDate() - 14);
    const thisWeekCalls = allUserCalls.filter(c => new Date(c.createdAt) >= weekAgo);
    const prevWeekCalls = allUserCalls.filter(c => {
        const date = new Date(c.createdAt);
        return date >= prevWeekStart && date < weekAgo;
    });
    const incomingThisWeek = thisWeekCalls.filter(isIncomingCall);
    const outgoingThisWeek = thisWeekCalls.filter(isOutgoingCall);
    const incomingPrevWeek = prevWeekCalls.filter(isIncomingCall);
    const outgoingPrevWeek = prevWeekCalls.filter(isOutgoingCall);
    const calcTrend = (current, previous) => {
        if (previous === 0)
            return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };
    const calcStats = (callList) => {
        const completed = callList.filter(c => c.status === 'completed');
        const successRate = callList.length > 0
            ? Math.round((completed.length / callList.length) * 100)
            : 0;
        const avgDuration = completed.length > 0
            ? Math.round(completed.reduce((sum, c) => sum + (c.duration || 0), 0) / completed.length)
            : 0;
        return { successRate, avgDuration };
    };
    const dailyBreakdown = [];
    for (let i = 6; i >= 0; i--) {
        const day = new Date();
        day.setDate(now.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        const dayCalls = thisWeekCalls.filter(c => {
            const callDate = new Date(c.createdAt);
            return callDate >= day && callDate <= dayEnd;
        });
        dailyBreakdown.push({
            date: day.toISOString(),
            incoming: dayCalls.filter(isIncomingCall).length,
            outgoing: dayCalls.filter(isOutgoingCall).length
        });
    }
    const leadDistribution = {
        hot: allUserCalls.filter(c => c.classification?.toLowerCase() === 'hot' || c.classification?.toLowerCase() === 'qualified').length,
        warm: allUserCalls.filter(c => c.classification?.toLowerCase() === 'warm' || c.classification?.toLowerCase() === 'interested').length,
        cold: allUserCalls.filter(c => c.classification?.toLowerCase() === 'cold' || c.classification?.toLowerCase() === 'not_interested').length,
        lost: allUserCalls.filter(c => c.classification?.toLowerCase() === 'lost' || c.classification?.toLowerCase() === 'do_not_call').length
    };
    let recentCalls = [];
    try {
        recentCalls = await db.select({
            id: calls.id,
            phoneNumber: calls.phoneNumber,
            status: calls.status,
            duration: calls.duration,
            classification: calls.classification,
            callDirection: calls.callDirection,
            createdAt: calls.createdAt,
            campaignId: calls.campaignId,
            incomingConnectionId: calls.incomingConnectionId,
            metadata: calls.metadata
        })
            .from(calls)
            .where(eq(calls.userId, userId))
            .orderBy(desc(calls.createdAt))
            .limit(10);
    }
    catch (callFetchError) {
        if (callFetchError?.code === '42703') {
            console.warn('[Dashboard] Missing database column for recent calls:', callFetchError.message);
        }
        else {
            console.error('[Dashboard] Error fetching recent calls:', callFetchError.message);
        }
    }
    let recentUsers = [];
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
        recentUsers = await db.select({
            id: users.id,
            email: users.email,
            createdAt: users.createdAt
        })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(5);
    }
    const totalCampaigns = userCampaigns.length;
    const activeCampaigns = userCampaigns.filter(c => c.status === 'in_progress' || c.status === 'scheduled' || c.status === 'pending').length;
    const completedCampaigns = userCampaigns.filter(c => c.status === 'completed').length;
    let allCampaignCalls = [];
    if (campaignIds.length > 0) {
        try {
            allCampaignCalls = await db.select().from(calls).where(inArray(calls.campaignId, campaignIds));
        }
        catch (callFetchError) {
            if (callFetchError?.code === '42703') {
                console.warn('[Dashboard] Missing database column for campaign calls:', callFetchError.message);
            }
            else {
                console.error('[Dashboard] Error fetching campaign calls:', callFetchError.message);
            }
        }
    }
    const campaignCallsCompleted = allCampaignCalls.filter(c => c.status === 'completed');
    const campaignSuccessRate = allCampaignCalls.length > 0
        ? Math.round((campaignCallsCompleted.length / allCampaignCalls.length) * 100)
        : 0;
    const campaignAvgDuration = campaignCallsCompleted.length > 0
        ? Math.round(campaignCallsCompleted.reduce((sum, c) => sum + (c.duration || 0), 0) / campaignCallsCompleted.length)
        : 0;
    const [appointmentsResult] = await db
        .select({ count: sql `count(*)` })
        .from(appointments)
        .where(eq(appointments.userId, userId));
    const appointmentsCount = Number(appointmentsResult?.count || 0);
    const userForms = await db.select({ id: forms.id }).from(forms).where(eq(forms.userId, userId));
    const formsCount = userForms.length;
    let formSubmissionsCount = 0;
    if (userForms.length > 0) {
        const formIds = userForms.map(f => f.id);
        const [submissionsResult] = await db
            .select({ count: sql `count(*)` })
            .from(formSubmissions)
            .where(inArray(formSubmissions.formId, formIds));
        formSubmissionsCount = Number(submissionsResult?.count || 0);
    }
    const [kbResult] = await db
        .select({ count: sql `count(*)` })
        .from(knowledgeBase)
        .where(eq(knowledgeBase.userId, userId));
    const knowledgeBaseCount = Number(kbResult?.count || 0);
    const [webhooksResult] = await db
        .select({ count: sql `count(*)` })
        .from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.userId, userId));
    const webhooksCount = Number(webhooksResult?.count || 0);
    const [userTemplatesResult] = await db
        .select({ count: sql `count(*)` })
        .from(promptTemplates)
        .where(eq(promptTemplates.userId, userId));
    const userTemplatesCount = Number(userTemplatesResult?.count || 0);
    const [systemTemplatesResult] = await db
        .select({ count: sql `count(*)` })
        .from(promptTemplates)
        .where(eq(promptTemplates.isSystemTemplate, true));
    const systemTemplatesCount = Number(systemTemplatesResult?.count || 0);
    const templatesCount = userTemplatesCount + systemTemplatesCount;
    const sentimentDistribution = {
        positive: allUserCalls.filter(c => c.sentiment === 'positive').length,
        neutral: allUserCalls.filter(c => c.sentiment === 'neutral').length,
        negative: allUserCalls.filter(c => c.sentiment === 'negative').length
    };
    const incomingAllTime = allUserCalls.filter(isIncomingCall);
    const outgoingAllTime = allUserCalls.filter(isOutgoingCall);
    const incomingAllStats = calcStats(incomingAllTime);
    const outgoingAllStats = calcStats(outgoingAllTime);
    return {
        callTypeStats: {
            incoming: {
                count: incomingAllTime.length,
                trend: calcTrend(incomingThisWeek.length, incomingPrevWeek.length),
                successRate: incomingAllStats.successRate,
                avgDuration: incomingAllStats.avgDuration
            },
            outgoing: {
                count: outgoingAllTime.length,
                trend: calcTrend(outgoingThisWeek.length, outgoingPrevWeek.length),
                successRate: outgoingAllStats.successRate,
                avgDuration: outgoingAllStats.avgDuration
            },
            campaign: {
                count: totalCampaigns,
                active: activeCampaigns,
                completed: completedCampaigns,
                successRate: campaignSuccessRate,
                avgDuration: campaignAvgDuration,
                totalCalls: allCampaignCalls.length
            }
        },
        weeklyCallsChart: dailyBreakdown,
        leadDistribution,
        sentimentDistribution,
        recentCalls: recentCalls.map(c => ({
            ...c,
            callType: isBatchCall(c) ? 'batch' :
                (c.callDirection === 'incoming' || c.incomingConnectionId) ? 'incoming' : 'outgoing'
        })),
        recentUsers,
        userName: currentUser?.name || currentUser?.email?.split('@')[0] || 'User',
        totalCalls: allUserCalls.length,
        totalThisWeek: thisWeekCalls.length,
        totalPrevWeek: prevWeekCalls.length,
        weeklyTrend: calcTrend(thisWeekCalls.length, prevWeekCalls.length),
        appointmentsBooked: appointmentsCount,
        formsSubmitted: formSubmissionsCount,
        formsCount: formsCount,
        knowledgeBaseCount: knowledgeBaseCount,
        webhooksCount: webhooksCount,
        templatesCount: templatesCount
    };
}
