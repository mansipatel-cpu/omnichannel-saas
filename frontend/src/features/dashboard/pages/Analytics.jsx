import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { apiRequest } from "@/shared/lib/queryClient";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppHeader } from "@/shared/components/AppPageHeader";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/shared/components/ui/table";
import { MessageSquare, Phone, Download, Calendar, CheckCircle, Eye, Reply, XCircle, Send, Clock, Users, TrendingUp, PhoneIncoming, PhoneOutgoing, Target, Info, Filter, ExternalLink, Loader2, } from "lucide-react";
const PIE_COLORS = ["#007BFF", "#94A3B8", "#10B981", "#F59E0B", "#EF4444"];
function authFetch(url) {
    const headers = {};
    const authHeader = AuthStorage.getAuthHeader();
    if (authHeader)
        headers.Authorization = authHeader;
    return fetch(url, { credentials: "include", headers });
}
function readChannelFromUrl() {
    if (typeof window === "undefined")
        return "whatsapp";
    const params = new URLSearchParams(window.location.search);
    return params.get("channel") === "calling" ? "calling" : "whatsapp";
}
function formatDuration(seconds) {
    if (!seconds)
        return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
function statusBadgeClass(status) {
    const key = (status || "").toLowerCase();
    if (key === "completed" || key === "active")
        return "bg-blue-50 text-blue-700";
    if (key === "failed")
        return "bg-red-50 text-red-600";
    if (key === "scheduled")
        return "bg-amber-50 text-amber-700";
    return "bg-slate-100 text-slate-600";
}
function KpiCard({ label, value, icon, iconBg, iconColor, subtitle, progress, progressColor, valueClass, }) {
    return (<div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${valueClass || "text-slate-900"}`}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {typeof progress === "number" && (<div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
              <div className={`h-1.5 rounded-full ${progressColor || "bg-[#007BFF]"}`} style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}/>
            </div>)}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor || ""}`}>
          {icon}
        </div>
      </div>
    </div>);
}
function ChartCard({ title, subtitle, action, children, className = "", }) {
    return (<div className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>);
}
function EmptyChartNote({ text }) {
    return (<div className="h-[260px] flex items-center justify-center text-sm text-slate-400">
      {text}
    </div>);
}
export default function Analytics() {
    const [location, setLocation] = useLocation();
    const { toast } = useToast();
    const { setPageMeta } = useAppHeader();
    const [channel, setChannel] = useState(readChannelFromUrl);
    const [waTab, setWaTab] = useState("overview");
    const [callTab, setCallTab] = useState("all");
    const [timeRange, setTimeRange] = useState("7days");
    const [waDays, setWaDays] = useState(30);
    const [exporting, setExporting] = useState(false);
    useEffect(() => {
        setChannel(readChannelFromUrl());
    }, [location]);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set("channel", channel);
        const next = `/analytics?${params.toString()}`;
        if (`${window.location.pathname}${window.location.search}` !== next) {
            window.history.replaceState(null, "", next);
        }
    }, [channel]);
    useEffect(() => {
        setPageMeta({
            title: channel === "whatsapp" ? "Analytics & Performance" : "Auto Calling Analytics",
            subtitle: channel === "whatsapp"
                ? "Comprehensive delivery rates, engagement metrics, and campaign conversion telemetry."
                : "Comprehensive voice call insights and performance metrics.",
        });
        return () => setPageMeta(null);
    }, [setPageMeta, channel, waTab]);
    const end = useMemo(() => new Date(), []);
    const start = useMemo(() => new Date(Date.now() - waDays * 24 * 60 * 60 * 1000), [waDays]);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const { data: activeChannel } = useQuery({
        queryKey: ["/api/whatsapp/channels/active"],
        enabled: channel === "whatsapp",
        queryFn: async () => {
            const res = await authFetch("/api/whatsapp/channels/active");
            if (!res.ok)
                return null;
            return res.json();
        },
    });
    const { data: messageAnalytics, isLoading: messageLoading } = useQuery({
        queryKey: ["/api/whatsapp/analytics/messages", activeChannel?.id, waDays],
        enabled: channel === "whatsapp" && !!activeChannel?.id,
        queryFn: async () => {
            const params = new URLSearchParams({
                startDate: startIso,
                endDate: endIso,
                channelId: activeChannel.id,
            });
            const res = await authFetch(`/api/whatsapp/analytics/messages?${params}`);
            if (!res.ok)
                throw new Error("Failed to load message analytics");
            return res.json();
        },
    });
    const { data: campaignAnalytics, isLoading: campaignLoading } = useQuery({
        queryKey: ["/api/whatsapp/analytics/campaigns", activeChannel?.id],
        enabled: channel === "whatsapp" && !!activeChannel?.id,
        queryFn: async () => {
            const params = new URLSearchParams({ channelId: activeChannel.id });
            const res = await authFetch(`/api/whatsapp/analytics/campaigns?${params}`);
            if (!res.ok)
                throw new Error("Failed to load campaign analytics");
            return res.json();
        },
    });
    const { data: callAnalytics, isLoading: callLoading } = useQuery({
        queryKey: ["/api/analytics", timeRange, callTab],
        enabled: channel === "calling",
        queryFn: async () => {
            const res = await authFetch(`/api/analytics?timeRange=${timeRange}&callType=${callTab}`);
            if (!res.ok)
                throw new Error("Failed to load calling analytics");
            return res.json();
        },
    });
    const messageMetrics = messageAnalytics?.overall || {};
    const campaignSummary = campaignAnalytics?.summary || {};
    const campaigns = Array.isArray(campaignAnalytics?.campaigns)
        ? campaignAnalytics.campaigns
        : Array.isArray(campaignAnalytics?.data)
            ? campaignAnalytics.data
            : [];
    const totalOutbound = Number(messageMetrics.totalOutbound) || 0;
    const totalInbound = Number(messageMetrics.totalInbound) || 0;
    const totalMessages = Number(messageMetrics.totalMessages) || totalOutbound + totalInbound;
    const totalDelivered = Number(messageMetrics.totalDelivered) || 0;
    const totalRead = Number(messageMetrics.totalRead) || 0;
    const totalReplied = Number(messageMetrics.totalReplied) || 0;
    const totalFailed = Number(messageMetrics.totalFailed) || 0;
    const deliveryRate = totalOutbound > 0 ? Math.min((totalDelivered / totalOutbound) * 100, 100) : 0;
    const readRate = totalDelivered > 0 ? Math.min((totalRead / totalDelivered) * 100, 100) : 0;
    const replyRate = totalOutbound > 0 ? Math.min((totalReplied / totalOutbound) * 100, 100) : 0;
    const failureRate = totalOutbound > 0 ? Math.min((totalFailed / totalOutbound) * 100, 100) : 0;
    const chartData = messageAnalytics?.dailyStats?.map((stat) => ({
        date: new Date(stat.date).toLocaleDateString(),
        total: Number(stat.totalSent || 0) + Number(stat.delivered || 0) + Number(stat.failed || 0),
        delivered: Number(stat.delivered || 0),
        failed: Number(stat.failed || 0),
        sent: Number(stat.totalSent || 0),
        read: Number(stat.read || 0),
    })) || [];
    const hourlyData = useMemo(() => {
        const rows = Array.isArray(messageAnalytics?.hourlyDistribution)
            ? messageAnalytics.hourlyDistribution
            : [];
        return rows
            .map((row) => ({
            hour: `${String(row.hour ?? row.h ?? 0).padStart?.(2, "0") || row.hour}:00`,
            count: Number(row.count || row.total || 0),
        }))
            .filter((r) => r.count > 0)
            .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
    }, [messageAnalytics]);
    const peakHour = useMemo(() => {
        if (!hourlyData.length)
            return null;
        return hourlyData.reduce((best, row) => (row.count > best.count ? row : best), hourlyData[0]);
    }, [hourlyData]);
    const callData = callAnalytics || {
        totalCalls: 0,
        successRate: 0,
        qualifiedLeads: 0,
        avgDuration: 0,
        leadDistribution: [],
        sentimentDistribution: [],
        campaignPerformance: [],
        dailyCalls: [],
    };
    const dailyCallChart = (callData.dailyCalls || []).map((d) => ({
        name: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
        value: d.count,
        Incoming: d.count,
    }));
    const handleExportCalling = async () => {
        setExporting(true);
        try {
            const response = await apiRequest("POST", "/api/analytics/export-pdf", {
                timeRange,
                callType: callTab,
            });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `calling-analytics-${new Date().toISOString().split("T")[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast({ title: "Report exported" });
        }
        catch {
            toast({ title: "Export failed", variant: "destructive" });
        }
        finally {
            setExporting(false);
        }
    };
    const handleExportWhatsApp = async () => {
        if (!activeChannel?.id) {
            toast({ title: "No WhatsApp channel connected", variant: "destructive" });
            return;
        }
        setExporting(true);
        try {
            const params = new URLSearchParams({
                format: "csv",
                type: waTab === "campaigns" ? "campaigns" : waTab === "messages" ? "messages" : "all",
                startDate: startIso,
                endDate: endIso,
                channelId: activeChannel.id,
            });
            const response = await authFetch(`/api/whatsapp/analytics/export?${params}`);
            if (!response.ok)
                throw new Error("Export failed");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `whatsway-analytics-${format(start, "yyyy-MM-dd")}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast({ title: "Export successful" });
        }
        catch {
            toast({ title: "Export failed", variant: "destructive" });
        }
        finally {
            setExporting(false);
        }
    };
    const pageTitle = channel === "whatsapp"
        ? waTab === "messages"
            ? "Messaging Analytics"
            : waTab === "campaigns"
                ? "Campaigns Analytics"
                : "Analytics & Performance"
        : "";
    const pageSubtitle = channel === "whatsapp"
        ? waTab === "messages"
            ? "Monitor and analyze communication throughput across automated channels"
            : waTab === "campaigns"
                ? "Overview of recent message broadcasts and conversion metrics"
                : "Comprehensive delivery rates, engagement metrics, and campaign conversion telemetry."
        : "";
    const waLoading = channel === "whatsapp" && (messageLoading || campaignLoading);
    const callingLoading = channel === "calling" && callLoading;
    return (<div className="space-y-5 pb-8">
      {/* Channel switch */}
      <div className="inline-flex items-center rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => setChannel("whatsapp")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${channel === "whatsapp" ? "bg-[#007BFF] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
          <MessageSquare className="h-4 w-4"/>
          Whatsway (WhatsApp)
        </button>
        <button type="button" onClick={() => setChannel("calling")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${channel === "calling" ? "bg-[#007BFF] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
          <Phone className="h-4 w-4"/>
          Auto Calling
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          {pageTitle && <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>}
          {pageSubtitle && <p className="text-sm text-slate-500 mt-1">{pageSubtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {channel === "whatsapp" ? (<>
              <Select value={String(waDays)} onValueChange={(v) => setWaDays(Number(v))}>
                <SelectTrigger className="h-10 w-[200px] bg-white border-slate-200">
                  <Calendar className="h-4 w-4 mr-2 text-slate-400"/>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="h-10 bg-white border-slate-200" disabled={exporting} onClick={handleExportWhatsApp}>
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Download className="h-4 w-4 mr-2"/>}
                Export
              </Button>
            </>) : (<>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-10 w-[160px] bg-white border-slate-200">
                  <Calendar className="h-4 w-4 mr-2 text-slate-400"/>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Button className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent" disabled={exporting} onClick={handleExportCalling}>
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Download className="h-4 w-4 mr-2"/>}
                Export Report
              </Button>
            </>)}
        </div>
      </div>

      {/* Sub tabs */}
      {channel === "whatsapp" ? (<div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
          {[
                ["overview", "Overview"],
                ["messages", "Messages"],
                ["campaigns", "Campaigns"],
            ].map(([id, label]) => (<button key={id} type="button" onClick={() => setWaTab(id)} className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${waTab === id
                    ? "bg-white text-[#007BFF] shadow-sm border border-blue-100"
                    : "text-slate-600 hover:text-slate-900"}`}>
              {label}
            </button>))}
        </div>) : (<div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1">
          {[
                ["all", "All Calls", Phone],
                ["incoming", "Incoming", PhoneIncoming],
                ["outgoing", "Outgoing", PhoneOutgoing],
                ["batch", "Campaigns", Target],
            ].map(([id, label, Icon]) => (<button key={id} type="button" onClick={() => setCallTab(id)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${callTab === id
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"}`}>
              <Icon className="h-4 w-4"/>
              {label}
            </button>))}
        </div>)}

      {(waLoading || callingLoading) && (<div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2"/>
          Loading analytics...
        </div>)}

      {/* WhatsApp content */}
      {channel === "whatsapp" && !waLoading && (<>
          {waTab === "overview" && (<div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <KpiCard label="Total Messages" value={totalMessages.toLocaleString()} subtitle={`Last ${waDays} days`} icon={<MessageSquare className="h-5 w-5 text-[#007BFF]"/>} iconBg="bg-blue-50"/>
                <KpiCard label="Delivery Rate" value={`${deliveryRate.toFixed(1)}%`} valueClass="text-emerald-600" progress={deliveryRate} progressColor="bg-emerald-500" icon={<CheckCircle className="h-5 w-5 text-emerald-600"/>} iconBg="bg-emerald-50"/>
                <KpiCard label="Read Rate" value={`${readRate.toFixed(1)}%`} valueClass="text-[#007BFF]" progress={readRate} progressColor="bg-[#007BFF]" icon={<Eye className="h-5 w-5 text-[#007BFF]"/>} iconBg="bg-blue-50"/>
                <KpiCard label="Reply Rate" value={`${replyRate.toFixed(1)}%`} valueClass="text-[#007BFF]" progress={replyRate} progressColor="bg-[#007BFF]" icon={<Reply className="h-5 w-5 text-[#007BFF]"/>} iconBg="bg-blue-50"/>
                <KpiCard label="Failure Rate" value={`${failureRate.toFixed(1)}%`} valueClass="text-red-600" progress={failureRate} progressColor="bg-red-500" icon={<XCircle className="h-5 w-5 text-red-600"/>} iconBg="bg-red-50"/>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard title="Message Performance" className="lg:col-span-2">
                  {chartData.length === 0 ? (<EmptyChartNote text="No message performance data for this range."/>) : (<div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
                          <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 11 }}/>
                          <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }}/>
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="sent" name="Total" stroke="#007BFF" strokeWidth={2} dot={false}/>
                          <Line type="monotone" dataKey="delivered" name="Delivered" stroke="#10B981" strokeWidth={2} dot={false}/>
                          <Line type="monotone" dataKey="failed" name="Failed / Other" stroke="#EF4444" strokeWidth={2} dot={false}/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>)}
                </ChartCard>

                <ChartCard title="Summary">
                  <div className="space-y-4">
                    {[
                    ["Active Campaigns", campaignSummary.activeCampaigns ?? campaignSummary.active ?? 0],
                    ["Total Campaigns", campaignSummary.totalCampaigns ?? campaigns.length],
                    ["Unique Contacts", messageMetrics.uniqueContacts ?? campaignSummary.uniqueContacts ?? 0],
                    ["Total Recipients", campaignSummary.totalRecipients ?? campaignSummary.recipients ?? 0],
                ].map(([label, value]) => (<div key={String(label)} className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-semibold text-slate-900">{Number(value).toLocaleString()}</span>
                      </div>))}
                    <div className="rounded-xl bg-blue-50 px-3 py-3 text-xs text-blue-700 flex items-start gap-2 mt-2">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0"/>
                      All message telemetry synchronized live with AutoComm Meta WABA gateway.
                    </div>
                  </div>
                </ChartCard>
              </div>
            </div>)}

          {waTab === "messages" && (<div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard label="Outbound Messages" value={totalOutbound.toLocaleString()} icon={<Send className="h-5 w-5 text-[#007BFF]"/>} iconBg="bg-blue-50"/>
                <KpiCard label="Inbound Messages" value={totalInbound.toLocaleString()} icon={<MessageSquare className="h-5 w-5 text-[#007BFF]"/>} iconBg="bg-blue-50"/>
                <KpiCard label="Average Response Time" value={messageAnalytics?.avgResponseTime || "—"} icon={<Clock className="h-5 w-5 text-[#007BFF]"/>} iconBg="bg-blue-50"/>
              </div>

              <ChartCard title="Message Activity by Hour" subtitle="Distribution of automated outbound & inbound messages over a 24-hour cycle" action={peakHour ? (<span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      Peak: {peakHour.hour} ({peakHour.count} msgs)
                    </span>) : null}>
                {hourlyData.length === 0 ? (<EmptyChartNote text="No hourly activity recorded for this range."/>) : (<div className="space-y-2.5">
                    {hourlyData.map((row) => {
                        const max = Math.max(...hourlyData.map((r) => r.count), 1);
                        return (<div key={row.hour} className="flex items-center gap-3">
                          <span className="w-12 text-xs text-slate-500 tabular-nums">{row.hour}</span>
                          <div className="flex-1 h-7 rounded-md bg-slate-50 overflow-hidden">
                            <div className="h-full rounded-md bg-[#007BFF]" style={{ width: `${(row.count / max) * 100}%` }}/>
                          </div>
                          <span className="w-8 text-xs text-slate-500 text-right tabular-nums">{row.count}</span>
                        </div>);
                    })}
                  </div>)}
              </ChartCard>
            </div>)}

          {waTab === "campaigns" && (<div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <KpiCard label="Total Sent" value={(campaignSummary.totalSent ?? totalOutbound).toLocaleString()} icon={<Send className="h-5 w-5 text-slate-500"/>} iconBg="bg-slate-100"/>
                <KpiCard label="Total Delivered" value={(campaignSummary.totalDelivered ?? totalDelivered).toLocaleString()} icon={<CheckCircle className="h-5 w-5 text-slate-500"/>} iconBg="bg-slate-100"/>
                <KpiCard label="Total Read" value={(campaignSummary.totalRead ?? totalRead).toLocaleString()} icon={<Eye className="h-5 w-5 text-slate-500"/>} iconBg="bg-slate-100"/>
                <KpiCard label="Total Failed" value={(campaignSummary.totalFailed ?? totalFailed).toLocaleString()} icon={<Clock className="h-5 w-5 text-slate-500"/>} iconBg="bg-slate-100"/>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Campaign Performance</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Overview of recent message broadcasts and conversion metrics
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 bg-white border-slate-200">
                      <Filter className="h-3.5 w-3.5 mr-1.5"/>
                      Filter
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 bg-white border-slate-200" onClick={handleExportWhatsApp}>
                      <Download className="h-3.5 w-3.5 mr-1.5"/>
                      Export CSV
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] tracking-wider text-slate-400">CAMPAIGN</TableHead>
                        <TableHead className="text-[10px] tracking-wider text-slate-400">STATUS</TableHead>
                        <TableHead className="text-[10px] tracking-wider text-slate-400">RECIPIENTS</TableHead>
                        <TableHead className="text-[10px] tracking-wider text-slate-400">SENT</TableHead>
                        <TableHead className="text-[10px] tracking-wider text-slate-400">DELIVERED</TableHead>
                        <TableHead className="text-[10px] tracking-wider text-slate-400">READ</TableHead>
                        <TableHead className="text-[10px] tracking-wider text-slate-400">RATE</TableHead>
                        <TableHead className="text-[10px] tracking-wider text-slate-400">ACTIONS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.length === 0 ? (<TableRow>
                          <TableCell colSpan={8} className="text-center text-slate-400 py-12">
                            No campaigns found.
                          </TableCell>
                        </TableRow>) : (campaigns.slice(0, 20).map((c) => {
                    const sent = Number(c.sentCount || 0);
                    const delivered = Number(c.deliveredCount || 0);
                    const rate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
                    return (<TableRow key={c.id} className="border-slate-100">
                              <TableCell>
                                <p className="text-sm font-semibold text-slate-900">{c.name || "Untitled"}</p>
                                <p className="text-xs text-slate-400">{c.type || "marketing"}</p>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClass(c.status)}`}>
                                  {c.status || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">{Number(c.recipientCount || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-sm">{sent.toLocaleString()}</TableCell>
                              <TableCell className="text-sm">{delivered.toLocaleString()}</TableCell>
                              <TableCell className="text-sm">{Number(c.readCount || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-sm">{rate}%</TableCell>
                              <TableCell>
                                <button type="button" className="inline-flex items-center gap-1 text-sm text-[#007BFF] hover:underline" onClick={() => setLocation(`/campaigns/whatsapp/${c.id}`)}>
                                  View Details
                                  <ExternalLink className="h-3 w-3"/>
                                </button>
                              </TableCell>
                            </TableRow>);
                }))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>)}
        </>)}

      {/* Auto Calling content */}
      {channel === "calling" && !callingLoading && (<div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard label="Total Calls" value={(callData.totalCalls || 0).toLocaleString()} subtitle="completed in selected range" icon={<Phone className="h-5 w-5 text-cyan-600"/>} iconBg="bg-cyan-50"/>
            <KpiCard label="Success Rate" value={`${callData.successRate || 0}%`} subtitle="Standard benchmark: 75%" icon={<TrendingUp className="h-5 w-5 text-emerald-600"/>} iconBg="bg-emerald-50"/>
            <KpiCard label="Qualified Leads" value={(callData.qualifiedLeads || 0).toLocaleString()} subtitle="Based on qualification criteria" icon={<Users className="h-5 w-5 text-[#007BFF]"/>} iconBg="bg-blue-50"/>
            <KpiCard label="Avg Duration" value={formatDuration(callData.avgDuration || 0)} subtitle="minutes per call" icon={<Clock className="h-5 w-5 text-[#007BFF]"/>} iconBg="bg-blue-50"/>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Daily Call Volume">
              {dailyCallChart.length === 0 ? (<EmptyChartNote text="No call volume recorded for this time window."/>) : (<div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyCallChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
                      <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 11 }}/>
                      <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }}/>
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="value" name="Incoming" stroke="#007BFF" fill="#007BFF33"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>)}
            </ChartCard>

            <ChartCard title="Lead Distribution">
              {(callData.leadDistribution || []).length === 0 ? (<div className="h-[280px] flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={[{ name: "No data", value: 1 }]} dataKey="value" innerRadius={55} outerRadius={80}>
                        <Cell fill="#007BFF"/>
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-slate-500 -mt-2">100% No Data</p>
                </div>) : (<div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={callData.leadDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80}>
                        {callData.leadDistribution.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>)}
            </ChartCard>

            <ChartCard title="Campaign Success Rate" subtitle="Dispatched workflow completion">
              {(callData.campaignPerformance || []).length === 0 ? (<EmptyChartNote text="No campaign metrics evaluated for current filter."/>) : (<div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={callData.campaignPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
                      <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 11 }}/>
                      <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }}/>
                      <Tooltip />
                      <Bar dataKey="value" fill="#007BFF" radius={[6, 6, 0, 0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>)}
            </ChartCard>

            <ChartCard title="Sentiment Analysis" subtitle="AI voice emotional tone detection">
              {(callData.sentimentDistribution || []).length === 0 ? (<div className="h-[280px] flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={[{ name: "No data", value: 1 }]} dataKey="value" innerRadius={55} outerRadius={80}>
                        <Cell fill="#007BFF"/>
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-slate-500 -mt-2">100% No Data</p>
                </div>) : (<div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={callData.sentimentDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80}>
                        {callData.sentimentDistribution.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>)}
            </ChartCard>
          </div>
        </div>)}
    </div>);
}
