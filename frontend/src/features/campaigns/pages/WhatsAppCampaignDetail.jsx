import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { useAppHeader } from "@/shared/components/AppPageHeader";
import { useToast } from "@/shared/hooks/use-toast";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/shared/components/ui/table";
import { ArrowLeft, Download, Users, Send, CheckCircle, Eye, XCircle, AlertCircle, ChevronLeft, ChevronRight, } from "lucide-react";
function authFetch(url) {
    const headers = {};
    const authHeader = AuthStorage.getAuthHeader();
    if (authHeader)
        headers.Authorization = authHeader;
    return fetch(url, { credentials: "include", headers });
}
function safeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
}
function formatDateTime(value) {
    if (!value)
        return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return "—";
    return date.toLocaleString();
}
function statusBadgeClass(status) {
    const key = (status || "").toLowerCase();
    if (key === "read")
        return "bg-blue-50 text-blue-700";
    if (key === "delivered")
        return "bg-emerald-50 text-emerald-700";
    if (key === "sent")
        return "bg-violet-50 text-violet-700";
    if (key === "failed")
        return "bg-red-50 text-red-600";
    if (key === "pending" || key === "queued")
        return "bg-amber-50 text-amber-700";
    if (key === "completed" || key === "active")
        return "bg-blue-50 text-blue-700";
    return "bg-slate-100 text-slate-600";
}
function looksLikeId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
        || /^[0-9a-f]{20,}$/i.test(value);
}
export default function WhatsAppCampaignDetail() {
    const { id } = useParams();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { setPageMeta } = useAppHeader();
    const [exportLoading, setExportLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    useEffect(() => {
        setPageMeta({
            title: "Campaign Details",
            subtitle: "Review campaign performance, recipients, and delivery metrics.",
        });
        return () => setPageMeta(null);
    }, [setPageMeta]);
    const { data, isLoading, error } = useQuery({
        queryKey: ["whatsapp-campaign-details", id],
        queryFn: async () => {
            const response = await authFetch(`/api/whatsapp/analytics/campaigns/${id}`);
            if (!response.ok) {
                throw new Error(`Failed to load campaign (${response.status})`);
            }
            return response.json();
        },
        enabled: !!id,
        refetchInterval: 8000,
    });
    const campaign = (data?.campaign || {});
    const recipients = (Array.isArray(data?.recipients) ? data.recipients : []);
    const sentCount = safeNumber(campaign.sentCount);
    const deliveredCount = safeNumber(campaign.deliveredCount);
    const recipientCount = safeNumber(campaign.recipientCount);
    const readCount = safeNumber(campaign.readCount);
    const failedCount = safeNumber(campaign.failedCount);
    const deliveryRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0;
    const readRate = deliveredCount > 0 ? (readCount / deliveredCount) * 100 : 0;
    const failureRate = recipientCount > 0
        ? Math.min((failedCount / recipientCount) * 100, 100)
        : 0;
    const filteredRecipients = useMemo(() => {
        if (statusFilter === "all")
            return recipients;
        return recipients.filter((r) => (r.status || "").toLowerCase() === statusFilter);
    }, [recipients, statusFilter]);
    const totalRecipients = filteredRecipients.length;
    const totalPages = Math.max(1, Math.ceil(totalRecipients / rowsPerPage));
    const currentPage = Math.min(page, totalPages);
    const startItem = totalRecipients === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalRecipients);
    const pageRows = filteredRecipients.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const statusOptions = useMemo(() => {
        const set = new Set();
        recipients.forEach((r) => {
            if (r.status)
                set.add(r.status.toLowerCase());
        });
        return Array.from(set).sort();
    }, [recipients]);
    const audienceTags = useMemo(() => {
        const groups = Array.isArray(campaign.contactGroups) ? campaign.contactGroups : [];
        return groups.filter((g) => typeof g === "string" && g.trim() && !looksLikeId(g));
    }, [campaign.contactGroups]);
    const handleExport = async (format) => {
        if (!id)
            return;
        setExportLoading(true);
        try {
            const params = new URLSearchParams({
                format,
                type: "campaigns",
                campaignId: id,
            });
            const response = await authFetch(`/api/whatsapp/analytics/export?${params}`);
            if (!response.ok)
                throw new Error("Export failed");
            const blob = await response.blob();
            const contentType = response.headers.get("content-type") || "";
            let ext = "pdf";
            if (format === "excel")
                ext = "xlsx";
            else if (format === "csv")
                ext = contentType.includes("zip") ? "zip" : "csv";
            const safeName = (campaign.name || "unnamed")
                .replace(/[^a-z0-9_\-]+/gi, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 80) || "unnamed";
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `campaign-${safeName}-${new Date().toISOString().split("T")[0]}.${ext}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast({
                title: "Export successful",
                description: `Campaign report exported as ${format.toUpperCase()}`,
            });
        }
        catch {
            toast({
                title: "Export failed",
                description: "Failed to export campaign report",
                variant: "destructive",
            });
        }
        finally {
            setExportLoading(false);
        }
    };
    if (isLoading) {
        return (<div className="flex items-center justify-center py-24 text-slate-400">
        Loading campaign details...
      </div>);
    }
    if (error || !campaign.id) {
        return (<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto"/>
        <h2 className="text-lg font-semibold text-slate-900">Unable to load campaign</h2>
        <p className="text-sm text-slate-500">
          {error?.message || "The campaign was not found or you don't have access."}
        </p>
        <Button variant="outline" onClick={() => setLocation("/campaigns")}>
          <ArrowLeft className="h-4 w-4 mr-2"/>
          Back to Campaigns
        </Button>
      </div>);
    }
    return (<div className="space-y-5 pb-8">
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <Link href="/dashboard" className="hover:text-slate-600">Dashboard</Link>
        <span>/</span>
        <Link href="/campaigns" className="hover:text-slate-600">Campaigns</Link>
        <span>/</span>
        <span className="text-slate-600">Campaign Details</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="justify-start w-fit text-slate-600" onClick={() => setLocation("/campaigns")}>
          <ArrowLeft className="h-4 w-4 mr-2"/>
          Back to Campaigns
        </Button>
        <div className="flex flex-wrap gap-2">
          {["pdf", "excel", "csv"].map((format) => (<Button key={format} variant="outline" size="sm" className="h-9 bg-white border-slate-200" disabled={exportLoading} onClick={() => handleExport(format)}>
              <Download className="h-4 w-4 mr-2"/>
              {exportLoading ? "Exporting..." : `Export ${format.toUpperCase()}`}
            </Button>))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-5">Campaign Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
          <div>
            <p className="text-xs text-slate-400 mb-1">Type</p>
            <p className="text-sm font-medium text-slate-800">{campaign.type || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Status</p>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusBadgeClass(campaign.status)}`}>
              {campaign.status || "—"}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">API Type</p>
            <p className="text-sm font-medium text-slate-800 font-mono">{campaign.apiType || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Campaign Type</p>
            <p className="text-sm font-medium text-slate-800 capitalize">{campaign.campaignType || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Template</p>
            <p className="text-sm font-medium text-slate-800 font-mono truncate" title={campaign.templateName || undefined}>
              {campaign.templateName || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Language</p>
            <p className="text-sm font-medium text-slate-800">{campaign.templateLanguage || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Created</p>
            <p className="text-sm font-medium text-slate-800">{formatDateTime(campaign.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Scheduled</p>
            <p className="text-sm font-medium text-slate-800">
              {campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : "Immediate"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Completed</p>
            <p className="text-sm font-medium text-slate-800">
              {campaign.completedAt ? formatDateTime(campaign.completedAt) : "In Progress"}
            </p>
          </div>
        </div>
        {campaign.description && (<div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-1">Description</p>
            <p className="text-sm font-medium text-slate-800">{campaign.description}</p>
          </div>)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Recipients" value={recipientCount.toLocaleString()} icon={<Users className="h-5 w-5 text-blue-600"/>} iconBg="bg-blue-50"/>
        <MetricCard label="Messages Sent" value={sentCount.toLocaleString()} icon={<Send className="h-5 w-5 text-emerald-600"/>} iconBg="bg-emerald-50"/>
        <MetricCard label="Delivery Rate" value={`${deliveryRate}%`} valueClass="text-emerald-600" icon={<CheckCircle className="h-5 w-5 text-emerald-600"/>} iconBg="bg-emerald-50" progress={deliveryRate} progressClass="bg-emerald-500"/>
        <MetricCard label="Read Rate" value={`${readRate.toFixed(1)}%`} valueClass="text-orange-600" icon={<Eye className="h-5 w-5 text-orange-600"/>} iconBg="bg-orange-50" progress={readRate} progressClass="bg-orange-500"/>
        <MetricCard label="Failure Rate" value={`${failureRate.toFixed(1)}%`} valueClass="text-red-600" icon={<XCircle className="h-5 w-5 text-red-600"/>} iconBg="bg-red-50" progress={failureRate} progressClass="bg-red-500"/>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Recipient Details</h2>
          <Select value={statusFilter} onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
        }}>
            <SelectTrigger className="h-9 w-full sm:w-[160px] bg-white border-slate-200">
              <SelectValue placeholder="All Statuses"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map((status) => (<SelectItem key={status} value={status} className="capitalize">
                  {status}
                </SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-hidden">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="h-9 px-3 text-[10px] font-semibold tracking-wider text-slate-400 w-[28%]">NAME</TableHead>
                <TableHead className="h-9 px-2 text-[10px] font-semibold tracking-wider text-slate-400 w-[26%]">NUMBER</TableHead>
                <TableHead className="h-9 px-2 text-[10px] font-semibold tracking-wider text-slate-400 w-[18%]">STATUS</TableHead>
                <TableHead className="h-9 px-2 pr-4 text-[10px] font-semibold tracking-wider text-slate-400 w-[28%]">ERROR DETAILS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (<TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-400 py-12 px-3">
                    No recipients found for this campaign.
                  </TableCell>
                </TableRow>) : (pageRows.map((row) => (<TableRow key={row.id} className="border-slate-100">
                    <TableCell className="px-3 py-2.5 text-sm font-medium text-slate-800 truncate">
                      {row.name || "—"}
                    </TableCell>
                    <TableCell className="px-2 py-2.5 text-sm text-slate-600 truncate">
                      {row.phone || "—"}
                    </TableCell>
                    <TableCell className="px-2 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClass(row.status)}`}>
                        {row.status || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-2.5 pr-4 text-sm text-slate-500 truncate" title={row.errorMessage || undefined}>
                      {row.errorMessage || row.errorCode || "—"}
                    </TableCell>
                  </TableRow>)))}
            </TableBody>
          </Table>
        </div>

        {totalRecipients > 0 && (<div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-400">
              Showing {startItem} to {endItem} of {totalRecipients} recipients
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Rows per page</span>
                <Select value={String(rowsPerPage)} onValueChange={(value) => {
                setRowsPerPage(Number(value));
                setPage(1);
            }}>
                  <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 25, 50].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 bg-white border-slate-200" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4 mr-1"/>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="h-8 bg-white border-slate-200" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1"/>
                </Button>
              </div>
            </div>
          </div>)}
      </div>

      {(audienceTags.length > 0
            || (Array.isArray(campaign.contactGroups) && campaign.contactGroups.length > 0)
            || (Array.isArray(campaign.csvData) && campaign.csvData.length > 0)) && (<div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Target Audience</h2>
          {Array.isArray(campaign.contactGroups) && campaign.contactGroups.length > 0 && (<div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">Contact Groups</p>
                <p className="text-sm font-medium text-slate-800">
                  {audienceTags.length > 0
                    ? `${audienceTags.length} group(s) selected`
                    : `${campaign.contactGroups.length} contact(s) selected`}
                </p>
              </div>
              {audienceTags.length > 0 && (<div className="flex flex-wrap gap-2">
                  {audienceTags.map((tag) => (<span key={tag} className="inline-flex rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-medium">
                      {tag}
                    </span>))}
                </div>)}
            </div>)}
          {Array.isArray(campaign.csvData) && campaign.csvData.length > 0 && (<div className={Array.isArray(campaign.contactGroups) && campaign.contactGroups.length > 0 ? "mt-4 pt-4 border-t border-slate-100" : ""}>
              <p className="text-xs text-slate-400 mb-1">CSV Data</p>
              <p className="text-sm font-medium text-slate-800">
                {campaign.csvData.length} records imported
              </p>
            </div>)}
        </div>)}
    </div>);
}
function MetricCard({ label, value, valueClass, icon, iconBg, progress, progressClass, }) {
    return (<div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-400 mb-1">{label}</p>
          <p className={`text-2xl font-bold text-slate-900 ${valueClass || ""}`}>{value}</p>
          {typeof progress === "number" && (<div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
              <div className={`h-1.5 rounded-full transition-all ${progressClass || "bg-slate-400"}`} style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}/>
            </div>)}
        </div>
        <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </div>);
}
