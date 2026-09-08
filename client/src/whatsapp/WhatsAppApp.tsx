import { Router, Switch, Route, Redirect } from "wouter";
import { AuthProvider } from "@wa/contexts/auth-context";
import { ChannelProvider } from "@wa/contexts/channel-context";
import { SocketProvider } from "@wa/contexts/socket-context";
import { SidebarProvider } from "@wa/contexts/sidebar-context";
import Inbox from "@wa/pages/inbox";
import Contacts from "@wa/pages/contacts/Contacts";
import Campaigns from "@wa/pages/campaigns";
import Automations from "@wa/pages/automations";
import Analytics from "@wa/pages/analytics";
import Dashboard from "@wa/pages/dashboard";
import Settings from "@wa/pages/settings";
import Team from "@wa/pages/team";
import GroupsUI from "@wa/pages/group-list";
import ChatbotBuilder from "@wa/pages/chatbot-builder";
import AddChatbotBuilder from "@wa/pages/add-chatbot-builder";
import WidgetBuilder from "@wa/pages/widget-builder";
import Websites from "@wa/pages/websites";
import WABAConnection from "@wa/pages/WABAConnection";
import Webhooks from "@wa/pages/Webhooks";
import BulkImport from "@wa/pages/BulkImport";
import StoresPage from "@wa/pages/ecommerce/StoresPage";
import AbandonedCarts from "@wa/pages/ecommerce/AbandonedCarts";
import CodOrdersPage from "@wa/pages/ecommerce/CodOrders";
import ApiDocs from "@wa/pages/api-docs";
import Logs from "@wa/pages/logs";
import ChatHub from "@wa/pages/ChatHub";
import Account from "@wa/pages/account";
import BotFlowBuilder from "@wa/pages/BotFlowBuilder";
import Workflows from "@wa/pages/Workflows";
import AutoResponses from "@wa/pages/AutoResponses";
import MultiNumber from "@wa/pages/MultiNumber";
import QRCodes from "@wa/pages/QRCodes";
import Segmentation from "@wa/pages/Segmentation";
import CampaignAnalytics from "@wa/pages/campaign-analytics";
import NotFound from "@wa/pages/not-found";

function WhatsAppRoutes() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/inbox" />}</Route>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/templates/agentlab/new">{() => <Redirect to="~/templates/agentlab/new" />}</Route>
      <Route path="/templates/new">{() => <Redirect to="~/templates/new" />}</Route>
      <Route path="/templates">{() => <Redirect to="~/templates" />}</Route>
      <Route path="/automation" component={Automations} />
      <Route path="/analytics/campaign/:campaignId" component={CampaignAnalytics} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/team" component={Team} />
      <Route path="/groups" component={GroupsUI} />
      <Route path="/chatbot-builder" component={ChatbotBuilder} />
      <Route path="/add/chatbot-builder" component={AddChatbotBuilder} />
      <Route path="/widget-builder" component={WidgetBuilder} />
      <Route path="/websites" component={Websites} />
      <Route path="/waba-connection" component={WABAConnection} />
      <Route path="/webhooks" component={Webhooks} />
      <Route path="/bulk-import" component={BulkImport} />
      <Route path="/ecommerce/stores" component={StoresPage} />
      <Route path="/ecommerce/abandoned-carts" component={AbandonedCarts} />
      <Route path="/ecommerce/cod-orders" component={CodOrdersPage} />
      <Route path="/api-docs" component={ApiDocs} />
      <Route path="/logs" component={Logs} />
      <Route path="/chat-hub" component={ChatHub} />
      <Route path="/account" component={Account} />
      <Route path="/settings" component={Settings} />
      <Route path="/bot-builder" component={BotFlowBuilder} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/auto-responses" component={AutoResponses} />
      <Route path="/multi-number" component={MultiNumber} />
      <Route path="/qr-codes" component={QRCodes} />
      <Route path="/segmentation" component={Segmentation} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function WhatsAppApp() {
  return (
    <AuthProvider>
      <ChannelProvider>
        <SocketProvider>
          <SidebarProvider>
            <Router base="/whatsapp">
              <WhatsAppRoutes />
            </Router>
          </SidebarProvider>
        </SocketProvider>
      </ChannelProvider>
    </AuthProvider>
  );
}
