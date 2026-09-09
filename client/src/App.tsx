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
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Zap, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { TeamMemberSidebar } from "@/components/TeamMemberSidebar";
import { AdminTeamMemberSidebar } from "@/components/AdminTeamMemberSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BrandingProvider, useBranding } from "@/components/BrandingProvider";
import { DirectionProvider } from "@/components/DirectionProvider";
import { AppHeaderProvider, AppPageHeader } from "@/components/AppPageHeader";
import { useEffect, useState } from "react";
import { AuthStorage } from "./lib/auth-storage";
import { TeamAuth } from "./lib/team-auth";
import { useQuery } from "@tanstack/react-query";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import Calls from "@/pages/Calls";
import CallDetail from "@/pages/CallDetail";
import Analytics from "@/pages/Analytics";
import Billing from "@/pages/Billing";
import PaymentResult from "@/pages/PaymentResult";
import KnowledgeBase from "@/pages/KnowledgeBase";
import Agents from "@/pages/Agents";
import Voices from "@/pages/Voices";
import PhoneNumbers from "@/pages/PhoneNumbers";
import AllContacts from "@/pages/AllContacts";
import AddContact from "@/pages/AddContact";
import CreateContactGroup from "@/pages/CreateContactGroup";
import CreateCampaign from "@/pages/CreateCampaign";
import AllTemplates from "@/pages/AllTemplates";
import CreateWhatwayTemplate from "@/pages/CreateWhatwayTemplate";
import CreateAgentLabTemplate from "@/pages/CreateAgentLabTemplate";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import LandingPage from "@/pages/LandingPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminCampaignDetail from "@/pages/AdminCampaignDetail";
import PrivacyPolicy from "@/pages/policies/PrivacyPolicy";
import TermsOfService from "@/pages/policies/TermsOfService";
import CookiePolicy from "@/pages/policies/CookiePolicy";
import InstallWizard from "@/pages/InstallWizard";
import NotFound from "@/pages/not-found";
import FlowsPage from "@/pages/FlowsPage";
import CRMPage from "@/pages/CRMPage";
import WidgetsPage from "@/pages/WidgetsPage";
import FlowBuilderPage from "@/pages/FlowBuilderPage";
import FlowExecutionLogsPage from "@/pages/FlowExecutionLogsPage";
import WebhookConfigPage from "@/pages/WebhookConfigPage";
import FormsPage from "@/pages/FormsPage";
import AppointmentsPage from "@/pages/AppointmentsPage";
import FlowTemplatesPage from "@/pages/FlowTemplatesPage";
import IncomingConnections from "@/pages/IncomingConnections";
import ToolsPage from "@/pages/ToolsPage";
import GoogleCallbackPage from "@/pages/GoogleCallbackPage";
import TransactionHistory from "@/pages/TransactionHistory";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import Contact from "@/pages/Contact";
import LoginPage from "@/pages/LoginPage";
import TeamMemberLogin from "@/pages/TeamMemberLogin";
import AdminTeamLogin from "@/pages/AdminTeamLogin";
import FeaturesPage from "@/pages/FeaturesPage";
import PricingPage from "@/pages/PricingPage";
import UseCasesPage from "@/pages/UseCasesPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import { ScrollToTop } from "@/components/ScrollToTop";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { AnalyticsScripts } from "@/components/AnalyticsScripts";
import { SessionTimeoutDialog } from "@/components/SessionTimeoutDialog";
import { useActivityTimeout } from "@/hooks/useActivityTimeout";
import { useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { PluginRegistryProvider, usePluginRegistry } from "@/contexts/plugin-registry";
import { PluginBootstrapper } from "@/components/plugin-bootstrapper";
import { DynamicLanguagesProvider } from "@/contexts/dynamic-languages";
import WhatsAppApp from "@wa/WhatsAppApp";
import { isUserAppPath, stripAppPrefix } from "@/lib/app-routes";

function PluginConversationsPage() {
  const registry = usePluginRegistry();
  const routes = registry.getRoutes();
  const conversationRoute = routes.find(r => r.id === 'messaging-conversations');
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (conversationRoute) return;
    const timer = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [conversationRoute]);

  if (!conversationRoute) {
    if (timedOut) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
          <div>
            <h3 className="text-lg font-medium mb-1" data-testid="text-conversations-error">Conversations Unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              The messaging plugin could not be loaded. This may be due to a configuration issue or a temporary error.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              data-testid="button-conversations-retry"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
        <div>
          <h3 className="text-lg font-medium mb-1" data-testid="text-conversations-loading">Loading Conversations</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            The messaging plugin is loading. Please wait a moment or refresh the page.
          </p>
        </div>
      </div>
    );
  }

  const ConversationComponent = conversationRoute.component;

  return (
    <div className="-mx-4 md:-mx-10 lg:-mx-16 xl:-mx-20 -my-4 md:-my-6 h-[calc(100vh-3.5rem)]">
      <ConversationComponent />
    </div>
  );
}

function LegacyAppRedirect() {
  const [location] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const next = stripAppPrefix(location.split("?")[0]);
  return <Redirect to={`${next}${search}`} />;
}

function UserAppRoutes({ includeAdmin = false }: { includeAdmin?: boolean }) {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/campaigns/new" component={CreateCampaign} />
      <Route path="/campaigns/:id" component={CampaignDetail} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/calls/:id" component={CallDetail} />
      <Route path="/calls" component={Calls} />
      <Route path="/contacts/new" component={AddContact} />
      <Route path="/contacts/groups/new" component={CreateContactGroup} />
      <Route path="/contacts" component={AllContacts} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/crm" component={CRMPage} />
      <Route path="/tools/widgets" component={WidgetsPage} />
      <Route path="/billing" component={Billing} />
      <Route path="/payment-result" component={PaymentResult} />
      <Route path="/transaction-history">
        <Redirect to="/billing?tab=history" />
      </Route>
      <Route path="/upgrade">
        <Redirect to="/billing?tab=plans" />
      </Route>
      <Route path="/knowledge-base" component={KnowledgeBase} />
      <Route path="/agents" component={Agents} />
      <Route path="/conversations" component={PluginConversationsPage} />
      <Route path="/templates/agentlab/new" component={CreateAgentLabTemplate} />
      <Route path="/templates/new" component={CreateWhatwayTemplate} />
      <Route path="/templates" component={AllTemplates} />
      <Route path="/prompt-templates">
        <Redirect to="/templates" />
      </Route>
      <Route path="/whatsapp/templates/agentlab/new">
        <Redirect to="/templates/agentlab/new" />
      </Route>
      <Route path="/whatsapp/templates/new">
        <Redirect to="/templates/new" />
      </Route>
      <Route path="/whatsapp/templates">
        <Redirect to="/templates" />
      </Route>
      <Route path="/app/templates/agentlab/new">
        <Redirect to="/templates/agentlab/new" />
      </Route>
      <Route path="/app/templates/new">
        <Redirect to="/templates/new" />
      </Route>
      <Route path="/incoming-connections" component={IncomingConnections} />
      <Route path="/voices" component={Voices} />
      <Route path="/phone-numbers" component={PhoneNumbers} />
      <Route path="/google-callback" component={GoogleCallbackPage} />
      <Route path="/tools" component={ToolsPage} />
      <Route path="/flows/new" component={FlowBuilderPage} />
      <Route path="/flows/execution">
        <Redirect to="/flows?tab=execution" />
      </Route>
      <Route path="/flows/webhooks" component={WebhookConfigPage} />
      <Route path="/flows/forms" component={FormsPage} />
      <Route path="/flows/appointments" component={AppointmentsPage} />
      <Route path="/flows/templates">
        <Redirect to="/flows?tab=templates" />
      </Route>
      <Route path="/flows/:id" component={FlowBuilderPage} />
      <Route path="/flows" component={FlowsPage} />
      <Route path="/outbound" component={() => <div className="text-center py-16 text-muted-foreground">Outbound page coming soon</div>} />
      <Route path="/settings" component={Settings} />
      <Route path="/developers" component={() => <div className="text-center py-16 text-muted-foreground">Developers page coming soon</div>} />
      <Route path="/whatsapp" component={WhatsAppApp} />
      <Route path="/whatsapp/*" component={WhatsAppApp} />
      {includeAdmin ? <Route path="/admin" component={AdminDashboard} /> : null}
      <Route path="/app/*" component={LegacyAppRedirect} />
      <Route path="/app" component={LegacyAppRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  
  const handleTimeout = useCallback(() => {
    // Logout request sends HttpOnly cookie automatically via credentials: 'include'
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    AuthStorage.clearAuth();
    queryClient.clear();
    setLocation('/login');
  }, [setLocation]);

  const { isWarningVisible, remainingTime, dismissWarning } = useActivityTimeout({
    enabled: AuthStorage.isAuthenticated(),
    onTimeout: handleTimeout,
    warningThresholdMs: 5 * 60 * 1000,
  });

  return (
    <>
      {children}
      <SessionTimeoutDialog
        open={isWarningVisible}
        remainingTime={remainingTime}
        onContinue={dismissWarning}
        onLogout={handleTimeout}
      />
    </>
  );
}


function PublicRouter() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={LoginPage} />
        <Route path="/home" component={LandingPage} />
        <Route path="/team/login" component={TeamMemberLogin} />
        <Route path="/admin/team/login" component={AdminTeamLogin} />
        <Route path="/features" component={FeaturesPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/use-cases" component={UseCasesPage} />
        <Route path="/integrations" component={IntegrationsPage} />
        <Route path="/contact" component={Contact} />
        <Route path="/blog/:slug" component={BlogPost} />
        <Route path="/blog" component={Blog} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/cookies" component={CookiePolicy} />
        <Route component={LoginPage} />
      </Switch>
    </>
  );
}

function AdminRouter() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  const { branding, currentLogo } = useBranding();

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <AppHeaderProvider>
      <div className="flex flex-col h-screen w-full">
        <DemoModeBanner />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex md:hidden items-center justify-between h-14 px-4 border-b bg-background/95">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-mobile-menu" />
                {currentLogo ? (
                  <img
                    src={currentLogo}
                    alt={branding.app_name}
                    className="h-7 w-auto max-w-[120px] object-contain"
                  />
                ) : (
                  <Zap className="h-6 w-6 text-primary" />
                )}
              </div>
            </header>
          <main className="flex-1 overflow-auto bg-[#F8F9FB]">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
              <AppPageHeader />
              <Switch>
                <Route path="/">
                  <Redirect to="/admin" />
                </Route>
                <Route path="/admin" component={AdminDashboard} />
                <Route path="/admin/dashboard" component={AdminDashboard} />
                <Route path="/admin/campaigns/:id" component={AdminCampaignDetail} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
          </div>
        </div>
      </div>
      </AppHeaderProvider>
    </SidebarProvider>
  );
}

function UserRouter() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  const { branding, currentLogo } = useBranding();

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <AppHeaderProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex md:hidden items-center justify-between h-14 px-4 border-b bg-background/95">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-mobile-menu" />
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt={branding.app_name}
                  className="h-7 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <Zap className="h-6 w-6 text-primary" />
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-[#F8F9FB]">
            <div className="w-full px-4 md:px-8 lg:px-10 py-6 md:py-8">
              <AppPageHeader />
              <UserAppRoutes />
            </div>
          </main>
        </div>
      </div>
      </AppHeaderProvider>
    </SidebarProvider>
  );
}

function TeamMemberRouter() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  const { branding, currentLogo } = useBranding();

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <AppHeaderProvider>
      <div className="flex h-screen w-full">
        <TeamMemberSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex md:hidden items-center justify-between h-14 px-4 border-b bg-background/95">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-mobile-menu" />
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt={branding.app_name}
                  className="h-7 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <Zap className="h-6 w-6 text-primary" />
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-[#F8F9FB]">
            <div className="w-full px-4 md:px-8 lg:px-10 py-6 md:py-8">
              <AppPageHeader />
              <UserAppRoutes includeAdmin />
            </div>
          </main>
        </div>
      </div>
      </AppHeaderProvider>
    </SidebarProvider>
  );
}

function AdminTeamMemberRouter() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  const { branding, currentLogo } = useBranding();

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <AppHeaderProvider>
      <div className="flex h-screen w-full">
        <AdminTeamMemberSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex md:hidden items-center justify-between h-14 px-4 border-b bg-background/95">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-mobile-menu" />
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt={branding.app_name}
                  className="h-7 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <Zap className="h-6 w-6 text-primary" />
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-[#F8F9FB]">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
              <AppPageHeader />
              <Switch>
                <Route path="/">
                  <Redirect to="/admin" />
                </Route>
                <Route path="/admin" component={AdminDashboard} />
                <Route path="/admin/dashboard" component={AdminDashboard} />
                <Route path="/admin/campaigns/:id" component={AdminCampaignDetail} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      </div>
      </AppHeaderProvider>
    </SidebarProvider>
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  credits?: number;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  // Fetch user from server to validate admin access
  const { data: user, isLoading: userLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // Handle auth errors
  useEffect(() => {
    if (isError) {
      AuthStorage.clearAuth();
      window.location.href = "/login";
    }
  }, [isError]);

  // Show loading while fetching user data
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If no user data at all (shouldn't happen after loading), redirect to login
  if (!user) {
    console.log("AdminGuard - No user data, redirecting to /login");
    return <Redirect to="/login" />;
  }

  const hasAdminAccess = user.role === 'admin';
  
  // If user doesn't have admin access, redirect to user panel
  if (!hasAdminAccess) {
    console.log("AdminGuard - User is not authorized for admin panel, redirecting to /dashboard");
    return <Redirect to="/dashboard" />;
  }

  console.log("AdminGuard - User has admin access, rendering admin panel");
  return <>{children}</>;
}

interface AdminTeamMemberInfo {
  id: string;
  email: string;
  status: string;
  role?: {
    id: string;
    name: string;
  };
}

function AdminTeamGuard({ children }: { children: React.ReactNode }) {
  // Validate admin team member JWT token via server
  const { data: authData, isLoading, isError } = useQuery<{ 
    member: AdminTeamMemberInfo; 
    team: { id: string; name: string }; 
    permissions: Record<string, Record<string, any>> 
  }>({
    queryKey: ["/api/admin/team/auth/me"],
    queryFn: async () => {
      const token = TeamAuth.getToken();
      if (!token) throw new Error("No token");
      const response = await fetch("/api/admin/team/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Invalid session");
      return response.json();
    },
    retry: false,
  });

  // Handle auth errors
  useEffect(() => {
    if (isError) {
      TeamAuth.clearAuth();
      window.location.href = "/admin/team/login";
    }
  }, [isError]);

  // Show loading while validating token
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If no auth data, redirect to admin team login
  if (!authData || !authData.member) {
    console.log("AdminTeamGuard - No valid session, redirecting to /admin/team/login");
    TeamAuth.clearAuth();
    return <Redirect to="/admin/team/login" />;
  }

  // Check member status
  if (authData.member.status !== 'active') {
    console.log("AdminTeamGuard - Member not active, redirecting to /admin/team/login");
    TeamAuth.clearAuth();
    return <Redirect to="/admin/team/login" />;
  }

  console.log("AdminTeamGuard - Admin team member validated, rendering admin panel");
  return <>{children}</>;
}

function UserGuard({ children }: { children: React.ReactNode }) {
  const [isTeamMember, setIsTeamMember] = useState(() => TeamAuth.isAuthenticated());
  const [teamAuthValid, setTeamAuthValid] = useState<boolean | null>(null);
  const [teamAuthLoading, setTeamAuthLoading] = useState(isTeamMember);

  // Fetch user from server (for regular users)
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
    enabled: !isTeamMember, // Only fetch for non-team-members
  });

  // Validate team member session
  useEffect(() => {
    if (isTeamMember) {
      setTeamAuthLoading(true);
      TeamAuth.validateSession().then(result => {
        setTeamAuthValid(result.valid);
        setTeamAuthLoading(false);
        if (!result.valid) {
          TeamAuth.clearAuth();
        }
      });
    }
  }, [isTeamMember]);

  // Handle auth errors for regular users
  useEffect(() => {
    if (!isTeamMember && isError) {
      AuthStorage.clearAuth();
      window.location.href = "/login";
    }
  }, [isError, isTeamMember]);

  // Show loading state
  if (isTeamMember ? teamAuthLoading : isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Team member authentication check
  if (isTeamMember) {
    if (teamAuthValid === false) {
      return <Redirect to="/team/login" />;
    }
    // Team member is valid, render children
    return <>{children}</>;
  }

  // Regular user authentication check
  if (!user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();
  // Initialize auth state synchronously from localStorage to prevent flash
  // Check both regular user auth AND team member auth
  const [isAuthenticated, setIsAuthenticated] = useState(() => 
    AuthStorage.isAuthenticated() || TeamAuth.isAuthenticated()
  );
  const [isTeamMember, setIsTeamMember] = useState(() => TeamAuth.isAuthenticated());
  const [isAdminTeamMember, setIsAdminTeamMember] = useState(() => TeamAuth.isAdminTeamMember());
  const [isChecking, setIsChecking] = useState(true);

  // Check installation status
  const { data: installStatus } = useQuery<{ installed: boolean }>({
    queryKey: ["/api/installer/status"],
    retry: false,
  });

  // Verify auth state and mark checking complete
  useEffect(() => {
    // Re-verify from storage in case it changed
    const regularAuth = AuthStorage.isAuthenticated();
    const teamAuth = TeamAuth.isAuthenticated();
    const adminTeamAuth = TeamAuth.isAdminTeamMember();
    setIsAuthenticated(regularAuth || teamAuth);
    setIsTeamMember(teamAuth);
    setIsAdminTeamMember(adminTeamAuth);
    setIsChecking(false);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log("Router - Current location:", location);
    console.log("Router - isAuthenticated:", isAuthenticated);
    console.log("Router - location.startsWith('/admin'):", location.startsWith('/admin'));
    console.log("Router - isUserAppPath:", isUserAppPath(location));
    console.log("Router - location === '/dashboard':", location === '/dashboard');
  }, [location, isAuthenticated]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Installation check - if not installed, redirect to installer unless already on /install
  if (installStatus && !installStatus.installed && location !== '/install') {
    console.log("Router - Not installed, redirecting to /install");
    return <Redirect to="/install" />;
  }

  // Block installer if already installed
  if (location === '/install' && installStatus?.installed) {
    console.log("Router - Already installed, redirecting to /login");
    return <Redirect to="/login" />;
  }

  // Installer route (public, no auth required)
  if (location === '/install') {
    console.log("Router - Rendering InstallWizard");
    return <InstallWizard />;
  }

  // Redirect authenticated users away from login/register/home immediately
  // This prevents the flash when page reloads after login
  if (isAuthenticated && (location === '/' || location === '/login' || location === '/register')) {
    // Admin team members go to /admin
    if (isAdminTeamMember) {
      console.log("Router - Authenticated admin team member on auth page, redirecting to /admin");
      return <Redirect to="/admin" />;
    }
    // User team members go to /app
    if (isTeamMember) {
      console.log("Router - Authenticated team member on auth page, redirecting to /dashboard");
      return <Redirect to="/dashboard" />;
    }
    const user = AuthStorage.getUser();
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const redirectTo = isAdmin ? '/admin' : '/dashboard';
    console.log("Router - Authenticated user on auth page, redirecting to", redirectTo);
    return <Redirect to={redirectTo} />;
  }

  // Redirect authenticated team members away from team login page
  if (isTeamMember && location === '/team/login') {
    const redirectTo = isAdminTeamMember ? '/admin' : '/dashboard';
    console.log("Router - Authenticated team member on team login page, redirecting to", redirectTo);
    return <Redirect to={redirectTo} />;
  }

  // Redirect authenticated admin team members away from admin team login page
  if (isAdminTeamMember && location === '/admin/team/login') {
    console.log("Router - Authenticated admin team member on admin team login page, redirecting to /admin");
    return <Redirect to="/admin" />;
  }

  // Admin routes - protected by server-side validation
  // Check this BEFORE public routes to prevent flash during login transition
  if (location.startsWith('/admin') && !location.startsWith('/admin/team/login')) {
    // Admin team members get the AdminTeamGuard + AdminTeamMemberRouter with permission-based sidebar
    if (isAdminTeamMember) {
      console.log("Router - Rendering AdminTeamGuard + AdminTeamMemberRouter (admin team member)");
      return (
        <AdminTeamGuard>
          <AdminTeamMemberRouter />
        </AdminTeamGuard>
      );
    }
    console.log("Router - Rendering AdminGuard + AdminRouter");
    return (
      <AdminGuard>
        <AdminRouter />
      </AdminGuard>
    );
  }

  // User routes (/app) - protected by server-side validation
  // Check this BEFORE public routes to prevent flash during login transition
  if (isUserAppPath(location)) {
    // Team members get the TeamMemberRouter with permission-based sidebar
    if (isTeamMember) {
      console.log("Router - Rendering UserGuard + TeamMemberRouter (team member)");
      return (
        <UserGuard>
          <TeamMemberRouter />
        </UserGuard>
      );
    }
    console.log("Router - Rendering UserGuard + UserRouter");
    return (
      <UserGuard>
        <UserRouter />
      </UserGuard>
    );
  }

  // Public routes (landing, login, register)
  console.log("Router - Rendering PublicRouter");
  return <PublicRouter />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DirectionProvider>
          <BrandingProvider>
            <PluginRegistryProvider>
              <PluginBootstrapper>
                <DynamicLanguagesProvider>
                  <TooltipProvider>
                    <AnalyticsScripts />
                    <SessionTimeoutWrapper>
                      <Router />
                    </SessionTimeoutWrapper>
                    <Toaster />
                    <CookieConsentBanner />
                  </TooltipProvider>
                </DynamicLanguagesProvider>
              </PluginBootstrapper>
            </PluginRegistryProvider>
          </BrandingProvider>
        </DirectionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
