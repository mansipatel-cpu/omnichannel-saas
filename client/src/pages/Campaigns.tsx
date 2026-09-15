/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  format,
  isAfter,
  subDays,
  startOfMonth,
  startOfYear,
  formatDistanceToNow,
  differenceInDays,
  addDays,
} from "date-fns";
import { AuthStorage } from "@/lib/auth-storage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
import { useDemoMode } from "@/components/DemoModeBanner";
import { usePagination } from "@/components/ui/data-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MessageCircle,
  Phone,
  MoreVertical,
  RotateCcw,
  RotateCw,
  Eye,
  Play,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  LayoutGrid,
} from "lucide-react";

interface VoiceCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  totalContacts: number;
  completedCalls: number;
  successfulCalls: number;
  failedCalls?: number;
  createdAt?: string | Date | null;
  scheduledFor?: string | Date | null;
  deletedAt?: string | null;
  phoneNumberId?: string | null;
  sipPhoneNumberId?: string | null;
  plivoPhoneNumberId?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  retryEnabled?: boolean;
  currentRetryPass?: number;
  retryMaxAttempts?: number;
}

interface WaCampaign {
  id: string;
  name?: string;
  status?: string;
  templateName?: string;
  recipientCount?: number;
  totalRecipients?: number;
  sentCount?: number;
  deliveredCount?: number;
  failedCount?: number;
  createdAt?: string | Date | null;
  scheduledAt?: string | Date | null;
  createdBy?: string;
}

interface WaTemplate {
  id: string;
  name?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  planType: string;
}

type ChannelTab = "whatsapp" | "calling" | "deleted";
type StatusLabel = "Ongoing" | "Scheduled" | "Completed" | "Paused" | "Draft" | "Failed" | "Deleted";
type DeletedChannel = "whatsapp" | "calling";

const PURGE_DAYS = 30;

interface DeletedRow {
  id: string;
  name: string;
  code: string;
  channel: DeletedChannel;
  channelLabel: string;
  subtype: string;
  audience: number;
  segment: string;
  deletedAt: Date;
  deletedBy: string;
  deletedByInitials: string;
  isSample?: boolean;
}

function authFetch(url: string) {
  const headers: Record<string, string> = {};
  const authHeader = AuthStorage.getAuthHeader();
  if (authHeader) headers.Authorization = authHeader;
  return fetch(url, { credentials: "include", headers });
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatStatus(status: string): StatusLabel {
  const map: Record<string, StatusLabel> = {
    in_progress: "Ongoing",
    sending: "Ongoing",
    active: "Ongoing",
    scheduled: "Scheduled",
    completed: "Completed",
    paused: "Paused",
    pending: "Draft",
    draft: "Draft",
    failed: "Failed",
    deleted: "Deleted",
  };
  return map[status] || "Draft";
}

function statusClass(label: StatusLabel) {
  switch (label) {
    case "Ongoing":
      return "bg-blue-50 text-blue-600";
    case "Scheduled":
      return "bg-orange-50 text-orange-600";
    case "Completed":
      return "bg-emerald-50 text-emerald-600";
    case "Paused":
      return "bg-red-50 text-red-500";
    case "Failed":
      return "bg-red-50 text-red-500";
    case "Deleted":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

function tagClass(tag: string) {
  const key = tag.toLowerCase();
  if (key.includes("bill")) return "bg-orange-50 text-orange-600";
  if (key.includes("market") || key.includes("promo") || key.includes("offer")) return "bg-violet-50 text-violet-600";
  if (key.includes("security") || key.includes("alert")) return "bg-red-50 text-red-500";
  if (key.includes("retain") || key.includes("reactivat")) return "bg-teal-50 text-teal-600";
  if (key.includes("onboard") || key.includes("welcome")) return "bg-blue-50 text-blue-600";
  return "bg-slate-100 text-slate-600";
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AU";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function campaignCode(id: string, channel: DeletedChannel) {
  const suffix = channel === "whatsapp" ? "WA" : "AC";
  const short = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0000";
  return `CMP-${short}-${suffix}`;
}

function callingSubtype(type?: string) {
  const key = (type || "").toLowerCase();
  if (key.includes("ivr") || key.includes("survey")) return "IVR Survey";
  if (key.includes("ai") || key.includes("voice")) return "AI Voice";
  if (key.includes("reminder")) return "Reminder Call";
  return type || "Outbound Call";
}

function daysUntilPurge(deletedAt: Date) {
  return Math.max(0, differenceInDays(addDays(deletedAt, PURGE_DAYS), new Date()));
}

interface Row {
  id: string;
  name: string;
  tag: string;
  audience: number;
  template: string;
  schedule: string;
  status: StatusLabel;
  sent: number;
  delivered: number;
  failed: number;
  createdAt: Date | null;
  createdBy: string;
  channel: "whatsapp" | "calling";
  rawVoice?: VoiceCampaign;
}

export default function Campaigns() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { setPageMeta, search } = useAppHeader();

  const [tab, setTab] = useState<ChannelTab>("whatsapp");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [createdByFilter, setCreatedByFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [deletedTypeFilter, setDeletedTypeFilter] = useState("all");
  const [deletedDateFilter, setDeletedDateFilter] = useState("all");
  const [selectedDeletedIds, setSelectedDeletedIds] = useState<string[]>([]);
  const [restoringCampaignId, setRestoringCampaignId] = useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Row | null>(null);
  const [campaignToPurge, setCampaignToPurge] = useState<DeletedRow | null>(null);
  const [showPhoneNumberAlert, setShowPhoneNumberAlert] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const tableSearch = searchQuery || search;

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: voiceCampaigns = [], isLoading: voiceLoading } = useQuery<VoiceCampaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: deletedCampaigns = [] } = useQuery<VoiceCampaign[]>({
    queryKey: ["/api/campaigns/deleted"],
  });

  const { data: waCampaigns = [], isLoading: waLoading } = useQuery<WaCampaign[]>({
    queryKey: ["/api/whatsapp/campaigns"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/whatsapp/campaigns");
        if (!response.ok) return [];
        const result = await response.json();
        return Array.isArray(result) ? result : result?.data || [];
      } catch {
        return [];
      }
    },
  });

  const { data: waTemplates = [] } = useQuery<WaTemplate[]>({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/whatsapp/templates?limit=100");
        if (!response.ok) return [];
        const result = await response.json();
        return Array.isArray(result) ? result : result?.data || [];
      } catch {
        return [];
      }
    },
  });

  const isPro = user?.planType === "pro";
  const campaignsWithoutPhoneNumber = voiceCampaigns.filter(
    (c) => !c.phoneNumberId && !c.sipPhoneNumberId && !c.plivoPhoneNumberId && c.status !== "completed"
  );
  const unassignedIds = campaignsWithoutPhoneNumber.map((c) => c.id);

  useEffect(() => {
    if (userLoading || voiceLoading || !user || !isPro || unassignedIds.length === 0) return;
    const sessionKey = `phone_alert_dismissed_${user.id}`;
    try {
      const dismissedData = sessionStorage.getItem(sessionKey);
      if (dismissedData) {
        const { ids: dismissedIds } = JSON.parse(dismissedData);
        const dismissedSet = new Set(dismissedIds || []);
        if (!unassignedIds.some((id) => !dismissedSet.has(id))) return;
      }
    } catch {
      sessionStorage.removeItem(sessionKey);
    }
    setShowPhoneNumberAlert(true);
  }, [userLoading, voiceLoading, user, isPro, unassignedIds.join(",")]);

  useEffect(() => {
    setPageMeta({
      title: "Campaigns",
      subtitle: "Create and manage your WhatsApp and automated calling campaigns.",
    });
    return () => setPageMeta(null);
  }, [setPageMeta]);

  const restoreMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      setRestoringCampaignId(campaignId);
      const res = await apiRequest("PATCH", `/api/campaigns/${campaignId}/restore`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/deleted"] });
      toast({ title: "Campaign restored" });
      setRestoringCampaignId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to restore campaign",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setRestoringCampaignId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: Row) => {
      const url =
        row.channel === "whatsapp"
          ? `/api/whatsapp/campaigns/${row.id}`
          : `/api/campaigns/${row.id}`;
      await apiRequest("DELETE", url);
    },
    onSuccess: (_data, row) => {
      if (row.channel === "whatsapp") {
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/campaigns"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns/deleted"] });
      }
      toast({ title: "Campaign deleted", description: "Campaign has been deleted successfully" });
      setCampaignToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete campaign",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const waRows = useMemo<Row[]>(() => waCampaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name || "Untitled campaign",
    tag: campaign.templateName || "WhatsApp",
    audience: campaign.recipientCount || campaign.totalRecipients || 0,
    template: campaign.templateName || "—",
    schedule: parseDate(campaign.scheduledAt)
      ? format(parseDate(campaign.scheduledAt) as Date, "MMM d, yyyy")
      : "Immediate",
    status: formatStatus((campaign.status || "draft").toLowerCase()),
    sent: campaign.sentCount || 0,
    delivered: campaign.deliveredCount || 0,
    failed: campaign.failedCount || 0,
    createdAt: parseDate(campaign.createdAt),
    createdBy: campaign.createdBy || "All",
    channel: "whatsapp",
  })), [waCampaigns]);

  const voiceRows = useMemo<Row[]>(() =>
    voiceCampaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      tag: campaign.type || "Calling",
      audience: campaign.totalContacts || 0,
      template: campaign.type || "Voice script",
      schedule: parseDate(campaign.scheduledFor)
        ? format(parseDate(campaign.scheduledFor) as Date, "MMM d, yyyy")
        : "Immediate",
      status: formatStatus(campaign.status),
      sent: campaign.completedCalls || 0,
      delivered: campaign.successfulCalls || 0,
      failed: campaign.failedCalls || 0,
      createdAt: parseDate(campaign.createdAt),
      createdBy: "All",
      channel: "calling" as const,
      rawVoice: campaign,
    })),
  [voiceCampaigns]);

  const deletedRows = useMemo<DeletedRow[]>(() => {
    const actor = user?.name || "Admin User";
    const fromApi = deletedCampaigns.map((campaign) => {
      const deletedAt = parseDate(campaign.deletedAt) || parseDate(campaign.createdAt) || new Date();
      return {
        id: campaign.id,
        name: campaign.name,
        code: campaignCode(campaign.id, "calling"),
        channel: "calling" as const,
        channelLabel: "Auto Calling",
        subtype: callingSubtype(campaign.type),
        audience: campaign.totalContacts || 0,
        segment: "All Contacts",
        deletedAt,
        deletedBy: actor,
        deletedByInitials: initialsFromName(actor),
      };
    });
    return fromApi;
  }, [deletedCampaigns, user?.name]);

  const rows = tab === "whatsapp" ? waRows : voiceRows;
  const createdByOptions = Array.from(new Set(waRows.map((row) => row.createdBy).filter((value) => value && value !== "All")));
  const templateOptions = tab === "whatsapp"
    ? Array.from(new Set(waRows.map((row) => row.template).filter((value) => value && value !== "—")))
    : Array.from(new Set(voiceRows.map((row) => row.template).filter(Boolean)));

  const filteredRows = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    const now = new Date();
    return rows.filter((row) => {
      const matchesSearch = !query || row.name.toLowerCase().includes(query) || row.template.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || row.status.toLowerCase() === statusFilter;
      const matchesCreatedBy = createdByFilter === "all" || row.createdBy === createdByFilter;
      const matchesTemplate = templateFilter === "all" || row.template === templateFilter;
      const created = row.createdAt;
      const matchesDate =
        dateFilter === "all" ||
        (created && dateFilter === "month" && isAfter(created, startOfMonth(now))) ||
        (created && dateFilter === "30d" && isAfter(created, subDays(now, 30))) ||
        (created && dateFilter === "year" && isAfter(created, startOfYear(now)));
      return matchesSearch && matchesStatus && matchesCreatedBy && matchesTemplate && matchesDate;
    });
  }, [rows, tableSearch, statusFilter, createdByFilter, templateFilter, dateFilter]);

  const filteredDeletedRows = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    const now = new Date();
    return deletedRows.filter((row) => {
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.code.toLowerCase().includes(query) ||
        row.channelLabel.toLowerCase().includes(query) ||
        row.subtype.toLowerCase().includes(query);
      const matchesType = deletedTypeFilter === "all" || row.channel === deletedTypeFilter;
      const matchesDate =
        deletedDateFilter === "all" ||
        (deletedDateFilter === "7d" && isAfter(row.deletedAt, subDays(now, 7))) ||
        (deletedDateFilter === "30d" && isAfter(row.deletedAt, subDays(now, 30))) ||
        (deletedDateFilter === "month" && isAfter(row.deletedAt, startOfMonth(now)));
      return matchesSearch && matchesType && matchesDate;
    });
  }, [deletedRows, tableSearch, deletedTypeFilter, deletedDateFilter]);

  const campaignPagination = usePagination(filteredRows, 5);
  const deletedPagination = usePagination(filteredDeletedRows, 10);

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    handlePageChange,
    handleItemsPerPageChange,
  } = tab === "deleted" ? deletedPagination : campaignPagination;

  const paginatedDeletedItems = deletedPagination.paginatedItems;
  const paginatedCampaignItems = campaignPagination.paginatedItems;

  useEffect(() => {
    campaignPagination.handlePageChange(1);
    deletedPagination.handlePageChange(1);
    setSelectedDeletedIds([]);
  }, [tab, tableSearch, statusFilter, dateFilter, createdByFilter, templateFilter, deletedTypeFilter, deletedDateFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFilter("all");
    setCreatedByFilter("all");
    setTemplateFilter("all");
    setDeletedTypeFilter("all");
    setDeletedDateFilter("all");
  };

  const hasFilters =
    tab === "deleted"
      ? Boolean(tableSearch) || deletedTypeFilter !== "all" || deletedDateFilter !== "all"
      : Boolean(tableSearch) || statusFilter !== "all" || dateFilter !== "all" || createdByFilter !== "all" || templateFilter !== "all";
  const activeRuns =
    voiceCampaigns.filter((c) => c.status === "in_progress").length +
    waCampaigns.filter((c) => ["active", "sending"].includes(c.status || "")).length;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const isLoading = tab === "whatsapp" ? waLoading : tab === "calling" ? voiceLoading : false;

  const allVisibleDeletedSelected =
    paginatedDeletedItems.length > 0 &&
    paginatedDeletedItems.every((row) => selectedDeletedIds.includes(row.id));

  const toggleSelectAllDeleted = () => {
    if (allVisibleDeletedSelected) {
      setSelectedDeletedIds((prev) => prev.filter((id) => !paginatedDeletedItems.some((row) => row.id === id)));
      return;
    }
    setSelectedDeletedIds((prev) => {
      const next = new Set(prev);
      paginatedDeletedItems.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
  };

  const toggleDeletedSelection = (id: string) => {
    setSelectedDeletedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const handleRestoreDeleted = (row: DeletedRow) => {
    if (row.isSample) {
      toast({
        title: "Sample campaign",
        description: "This is preview UI data. Restore works for real deleted campaigns.",
      });
      return;
    }
    restoreMutation.mutate(row.id);
  };

  const handlePurgeDeleted = (row: DeletedRow) => {
    if (row.isSample) {
      toast({
        title: "Sample campaign removed",
        description: "Preview row dismissed from this session view.",
      });
      setCampaignToPurge(null);
      return;
    }
    toast({
      title: "Permanent delete",
      description: "Permanent deletion will be available once backend purge is enabled.",
    });
    setCampaignToPurge(null);
  };

  const visiblePages = useMemo(() => {
    const pages: Array<number | "ellipsis"> = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  const openRow = (row: Row) => {
    if (row.channel === "whatsapp") {
      setLocation(`/campaigns/whatsapp/${row.id}`);
      return;
    }
    setLocation(`/campaigns/${row.id}`);
  };

  const filterTriggerClass = "h-10 w-full sm:w-[160px] bg-white border-slate-200";
  const deletedCount = deletedCampaigns.length;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-slate-400">
          <Link href="/dashboard" className="hover:text-slate-600">Dashboard</Link>
          <span>&gt;</span>
          <span className="text-slate-600">Campaigns</span>
          </div>
              <Button
          onClick={() =>
            setLocation(tab === "calling" ? "/campaigns/new?channel=calling" : "/campaigns/new")
          }
          className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
              data-testid="button-create-campaign"
            >
              <Plus className="h-4 w-4 mr-2" />
          Create Campaign
            </Button>
          </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-t border-b border-slate-200 pt-3">
        <div className="flex items-center gap-6 lg:gap-8 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setTab("whatsapp")}
            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === "whatsapp" ? "border-[#007BFF] text-[#007BFF]" : "border-transparent text-slate-500"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Campaigns
            <span className={`rounded-md min-w-6 h-6 px-1.5 flex items-center justify-center text-[11px] font-semibold ${tab === "whatsapp" ? "bg-blue-50 text-[#007BFF]" : "bg-slate-100 text-slate-500"}`}>
              {waRows.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("calling")}
            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === "calling" ? "border-[#007BFF] text-[#007BFF]" : "border-transparent text-slate-500"
            }`}
          >
            <Phone className="h-4 w-4" />
            Auto Calling Campaigns
            <span className={`rounded-md min-w-6 h-6 px-1.5 flex items-center justify-center text-[11px] font-semibold ${tab === "calling" ? "bg-blue-50 text-[#007BFF]" : "bg-slate-100 text-slate-500"}`}>
              {voiceCampaigns.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("deleted")}
            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === "deleted" ? "border-[#007BFF] text-[#007BFF]" : "border-transparent text-slate-500"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            Deleted Campaigns
            <span className={`rounded-md min-w-6 h-6 px-1.5 flex items-center justify-center text-[11px] font-semibold ${tab === "deleted" ? "bg-blue-50 text-[#007BFF]" : "bg-slate-100 text-slate-500"}`}>
              {deletedCount}
            </span>
          </button>
        </div>
        {tab === "deleted" ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 pb-3">
            <Clock className="h-4 w-4 text-slate-400" />
            Auto-purged after {PURGE_DAYS} days
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500 pb-3">
            <span className="h-2 w-2 rounded-md bg-emerald-500" />
            {activeRuns} Active Dispatch Run{activeRuns === 1 ? "" : "s"}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <div className="relative w-full sm:w-[280px] shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tab === "deleted" ? "Search deleted campaigns..." : "Search Campaign by name..."}
                className="h-10 pl-9 bg-white border-slate-200"
                data-testid="input-search-campaigns"
              />
            </div>
            {tab === "deleted" ? (
              <>
                <Select value={deletedTypeFilter} onValueChange={setDeletedTypeFilter}>
                  <SelectTrigger className={filterTriggerClass}>
                    <SelectValue placeholder="Type: All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Type: All Types</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="calling">Auto Calling</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={deletedDateFilter} onValueChange={setDeletedDateFilter}>
                  <SelectTrigger className={`${filterTriggerClass} sm:w-[180px]`}>
                    <SelectValue placeholder="Deleted Date: All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Deleted Date: All Time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={filterTriggerClass}>
                    <SelectValue placeholder="Status: All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status: All</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className={`${filterTriggerClass} sm:w-[150px]`}>
                    <SelectValue placeholder="Date: All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Date: All Time</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="year">This year</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
                  <SelectTrigger className={`${filterTriggerClass} sm:w-[170px]`}>
                    <SelectValue placeholder="Created By: All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Created By: All</SelectItem>
                    {createdByOptions.map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={templateFilter} onValueChange={setTemplateFilter}>
                  <SelectTrigger className={`${filterTriggerClass} sm:w-[200px]`}>
                    <SelectValue placeholder="Template: All Templates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Template: All Templates</SelectItem>
                    {templateOptions.map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                    {waTemplates.filter((tpl) => tpl.name && !templateOptions.includes(tpl.name)).map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.name || tpl.id}>{tpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          {tab === "deleted" ? (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 bg-white border-slate-200"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/campaigns/deleted"] });
                  toast({ title: "Refreshed", description: "Deleted campaigns list updated." });
                }}
              >
                <RotateCw className="h-4 w-4 text-slate-500" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 bg-white border-slate-200 text-slate-600"
                onClick={toggleSelectAllDeleted}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Select All
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 whitespace-nowrap shrink-0"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {tab === "deleted" ? (
            <Table className="w-full min-w-[960px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="h-10 w-12 px-4">
                    <Checkbox
                      checked={allVisibleDeletedSelected}
                      onCheckedChange={() => toggleSelectAllDeleted()}
                      aria-label="Select all deleted campaigns"
                    />
                  </TableHead>
                  <TableHead className="h-10 px-3 text-[10px] font-semibold tracking-wider text-slate-400">CAMPAIGN NAME</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] font-semibold tracking-wider text-slate-400">CHANNEL / TYPE</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] font-semibold tracking-wider text-slate-400">AUDIENCE</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] font-semibold tracking-wider text-slate-400">DELETED DATE</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] font-semibold tracking-wider text-slate-400">DELETED BY</TableHead>
                  <TableHead className="h-10 px-3 pr-4 text-[10px] font-semibold tracking-wider text-slate-400 text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeletedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400 py-16 px-2">
                      {hasFilters ? "No deleted campaigns match your filters." : "No deleted campaigns."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDeletedItems.map((row) => {
                    const purgeIn = daysUntilPurge(row.deletedAt);
                    const purgeUrgent = purgeIn <= 10;
                    return (
                      <TableRow key={row.id} className="border-slate-100">
                        <TableCell className="px-4 py-3">
                          <Checkbox
                            checked={selectedDeletedIds.includes(row.id)}
                            onCheckedChange={() => toggleDeletedSelection(row.id)}
                            aria-label={`Select ${row.name}`}
                          />
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${row.channel === "whatsapp" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                              {row.channel === "whatsapp" ? <MessageCircle className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{row.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{row.code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="flex items-start gap-2">
                            <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${row.channel === "whatsapp" ? "bg-emerald-500" : "bg-blue-500"}`} />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{row.channelLabel}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{row.subtype}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <p className="text-sm font-medium text-slate-800">{row.audience.toLocaleString()} Recipients</p>
                          <p className="text-xs text-slate-400 mt-0.5">{row.segment}</p>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatDistanceToNow(row.deletedAt, { addSuffix: true })}
                          </p>
                          <p className={`text-xs mt-0.5 ${purgeUrgent ? "text-orange-500 font-medium" : "text-slate-400"}`}>
                            Auto-purges in {purgeIn}d
                          </p>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold flex items-center justify-center">
                              {row.deletedByInitials}
                            </div>
                            <span className="text-sm text-slate-700">{row.deletedBy}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 border-blue-200 bg-blue-50 text-[#007BFF] hover:bg-blue-100 hover:text-[#0069d9]"
                              onClick={() => handleRestoreDeleted(row)}
                              disabled={!row.isSample && restoringCampaignId === row.id}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              {!row.isSample && restoringCampaignId === row.id ? "Restoring..." : "Restore"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                              onClick={() => setCampaignToPurge(row)}
                              title="Delete Permanently"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          ) : (
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="h-9 w-[18%] px-2 pl-3 text-[10px] font-semibold tracking-wider text-slate-400">CAMPAIGN</TableHead>
                <TableHead className="h-9 w-[8%] px-1.5 text-[10px] font-semibold tracking-wider text-slate-400">AUDIENCE</TableHead>
                <TableHead className="h-9 w-[12%] px-1.5 text-[10px] font-semibold tracking-wider text-slate-400">TEMPLATE</TableHead>
                <TableHead className="h-9 w-[10%] px-1.5 text-[10px] font-semibold tracking-wider text-slate-400">SCHEDULE</TableHead>
                <TableHead className="h-9 w-[11%] px-1.5 text-[10px] font-semibold tracking-wider text-slate-400">STATUS</TableHead>
                <TableHead className="h-9 w-[6%] px-1.5 text-[10px] font-semibold tracking-wider text-slate-400 text-center">SENT</TableHead>
                <TableHead className="h-9 w-[7%] px-1.5 text-[10px] font-semibold tracking-wider text-slate-400 text-center">DELIVERED</TableHead>
                <TableHead className="h-9 w-[6%] px-1.5 text-[10px] font-semibold tracking-wider text-slate-400 text-center">FAILED</TableHead>
                <TableHead className="h-9 w-[12%] px-1.5 text-[10px] font-semibold tracking-wider text-slate-400">CREATED</TableHead>
                <TableHead className="h-9 w-[10%] px-1.5 pr-3 text-[10px] font-semibold tracking-wider text-slate-400 text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-slate-400 py-16 px-2">Loading campaigns...</TableCell>
                </TableRow>
              ) : paginatedCampaignItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-slate-400 py-16 px-2">
                    {hasFilters ? "No campaigns match your filters." : "No campaigns yet. Create a campaign to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCampaignItems.map((row) => (
                  <TableRow key={`${row.channel}-${row.id}`} className="border-slate-100">
                    <TableCell className="px-2 pl-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-7 w-7 shrink-0 rounded-md flex items-center justify-center ${row.channel === "whatsapp" ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"}`}>
                          {row.channel === "whatsapp" ? <MessageCircle className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{row.name}</p>
                          <span className={`inline-flex mt-0.5 rounded-full px-1.5 py-0 text-[10px] font-medium truncate max-w-full ${tagClass(row.tag)}`}>{row.tag}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-1.5 py-2 text-sm text-slate-700">{row.audience.toLocaleString()}</TableCell>
                    <TableCell className="px-1.5 py-2 text-sm text-slate-700 truncate" title={row.template}>{row.template}</TableCell>
                    <TableCell className="px-1.5 py-2 text-sm text-slate-500 truncate" title={row.schedule}>{row.schedule}</TableCell>
                    <TableCell className="px-1.5 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${statusClass(row.status)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell className="px-1.5 py-2 text-sm text-slate-700 text-center">{row.sent.toLocaleString()}</TableCell>
                    <TableCell className="px-1.5 py-2 text-sm text-emerald-600 text-center">{row.delivered.toLocaleString()}</TableCell>
                    <TableCell className="px-1.5 py-2 text-sm text-red-500 text-center">{row.failed.toLocaleString()}</TableCell>
                    <TableCell className="px-1.5 py-2 text-sm text-slate-500 truncate">
                      {row.createdAt ? format(row.createdAt, "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="px-1.5 py-2 pr-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openRow(row)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setCampaignToDelete(row)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          )}
        </div>

        {totalItems > 0 && (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
            <p className="text-sm text-slate-400">
              Showing {startItem}-{endItem} of {totalItems} {tab === "deleted" ? "deleted campaigns" : "campaigns"}
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Items per page:</span>
              <Select value={String(itemsPerPage)} onValueChange={(value) => handleItemsPerPageChange(Number(value))}>
                <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 25].map((option) => (
                    <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white border-slate-200" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {visiblePages.map((page, index) =>
                page === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-slate-400">...</span>
                ) : (
                <Button 
                    key={page}
                    size="sm"
                    variant={currentPage === page ? "default" : "outline"}
                    className={currentPage === page
                      ? "h-8 w-8 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
                      : "h-8 w-8 bg-white border-slate-200"}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                )
              )}
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white border-slate-200" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              </div>
            </div>
        )}
                    </div>

      <AlertDialog
        open={!!campaignToDelete}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setCampaignToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {campaignToDelete
                ? `This will delete "${campaignToDelete.name}". This action cannot be undone.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!campaignToDelete || deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white border-transparent"
              onClick={(e) => {
                e.preventDefault();
                if (campaignToDelete) deleteMutation.mutate(campaignToDelete);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!campaignToPurge}
        onOpenChange={(open) => {
          if (!open) setCampaignToPurge(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {campaignToPurge
                ? `"${campaignToPurge.name}" will be permanently removed and cannot be restored.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white border-transparent"
              onClick={(e) => {
                e.preventDefault();
                if (campaignToPurge) handlePurgeDeleted(campaignToPurge);
              }}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPhoneNumberAlert} onOpenChange={setShowPhoneNumberAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-xl">Phone Number Required</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base">
              You have {campaignsWithoutPhoneNumber.length} campaign(s) that need a phone number assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              if (user) sessionStorage.setItem(`phone_alert_dismissed_${user.id}`, JSON.stringify({ ids: unassignedIds }));
              setShowPhoneNumberAlert(false);
            }}>
              Remind Me Later
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowPhoneNumberAlert(false);
                setLocation("/phone-numbers");
              }}
              className="bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
            >
              <Phone className="h-4 w-4 mr-2" />
              Get Phone Number
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isDemoMode && (
        <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent className="sm:max-w-[850px] p-2 bg-slate-950 border border-slate-800 rounded-2xl">
            <DialogHeader className="p-4 pb-2 text-left">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-orange-400 fill-orange-400" />
                Campaigns Demonstration Video
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Watch a full walkthrough on creating and managing calling campaigns.
              </DialogDescription>
            </DialogHeader>
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black">
              {isVideoOpen && (
                <iframe
                  src="https://drive.google.com/file/d/18y1tCpdZkJ5Dpe9f262lVzP2KurVFvwW/preview"
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title="Campaigns Demo Video"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
