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
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { AuthStorage } from "@/lib/auth-storage";
import { apiRequest, apiRequestFormData, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
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
import { AuthProvider } from "@wa/contexts/auth-context";
import { TemplateDialog } from "@wa/components/templates/TemplateDialog";
import {
  Search,
  Plus,
  RefreshCw,
  FileText,
  MessageCircle,
  Phone,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
  Play,
  Server,
  Mic,
  RotateCw,
} from "lucide-react";

type ChannelTab = "whatsapp" | "agentlab";

interface WaChannel {
  id: string;
}

interface WaTemplate {
  id: string;
  name: string;
  category?: string;
  language?: string;
  body?: string;
  status?: string;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

interface PromptTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  systemPrompt?: string;
  firstMessage?: string | null;
  suggestedVoiceTone?: string | null;
  variables?: string[] | null;
  usageCount?: number;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
  isSystemTemplate?: boolean;
}

interface DashboardStats {
  callTypeStats?: {
    incoming?: { count?: number; successRate?: number; trend?: number };
    outgoing?: { count?: number; successRate?: number; trend?: number };
  };
}

interface WaCampaign {
  sentCount?: number;
  deliveredCount?: number;
}

interface Row {
  id: string;
  name: string;
  preview: string;
  category: string;
  language: string;
  status: string;
  updatedAt: Date | null;
  channel: ChannelTab;
  voiceName?: string;
  voiceDetail?: string;
  duration?: string;
  iconClass?: string;
}

const VOICE_ICON_COLORS = [
  "bg-blue-50 text-[#007BFF]",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
  "bg-violet-50 text-violet-600",
  "bg-rose-50 text-rose-500",
  "bg-cyan-50 text-cyan-600",
];

const VOICE_MODELS = [
  { name: "Azure Guy Neural (Male)", detail: "EN-US • 1.0x / Natural" },
  { name: "OpenAI Nova (Female)", detail: "EN-US • 1.0x / Natural" },
  { name: "ElevenLabs Rachel (Female)", detail: "EN-US • 1.0x / Natural" },
  { name: "ElevenLabs Adam (Male)", detail: "EN-US • 1.0x / Natural" },
];

function authFetch(url: string) {
  const headers: Record<string, string> = {};
  const authHeader = AuthStorage.getAuthHeader();
  if (authHeader) headers.Authorization = authHeader;
  return fetch(url, { credentials: "include", headers });
}

function asArray<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { data?: unknown }).data)) {
    return (result as { data: T[] }).data;
  }
  return [];
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function languageLabel(code?: string) {
  if (!code) return "EN (US)";
  const normalized = code.replace("-", "_");
  const [lang, region] = normalized.split("_");
  if (region) return `${lang.toUpperCase()} (${region.toUpperCase()})`;
  return lang.toUpperCase();
}

function categoryLabel(value?: string) {
  if (!value) return "General";
  const map: Record<string, string> = {
    MARKETING: "Marketing",
    UTILITY: "Utility",
    AUTHENTICATION: "Authentication",
    TRANSACTIONAL: "Transactional",
    sales: "Sales",
    support: "Support",
    appointment: "Appointment",
    survey: "Survey",
    general: "General",
  };
  return map[value] || value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function voiceCategoryLabel(value?: string, name?: string) {
  const title = (name || "").toLowerCase();
  if (/(otp|auth|pin|ivr|verification)/.test(title)) return "Authentication / IVR";
  if (/(bill|overdue|balance|payment|invoice)/.test(title)) return "Voice Call / Billing";
  if (/(compliance|consent|gdpr|opt.?out)/.test(title)) return "Compliance / Agent";
  const map: Record<string, string> = {
    sales: "Voice Call / Sales",
    support: "Voice Call / Support",
    appointment: "Transactional",
    survey: "Voice Call / Survey",
    general: "Voice Call / General",
  };
  return map[value || ""] || categoryLabel(value);
}

function estimateDuration(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(6, Math.round((words / 150) * 60));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function voiceStatus(template: PromptTemplate) {
  if (template.isSystemTemplate || (template.usageCount || 0) > 0) return "active";
  return "draft";
}

function statusMeta(status?: string) {
  const value = (status || "draft").toLowerCase();
  if (value === "approved") return { label: "Approved", className: "bg-emerald-50 text-emerald-700" };
  if (value === "active") return { label: "Active", className: "bg-teal-50 text-teal-700" };
  if (value === "pending" || value === "submitted" || value === "in_review") {
    return { label: "In Review", className: "bg-amber-50 text-amber-700" };
  }
  if (value === "rejected") return { label: "Rejected", className: "bg-red-50 text-red-600" };
  return { label: "Draft", className: "bg-slate-100 text-slate-500" };
}

function highlightPreview(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, index) =>
    part.startsWith("{{") ? (
      <span key={index} className="text-[#007BFF]">{part}</span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

function buildTemplateFormData(data: any, channelId?: string) {
  const formData = new FormData();
  formData.append("name", data.name);
  formData.append("category", data.category);
  formData.append("language", data.language);
  formData.append("body", data.body || "");
  if (channelId) formData.append("channelId", channelId);
  if (data.footer) formData.append("footer", data.footer);
  if (data.variables?.length) formData.append("samples", JSON.stringify(data.variables));
  if (data.buttons?.length) formData.append("buttons", JSON.stringify(data.buttons));
  if (data.mediaFile) {
    formData.append("mediaFile", data.mediaFile);
    formData.append("mediaType", data.mediaType);
  } else if (data.header) {
    formData.append("header", data.header);
  }
  if (data.marketingSubType && data.marketingSubType !== "CUSTOM") {
    formData.append("marketingSubType", data.marketingSubType);
  }
  if (data.couponCode) formData.append("couponCode", data.couponCode);
  if (data.offerText) formData.append("offerText", data.offerText);
  if (data.hasExpiration) {
    formData.append("hasExpiration", "true");
    formData.append("expirationDays", String(data.expirationDays || 14));
  }
  if (data.headerVariable) formData.append("headerVariable", data.headerVariable);
  return formData;
}

export default function AllTemplates() {
  const { toast } = useToast();
  const { setPageMeta, search } = useAppHeader();

  const [tab, setTab] = useState<ChannelTab>("whatsapp");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [voiceModelFilter, setVoiceModelFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [editingWa, setEditingWa] = useState<WaTemplate | null>(null);

  const tableSearch = searchQuery || search;

  useEffect(() => {
    setPageMeta({
      title: "Templates",
      subtitle: "Create and manage WhatsApp and AgentLab templates.",
    });
    return () => setPageMeta(null);
  }, [setPageMeta]);

  const { data: activeChannel } = useQuery<WaChannel | null>({
    queryKey: ["/api/whatsapp/channels/active"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/whatsapp/channels/active");
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
  });

  const { data: waTemplates = [], isLoading: waLoading } = useQuery<WaTemplate[]>({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/whatsapp/templates?limit=200");
        if (!response.ok) return [];
        return asArray<WaTemplate>(await response.json());
      } catch {
        return [];
      }
    },
  });

  const { data: promptTemplates = [], isLoading: voiceLoading } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates", "all"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/prompt-templates");
        if (!response.ok) return [];
        return asArray<PromptTemplate>(await response.json());
      } catch {
        return [];
      }
    },
  });

  const { data: waCampaigns = [] } = useQuery<WaCampaign[]>({
    queryKey: ["/api/whatsapp/campaigns"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/whatsapp/campaigns");
        if (!response.ok) return [];
        return asArray<WaCampaign>(await response.json());
      } catch {
        return [];
      }
    },
  });

  const { data: sipNumbers } = useQuery<{ data?: unknown[] } | unknown[]>({
    queryKey: ["/api/sip/phone-numbers"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/sip/phone-numbers");
        if (!response.ok) return [];
        return response.json();
      } catch {
        return [];
      }
    },
  });

  const trunkCount = Array.isArray(sipNumbers)
    ? sipNumbers.length
    : Array.isArray((sipNumbers as { data?: unknown[] })?.data)
      ? (sipNumbers as { data: unknown[] }).data.length
      : 0;

  const { data: dashboard } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/dashboard");
        if (!response.ok) return {};
        return response.json();
      } catch {
        return {};
      }
    },
  });

  const waRows = useMemo<Row[]>(() => waTemplates.map((template) => ({
    id: template.id,
    name: template.name || "Untitled template",
    preview: template.body || "No preview available",
    category: categoryLabel(template.category),
    language: languageLabel(template.language),
    status: template.status || "draft",
    updatedAt: parseDate(template.updatedAt || template.createdAt),
    channel: "whatsapp",
  })), [waTemplates]);

  const voiceRows = useMemo<Row[]>(() => promptTemplates.map((template, index) => {
    const preview = template.firstMessage || template.systemPrompt || template.description || "Voice prompt template";
    const voice = VOICE_MODELS[index % VOICE_MODELS.length];
    return {
      id: template.id,
      name: template.name || "Untitled template",
      preview,
      category: voiceCategoryLabel(template.category, template.name),
      language: "EN-US",
      status: voiceStatus(template),
      updatedAt: parseDate(template.updatedAt || template.createdAt),
      channel: "agentlab" as const,
      voiceName: voice.name,
      voiceDetail: voice.detail,
      duration: estimateDuration(preview),
      iconClass: VOICE_ICON_COLORS[index % VOICE_ICON_COLORS.length],
    };
  }), [promptTemplates]);

  const rows = tab === "whatsapp" ? waRows : voiceRows;

  const filteredRows = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !query || row.name.toLowerCase().includes(query) || row.preview.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "all" || row.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchesStatus = statusFilter === "all" || statusMeta(row.status).label.toLowerCase() === statusFilter;
      const matchesLanguage = languageFilter === "all" || row.language === languageFilter;
      const matchesVoice = voiceModelFilter === "all" || row.voiceName === voiceModelFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesLanguage && matchesVoice;
    });
  }, [rows, tableSearch, categoryFilter, statusFilter, languageFilter, voiceModelFilter]);

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(filteredRows, 6);

  useEffect(() => {
    handlePageChange(1);
    setSelectedIds([]);
    setCategoryFilter("all");
    setStatusFilter("all");
    setLanguageFilter("all");
    setVoiceModelFilter("all");
  }, [tab]);

  useEffect(() => {
    handlePageChange(1);
    setSelectedIds([]);
  }, [tableSearch, categoryFilter, statusFilter, languageFilter, voiceModelFilter]);

  const approvedWa = waTemplates.filter((item) => (item.status || "").toLowerCase() === "approved").length;
  const approvedRate = waTemplates.length ? Math.round((approvedWa / waTemplates.length) * 1000) / 10 : 0;
  const sent = waCampaigns.reduce((sum, item) => sum + (item.sentCount || 0), 0);
  const delivered = waCampaigns.reduce((sum, item) => sum + (item.deliveredCount || 0), 0);
  const dispatchSuccess = sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : approvedRate;
  const monthStart = startOfMonth(new Date());
  const voiceAddedThisMonth = promptTemplates.filter((item) => {
    const created = parseDate(item.createdAt);
    return created ? created >= monthStart : false;
  }).length;
  const incomingRate = dashboard?.callTypeStats?.incoming?.successRate || 0;
  const outgoingRate = dashboard?.callTypeStats?.outgoing?.successRate || 0;
  const incomingCount = dashboard?.callTypeStats?.incoming?.count || 0;
  const outgoingCount = dashboard?.callTypeStats?.outgoing?.count || 0;
  const callTotal = incomingCount + outgoingCount;
  const callSuccess = callTotal
    ? Math.round(((incomingCount * incomingRate + outgoingCount * outgoingRate) / callTotal) * 10) / 10
    : 0;
  const incomingTrend = dashboard?.callTypeStats?.incoming?.trend || 0;
  const outgoingTrend = dashboard?.callTypeStats?.outgoing?.trend || 0;
  const callTrend = Math.round(((incomingTrend + outgoingTrend) / 2) * 10) / 10;

  const categoryOptions = Array.from(new Set(rows.map((row) => row.category)));
  const languageOptions = Array.from(new Set(rows.map((row) => row.language)));
  const voiceModelOptions = Array.from(new Set(voiceRows.map((row) => row.voiceName).filter(Boolean) as string[]));
  const pageIds = paginatedItems.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const isLoading = tab === "whatsapp" ? waLoading : voiceLoading;

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

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!activeChannel?.id) throw new Error("Create a WhatsApp channel before syncing templates.");
      const response = await apiRequest("POST", "/api/whatsapp/templates/sync", { channelId: activeChannel.id });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({ title: "Templates synced" });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message || "Please try again", variant: "destructive" });
    },
  });

  const waSaveMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = buildTemplateFormData(data, activeChannel?.id);
      if (editingWa) {
        return apiRequestFormData("PUT", `/api/whatsapp/templates/${editingWa.id}`, formData);
      }
      return apiRequestFormData("POST", "/api/whatsapp/templates", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({ title: editingWa ? "Template updated" : "Template created" });
      setWaDialogOpen(false);
      setEditingWa(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to save template", description: error.message || "Please try again", variant: "destructive" });
    },
  });

  const createHref = tab === "whatsapp" ? "~/templates/new" : "~/templates/agentlab/new";

  const filterTriggerClass = "h-10 w-[148px] shrink-0 bg-white border-slate-200";

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-slate-400">
          <Link href="/dashboard" className="hover:text-slate-600">Home</Link>
          <span>/</span>
          <span className="text-slate-600">Templates</span>
        </div>
        <div className="flex items-center gap-2">
          {tab === "whatsapp" && (
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="h-10 bg-white border-slate-200 text-[#007BFF]"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sync Meta API
            </Button>
          )}
          <Button
            asChild
            className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
            data-testid="button-add-template"
          >
            <Link href={createHref}>
              <Plus className="h-4 w-4 mr-2" />
              Add Template
            </Link>
          </Button>
        </div>
      </div>

      <div className="border-b border-slate-200 pb-4">
        <div className="inline-flex rounded-md bg-[#F4F6F8] p-1">
          <button
            type="button"
            onClick={() => setTab("whatsapp")}
            className={`h-10 px-4 rounded-md text-sm font-medium flex items-center gap-2 ${
              tab === "whatsapp" ? "bg-white text-[#007BFF] shadow-sm" : "text-slate-500"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            Whatway Template
            <span className={`min-w-6 h-6 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center ${
              tab === "whatsapp" ? "bg-blue-50 text-[#007BFF]" : "bg-slate-200 text-slate-500"
            }`}>
              {waRows.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("agentlab")}
            className={`h-10 px-4 rounded-md text-sm font-medium flex items-center gap-2 ${
              tab === "agentlab" ? "bg-[#007BFF] text-white shadow-sm" : "text-slate-500"
            }`}
          >
            <Phone className="h-4 w-4" />
            AgentLab Template
            <span className={`min-w-6 h-6 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center ${
              tab === "agentlab" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
            }`}>
              {voiceRows.length}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tab === "whatsapp" ? (
          <>
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Templates</p>
                  <p className="text-[28px] font-bold text-slate-900 mt-1">{(waRows.length + voiceRows.length).toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 mt-2">WhatsApp + AgentLab</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#007BFF] flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Whatway WhatsApp</p>
                  <p className="text-[28px] font-bold text-slate-900 mt-1">{waRows.length.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {approvedRate}% Meta Approved
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">AgentLab Voice</p>
                  <p className="text-[28px] font-bold text-slate-900 mt-1">{voiceRows.length.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-2">{trunkCount} Active Trunks</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Phone className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Dispatch Success</p>
                  <p className="text-[28px] font-bold text-slate-900 mt-1">{dispatchSuccess}%</p>
                  <p className="text-xs text-emerald-600 mt-2">Delivered vs sent</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Voice Templates</p>
                  <p className="text-[28px] font-bold text-slate-900 mt-1">{voiceRows.length.toLocaleString()}</p>
                  <p className="text-xs text-[#007BFF] mt-2">+{voiceAddedThisMonth} this month</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#007BFF] flex items-center justify-center">
                  <Phone className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Trunks / SIP</p>
                  <p className="text-[28px] font-bold text-slate-900 mt-1">{trunkCount.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {trunkCount > 0 ? "Connected" : "No trunks yet"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Server className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Synthesis Engine</p>
                  <p className="text-[22px] font-bold text-slate-900 mt-1 leading-tight">Neural TTS v2.4</p>
                  <p className="text-xs text-slate-500 mt-2">ElevenLabs & OpenAI</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Mic className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Call Connection Success</p>
                  <p className="text-[28px] font-bold text-slate-900 mt-1">{callSuccess}%</p>
                  <p className="text-xs text-emerald-600 mt-2">
                    {callTrend >= 0 ? "+" : ""}{callTrend}% this week
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <RotateCw className="h-5 w-5" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-3 flex-nowrap overflow-x-auto">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tab === "agentlab" ? "Search voice scripts, TTS voices, IVR prompts..." : "Filter templates..."}
              className="h-10 pl-9 bg-white border-slate-200"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className={filterTriggerClass}>
              <SelectValue placeholder="Category: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Category: All</SelectItem>
              {categoryOptions.map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tab === "agentlab" && (
            <Select value={voiceModelFilter} onValueChange={setVoiceModelFilter}>
              <SelectTrigger className={filterTriggerClass}>
                <SelectValue placeholder="Voice Model: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Voice Model: All</SelectItem>
                {voiceModelOptions.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className={filterTriggerClass}>
              <SelectValue placeholder="Language: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Language: All</SelectItem>
              {languageOptions.map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={filterTriggerClass}>
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              {tab === "whatsapp" && <SelectItem value="approved">Approved</SelectItem>}
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="in review">In Review</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => {
            setSearchQuery("");
            setCategoryFilter("all");
            setStatusFilter("all");
            setLanguageFilter("all");
            setVoiceModelFilter("all");
          }}
          className="mt-3 h-10 px-3 rounded-md border border-slate-200 text-sm text-slate-600 bg-white inline-flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          More Filters
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="w-12 pl-5">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={(checked) => {
                      const on = checked === true;
                      setSelectedIds((current) => on
                        ? Array.from(new Set([...current, ...pageIds]))
                        : current.filter((id) => !pageIds.includes(id)));
                    }}
                  />
                </TableHead>
                {tab === "agentlab" ? (
                  <>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">VOICE TEMPLATE SPEC & TTS PREVIEW</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">CATEGORY</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">VOICE & LANGUAGE</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400 pr-5">DURATION / STATUS</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">TEMPLATE SPEC & PREVIEW</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">CATEGORY</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">LANGUAGE</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">META STATUS</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400 pr-5">LAST MODIFIED</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={tab === "agentlab" ? 5 : 6} className="text-center text-slate-400 py-16">Loading templates...</TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tab === "agentlab" ? 5 : 6} className="text-center text-slate-400 py-16">No templates yet.</TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((row) => {
                  const status = statusMeta(row.status);
                  return (
                    <TableRow
                      key={`${row.channel}-${row.id}`}
                      className="border-slate-100 cursor-pointer"
                      onClick={() => {
                        if (row.channel === "whatsapp") {
                          const match = waTemplates.find((item) => item.id === row.id) || null;
                          setEditingWa(match);
                          setWaDialogOpen(true);
                        }
                      }}
                    >
                      <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(row.id)}
                          onCheckedChange={(checked) => {
                            const on = checked === true;
                            setSelectedIds((current) => on ? [...current, row.id] : current.filter((id) => id !== row.id));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-3 min-w-[280px]">
                          <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center ${
                            row.iconClass || (row.channel === "whatsapp" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-[#007BFF]")
                          }`}>
                            {row.channel === "whatsapp" ? <MessageCircle className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 flex items-center gap-1.5">
                              {tab === "agentlab" && <Play className="h-3 w-3 text-[#007BFF] fill-[#007BFF] shrink-0" />}
                              <span>{highlightPreview(row.preview)}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-md bg-slate-100 text-slate-600 px-2.5 py-1 text-[11px] font-medium">
                          {row.category}
                        </span>
                      </TableCell>
                      {tab === "agentlab" ? (
                        <>
                          <TableCell>
                            <p className="text-sm font-medium text-slate-700">{row.voiceName}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{row.voiceDetail}</p>
                          </TableCell>
                          <TableCell className="pr-5">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs text-slate-400">{row.duration}</span>
                              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {status.label}
                              </span>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-sm text-slate-600">{row.language}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {status.label}
                            </span>
                          </TableCell>
                          <TableCell className="pr-5 text-sm text-slate-500">
                            {row.updatedAt ? (
                              <div>
                                <p>{format(row.updatedAt, "MMM d, yyyy")}</p>
                                <p className="text-xs text-slate-400">{format(row.updatedAt, "h:mm a")}</p>
                              </div>
                            ) : "—"}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalItems > 0 && (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
            <p className="text-sm text-slate-400">
              Showing {startItem} to {endItem} of {totalItems} templates
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Show</span>
              <Select value={String(itemsPerPage)} onValueChange={(value) => handleItemsPerPageChange(Number(value))}>
                <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[6, 10, 25].map((option) => (
                    <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>per page</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 bg-white border-slate-200" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
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
              <Button variant="outline" size="sm" className="h-8 bg-white border-slate-200" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {waDialogOpen && (
        <AuthProvider>
          <TemplateDialog
            open={waDialogOpen}
            onOpenChange={(open) => {
              setWaDialogOpen(open);
              if (!open) setEditingWa(null);
            }}
            template={editingWa as any}
            onSubmit={(data) => waSaveMutation.mutate(data)}
            isSubmitting={waSaveMutation.isPending}
            channelId={activeChannel?.id}
          />
        </AuthProvider>
      )}
    </div>
  );
}
