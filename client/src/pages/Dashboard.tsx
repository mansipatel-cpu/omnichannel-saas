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
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { AuthStorage } from "@/lib/auth-storage";
import { CreateCampaignDialog } from "@/components/CreateCampaignDialog";
import { useDemoMode } from "@/components/DemoModeBanner";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Plus, 
  UserPlus,
  FilePlus,
  Users,
  UserRound,
  Megaphone,
  Activity,
  MessageSquare,
  CircleAlert,
  PhoneCall,
  PhoneOff,
  Search,
  Play,
  Pencil,
  Loader2,
  ChevronDown,
  LogOut,
  CreditCard,
  Settings,
} from "lucide-react";

interface DashboardData {
  userName: string;
  totalCalls: number;
  weeklyTrend: number;
  templatesCount: number;
  callTypeStats: {
    incoming: { count: number; trend: number; successRate: number };
    outgoing: { count: number; trend: number; successRate: number };
    campaign: { count: number; active: number; completed: number };
  };
  recentCalls: Array<{
    id: string;
    phoneNumber: string | null;
    status: string;
    createdAt: string;
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    createdAt: string | null;
  }>;
}

interface VoiceCampaign {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  completedCalls: number;
  createdAt?: string;
}

interface WaCampaign {
  id: string;
  name?: string;
  status?: string;
  createdAt?: string;
  recipientCount?: number;
  totalRecipients?: number;
  sentCount?: number;
}

interface DeduplicatedContact {
  id: string;
  phone: string;
  email: string | null;
  names: Array<{ firstName: string; lastName: string | null }>;
  campaigns: Array<{ id: string; name: string }>;
  status: string;
  callCount: number;
}

interface PromptTemplate {
  id: string;
  name: string;
  description?: string | null;
  firstMessage?: string | null;
  systemPrompt?: string;
}

interface WaTemplate {
  id: string;
  name?: string;
  status?: string;
  body?: string;
  content?: string;
  components?: any;
}

interface WaStats {
  totalMessages?: number;
  messagesFailed?: number;
  messagesDelivered?: number;
}

interface MeUser {
  name?: string;
  email?: string;
  role?: string;
}

async function authFetch(url: string) {
  const headers: Record<string, string> = {};
  const authHeader = AuthStorage.getAuthHeader();
  if (authHeader) headers.Authorization = authHeader;
  const response = await fetch(url, { credentials: "include", headers });
  if (!response.ok) throw new Error(`Failed ${url}`);
  return response.json();
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    in_progress: "Ongoing",
    sending: "Ongoing",
    active: "Ongoing",
    scheduled: "Scheduled",
    completed: "Completed",
    pending: "Draft",
    draft: "Draft",
    paused: "Draft",
    failed: "Failed",
  };
  return map[status] || status.replace(/_/g, " ");
}

function statusClass(label: string) {
  switch (label) {
    case "Ongoing":
    case "Active":
      return "bg-emerald-100 text-emerald-700";
    case "Scheduled":
      return "bg-violet-100 text-violet-700";
    case "Completed":
      return "bg-blue-100 text-blue-700";
    case "Failed":
      return "bg-red-100 text-red-700";
    case "Pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function contactDisplayName(contact: DeduplicatedContact) {
  const name = contact.names?.[0];
  const full = `${name?.firstName || ""} ${name?.lastName || ""}`.trim();
  return full || contact.email || contact.phone || "Unknown";
}

function contactStatusLabel(status: string) {
  if (status === "pending") return "Pending";
  if (status === "completed" || status === "incoming_call" || status === "outgoing_call") return "Active";
  return "Inactive";
}

function templatePreview(tpl: WaTemplate) {
  const body = tpl.body || tpl.content;
  if (typeof body === "string" && body.trim()) return body;
  const text = tpl.components?.find?.((c: any) => c.type === "BODY")?.text;
  return text || "—";
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { isDemoMode } = useDemoMode();
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [campaignChoiceOpen, setCampaignChoiceOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    queryFn: () => authFetch("/api/dashboard"),
  });

  const { data: me } = useQuery<MeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: contacts = [] } = useQuery<DeduplicatedContact[]>({
    queryKey: ["/api/contacts/deduplicated"],
  });

  const { data: voiceCampaigns = [] } = useQuery<VoiceCampaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => authFetch("/api/campaigns"),
  });

  const { data: waCampaigns = [] } = useQuery<WaCampaign[]>({
    queryKey: ["/api/whatsapp/campaigns"],
    queryFn: async () => {
      try {
        const result = await authFetch("/api/whatsapp/campaigns");
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
        const result = await authFetch("/api/whatsapp/templates?limit=6");
        return Array.isArray(result) ? result : result?.data || [];
      } catch {
        return [];
      }
    },
  });

  const { data: waStats } = useQuery<WaStats>({
    queryKey: ["/api/whatsapp/dashboard/stats"],
    queryFn: async () => {
      try {
        return await authFetch("/api/whatsapp/dashboard/stats");
      } catch {
        return {};
      }
    },
  });

  const { data: promptTemplates = [] } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates", "dashboard"],
    queryFn: async () => {
      try {
        const result = await authFetch("/api/prompt-templates");
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const incoming = dashboard?.callTypeStats?.incoming?.count || 0;
  const outgoing = dashboard?.callTypeStats?.outgoing?.count || 0;
  const incomingRate = dashboard?.callTypeStats?.incoming?.successRate || 0;
  const outgoingRate = dashboard?.callTypeStats?.outgoing?.successRate || 0;
  const completedCalls = Math.round((incoming * incomingRate + outgoing * outgoingRate) / 100);
  const failedCalls = Math.max(0, (dashboard?.totalCalls || 0) - completedCalls);

  const overviewCampaigns = [
    ...voiceCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      type: "Auto Calling" as const,
      status: formatStatus(c.status),
      audience: c.totalContacts || 0,
      progress: c.totalContacts ? Math.min(100, Math.round(((c.completedCalls || 0) / c.totalContacts) * 100)) : 0,
      created: c.createdAt,
      href: `/app/campaigns/${c.id}`,
    })),
    ...waCampaigns.map((c) => ({
      id: c.id,
      name: c.name || "Untitled campaign",
      type: "WhatsApp" as const,
      status: formatStatus(c.status || "draft"),
      audience: c.recipientCount || c.totalRecipients || 0,
      progress: (c.recipientCount || c.totalRecipients)
        ? Math.min(100, Math.round(((c.sentCount || 0) / (c.recipientCount || c.totalRecipients || 1)) * 100))
        : 0,
      created: c.createdAt,
      href: "/app/whatsapp/campaigns",
    })),
  ]
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 6);

  const totalCampaigns = voiceCampaigns.length + waCampaigns.length;
  const ongoingCampaigns =
    voiceCampaigns.filter((c) => ["in_progress", "pending", "scheduled"].includes(c.status)).length +
    waCampaigns.filter((c) => ["active", "sending", "scheduled"].includes(c.status || "")).length;

  const recentContacts = contacts.slice(0, 5);
  const displayName = me?.name || dashboard?.userName || "Admin User";
  const roleLabel = me?.role === "super_admin" ? "Super Admin" : me?.role === "admin" ? "Admin" : "User";

  const templateRows = [
    ...waTemplates.map((tpl) => ({
      id: `wa-${tpl.id}`,
      name: tpl.name || "Untitled",
      channel: "WhatsApp" as const,
      preview: templatePreview(tpl),
      status: formatStatus((tpl.status || "draft").toLowerCase()) === "Ongoing"
        ? "Active"
        : formatStatus((tpl.status || "draft").toLowerCase()),
      href: "/app/whatsapp/templates",
    })),
    ...promptTemplates.map((tpl) => ({
      id: `call-${tpl.id}`,
      name: tpl.name,
      channel: "Calling" as const,
      preview: tpl.firstMessage || tpl.description || tpl.systemPrompt || "—",
      status: "Active",
      href: "/app/prompt-templates",
    })),
  ].slice(0, 6);

  const userTrend = dashboard?.weeklyTrend
    ? `${dashboard.weeklyTrend > 0 ? "+" : ""}${dashboard.weeklyTrend}% this month`
    : null;

  const stats = [
    { label: "Total Users", value: contacts.length, hint: userTrend, hintClass: "text-emerald-600", icon: Users, iconBg: "bg-blue-50 text-[#007BFF]" },
    { label: "Recent Users", value: recentContacts.length, hint: recentContacts.length ? `+${recentContacts.length} shown` : null, hintClass: "text-emerald-600", icon: UserRound, iconBg: "bg-blue-50 text-[#007BFF]" },
    { label: "Total Campaigns", value: totalCampaigns, hint: null, icon: Megaphone, iconBg: "bg-violet-50 text-violet-600" },
    { label: "Ongoing Campaigns", value: ongoingCampaigns, hint: null, icon: Activity, iconBg: "bg-emerald-50 text-emerald-600" },
    { label: "Completed Messages", value: waStats?.messagesDelivered ?? waStats?.totalMessages ?? 0, hint: null, icon: MessageSquare, iconBg: "bg-emerald-50 text-emerald-600" },
    { label: "Failed Messages", value: waStats?.messagesFailed ?? 0, hint: null, icon: CircleAlert, iconBg: "bg-red-50 text-red-500" },
  ];

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    AuthStorage.clearAuth();
    window.location.href = "/";
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of your communication automation.</p>
        </div>
        <div className="flex items-center gap-3">
          {isDemoMode && (
            <Button variant="outline" size="sm" onClick={() => setIsVideoOpen(true)} className="hidden sm:flex">
              <Play className="h-4 w-4 mr-1 fill-current" />
              Demo
            </Button>
          )}
          <div className="relative hidden md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-10 w-56 pl-10 rounded-md bg-white border-slate-200 shadow-sm"
            />
          </div>
          <div className="h-10 w-10 rounded-md bg-white border border-slate-200 shadow-sm flex items-center justify-center">
            <NotificationBell />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden sm:flex items-center gap-2.5 rounded-full hover:bg-white py-1 pl-1 pr-2">
                <div className="h-9 w-9 rounded-md bg-[#007BFF] text-white flex items-center justify-center text-sm font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight text-left">
                  <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="text-[11px] text-slate-500">{roleLabel}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setLocation("/app/settings")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/app/billing")} className="cursor-pointer">
                <CreditCard className="mr-2 h-4 w-4" />
                Billing & Credits
              </DropdownMenuItem>
              <div className="flex items-center justify-between px-2 py-1.5">
                <LanguageSelector variant="compact" />
                <ThemeToggle />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          onClick={() => setCampaignChoiceOpen(true)}
          className="rounded-2xl bg-[#007BFF] text-white p-5 text-left min-h-[132px] hover:bg-[#0069d9] transition-colors shadow-sm"
          data-testid="card-create-campaign"
        >
          <Plus className="h-8 w-8 mb-5" strokeWidth={2.5} />
          <p className="font-semibold text-[15px]">Create Campaign</p>
          <p className="text-xs text-white/80 mt-1">Start a new WhatsApp or calling campaign.</p>
        </button>
        <button
          onClick={() => setLocation("/app/contacts")}
          className="rounded-2xl bg-white border border-slate-200 p-5 text-left min-h-[132px] hover:border-[#007BFF]/40 transition-colors shadow-sm"
        >
          <UserPlus className="h-7 w-7 text-[#007BFF] mb-5" />
          <p className="font-semibold text-[15px] text-slate-900">Add Contact</p>
          <p className="text-xs text-slate-500 mt-1">Add the new contact list.</p>
        </button>
        <button
          onClick={() => setLocation("/app/whatsapp/templates")}
          className="rounded-2xl bg-white border border-slate-200 p-5 text-left min-h-[132px] hover:border-[#007BFF]/40 transition-colors shadow-sm"
        >
          <FilePlus className="h-7 w-7 text-[#007BFF] mb-5" />
          <p className="font-semibold text-[15px] text-slate-900">Create Template</p>
          <p className="text-xs text-slate-500 mt-1">Build a reusable message template.</p>
        </button>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="rounded-2xl bg-white border border-slate-200 p-5 text-left min-h-[132px] hover:border-[#007BFF]/40 transition-colors shadow-sm"
        >
          <PhoneCall className="h-7 w-7 text-[#007BFF] mb-5" />
          <p className="font-semibold text-[15px] text-slate-900">Create Calling Campaign</p>
          <p className="text-xs text-slate-500 mt-1">Set up an automated voice calling campaign.</p>
        </button>
              </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm min-h-[108px]">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.iconBg}`}>
                <stat.icon className="h-4 w-4" />
              </span>
              </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value.toLocaleString()}</p>
            {stat.hint ? <p className={`text-[11px] font-medium mt-1 ${stat.hintClass || "text-slate-500"}`}>{stat.hint}</p> : null}
              </div>
        ))}
            </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between shadow-sm min-h-[88px]">
              <div>
            <p className="text-xs text-slate-500">Completed Calls</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{completedCalls.toLocaleString()}</p>
              </div>
          <span className="h-10 w-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <PhoneCall className="h-5 w-5" />
                </span>
              </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between shadow-sm min-h-[88px]">
            <div>
            <p className="text-xs text-slate-500">Failed Calls</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{failedCalls.toLocaleString()}</p>
              </div>
          <span className="h-10 w-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
            <PhoneOff className="h-5 w-5" />
                </span>
              </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold text-foreground">Campaign Overview</h2>
          <button onClick={() => setLocation("/app/campaigns")} className="text-sm text-[#007BFF] hover:underline">
            View All
                </button>
              </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-sky-50/80 hover:bg-sky-50/80">
              <TableHead>Campaign Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overviewCampaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No campaigns yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              overviewCampaigns.map((campaign) => (
                <TableRow key={`${campaign.type}-${campaign.id}`}>
                  <TableCell className="font-medium text-foreground">{campaign.name}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${campaign.type === "WhatsApp" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
                      {campaign.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(campaign.status)}`}>{campaign.status}</span>
                  </TableCell>
                  <TableCell>{campaign.audience.toLocaleString()}</TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-[#007BFF] rounded-full" style={{ width: `${campaign.progress}%` }} />
                </div>
                      <span className="text-xs text-muted-foreground w-8">{campaign.progress}%</span>
              </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {campaign.created ? new Date(campaign.created).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <button onClick={() => setLocation(campaign.href)} className="text-sm text-[#007BFF] hover:underline">
                      View
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold text-foreground">Recent Users</h2>
          <button onClick={() => setLocation("/app/contacts")} className="text-sm text-[#007BFF] hover:underline">
            View All
          </button>
                    </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-sky-50/80 hover:bg-sky-50/80">
              <TableHead>User</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No recent users to display.
                </TableCell>
              </TableRow>
            ) : (
              recentContacts.map((contact) => {
                const label = contactStatusLabel(contact.status);
                return (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">
                          {contactDisplayName(contact).charAt(0).toUpperCase()}
              </div>
                        <span className="font-medium text-foreground">{contactDisplayName(contact)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{contact.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.campaigns?.[0]?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.callCount ? `${contact.callCount} calls` : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(label)}`}>{label}</span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold text-foreground">Default Messages / Templates</h2>
          <button onClick={() => setLocation("/app/whatsapp/templates")} className="text-sm text-[#007BFF] hover:underline">
            View All Templates
          </button>
                    </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-sky-50/80 hover:bg-sky-50/80">
              <TableHead>Template Name</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templateRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No templates yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              templateRows.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium text-foreground">{tpl.name}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${tpl.channel === "WhatsApp" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
                      {tpl.channel}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground">{tpl.preview}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(tpl.status)}`}>{tpl.status}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setLocation(tpl.href)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
            </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
            </div>

      <Dialog open={campaignChoiceOpen} onOpenChange={setCampaignChoiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>Start a new WhatsApp or calling campaign.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <button
              className="rounded-xl border border-slate-200 p-4 text-left hover:border-[#007BFF] hover:bg-sky-50/60 transition-colors"
              onClick={() => {
                setCampaignChoiceOpen(false);
                setLocation("/app/whatsapp/campaigns");
              }}
            >
              <p className="font-semibold text-slate-900">WhatsApp campaign</p>
              <p className="text-sm text-slate-500 mt-1">Send messages to your audience on WhatsApp.</p>
            </button>
            <button
              className="rounded-xl border border-slate-200 p-4 text-left hover:border-[#007BFF] hover:bg-sky-50/60 transition-colors"
              onClick={() => {
                setCampaignChoiceOpen(false);
                setCreateDialogOpen(true);
              }}
            >
              <p className="font-semibold text-slate-900">Calling campaign</p>
              <p className="text-sm text-slate-500 mt-1">Set up an automated voice calling campaign.</p>
            </button>
                      </div>
        </DialogContent>
      </Dialog>

      <CreateCampaignDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {isDemoMode && (
        <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent className="sm:max-w-[850px] p-2 bg-slate-950 border border-slate-800 rounded-2xl">
            <DialogHeader className="p-4 pb-2 text-left">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-emerald-400 fill-emerald-400" />
                Live Demonstration
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {t("dashboard.subtitle")}
              </DialogDescription>
            </DialogHeader>
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black">
              {isVideoOpen && (
                <iframe
                  src="https://drive.google.com/file/d/12P10ehRmXueHJETBJM1-O66JFsvWKkV4/preview"
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title="Demo Video"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
