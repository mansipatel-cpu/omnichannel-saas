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
import { useEffect, useState, type CSSProperties } from "react";
import {
  Megaphone,
  Users,
  MessageSquare,
  Phone,
  FileText,
  BarChart3,
  LayoutGrid,
  Settings,
  Headphones,
  ChevronDown,
  Zap,
  BookOpen,
  Headset,
  AudioLines,
  ContactRound,
  Workflow,
  ClipboardList,
  Calendar,
  Link as LinkIcon,
  Inbox,
  Grid3x3,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useBranding } from "@/components/BrandingProvider";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
}

const sidebarVars = {
  "--sidebar": "222 39% 11%",
  "--sidebar-foreground": "210 20% 90%",
  "--sidebar-border": "222 30% 16%",
  "--sidebar-primary": "211 100% 50%",
  "--sidebar-primary-foreground": "0 0% 100%",
  "--sidebar-accent": "211 100% 50%",
  "--sidebar-accent-foreground": "0 0% 100%",
  "--sidebar-ring": "211 100% 50%",
} as CSSProperties;

const messagesItems = [
  { title: "Team Inbox", url: "/whatsapp/inbox", icon: Inbox },
  { title: "API Documentation", url: "/whatsapp/api-docs", icon: FileText },
  { title: "Channels", url: "/whatsapp/waba-connection", icon: AudioLines },
];

const autoCallingItems = [
  { title: "Agents", url: "/agents", icon: Headset },
  { title: "Knowledge Base", url: "/knowledge-base", icon: BookOpen },
  { title: "Voice", url: "/voices", icon: AudioLines },
  { title: "Calls", url: "/calls", icon: Phone },
  { title: "Quick CRM", url: "/crm", icon: ContactRound },
  { title: "Phone Numbers", url: "/phone-numbers", icon: Grid3x3 },
  { title: "Incoming Connections", url: "/incoming-connections", icon: LinkIcon },
  { title: "Flow Builder", url: "/flows", icon: Workflow },
  { title: "Execution Logs", url: "/flows/execution", icon: ClipboardList },
  { title: "Forms", url: "/flows/forms", icon: FileText },
  { title: "Appointments", url: "/flows/appointments", icon: Calendar },
];

function pathMatches(location: string, url: string) {
  if (url === "/dashboard") {
    return location === "/dashboard" || location === "/app" || location === "/dashboard";
  }
  if (url === "/campaigns") {
    return location === "/campaigns" || location.startsWith("/campaigns/") || location.startsWith("/whatsapp/campaigns");
  }
  if (url === "/contacts") {
    return location === "/contacts" || location.startsWith("/contacts/");
  }
  if (url === "/templates") {
    return location === "/templates" || location.startsWith("/templates/") || location.startsWith("/whatsapp/templates") || location === "/prompt-templates";
  }
  if (url === "/flows") {
    return location === "/flows" || (location.startsWith("/flows/") && !location.startsWith("/flows/execution") && !location.startsWith("/flows/forms") && !location.startsWith("/flows/appointments"));
  }
  return location === url || location.startsWith(url + "/");
}

function isInGroup(location: string, items: Array<{ url: string }>) {
  return items.some((item) => pathMatches(location, item.url));
}

export function AppSidebar() {
  const [location] = useLocation();
  const { branding } = useBranding();
  const { setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const [messagesOpen, setMessagesOpen] = useState(true);
  const [autoCallingOpen, setAutoCallingOpen] = useState(true);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (isInGroup(location, messagesItems)) setMessagesOpen(true);
    if (isInGroup(location, autoCallingItems)) setAutoCallingOpen(true);
  }, [location]);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  if (userLoading || !user) {
    return null;
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";
  const appName = branding.app_name || "AutoComm";

  const itemClass = (active: boolean) =>
    cn(
      "h-10 rounded-lg text-[13px] text-slate-300 hover:bg-white/10 hover:text-white",
      "group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 group-data-[collapsible=icon]:justify-center",
      active && "bg-[#007BFF] text-white hover:bg-[#007BFF] hover:text-white"
    );

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0 [&_[data-sidebar=sidebar]]:bg-[#1A2233]"
      style={sidebarVars}
    >
      <SidebarHeader className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex items-center gap-2.5 min-w-0 text-left"
            data-testid="button-sidebar-toggle"
            title="Collapse sidebar"
          >
            <div className="h-9 w-9 rounded-lg bg-[#007BFF] text-white flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold text-white truncate">{appName}</p>
              <p className="text-[11px] text-slate-400">Platform</p>
            </div>
          </button>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center">
          <button
            type="button"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-lg bg-[#007BFF] text-white flex items-center justify-center"
            data-testid="button-sidebar-toggle-collapsed"
            title="Expand sidebar"
          >
            <Zap className="h-4 w-4 fill-current" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="py-0">
          <SidebarGroupLabel className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathMatches(location, "/dashboard")} tooltip="Dashboard" className={itemClass(pathMatches(location, "/dashboard"))} data-testid="link-dashboard">
                  <Link href="/dashboard" onClick={handleNavClick}>
                    <LayoutGrid className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathMatches(location, "/campaigns")} tooltip="Campaigns" className={itemClass(pathMatches(location, "/campaigns"))} data-testid="link-campaigns">
                  <Link href="/campaigns" onClick={handleNavClick}>
                    <Megaphone className="h-4 w-4" />
                    <span>Campaigns</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathMatches(location, "/contacts")} tooltip="Contacts" className={itemClass(pathMatches(location, "/contacts"))} data-testid="link-contacts">
                  <Link href="/contacts" onClick={handleNavClick}>
                    <Users className="h-4 w-4" />
                    <span>Contacts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible open={messagesOpen} onOpenChange={setMessagesOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Messages" className="h-10 rounded-lg text-[13px] text-slate-300 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 group-data-[collapsible=icon]:justify-center">
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      <span>Messages</span>
                      <ChevronDown className={cn("ml-auto h-4 w-4 text-slate-500 transition-transform group-data-[collapsible=icon]:hidden", messagesOpen && "rotate-180")} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenuSub className="border-white/10 mx-3 mt-0.5 mb-1">
                      {messagesItems.map((item) => (
                        <SidebarMenuSubItem key={item.url}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathMatches(location, item.url)}
                            className={cn(
                              "h-8 text-[13px] text-slate-400 hover:bg-white/10 hover:text-white",
                              pathMatches(location, item.url) && "bg-[#007BFF]/20 text-white"
                            )}
                          >
                            <Link href={item.url} onClick={handleNavClick}>
                              <item.icon className="h-3.5 w-3.5" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <Collapsible open={autoCallingOpen} onOpenChange={setAutoCallingOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Auto Calling" className="h-10 rounded-lg text-[13px] text-slate-300 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 group-data-[collapsible=icon]:justify-center">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>Auto Calling</span>
                      <ChevronDown className={cn("ml-auto h-4 w-4 text-slate-500 transition-transform group-data-[collapsible=icon]:hidden", autoCallingOpen && "rotate-180")} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenuSub className="border-white/10 mx-3 mt-0.5 mb-1">
                      {autoCallingItems.map((item) => (
                        <SidebarMenuSubItem key={item.url}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathMatches(location, item.url)}
                            className={cn(
                              "h-8 text-[13px] text-slate-400 hover:bg-white/10 hover:text-white",
                              pathMatches(location, item.url) && "bg-[#007BFF]/20 text-white"
                            )}
                          >
                            <Link href={item.url} onClick={handleNavClick}>
                              <item.icon className="h-3.5 w-3.5" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathMatches(location, "/templates")} tooltip="Templates" className={itemClass(pathMatches(location, "/templates"))} data-testid="link-templates">
                  <Link href="/templates" onClick={handleNavClick}>
                    <FileText className="h-4 w-4" />
                    <span>Templates</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathMatches(location, "/analytics")} tooltip="Reports" className={itemClass(pathMatches(location, "/analytics"))} data-testid="link-reports">
                  <Link href="/analytics" onClick={handleNavClick}>
                    <BarChart3 className="h-4 w-4" />
                    <span>Reports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4 pt-2 mt-auto">
        <SidebarMenu className="gap-0.5">
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.startsWith("/admin")} tooltip="Admin Dashboard" className={itemClass(location.startsWith("/admin"))} data-testid="link-admin-dashboard">
                <Link href="/admin" onClick={handleNavClick}>
                  <LayoutGrid className="h-4 w-4" />
                  <span>Admin Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location === "/settings"} tooltip="Settings" className={itemClass(location === "/settings")} data-testid="link-settings">
              <Link href="/settings" onClick={handleNavClick}>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Help & Support" className={itemClass(false)} data-testid="link-help-support">
              <Link href="/settings" onClick={handleNavClick}>
                <Headphones className="h-4 w-4" />
                <span>Help & Support</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
