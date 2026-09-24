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
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AuthStorage } from "@/lib/auth-storage";
import { NotificationBell } from "@/components/NotificationBell";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ChevronDown, LogOut, User } from "lucide-react";

interface MeUser {
  name?: string;
  email?: string;
  role?: string;
}

export interface PageHeaderMeta {
  title?: string;
  subtitle?: string;
  hideTitle?: boolean;
}

interface AppHeaderContextValue {
  search: string;
  setSearch: (value: string) => void;
  pageMeta: PageHeaderMeta | null;
  setPageMeta: (meta: PageHeaderMeta | null) => void;
  actions: ReactNode;
  setActions: (node: ReactNode) => void;
}

const AppHeaderContext = createContext<AppHeaderContextValue | null>(null);

const PAGE_HEADERS: Array<{ test: (path: string) => boolean; title: string; subtitle: string }> = [
  { test: (p) => p === "/dashboard" || p === "/app" || p === "/dashboard", title: "Dashboard", subtitle: "Overview of your communication automation." },
  { test: (p) => p === "/contacts/new", title: "Add New Contact", subtitle: "Add the contact list" },
  { test: (p) => p === "/contacts/groups/new", title: "Create New Contact Group", subtitle: "Configure group details and select contacts to include in this group." },
  { test: (p) => p === "/contacts", title: "Users", subtitle: "Manage and view all registered platform users and contact records." },
  { test: (p) => p === "/campaigns/new", title: "Create Campaign", subtitle: "Configure audience, messaging template, scheduling, and channel delivery rules." },
  { test: (p) => p.startsWith("/campaigns/"), title: "Campaign Details", subtitle: "Review campaign performance and contacts." },
  { test: (p) => p === "/campaigns", title: "Campaigns", subtitle: "Create and manage your WhatsApp and automated calling campaigns." },
  { test: (p) => p.startsWith("/calls/"), title: "Call Details", subtitle: "Review the transcript and outcome of this call." },
  { test: (p) => p === "/calls", title: "Calls", subtitle: "Browse inbound and outbound call history." },
  { test: (p) => p.startsWith("/analytics"), title: "Analytics", subtitle: "Track WhatsApp and Auto Calling performance." },
  { test: (p) => p === "/agents/new", title: "Create AI Agent", subtitle: "Configure type, persona, telephony, model, and prompts." },
  { test: (p) => /^\/agents\/[^/]+\/edit$/.test(p), title: "Edit Agent", subtitle: "Update type, persona, telephony, model, and prompts." },
  { test: (p) => p === "/agents", title: "AI Agents", subtitle: "Create and manage your conversational AI agents" },
  { test: (p) => p === "/knowledge-base", title: "Knowledge Base", subtitle: "Train your AI agents with custom knowledge" },
  { test: (p) => p === "/voices", title: "Voice", subtitle: "Choose and preview voices for calling." },
  { test: (p) => p === "/crm", title: "Quick CRM", subtitle: "Manage leads captured from calls and chats." },
  { test: (p) => p === "/phone-numbers", title: "Phone Numbers", subtitle: "Purchase and manage calling numbers." },
  { test: (p) => p === "/incoming-connections", title: "Incoming Connections", subtitle: "Route inbound calls to the right agent." },
  { test: (p) => p === "/flows/execution", title: "Execution Logs", subtitle: "See how your flows ran." },
  { test: (p) => p === "/flows/forms", title: "Forms", subtitle: "Collect information during a conversation." },
  { test: (p) => p === "/flows/appointments", title: "Appointments", subtitle: "Manage bookings created by your flows." },
  { test: (p) => p.startsWith("/flows"), title: "Flow Builder", subtitle: "Design automated conversation flows." },
  { test: (p) => p === "/templates/agentlab/new", title: "Create AgentLab Voice Template", subtitle: "Configure automated AI voice calling scripts, prompts, tones, and conversational personality." },
  { test: (p) => p === "/templates/new", title: "Create Whatway Template", subtitle: "Configure WhatsApp Business API HSM template specification for campaigns and automated dispatches." },
  { test: (p) => p === "/templates" || p.startsWith("/whatsapp/templates") || p === "/prompt-templates", title: "Templates", subtitle: "Create and manage WhatsApp and AgentLab templates." },
  { test: (p) => p === "/tools/widgets", title: "Widgets", subtitle: "Embed calling and chat on your website." },
  { test: (p) => p === "/tools", title: "Tools", subtitle: "Connect extra capabilities to your agents." },
  { test: (p) => p === "/billing", title: "Billing", subtitle: "Plans, credits, and payment history." },
  { test: (p) => p === "/settings", title: "Profile", subtitle: "Manage your account details and preferences." },
  { test: (p) => p === "/whatsapp/inbox", title: "Team Inbox", subtitle: "Reply to WhatsApp conversations in one place." },
  { test: (p) => p === "/whatsapp/api-docs", title: "API Documentation", subtitle: "Integrate WhatsApp messaging into your apps." },
  { test: (p) => p.startsWith("/whatsapp/waba-connection") || p.startsWith("/whatsapp/channels"), title: "Settings", subtitle: "Connect and manage WhatsApp Business accounts." },
  { test: (p) => p.startsWith("/whatsapp/contacts"), title: "WhatsApp Contacts", subtitle: "Manage WhatsApp-only contact records." },
  { test: (p) => p.startsWith("/admin"), title: "Admin Dashboard", subtitle: "Platform-wide activity and tenants." },
];

function titleFromPath(path: string) {
  const match = PAGE_HEADERS.find((item) => item.test(path));
  if (match) return match;
  const segment = path.split("/").filter(Boolean).pop() || "Page";
  const title = segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return { title, subtitle: "" };
}

export function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  const [pageMeta, setPageMeta] = useState<PageHeaderMeta | null>(null);
  const [actions, setActions] = useState<ReactNode>(null);
  const locationRef = useRef(location);

  // Reset header chrome when the route changes, before child effects run.
  // A location effect would clear page meta after the page sets it.
  if (locationRef.current !== location) {
    locationRef.current = location;
    setSearch("");
    setPageMeta(null);
    setActions(null);
  }

  const value = useMemo(
    () => ({ search, setSearch, pageMeta, setPageMeta, actions, setActions }),
    [search, pageMeta, actions]
  );

  return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>;
}

export function useAppHeader() {
  const context = useContext(AppHeaderContext);
  if (!context) {
    throw new Error("useAppHeader must be used within AppHeaderProvider");
  }
  return context;
}

export function useAppHeaderOptional() {
  return useContext(AppHeaderContext);
}

export function AppPageHeader() {
  const [location, setLocation] = useLocation();
  const { search, setSearch, pageMeta, actions } = useAppHeader();
  const searchRef = useRef<HTMLInputElement>(null);
  const defaults = titleFromPath(location);
  const title = pageMeta?.title || defaults.title;
  const subtitle = pageMeta?.subtitle ?? defaults.subtitle;
  const hideTitle = Boolean(pageMeta?.hideTitle);

  const { data: me } = useQuery<MeUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: dashboard } = useQuery<{ userName?: string }>({
    queryKey: ["/api/dashboard"],
    enabled: location === "/dashboard" || location === "/app" || location === "/dashboard",
  });

  const displayName = me?.name || dashboard?.userName || "Admin User";
  const roleLabel = me?.role === "super_admin" ? "Super Admin" : me?.role === "admin" ? "Admin" : "User";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    AuthStorage.clearAuth();
    window.location.href = "/";
  };

  return (
    <div className={`flex flex-col lg:flex-row lg:items-center gap-4 mb-5 ${hideTitle ? "justify-end" : "justify-between"}`}>
      {!hideTitle && (
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900" data-testid="text-page-title">
            {title}
          </h1>
          {subtitle ? <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      )}
      <div className="flex items-center gap-3">
        {actions}
        <div className="relative hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-10 w-56 pl-10 rounded-md bg-white border-slate-200 shadow-sm"
            data-testid="input-app-header-search"
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
            <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
