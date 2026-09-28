/**
 * Team Member Sidebar
 * Shows navigation based on granted permissions for team members
 * Supports both user team members and admin sub-admins
 */
import { Users, BookOpen, Mic, Link as LinkIcon, Phone, Settings, ChevronsUpDown, BarChart3, Home, Target, LogOut, Shield, UserCheck, Webhook, FileText, Wrench, Globe, MessageSquare, ContactRound, Bot } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarTrigger, useSidebar, } from "@/shared/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/shared/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { useBranding } from "@/shared/components/BrandingProvider";
import { TeamAuth } from "@/shared/lib/team-auth";
import { Badge } from "@/shared/components/ui/badge";
// User section mappings to routes
const USER_SECTION_ROUTES = {
    dashboard: [
        { url: "/dashboard", icon: Home, label: "Dashboard", group: "build", iconColor: "text-blue-500" },
    ],
    campaigns: [
        { url: "/campaigns", icon: Target, label: "Campaigns", group: "build", iconColor: "text-orange-500" },
    ],
    agents: [
        { url: "/agents", icon: Bot, label: "Agents", group: "build", iconColor: "text-blue-500" },
        { url: "/templates", icon: FileText, label: "Templates", group: "build", iconColor: "text-green-500" },
        { url: "/voices", icon: Mic, label: "Voices", group: "build", iconColor: "text-pink-500" },
    ],
    knowledge_base: [
        { url: "/knowledge-base", icon: BookOpen, label: "Knowledge Base", group: "build", iconColor: "text-violet-500" },
    ],
    contacts: [
        { url: "/contacts", icon: UserCheck, label: "All Contacts", group: "telephony", iconColor: "text-brand" },
    ],
    crm: [
        { url: "/crm", icon: ContactRound, label: "Quick CRM", group: "tools", iconColor: "text-cyan-500" },
    ],
    calls: [
        { url: "/calls", icon: Phone, label: "Calls", group: "monitor", iconColor: "text-blue-500" },
    ],
    messaging: [
        { url: "/conversations", icon: MessageSquare, label: "Conversations", group: "monitor", iconColor: "text-green-500" },
    ],
    analytics: [
        { url: "/analytics", icon: BarChart3, label: "Analytics", group: "monitor", iconColor: "text-purple-500" },
    ],
    website_widget: [
        { url: "/tools/widgets", icon: Globe, label: "Website Widget", group: "tools", iconColor: "text-sky-500" },
    ],
    webhooks: [
        { url: "/flows/webhooks", icon: Webhook, label: "Webhooks", group: "tools", iconColor: "text-violet-500" },
    ],
    phone_numbers: [
        { url: "/phone-numbers", icon: Phone, label: "Phone Numbers", group: "telephony", iconColor: "text-emerald-500" },
        { url: "/incoming-connections", icon: LinkIcon, label: "Incoming Connections", group: "telephony", iconColor: "text-amber-500" },
    ],
    settings: [
        { url: "/settings", icon: Settings, label: "Settings", group: "settings" },
    ],
    team: [
        { url: "/message/team", icon: Users, label: "Team Management", group: "settings" },
    ],
};
export function TeamMemberSidebar() {
    const [location] = useLocation();
    const { t } = useTranslation();
    const { branding, currentLogo, showLogo, showFavicon } = useBranding();
    const { setOpenMobile, isMobile } = useSidebar();
    // Fetch team member data and permissions
    const { data: authData, isLoading } = useQuery({
        queryKey: ["/api/team/auth/me"],
        queryFn: async () => {
            const token = TeamAuth.getToken();
            if (!token)
                throw new Error("No token");
            const response = await fetch("/api/team/auth/me", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                throw new Error("Failed to fetch team member data");
            return response.json();
        },
        retry: false,
    });
    const handleNavClick = () => {
        if (isMobile) {
            setOpenMobile(false);
        }
    };
    const handleLogout = () => {
        TeamAuth.clearAuth();
        window.location.href = "/team/login";
    };
    if (isLoading || !authData) {
        return null;
    }
    const { member, team, permissions } = authData;
    const isAdminTeam = team.type === 'admin';
    const memberName = member.firstName && member.lastName
        ? `${member.firstName} ${member.lastName}`
        : member.email;
    const memberInitial = (member.firstName?.[0] || member.email[0] || 'T').toUpperCase();
    const roleName = member.role?.name || 'Team Member';
    // Check if user has read permission in a section (any subsection with canRead)
    const hasSectionAccess = (sectionId) => {
        const sectionPerms = permissions[sectionId];
        if (!sectionPerms)
            return false;
        return Object.values(sectionPerms).some(perm => perm.canRead === true);
    };
    // Build navigation items based on permissions
    const buildNavItems = () => {
        const groups = {
            build: [],
            telephony: [],
            monitor: [],
            tools: [],
            settings: [],
        };
        // Add user section routes based on permissions
        Object.entries(USER_SECTION_ROUTES).forEach(([sectionId, routes]) => {
            if (hasSectionAccess(sectionId)) {
                routes.forEach(route => {
                    groups[route.group].push({
                        url: route.url,
                        icon: route.icon,
                        label: route.label,
                        iconColor: route.iconColor,
                    });
                });
            }
        });
        if (groups.tools.length > 0) {
            groups.build.push({
                url: "/tools",
                icon: Wrench,
                label: t('nav.tools', 'Tools'),
                iconColor: "text-slate-500",
            });
            groups.tools = [];
        }
        return groups;
    };
    const navGroups = buildNavItems();
    return (<Sidebar collapsible="icon">
      {/* Header with responsive logo */}
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
        {/* When expanded: Logo on left, toggle on right */}
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          {showLogo && (<img src={currentLogo} alt={branding.app_name} className="h-8 w-auto max-w-[140px] object-contain"/>)}
          <SidebarTrigger className="h-6 w-6 shrink-0" data-testid="button-sidebar-toggle"/>
        </div>
        {/* When collapsed: Favicon + toggle stacked */}
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-2">
          {showFavicon && (<img src={branding.favicon_url} alt={branding.app_name} className="h-6 w-6 object-contain"/>)}
          <SidebarTrigger className="h-5 w-5 shrink-0" data-testid="button-sidebar-toggle-collapsed"/>
        </div>
      </SidebarHeader>

      <SidebarContent className="group-data-[collapsible=icon]:px-0 px-2 py-1">
        {/* Team Member Badge */}
        <div className="mx-2 my-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="h-4 w-4 text-primary"/>
            <div className="flex flex-col">
              <span className="text-xs font-medium">{isAdminTeam ? 'Admin Team' : 'Team Member'}</span>
              <span className="text-[10px] text-muted-foreground">{team.name}</span>
            </div>
          </div>
        </div>

        {/* Build Section */}
        {navGroups.build.length > 0 && (<SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t('sidebar.build')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navGroups.build.map((item) => (<SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location === item.url} tooltip={item.label} data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className={`h-4 w-4 ${item.iconColor || ''}`}/>
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>)}

        {/* Telephony Section */}
        {navGroups.telephony.length > 0 && (<SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t('sidebar.telephony')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navGroups.telephony.map((item) => (<SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location === item.url} tooltip={item.label} data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className={`h-4 w-4 ${item.iconColor || ''}`}/>
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>)}

        {/* Monitor Section */}
        {navGroups.monitor.length > 0 && (<SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t('sidebar.monitor')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navGroups.monitor.map((item) => (<SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location === item.url} tooltip={item.label} data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className={`h-4 w-4 ${item.iconColor || ''}`}/>
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>)}

        {/* Settings Section */}
        {navGroups.settings.length > 0 && (<SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t('sidebar.settings') || 'Settings'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navGroups.settings.map((item) => (<SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location === item.url} tooltip={item.label} data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className={`h-4 w-4 ${item.iconColor || ''}`}/>
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>)}

      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="px-2 py-1.5 mt-auto border-t border-sidebar-border">
        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover-elevate cursor-pointer" data-testid="button-team-member-menu">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  {memberInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-medium text-sidebar-foreground truncate">
                  {memberName}
                </span>
                <span className="text-xs text-muted-foreground truncate">{roleName}</span>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground"/>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{memberName}</p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
              <Badge variant="secondary" className="mt-1 text-xs">{roleName}</Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive" data-testid="button-team-logout">
              <LogOut className="mr-2 h-4 w-4"/>
              <span>{t('auth.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>);
}
