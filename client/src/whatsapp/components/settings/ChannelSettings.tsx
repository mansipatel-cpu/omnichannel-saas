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

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@wa/components/ui/button";
import { Badge } from "@wa/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@wa/components/ui/dialog";
import {
  Smartphone,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  TestTube,
  RefreshCw,
  Info,
  Activity,
  MessageSquare,
  Shield,
  TrendingUp,
  Gauge,
  ShieldCheck,
  Award,
  Zap,
  Unplug,
  ArrowRight,
  AlertTriangle,
  Clock,
  Globe,
  Check,
  X,
  Layers,
  Building2,
  Type,
  Loader2,
  Webhook,
  Radio,
  Copy,
} from "lucide-react";
import { useToast } from "@wa/hooks/use-toast";
import { apiRequest, queryClient } from "@wa/lib/queryClient";
import type { Channel } from "@shared/whatsapp-schema";
import { Loading } from "@wa/components/ui/loading";
import { ChannelDialog } from "./ChannelDialog";
import { BusinessProfileEditor } from "./BusinessProfileEditor";
import { DisplayNameEditor } from "./DisplayNameEditor";
import { TestMessageDialog } from "./TestMessageDialog";
import { useAuth } from "@wa/contexts/auth-context";
import { useChannelContext } from "@wa/contexts/channel-context";
import { useTranslation } from "@wa/lib/i18n";
import { SiWhatsapp } from "react-icons/si";


declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

type ConnectionFlow = "choose" | "eligibility" | "success";

export function ChannelSettings() {
  const { t } = useTranslation();
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [resubscribingChannelId, setResubscribingChannelId] = useState<string | null>(null);
  const [resubscribingAll, setResubscribingAll] = useState(false);
  const [webhookSubStatus, setWebhookSubStatus] = useState<Record<string, "subscribed" | "not_subscribed" | "unknown" | "loading">>({});
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [showDisplayNameEditor, setShowDisplayNameEditor] = useState(false);
  const [displayNameChannelId, setDisplayNameChannelId] = useState<string | null>(null);
  const [displayNameChannelName, setDisplayNameChannelName] = useState<string>("");
  const [profileChannelId, setProfileChannelId] = useState<string | null>(null);
  const [profileChannelName, setProfileChannelName] = useState<string>("");
  const [profileVerifiedName, setProfileVerifiedName] = useState<string>("");
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [connectionFlow, setConnectionFlow] = useState<ConnectionFlow>("choose");
  const [isCoexistenceFlow, setIsCoexistenceFlow] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSuccessGuidance, setShowSuccessGuidance] = useState(false);
  const [lastConnectedCoexistence, setLastConnectedCoexistence] = useState(false);
  const [channelProcessing, setChannelProcessing] = useState<{ status: "processing" | "error"; errorMessage?: string } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedChannel, setSelectedChannel } = useChannelContext();

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["/api/whatsapp/channels"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/whatsapp/channels");
      const json = await response.json();
      if (Array.isArray(json)) return json;
      if (Array.isArray(json?.data)) return json.data;
      return [];
    },
  });

  const { data: config } = useQuery({
    queryKey: ["/api/whatsapp/embedded/config"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/embedded/config", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: platformSettings } = useQuery({
    queryKey: ["/api/whatsapp/platform-settings"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/platform-settings", { credentials: "include" });
      if (!res.ok) return { embeddedSignupEnabled: true };
      return res.json();
    },
  });

  const embeddedSignupEnabled = platformSettings?.embeddedSignupEnabled ?? true;

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return await apiRequest("DELETE", `/api/whatsapp/channels/${channelId}`);
    },
    onSuccess: (_data, channelId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels/active"] });
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(null);
      }
      setShowDeleteConfirm(null);
      toast({
        title: "Channel Deleted",
        description: "The channel has been permanently removed from the platform.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return await apiRequest("POST", `/api/whatsapp/channels/${channelId}/disconnect`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
      setShowDisconnectConfirm(null);
      toast({
        title: "Channel Disconnected",
        description: "The WhatsApp channel has been disconnected from Cloud API. You can reconnect it anytime.",
      });
    },
    onError: (error) => {
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
    setShowChannelDialog(true);
  };

  const handleDeleteChannel = (channelId: string) => {
    setShowDeleteConfirm(channelId);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteChannelMutation.mutate(showDeleteConfirm);
    }
  };

  const checkChannelHealth = async (channelId: string) => {
    try {
      toast({
        title: t("settings.channel_setting.checkingHealth"),
        description: t("settings.channel_setting.verifyingConnection"),
      });

      const response = await apiRequest(
        "POST",
        `/api/whatsapp/channels/${channelId}/health`
      );

      const data = await response.json();

      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });

      if (data.status === "healthy") {
        toast({
          title: t("settings.channel_setting.channelHealthy"),
          description: t("settings.channel_setting.channelHealthyDesc"),
        });
      } else if (data.status === "warning") {
        toast({
          title: t("settings.channel_setting.channelWarnings"),
          description:
            data.error || t("settings.channel_setting.channelWarningsDesc"),
          variant: "default",
        });
      } else if (data.status === "error") {
        toast({
          title: t("settings.channel_setting.channelIssues"),
          description:
            data.error || t("settings.channel_setting.channelIssuesDesc"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("settings.channel_setting.healthCheckFailed"),
        description: t("settings.channel_setting.healthCheckFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const fetchWebhookSubStatus = async (channelId: string) => {
    setWebhookSubStatus((prev) => ({ ...prev, [channelId]: "loading" }));
    try {
      const response = await fetch(`/api/whatsapp/channels/${channelId}/webhook-subscription`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) {
        // 502 or other transport errors → unknown (not a definitive non-subscription)
        setWebhookSubStatus((prev) => ({ ...prev, [channelId]: "unknown" }));
      } else {
        setWebhookSubStatus((prev) => ({
          ...prev,
          [channelId]: data.subscribed ? "subscribed" : "not_subscribed",
        }));
      }
    } catch {
      setWebhookSubStatus((prev) => ({ ...prev, [channelId]: "unknown" }));
    }
  };

  const resubscribeWebhook = async (channelId: string) => {
    setResubscribingChannelId(channelId);
    try {
      await apiRequest("POST", `/api/whatsapp/channels/${channelId}/webhook-resubscribe`);
      toast({
        title: "Webhook Re-subscribed",
        description: "This channel is now subscribed to receive delivery and read receipts from Meta.",
      });
      setWebhookSubStatus((prev) => ({ ...prev, [channelId]: "subscribed" }));
    } catch (err: any) {
      const serverMsg = err?.responseData?.message || err?.responseData?.error || err?.message;
      toast({
        title: "Re-subscribe Failed",
        description: serverMsg || "Could not subscribe to Meta webhooks. Check credentials.",
        variant: "destructive",
      });
      setWebhookSubStatus((prev) => ({ ...prev, [channelId]: "not_subscribed" }));
    } finally {
      setResubscribingChannelId(null);
    }
  };

  const resubscribeAllWebhooks = async () => {
    setResubscribingAll(true);
    try {
      const response = await apiRequest("POST", "/api/whatsapp/channels/webhook-resubscribe-all");
      const data = await response.json();
      toast({
        title: "Webhooks Re-subscribed",
        description: data.message || "All channels processed.",
      });
      // Refresh subscription status for all displayed channels
      if (data.results) {
        const updated: Record<string, "subscribed" | "not_subscribed"> = {};
        for (const r of data.results) {
          updated[r.channelId] = r.success ? "subscribed" : "not_subscribed";
        }
        setWebhookSubStatus((prev) => ({ ...prev, ...updated }));
      }
    } catch {
      toast({
        title: "Re-subscribe Failed",
        description: "An error occurred. Try again.",
        variant: "destructive",
      });
    } finally {
      setResubscribingAll(false);
    }
  };

  const getHealthStatusBadge = (status?: string, lastChecked?: string) => {
    const label =
      status === "healthy"
        ? "Healthy"
        : status === "warning"
        ? "Warning"
        : status === "error"
        ? "Error"
        : status
        ? status
        : "Unknown";

    const className =
      status === "healthy"
        ? "bg-slate-100 text-slate-600 border-slate-200"
        : status === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : status === "error"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-slate-100 text-slate-500 border-slate-200";

    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${className}`}>
        {label}
      </span>
    );
  };

  // Fetch webhook subscription status for all channels when channels load
  useEffect(() => {
    if (!channels || channels.length === 0) return;
    for (const ch of channels) {
      if (!webhookSubStatus[ch.id]) {
        fetchWebhookSubStatus(ch.id);
      }
    }
  }, [channels]);

  useEffect(() => {
    if (!config?.appId) return;

    const existingScript = document.getElementById("facebook-jssdk");
    if (existingScript) {
      existingScript.remove();
      delete (window as any).FB;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: config.appId,
        cookie: true,
        xfbml: false,
        version: "v25.0",
      });
      console.log("FB SDK Initialized with App ID:", config.appId);
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, [config?.appId]);

  const openConnectionChooser = () => {
    setEditingChannel(null);
    setShowChannelDialog(true);
  };

  const openEmbeddedSignupChooser = () => {
    if (embeddedSignupEnabled) {
      setConnectionFlow("choose");
      setShowConnectionDialog(true);
    } else {
      openConnectionChooser();
    }
  };

  const startConnection = (coexistence: boolean) => {
    setIsCoexistenceFlow(coexistence);
    if (coexistence) {
      setConnectionFlow("eligibility");
    } else {
      launchFBLogin(false);
    }
  };

  const proceedAfterEligibility = () => {
    setShowConnectionDialog(false);
    setConnectionFlow("choose");
    launchFBLogin(true);
  };

  const launchFBLogin = (coexistence: boolean) => {
    if (!window.FB) {
      toast({
        title: "Facebook SDK not ready",
        description: "Please refresh the page and try again",
        variant: "destructive",
      });
      return;
    }

    if (!config?.configId) {
      toast({
        title: "Embedded config missing",
        description: "Save config first",
        variant: "destructive",
      });
      return;
    }

    const extras: any = coexistence
      ? { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }
      : { setup: {}, sessionInfoVersion: "3" };

    window.FB.login(
      (response: any) => {
        handleFBResponse(response, coexistence);
      },
      {
        config_id: config.configId,
        response_type: "code",
        override_default_response_type: true,
        extras,
      }
    );
  };

  const handleFBResponse = async (response: any, coexistence: boolean) => {
    if (!response.authResponse?.code) {
      toast({ title: "Signup cancelled" });
      return;
    }

    setShowConnectionDialog(false);
    setChannelProcessing({ status: "processing" });

    try {
      const signupRes = await apiRequest("POST", "/api/whatsapp/embedded-signup", {
        code: response.authResponse.code,
        coexistence,
      });

      const signupData = await signupRes.json();

      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/whatsapp/");
        },
      });

      if (signupData?.id) {
        const activateRes = await apiRequest("PUT", `/api/whatsapp/channels/${signupData.id}`, { isActive: true });
        const activatedChannel = await activateRes.json();
        setSelectedChannel(activatedChannel || signupData);
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith("/api/whatsapp/");
          },
        });
      }

      setChannelProcessing(null);
      setLastConnectedCoexistence(coexistence);
      setShowSuccessGuidance(true);
    } catch (err: any) {
      const errorMsg = err.message || "Something went wrong. Please try again.";
      setChannelProcessing({ status: "error", errorMessage: errorMsg });
    }
  };

  const disconnectChannel = (channelId: string) => {
    setShowDisconnectConfirm(channelId);
  };

  const confirmDisconnect = () => {
    if (showDisconnectConfirm) {
      disconnectMutation.mutate(showDisconnectConfirm);
    }
  };

  const channelPendingDelete = (channels as Channel[]).find((c) => c.id === showDeleteConfirm);
  const deleteChannelDisplayName =
    (channelPendingDelete as any)?.healthDetails?.verified_name ||
    channelPendingDelete?.name ||
    "this channel";
  const deleteChannelPhone = channelPendingDelete?.phoneNumber || "";
  const deleteChannelLabel = deleteChannelPhone
    ? `${deleteChannelDisplayName} (${deleteChannelPhone})`
    : deleteChannelDisplayName;

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Smartphone className="h-6 w-6 text-slate-800 shrink-0" />
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                WhatsApp{" "}
                <span className="inline-flex align-middle rounded-md bg-[#007BFF] px-2.5 py-0.5 text-sm font-semibold text-white">
                  Channels
                </span>
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-500 max-w-2xl">
              Configure your WhatsApp Business API channels for Cloud API and MM Lite.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {channels.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={resubscribeAllWebhooks}
                disabled={resubscribingAll || user?.username === "demouser"}
                title="Re-subscribe all channels to receive delivery and read receipts from Meta"
                className="h-10 bg-white border-slate-200 text-slate-700 shadow-none"
              >
                {resubscribingAll ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Webhook className="w-4 h-4 mr-2" />
                )}
                Re-subscribe Webhooks
              </Button>
            )}
            <Button
              onClick={openConnectionChooser}
              size="sm"
              className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent shadow-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              {channels.length > 0 ? "Add New Channel" : "Connect WhatsApp"}
            </Button>
          </div>
        </div>

        {channelsLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10">
            <Loading />
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white text-center py-16 px-6">
            <Smartphone className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 mb-4">
              {t("settings.channel_setting.noChannels")}
            </p>
            <Button
              onClick={openConnectionChooser}
              className="bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("settings.channel_setting.addFirstChannel")}
            </Button>
          </div>
        ) : (
            <div className="space-y-4">
              {(channels.length > 0 ? channels : []).map((channel: any) => (
              <div
                key={channel.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-5 p-5 sm:p-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-5">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {user?.username === "demouser" ? (
                          <span>
                            {channel.name.slice(0, -1).replace(/./g, "*") +
                              channel.name.slice(-1)}
                          </span>
                        ) : (
                          <>
                            {(channel as any).healthDetails?.verified_name ? (
                              <span>
                                {(channel as any).healthDetails.verified_name}
                                <span className="text-sm font-normal text-slate-500 ml-1.5">
                                  ({channel.phoneNumber || channel.name})
                                </span>
                              </span>
                            ) : (
                              channel.name
                            )}
                          </>
                        )}
                      </h3>
                      {channel.isActive && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      )}
                      {!channel.isActive && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                          Disconnected
                        </span>
                      )}
                      {channel.isCoexistence && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                          <Layers className="w-3 h-3" />
                          Coexistence
                        </span>
                      )}
                      {channel.mmLiteEnabled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                          <MessageSquare className="w-3 h-3" />
                          {t("settings.channel_setting.mmLite")}
                        </span>
                      )}
                    </div>

                    {channel.isCoexistence && channel.isActive && (
                      <div className="mb-4 p-2.5 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-blue-700 space-y-0.5">
                            <p className="font-medium">Coexistence Mode Active</p>
                            <p>This number is shared with WhatsApp Business App. Keep the app open at least every 14 days to maintain the connection.</p>
                            <p className="text-blue-600">View-once media and Windows/WearOS companion devices are not available.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5 text-sm mb-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-semibold text-slate-800 w-[140px] shrink-0">Channel ID</span>
                        <span className="font-mono text-[13px] text-slate-600 break-all">
                          {user?.username === "demouser"
                            ? channel.id?.slice(0, 8) + "****"
                            : channel.id}
                        </span>
                        {user?.username !== "demouser" && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(channel.id);
                              toast({ title: "Copied", description: "Channel ID copied to clipboard" });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-semibold text-slate-800 w-[140px] shrink-0">Meta App ID</span>
                        <span className="font-mono text-[13px] text-slate-600 break-all">
                          {user?.username === "demouser"
                            ? channel.appId?.slice(0, -4).replace(/./g, "*") + channel.appId?.slice(-4)
                            : channel.appId || "Not set"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-semibold text-slate-800 w-[140px] shrink-0">Phone</span>
                        <span className="font-mono text-[13px] text-slate-600">
                          {user?.username === "demouser"
                            ? channel.phoneNumber?.slice(0, -4).replace(/\d/g, "*") + channel.phoneNumber?.slice(-4)
                            : channel.phoneNumber || t("settings.channel_setting.notSet")}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-semibold text-slate-800 w-[140px] shrink-0">Phone Number ID</span>
                        <span className="font-mono text-[13px] text-slate-600 break-all">
                          {user?.username === "demouser"
                            ? channel.phoneNumberId?.slice(0, -4).replace(/\d/g, "*") + channel.phoneNumberId?.slice(-4)
                            : channel.phoneNumberId}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-semibold text-slate-800 w-[140px] shrink-0">Business Account ID</span>
                        <span className="font-mono text-[13px] text-slate-600 break-all">
                          {user?.username === "demouser"
                            ? channel.whatsappBusinessAccountId?.slice(0, -4).replace(/\d/g, "*") +
                              channel.whatsappBusinessAccountId?.slice(-4)
                            : channel.whatsappBusinessAccountId || t("settings.channel_setting.notSet")}
                        </span>
                      </div>
                    </div>

                    </div>
                    {/* Action Buttons */}
                    <div className="flex sm:flex-col gap-2 w-full sm:w-[150px] shrink-0">
                      {channel.isActive ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={user?.username === "demouser"}
                            onClick={() => {
                              setTestingChannelId(channel.id);
                              setShowTestDialog(true);
                            }}
                            className="w-full justify-start h-9 bg-white border-slate-200 text-slate-700 shadow-none"
                          >
                            <TestTube className="w-4 h-4 mr-2" />
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditChannel(channel)}
                            disabled={user?.username === "demouser"}
                            className="w-full justify-start h-9 bg-white border-slate-200 text-slate-700 shadow-none"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setProfileChannelId(channel.id);
                              setProfileChannelName(channel.name || channel.phoneNumber || "");
                              setProfileVerifiedName((channel as any).healthDetails?.verified_name || "");
                              setShowBusinessProfile(true);
                            }}
                            disabled={user?.username === "demouser"}
                            className="w-full justify-start h-9 text-emerald-600 border-emerald-300 hover:bg-emerald-50 bg-white shadow-none"
                            title="Edit WhatsApp Business Profile"
                          >
                            <Building2 className="w-4 h-4 mr-2" />
                            Profile
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDisplayNameChannelId(channel.id);
                              setDisplayNameChannelName(channel.name || channel.phoneNumber || "");
                              setShowDisplayNameEditor(true);
                            }}
                            disabled={user?.username === "demouser"}
                            className="w-full justify-start h-9 text-[#007BFF] border-blue-300 hover:bg-blue-50 bg-white shadow-none"
                            title="Manage WhatsApp Display Name"
                          >
                            <Type className="w-4 h-4 mr-2" />
                            Display Name
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectChannel(channel.id)}
                            disabled={user?.username === "demouser" || disconnectMutation.isPending}
                            className="w-full justify-start h-9 text-red-600 border-red-300 hover:bg-red-50 bg-white shadow-none"
                            title="Disconnect this channel from Cloud API"
                          >
                            <Unplug className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteChannel(channel.id)}
                            disabled={user?.username === "demouser" || deleteChannelMutation.isPending}
                            className="w-full justify-start h-9 text-red-600 border-red-300 hover:bg-red-50 bg-white shadow-none"
                            title="Permanently delete this channel"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </>
                      ) : (
                        <>
                          {embeddedSignupEnabled && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setConnectionFlow("choose");
                                setShowConnectionDialog(true);
                              }}
                              disabled={user?.username === "demouser"}
                              className="flex-1 sm:flex-none text-xs sm:text-sm text-orange-600 border-orange-200 hover:bg-orange-50"
                              title="Reconnect this channel via Meta Embedded Signup"
                            >
                              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Reconnect</span>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteChannel(channel.id)}
                            disabled={user?.username === "demouser" || deleteChannelMutation.isPending}
                            className="flex-1 sm:flex-none text-xs sm:text-sm text-red-600 border-red-200 hover:bg-red-50"
                            title="Permanently delete this channel"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Channel Health Section */}
                  <div className="px-5 sm:px-6 pb-2 pt-0">
                  <div className="mt-0 pt-4 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-5 h-5 text-slate-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-800">
                          {t("settings.channel_setting.channelHealth")}
                        </span>
                      </div>
                      {getHealthStatusBadge(
                        channel.healthStatus,
                        channel.lastHealthCheck
                      )}
                    </div>

                    {channel?.healthDetails &&
                      Object.keys(channel?.healthDetails).length > 0 && (
                        <div className="mt-3">
                          {channel?.healthDetails.error ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-md space-y-1 text-xs sm:text-sm">
                              <p className="text-red-700 font-medium break-words">
                                {t(
                                  "settings.channel_setting.healthDetails.errorLabel"
                                )}{" "}
                                {channel.healthDetails.error}
                              </p>
                              {channel.healthDetails.error_code && (
                                <p className="text-red-600">
                                  {t(
                                    "settings.channel_setting.healthDetails.errorCode"
                                  )}{" "}
                                  {channel.healthDetails.error_code}
                                </p>
                              )}
                              {channel.healthDetails.error_type && (
                                <p className="text-red-600">
                                  {t(
                                    "settings.channel_setting.healthDetails.errorType"
                                  )}{" "}
                                  {channel.healthDetails.error_type}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {channel.healthDetails.status && (
                                <div
                                  className={`p-2.5 sm:p-3 rounded-lg border ${
                                    channel.healthDetails.status === "LIVE"
                                      ? "bg-green-50 border-green-200"
                                      : "bg-yellow-50 border-yellow-200"
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Activity
                                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                                        channel.healthDetails.status ===
                                        "LIVE"
                                          ? "text-green-600"
                                          : "text-yellow-600"
                                      }`}
                                    />
                                    <span className="text-[10px] sm:text-xs font-medium text-gray-600">
                                      {t(
                                        "settings.channel_setting.healthDetails.accountMode"
                                      )}
                                    </span>
                                  </div>
                                  <p
                                    className={`font-semibold text-sm sm:text-base ${
                                      channel.healthDetails.status ===
                                      "LIVE"
                                        ? "text-green-700"
                                        : "text-yellow-700"
                                    }`}
                                  >
                                    {channel.healthDetails.status}
                                  </p>
                                </div>
                              )}

                              {channel.healthDetails.quality_rating && (
                                <div
                                  className={`p-2.5 sm:p-3 rounded-lg border ${
                                    channel.healthDetails.quality_rating ===
                                    "GREEN"
                                      ? "bg-emerald-50 border-emerald-200"
                                      : channel.healthDetails
                                          .quality_rating === "YELLOW"
                                      ? "bg-amber-50 border-amber-200"
                                      : "bg-red-50 border-red-200"
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 mb-1">
                                    <TrendingUp
                                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                                        channel.healthDetails
                                          .quality_rating === "GREEN"
                                          ? "text-emerald-600"
                                          : channel.healthDetails
                                              .quality_rating === "YELLOW"
                                          ? "text-amber-600"
                                          : "text-red-600"
                                      }`}
                                    />
                                    <span className="text-[10px] sm:text-xs font-medium text-gray-600">
                                      {t(
                                        "settings.channel_setting.healthDetails.qualityRating"
                                      )}
                                    </span>
                                  </div>
                                  <p
                                    className={`font-semibold text-sm sm:text-base ${
                                      channel.healthDetails
                                        .quality_rating === "GREEN"
                                        ? "text-emerald-700"
                                        : channel.healthDetails
                                            .quality_rating === "YELLOW"
                                        ? "text-amber-700"
                                        : "text-red-700"
                                    }`}
                                  >
                                    {channel.healthDetails.quality_rating}
                                  </p>
                                </div>
                              )}

                              {channel.healthDetails.messaging_limit && (
                                <div className="p-2.5 sm:p-3 rounded-lg border bg-blue-50 border-blue-200">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-blue-600" />
                                    <span className="text-[10px] sm:text-xs font-medium text-gray-600">
                                      {t(
                                        "settings.channel_setting.healthDetails.messagingLimit"
                                      )}
                                    </span>
                                  </div>
                                  <p className="font-semibold text-sm sm:text-base text-blue-700">
                                    {channel.healthDetails.messaging_limit === "TIER_250"
                                      ? "250 / day"
                                      : channel.healthDetails.messaging_limit === "TIER_1K"
                                      ? "1,000 / day"
                                      : channel.healthDetails.messaging_limit === "TIER_10K"
                                      ? "10,000 / day"
                                      : channel.healthDetails.messaging_limit === "TIER_100K"
                                      ? "100,000 / day"
                                      : channel.healthDetails.messaging_limit === "UNLIMITED" ||
                                        channel.healthDetails.messaging_limit === "TIER_UNLIMITED"
                                      ? "Unlimited"
                                      : channel.healthDetails.messaging_limit === "UNKNOWN"
                                      ? "Unconfirmed"
                                      : channel.healthDetails.messaging_limit}
                                  </p>
                                  {channel.lastHealthCheck && (
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      Last checked{" "}
                                      {formatDistanceToNow(new Date(channel.lastHealthCheck), { addSuffix: true })}
                                    </p>
                                  )}
                                </div>
                              )}

                              {channel.healthDetails.throughput_level && (
                                <div className="p-2.5 sm:p-3 rounded-lg border bg-blue-50 border-blue-200">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-blue-600" />
                                    <span className="text-[10px] sm:text-xs font-medium text-gray-600">
                                      {t(
                                        "settings.channel_setting.healthDetails.throughput"
                                      )}
                                    </span>
                                  </div>
                                  <p className="font-semibold text-sm sm:text-base text-blue-700 capitalize">
                                    {channel.healthDetails.throughput_level}
                                  </p>
                                </div>
                              )}

                              {channel.healthDetails
                                .verification_status && (
                                <div
                                  className={`p-2.5 sm:p-3 rounded-lg border ${
                                    channel.healthDetails
                                      .verification_status === "VERIFIED"
                                      ? "bg-teal-50 border-teal-200"
                                      : "bg-gray-50 border-gray-200"
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 mb-1">
                                    <ShieldCheck
                                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                                        channel.healthDetails
                                          .verification_status ===
                                        "VERIFIED"
                                          ? "text-teal-600"
                                          : "text-gray-600"
                                      }`}
                                    />
                                    <span className="text-[10px] sm:text-xs font-medium text-gray-600">
                                      {t(
                                        "settings.channel_setting.healthDetails.verification"
                                      )}
                                    </span>
                                  </div>
                                  <p
                                    className={`font-semibold text-sm sm:text-base ${
                                      channel.healthDetails
                                        .verification_status === "VERIFIED"
                                        ? "text-teal-700"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {channel.healthDetails.verification_status.replace(
                                      /_/g,
                                      " "
                                    )}
                                  </p>
                                </div>
                              )}

                              {channel.healthDetails.name_status && (
                                <div
                                  className={`p-2.5 sm:p-3 rounded-lg border ${
                                    channel.healthDetails.name_status ===
                                    "APPROVED"
                                      ? "bg-blue-50 border-blue-200"
                                      : "bg-orange-50 border-orange-200"
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Award
                                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                                        channel.healthDetails
                                          .name_status === "APPROVED"
                                          ? "text-blue-600"
                                          : "text-orange-600"
                                      }`}
                                    />
                                    <span className="text-[10px] sm:text-xs font-medium text-gray-600">
                                      {t(
                                        "settings.channel_setting.healthDetails.nameStatus"
                                      )}
                                    </span>
                                  </div>
                                  <p
                                    className={`font-semibold text-sm sm:text-base ${
                                      channel.healthDetails.name_status ===
                                      "APPROVED"
                                        ? "text-blue-700"
                                        : "text-orange-700"
                                    }`}
                                  >
                                    {channel.healthDetails.name_status}
                                  </p>
                                </div>
                              )}

                              {channel.healthDetails.health_status?.can_send_message && (
                                <div
                                  className={`p-2.5 sm:p-3 rounded-lg border sm:col-span-2 lg:col-span-3 ${
                                    channel.healthDetails.health_status.can_send_message === "AVAILABLE"
                                      ? "bg-green-50 border-green-200"
                                      : channel.healthDetails.health_status.can_send_message === "LIMITED"
                                      ? "bg-amber-50 border-amber-200"
                                      : "bg-red-50 border-red-200"
                                  }`}
                                >
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Zap
                                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                                        channel.healthDetails.health_status.can_send_message === "AVAILABLE"
                                          ? "text-green-600"
                                          : channel.healthDetails.health_status.can_send_message === "LIMITED"
                                          ? "text-amber-600"
                                          : "text-red-600"
                                      }`}
                                    />
                                    <span className="text-[10px] sm:text-xs font-medium text-gray-600">
                                      Messaging Availability
                                    </span>
                                  </div>
                                  <p
                                    className={`font-semibold text-sm sm:text-base ${
                                      channel.healthDetails.health_status.can_send_message === "AVAILABLE"
                                        ? "text-green-700"
                                        : channel.healthDetails.health_status.can_send_message === "LIMITED"
                                        ? "text-amber-700"
                                        : "text-red-700"
                                    }`}
                                  >
                                    {channel.healthDetails.health_status.can_send_message}
                                  </p>
                                  {Array.isArray(channel.healthDetails.health_status.entities) &&
                                    channel.healthDetails.health_status.entities.length > 0 && (
                                    <p className="text-[10px] text-gray-500 mt-1">
                                      {channel.healthDetails.health_status.entities
                                        .map((e: any) => e.entity_type || e.type || '')
                                        .filter(Boolean)
                                        .join(', ')}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              {channel.lastHealthCheck ? (
                                <>
                                  {t("settings.channel_setting.lastChecked")}{" "}
                                  {formatDistanceToNow(new Date(channel.lastHealthCheck), { addSuffix: true })}
                                </>
                              ) : (
                                "No health check run yet"
                              )}
                            </p>
                            <Button
                              onClick={() =>
                                checkChannelHealth(channel.id)
                              }
                              variant="ghost"
                              size="sm"
                              className="text-xs w-full sm:w-auto"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              {t("settings.channel_setting.refresh")}
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>
                  </div>

                  {/* Webhook Subscription Section */}
                  <div className="px-5 sm:px-6 pb-5">
                  <div className="mt-0 pt-4 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Radio className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-800 text-sm">Delivery Webhooks</span>
                        {webhookSubStatus[channel.id] === "loading" && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                          </Badge>
                        )}
                        {webhookSubStatus[channel.id] === "subscribed" && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="w-3 h-3" /> Subscribed
                          </Badge>
                        )}
                        {webhookSubStatus[channel.id] === "not_subscribed" && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-red-50 text-red-700 border-red-200">
                            <XCircle className="w-3 h-3" /> Not Subscribed
                          </Badge>
                        )}
                        {(webhookSubStatus[channel.id] === "unknown" || !webhookSubStatus[channel.id]) && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-gray-50 text-gray-600 border-gray-200">
                            <AlertTriangle className="w-3 h-3" /> Unknown
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchWebhookSubStatus(channel.id)}
                          disabled={webhookSubStatus[channel.id] === "loading"}
                          className="text-xs px-2"
                          title="Refresh subscription status"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resubscribeWebhook(channel.id)}
                          disabled={
                            resubscribingChannelId === channel.id ||
                            user?.username === "demouser"
                          }
                          className="text-xs text-green-700 border-green-200 hover:bg-green-50 whitespace-nowrap"
                        >
                          {resubscribingChannelId === channel.id ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Webhook className="w-3 h-3 mr-1" />
                          )}
                          Re-subscribe
                        </Button>
                      </div>
                    </div>
                    {webhookSubStatus[channel.id] === "not_subscribed" && (
                      <p className="text-xs text-red-600 mt-2 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        This channel is not subscribed to Meta webhooks. Campaign delivery and read rates will show 0%. Click Re-subscribe to fix this.
                      </p>
                    )}
                    {(webhookSubStatus[channel.id] === "unknown" || !webhookSubStatus[channel.id]) && (
                      <p className="text-xs text-gray-500 mt-2">
                        Click Re-subscribe if campaign delivery and read rates are showing 0%. This registers your channel with Meta to receive delivery receipts.
                      </p>
                    )}
                  </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Connection Type Chooser Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent className="sm:max-w-xl">
          {connectionFlow === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Connect WhatsApp Channel
                </DialogTitle>
                <DialogDescription>
                  Choose how you want to connect your WhatsApp number to this platform.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                {/* Coexistence Option */}
                <button
                  onClick={() => startConnection(true)}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <Layers className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">Connect Existing WhatsApp Business App</h3>
                        <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">Coexistence</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Keep using your WhatsApp Business App on your phone while also using this platform for automation, campaigns, and bulk messaging.
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Keep mobile app access</span>
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Sync chat history</span>
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Same phone number</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors mt-1" />
                  </div>
                </button>

                {/* Standard Option */}
                <button
                  onClick={() => startConnection(false)}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50/50 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                      <Smartphone className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">Register New Number</h3>
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">Standard</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Register a new or existing phone number exclusively for Cloud API use. The number will only work through this platform.
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Full API features</span>
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> No app required</span>
                        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Dedicated number</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors mt-1" />
                  </div>
                </button>
              </div>
            </>
          )}

          {connectionFlow === "eligibility" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Before You Connect
                </DialogTitle>
                <DialogDescription>
                  Please ensure you meet these requirements for WhatsApp Business App coexistence.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Smartphone className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">WhatsApp Business App v2.24.17+</p>
                      <p className="text-xs text-gray-500">Update your app to the latest version from your app store.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Active for at least 7 days</p>
                      <p className="text-xs text-gray-500">Your WhatsApp Business App should have been actively used for at least 7 days (ideally 1-2 months).</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Globe className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Supported country</p>
                      <p className="text-xs text-gray-500">Nigeria and South Africa are currently not supported for coexistence.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Shield className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Meta Business Account</p>
                      <p className="text-xs text-gray-500">You need a valid Meta Business Account to complete the connection.</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-700 space-y-1">
                      <p className="font-medium">What happens during connection:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>A QR code will appear — scan it with your WhatsApp Business App</li>
                        <li>Your chat history (up to 180 days) will sync to the platform</li>
                        <li>Linked companion devices will be temporarily unlinked</li>
                        <li>You can continue using both the app and this platform simultaneously</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setConnectionFlow("choose")}>
                  Back
                </Button>
                <Button onClick={proceedAfterEligibility} className="bg-blue-600 hover:bg-blue-700">
                  I Meet the Requirements — Continue
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Post-Onboarding Success Guidance Dialog */}
      <Dialog open={showSuccessGuidance} onOpenChange={setShowSuccessGuidance}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              WhatsApp Connected!
            </DialogTitle>
            <DialogDescription>
              {lastConnectedCoexistence
                ? "Your WhatsApp Business App number is now connected in coexistence mode."
                : "Your WhatsApp number is now connected and ready to use."}
            </DialogDescription>
          </DialogHeader>

          {lastConnectedCoexistence ? (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-gray-700 font-medium">Important things to know:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2.5 p-2.5 bg-blue-50 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="font-medium">Open your app regularly</p>
                    <p>Open WhatsApp Business App at least once every 14 days to keep the connection active.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 bg-blue-50 rounded-lg">
                  <RefreshCw className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="font-medium">Chat history syncing</p>
                    <p>Your existing chats (up to 180 days) will sync within 24 hours. Media files are not included in the sync.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 bg-blue-50 rounded-lg">
                  <Smartphone className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="font-medium">Re-link companion devices</p>
                    <p>Companion devices were unlinked during setup. Re-link them now (note: Windows and WearOS are not supported).</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 bg-amber-50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Limitations</p>
                    <p>View-once media is disabled. Do not uninstall the WhatsApp Business App — this will break the connection.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-gray-700">Your channel is ready! You can now:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Send and receive messages through the platform</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Create and send template messages</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Set up automation workflows</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Launch bulk messaging campaigns</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowSuccessGuidance(false)} className="w-full">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={!!showDisconnectConfirm} onOpenChange={() => setShowDisconnectConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Unplug className="w-5 h-5" />
              Disconnect Channel
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect this WhatsApp channel?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-700 space-y-1">
                  <p className="font-medium">This will:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Deregister the phone number from Cloud API</li>
                    <li>Stop all incoming and outgoing messages through this platform</li>
                    <li>Mark the channel as inactive</li>
                  </ul>
                  <p className="mt-1">You can reconnect the channel later if needed.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDisconnectConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDisconnect}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 rounded-xl border-slate-200 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 space-y-1.5 text-left">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <Trash2 className="h-[18px] w-[18px]" />
              </span>
              Delete Channel
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 pl-12">
              Are you sure you want to permanently delete this WhatsApp channel?
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-5 space-y-4">
            <div className="flex items-center gap-2.5 rounded-full bg-slate-100 px-4 py-2.5">
              <SiWhatsapp className="h-4 w-4 text-[#25D366] shrink-0" />
              <p className="text-sm text-slate-700">
                Channel: <span className="font-semibold text-slate-900">{deleteChannelLabel}</span>
              </p>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2 mb-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm font-semibold text-red-700">
                  Warning: This action cannot be undone.
                </p>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-red-600">
                <li>Permanently removes this channel configuration and Meta API credentials.</li>
                <li>Disconnects {deleteChannelLabel} from AutoComm platform.</li>
                <li>
                  All active automation dispatches and webhook listeners for this number will be
                  terminated immediately.
                </li>
                <li>
                  Historical message logs will be locked and archived according to enterprise
                  compliance retention policy.
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              className="h-10 border-slate-200 text-slate-700 hover:bg-slate-50 shadow-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              disabled={deleteChannelMutation.isPending}
              className="h-10 bg-red-600 hover:bg-red-700 text-white shadow-none"
            >
              {deleteChannelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Channel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Processing Dialog */}
      <Dialog open={!!channelProcessing} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          {channelProcessing?.status === "processing" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Connecting Your WhatsApp Channel</h3>
                <p className="text-sm text-muted-foreground">
                  We're setting up your WhatsApp Business Account. This may take a few moments.
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Please don't close or leave this page.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-700">This usually takes 10-30 seconds</span>
              </div>
            </div>
          )}
          {channelProcessing?.status === "error" && (
            <div className="flex flex-col items-center justify-center py-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Connection Failed</h3>
                <p className="text-sm text-muted-foreground">
                  {channelProcessing.errorMessage}
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={() => setChannelProcessing(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setChannelProcessing(null);
                  openEmbeddedSignupChooser();
                }}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Channel Dialog */}
      <ChannelDialog
        open={showChannelDialog}
        onOpenChange={setShowChannelDialog}
        editingChannel={editingChannel}
        onSuccess={(created) => {
          setShowChannelDialog(false);
          setEditingChannel(null);
          if (created?.id) {
            setSelectedChannel(created as any);
          }
        }}
      />

      {/* Test Message Dialog */}
      <TestMessageDialog
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
        channelId={testingChannelId}
      />

      {/* Business Profile Editor */}
      <BusinessProfileEditor
        open={showBusinessProfile}
        onOpenChange={setShowBusinessProfile}
        channelId={profileChannelId}
        channelName={profileChannelName}
        verifiedName={profileVerifiedName}
        onOpenDisplayName={() => {
          setDisplayNameChannelId(profileChannelId);
          setDisplayNameChannelName(profileChannelName);
          setShowDisplayNameEditor(true);
        }}
      />

      {/* Display Name Editor */}
      <DisplayNameEditor
        open={showDisplayNameEditor}
        onOpenChange={setShowDisplayNameEditor}
        channelId={displayNameChannelId}
        channelName={displayNameChannelName}
      />
    </>
  );
}
