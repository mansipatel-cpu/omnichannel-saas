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
import { queryClient } from "@/shared/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { TeamMemberSidebar } from "@/shared/components/TeamMemberSidebar";
import { AdminTeamMemberSidebar } from "@/shared/components/AdminTeamMemberSidebar";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import { BrandingProvider } from "@/shared/components/BrandingProvider";
import { DirectionProvider } from "@/shared/components/DirectionProvider";
import { AppShell, PublicLayout } from "@/shared/layouts";
import { useEffect, useState } from "react";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { TeamAuth } from "@/shared/lib/team-auth";
import { useQuery } from "@tanstack/react-query";
import Dashboard from "@/features/dashboard/pages/Dashboard";
import Campaigns from "@/features/campaigns/pages/Campaigns";
import CampaignDetail from "@/features/campaigns/pages/CampaignDetail";
import WhatsAppCampaignDetail from "@/features/campaigns/pages/WhatsAppCampaignDetail";
import Calls from "@/features/dashboard/pages/Calls";
import CallDetail from "@/features/dashboard/pages/CallDetail";
import Analytics from "@/features/dashboard/pages/Analytics";
import KnowledgeBase from "@/features/agents/pages/KnowledgeBase";
import Agents from "@/features/agents/pages/Agents";
import CreateAgent from "@/features/agents/pages/CreateAgent";
import Voices from "@/features/agents/pages/Voices";
import PhoneNumbers from "@/features/settings/pages/PhoneNumbers";
import AllContacts from "@/features/contacts/pages/AllContacts";
import AddContact from "@/features/contacts/pages/AddContact";
import CreateContactGroup from "@/features/contacts/pages/CreateContactGroup";
import CreateCampaign from "@/features/campaigns/pages/CreateCampaign";
import AllTemplates from "@/features/agents/pages/AllTemplates";
import CreateWhatwayTemplate from "@/features/agents/pages/CreateWhatwayTemplate";
import CreateAgentLabTemplate from "@/features/agents/pages/CreateAgentLabTemplate";
import Settings from "@/features/settings/pages/Settings";
import WhatsAppApp, { WhatsAppProviders } from "@wa/WhatsAppApp";
import WABAConnection from "@wa/pages/WABAConnection";
import LandingPage from "@/features/landing/pages/LandingPage";
import AdminDashboard from "@/features/admin/pages/AdminDashboard";
import AdminCampaignDetail from "@/features/admin/pages/AdminCampaignDetail";
import PrivacyPolicy from "@/features/landing/pages/policies/PrivacyPolicy";
import TermsOfService from "@/features/landing/pages/policies/TermsOfService";
import CookiePolicy from "@/features/landing/pages/policies/CookiePolicy";
import InstallWizard from "@/features/landing/pages/InstallWizard";
import NotFound from "@/features/common/pages/not-found";
import FlowsPage from "@/features/flows/pages/FlowsPage";
import CRMPage from "@/features/flows/pages/CRMPage";
import WidgetsPage from "@/features/flows/pages/WidgetsPage";
import FlowBuilderPage from "@/features/flows/pages/FlowBuilderPage";
import WebhookConfigPage from "@/features/settings/pages/WebhookConfigPage";
import FormsPage from "@/features/flows/pages/FormsPage";
import AppointmentsPage from "@/features/flows/pages/AppointmentsPage";
import IncomingConnections from "@/features/agents/pages/IncomingConnections";
import ToolsPage from "@/features/settings/pages/ToolsPage";
import GoogleCallbackPage from "@/features/auth/pages/GoogleCallbackPage";
import Blog from "@/features/landing/pages/Blog";
import BlogPost from "@/features/landing/pages/BlogPost";
import Contact from "@/features/landing/pages/Contact";
import LoginPage from "@/features/auth/pages/LoginPage";
import TeamMemberLogin from "@/features/auth/pages/TeamMemberLogin";
import AdminTeamLogin from "@/features/auth/pages/AdminTeamLogin";
import FeaturesPage from "@/features/landing/pages/FeaturesPage";
import PricingPage from "@/features/landing/pages/PricingPage";
import UseCasesPage from "@/features/landing/pages/UseCasesPage";
import IntegrationsPage from "@/features/flows/pages/IntegrationsPage";
import { AnalyticsScripts } from "@/shared/components/AnalyticsScripts";
import { SessionTimeoutDialog } from "@/shared/components/SessionTimeoutDialog";
import { useActivityTimeout } from "@/shared/hooks/useActivityTimeout";
import { useCallback } from "react";
import { PluginRegistryProvider, usePluginRegistry } from "@/shared/contexts/plugin-registry";
import { PluginBootstrapper } from "@/shared/components/plugin-bootstrapper";
import { DynamicLanguagesProvider } from "@/shared/contexts/dynamic-languages";
import { isUserAppPath, stripAppPrefix } from "@/shared/lib/app-routes";
function ChannelSettingsPage() {
    return (<WhatsAppProviders>
      <WABAConnection />
    </WhatsAppProviders>);
}
function PluginConversationsPage() {
    const registry = usePluginRegistry();
    const routes = registry.getRoutes();
    const conversationRoute = routes.find(r => r.id === 'messaging-conversations');
    const [timedOut, setTimedOut] = useState(false);
    useEffect(() => {
        if (conversationRoute)
            return;
        const timer = setTimeout(() => setTimedOut(true), 10000);
        return () => clearTimeout(timer);
    }, [conversationRoute]);
    if (!conversationRoute) {
        if (timedOut) {
            return (<div className="flex flex-col items-center justify-center h-full text-center gap-4">
          <AlertTriangle className="w-10 h-10 text-amber-500"/>
          <div>
            <h3 className="text-lg font-medium mb-1" data-testid="text-conversations-error">Conversations Unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              The messaging plugin could not be loaded. This may be due to a configuration issue or a temporary error.
            </p>
            <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" data-testid="button-conversations-retry">
              <RefreshCw className="w-4 h-4"/>
              Refresh page
            </button>
          </div>
        </div>);
        }
        return (<div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <Loader2 className="w-10 h-10 text-muted-foreground animate-spin"/>
        <div>
          <h3 className="text-lg font-medium mb-1" data-testid="text-conversations-loading">Loading Conversations</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            The messaging plugin is loading. Please wait a moment or refresh the page.
          </p>
        </div>
      </div>);
    }
    const ConversationComponent = conversationRoute.component;
    return (<div className="-mx-4 md:-mx-10 lg:-mx-16 xl:-mx-20 -my-4 md:-my-6 h-[calc(100vh-3.5rem)]">
      <ConversationComponent />
    </div>);
}
function LegacyAppRedirect() {
    const [location] = useLocation();
    const search = typeof window !== "undefined" ? window.location.search : "";
    const next = stripAppPrefix(location.split("?")[0]);
    return <Redirect to={`${next}${search}`}/>;
}
function WhatsAppToMessageRedirect() {
    const [location] = useLocation();
    const search = typeof window !== "undefined" ? window.location.search : "";
    const rest = location.replace(/^\/whatsapp/, "") || "";
    return <Redirect to={`/message${rest}${search}`}/>;
}
function UserAppRoutes({ includeAdmin = false }) {
    return (<Switch>
      <Route path="/">
        <Redirect to="/dashboard"/>
      </Route>
      <Route path="/dashboard" component={Dashboard}/>
      <Route path="/campaigns/new" component={CreateCampaign}/>
      <Route path="/campaigns/whatsapp/:id" component={WhatsAppCampaignDetail}/>
      <Route path="/campaigns/:id" component={CampaignDetail}/>
      <Route path="/campaigns" component={Campaigns}/>
      <Route path="/calls/:id" component={CallDetail}/>
      <Route path="/calls" component={Calls}/>
      <Route path="/contacts/new" component={AddContact}/>
      <Route path="/contacts/groups/new" component={CreateContactGroup}/>
      <Route path="/contacts" component={AllContacts}/>
      <Route path="/analytics" component={Analytics}/>
      <Route path="/crm" component={CRMPage}/>
      <Route path="/tools/widgets" component={WidgetsPage}/>
      <Route path="/transaction-history">
        <Redirect to="/dashboard"/>
      </Route>
      <Route path="/upgrade">
        <Redirect to="/dashboard"/>
      </Route>
      <Route path="/knowledge-base" component={KnowledgeBase}/>
      <Route path="/agents/new" component={CreateAgent}/>
      <Route path="/agents/:id/edit" component={CreateAgent}/>
      <Route path="/agents" component={Agents}/>
      <Route path="/conversations" component={PluginConversationsPage}/>
      <Route path="/templates/agentlab/new" component={CreateAgentLabTemplate}/>
      <Route path="/templates/new" component={CreateWhatwayTemplate}/>
      <Route path="/templates" component={AllTemplates}/>
      <Route path="/prompt-templates">
        <Redirect to="/templates"/>
      </Route>
      <Route path="/whatsapp/templates/agentlab/new">
        <Redirect to="/templates/agentlab/new"/>
      </Route>
      <Route path="/whatsapp/templates/new">
        <Redirect to="/templates/new"/>
      </Route>
      <Route path="/whatsapp/templates">
        <Redirect to="/templates"/>
      </Route>
      <Route path="/app/templates/agentlab/new">
        <Redirect to="/templates/agentlab/new"/>
      </Route>
      <Route path="/app/templates/new">
        <Redirect to="/templates/new"/>
      </Route>
      <Route path="/incoming-connections" component={IncomingConnections}/>
      <Route path="/voices" component={Voices}/>
      <Route path="/phone-numbers" component={PhoneNumbers}/>
      <Route path="/google-callback" component={GoogleCallbackPage}/>
      <Route path="/tools" component={ToolsPage}/>
      <Route path="/flows/new" component={FlowBuilderPage}/>
      <Route path="/flows/execution">
        <Redirect to="/flows?tab=execution"/>
      </Route>
      <Route path="/flows/webhooks" component={WebhookConfigPage}/>
      <Route path="/flows/forms" component={FormsPage}/>
      <Route path="/flows/appointments" component={AppointmentsPage}/>
      <Route path="/flows/templates">
        <Redirect to="/flows?tab=templates"/>
      </Route>
      <Route path="/flows/:id" component={FlowBuilderPage}/>
      <Route path="/flows" component={FlowsPage}/>
      <Route path="/settings" component={ChannelSettingsPage}/>
      <Route path="/account" component={Settings}/>
      <Route path="/message" component={WhatsAppApp}/>
      <Route path="/message/*" component={WhatsAppApp}/>
      <Route path="/whatsapp" component={WhatsAppToMessageRedirect}/>
      <Route path="/whatsapp/*" component={WhatsAppToMessageRedirect}/>
      {includeAdmin ? <Route path="/admin" component={AdminDashboard}/> : null}
      <Route path="/app/*" component={LegacyAppRedirect}/>
      <Route path="/app" component={LegacyAppRedirect}/>
      <Route component={NotFound}/>
    </Switch>);
}
function SessionTimeoutWrapper({ children }) {
    const [, setLocation] = useLocation();
    const handleTimeout = useCallback(() => {
        // Logout request sends HttpOnly cookie automatically via credentials: 'include'
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        }).catch(() => { });
        AuthStorage.clearAuth();
        queryClient.clear();
        setLocation('/login');
    }, [setLocation]);
    const { isWarningVisible, remainingTime, dismissWarning } = useActivityTimeout({
        enabled: AuthStorage.isAuthenticated(),
        onTimeout: handleTimeout,
        warningThresholdMs: 5 * 60 * 1000,
    });
    return (<>
      {children}
      <SessionTimeoutDialog open={isWarningVisible} remainingTime={remainingTime} onContinue={dismissWarning} onLogout={handleTimeout}/>
    </>);
}
function PublicRouter() {
    return (
      <PublicLayout>
        <Switch>
          <Route path="/" component={LoginPage}/>
          <Route path="/login" component={LoginPage}/>
          <Route path="/register" component={LoginPage}/>
          <Route path="/home" component={LandingPage}/>
          <Route path="/team/login" component={TeamMemberLogin}/>
          <Route path="/admin/team/login" component={AdminTeamLogin}/>
          <Route path="/features" component={FeaturesPage}/>
          <Route path="/pricing" component={PricingPage}/>
          <Route path="/transaction-history">
            <Redirect to="/dashboard"/>
          </Route>
          <Route path="/upgrade">
            <Redirect to="/dashboard"/>
          </Route>
          <Route path="/use-cases" component={UseCasesPage}/>
          <Route path="/integrations" component={IntegrationsPage}/>
          <Route path="/contact" component={Contact}/>
          <Route path="/blog/:slug" component={BlogPost}/>
          <Route path="/blog" component={Blog}/>
          <Route path="/privacy" component={PrivacyPolicy}/>
          <Route path="/terms" component={TermsOfService}/>
          <Route path="/cookies" component={CookiePolicy}/>
          <Route component={LoginPage}/>
        </Switch>
      </PublicLayout>
    );
}
function AdminRouter() {
    return (
      <AppShell sidebar={<AppSidebar />} showDemoBanner contentClassName="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <Switch>
          <Route path="/">
            <Redirect to="/admin"/>
          </Route>
          <Route path="/admin" component={AdminDashboard}/>
          <Route path="/admin/dashboard" component={AdminDashboard}/>
          <Route path="/admin/campaigns/:id" component={AdminCampaignDetail}/>
          <Route component={NotFound}/>
        </Switch>
      </AppShell>
    );
}
function UserRouter() {
    return (
      <AppShell sidebar={<AppSidebar />}>
        <UserAppRoutes />
      </AppShell>
    );
}
function TeamMemberRouter() {
    return (
      <AppShell sidebar={<TeamMemberSidebar />}>
        <UserAppRoutes includeAdmin/>
      </AppShell>
    );
}
function AdminTeamMemberRouter() {
    return (
      <AppShell sidebar={<AdminTeamMemberSidebar />} contentClassName="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <Switch>
          <Route path="/">
            <Redirect to="/admin"/>
          </Route>
          <Route path="/admin" component={AdminDashboard}/>
          <Route path="/admin/dashboard" component={AdminDashboard}/>
          <Route path="/admin/campaigns/:id" component={AdminCampaignDetail}/>
          <Route component={NotFound}/>
        </Switch>
      </AppShell>
    );
}
function AdminGuard({ children }) {
    // Fetch user from server to validate admin access
    const { data: user, isLoading: userLoading, isError } = useQuery({
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
        return (<div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"/>
      </div>);
    }
    // If no user data at all (shouldn't happen after loading), redirect to login
    if (!user) {
        console.log("AdminGuard - No user data, redirecting to /login");
        return <Redirect to="/login"/>;
    }
    const hasAdminAccess = user.role === 'admin';
    // If user doesn't have admin access, redirect to user panel
    if (!hasAdminAccess) {
        console.log("AdminGuard - User is not authorized for admin panel, redirecting to /dashboard");
        return <Redirect to="/dashboard"/>;
    }
    console.log("AdminGuard - User has admin access, rendering admin panel");
    return <>{children}</>;
}
function AdminTeamGuard({ children }) {
    // Validate admin team member JWT token via server
    const { data: authData, isLoading, isError } = useQuery({
        queryKey: ["/api/admin/team/auth/me"],
        queryFn: async () => {
            const token = TeamAuth.getToken();
            if (!token)
                throw new Error("No token");
            const response = await fetch("/api/admin/team/auth/me", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                throw new Error("Invalid session");
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
        return (<div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"/>
      </div>);
    }
    // If no auth data, redirect to admin team login
    if (!authData || !authData.member) {
        console.log("AdminTeamGuard - No valid session, redirecting to /admin/team/login");
        TeamAuth.clearAuth();
        return <Redirect to="/admin/team/login"/>;
    }
    // Check member status
    if (authData.member.status !== 'active') {
        console.log("AdminTeamGuard - Member not active, redirecting to /admin/team/login");
        TeamAuth.clearAuth();
        return <Redirect to="/admin/team/login"/>;
    }
    console.log("AdminTeamGuard - Admin team member validated, rendering admin panel");
    return <>{children}</>;
}
function UserGuard({ children }) {
    const [isTeamMember, setIsTeamMember] = useState(() => TeamAuth.isAuthenticated());
    const [teamAuthValid, setTeamAuthValid] = useState(null);
    const [teamAuthLoading, setTeamAuthLoading] = useState(isTeamMember);
    // Fetch user from server (for regular users)
    const { data: user, isLoading, isError } = useQuery({
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
        return (<div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"/>
      </div>);
    }
    // Team member authentication check
    if (isTeamMember) {
        if (teamAuthValid === false) {
            return <Redirect to="/team/login"/>;
        }
        // Team member is valid, render children
        return <>{children}</>;
    }
    // Regular user authentication check
    if (!user) {
        return <Redirect to="/login"/>;
    }
    return <>{children}</>;
}
function Router() {
    const [location] = useLocation();
    // Initialize auth state synchronously from localStorage to prevent flash
    // Check both regular user auth AND team member auth
    const [isAuthenticated, setIsAuthenticated] = useState(() => AuthStorage.isAuthenticated() || TeamAuth.isAuthenticated());
    const [isTeamMember, setIsTeamMember] = useState(() => TeamAuth.isAuthenticated());
    const [isAdminTeamMember, setIsAdminTeamMember] = useState(() => TeamAuth.isAdminTeamMember());
    const [isChecking, setIsChecking] = useState(true);
    // Check installation status
    const { data: installStatus } = useQuery({
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
        return (<div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"/>
      </div>);
    }
    // Installation check - if not installed, redirect to installer unless already on /install
    if (installStatus && !installStatus.installed && location !== '/install') {
        console.log("Router - Not installed, redirecting to /install");
        return <Redirect to="/install"/>;
    }
    // Block installer if already installed
    if (location === '/install' && installStatus?.installed) {
        console.log("Router - Already installed, redirecting to /login");
        return <Redirect to="/login"/>;
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
            return <Redirect to="/admin"/>;
        }
        // User team members go to /app
        if (isTeamMember) {
            console.log("Router - Authenticated team member on auth page, redirecting to /dashboard");
            return <Redirect to="/dashboard"/>;
        }
        console.log("Router - Authenticated user on auth page, redirecting to /dashboard");
        return <Redirect to="/dashboard"/>;
    }
    // Redirect authenticated team members away from team login page
    if (isTeamMember && location === '/team/login') {
        const redirectTo = isAdminTeamMember ? '/admin' : '/dashboard';
        console.log("Router - Authenticated team member on team login page, redirecting to", redirectTo);
        return <Redirect to={redirectTo}/>;
    }
    // Redirect authenticated admin team members away from admin team login page
    if (isAdminTeamMember && location === '/admin/team/login') {
        console.log("Router - Authenticated admin team member on admin team login page, redirecting to /admin");
        return <Redirect to="/admin"/>;
    }
    // Admin dashboard is no longer the home page. Regular users land on /dashboard.
    if ((location === '/admin' || location === '/admin/dashboard') && !isAdminTeamMember) {
        return <Redirect to="/dashboard"/>;
    }
    // Admin routes - protected by server-side validation
    // Check this BEFORE public routes to prevent flash during login transition
    if (location.startsWith('/admin') && !location.startsWith('/admin/team/login')) {
        // Admin team members get the AdminTeamGuard + AdminTeamMemberRouter with permission-based sidebar
        if (isAdminTeamMember) {
            console.log("Router - Rendering AdminTeamGuard + AdminTeamMemberRouter (admin team member)");
            return (<AdminTeamGuard>
          <AdminTeamMemberRouter />
        </AdminTeamGuard>);
        }
        console.log("Router - Rendering AdminGuard + AdminRouter");
        return (<AdminGuard>
        <AdminRouter />
      </AdminGuard>);
    }
    // User routes (/app) - protected by server-side validation
    // Check this BEFORE public routes to prevent flash during login transition
    if (isUserAppPath(location)) {
        // Team members get the TeamMemberRouter with permission-based sidebar
        if (isTeamMember) {
            console.log("Router - Rendering UserGuard + TeamMemberRouter (team member)");
            return (<UserGuard>
          <TeamMemberRouter />
        </UserGuard>);
        }
        console.log("Router - Rendering UserGuard + UserRouter");
        return (<UserGuard>
        <UserRouter />
      </UserGuard>);
    }
    // Public routes (landing, login, register)
    console.log("Router - Rendering PublicRouter");
    return <PublicRouter />;
}
export default function App() {
    return (<QueryClientProvider client={queryClient}>
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
                  </TooltipProvider>
                </DynamicLanguagesProvider>
              </PluginBootstrapper>
            </PluginRegistryProvider>
          </BrandingProvider>
        </DirectionProvider>
      </ThemeProvider>
    </QueryClientProvider>);
}
