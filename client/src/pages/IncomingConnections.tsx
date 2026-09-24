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
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus, Phone, Trash2, Link as LinkIcon, ArrowRight, Mic } from "lucide-react";
import { SiOpenai, SiTwilio } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { useAppHeaderOptional } from "@/components/AppPageHeader";

// ElevenLabs icon SVG component
function ElevenLabsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 4h2v16H8V4zm6 0h2v16h-2V4z"/>
    </svg>
  );
}

type IncomingConnection = {
  id: string;
  agentId: string;
  phoneNumberId: string;
  createdAt: string;
  agent: {
    id: string;
    name: string;
    elevenLabsVoiceId: string | null;
    language: string | null;
    telephonyProvider?: string | null;
  };
  phoneNumber: {
    id: string;
    phoneNumber: string;
    friendlyName: string | null;
  };
};

type Agent = {
  id: string;
  name: string;
  type: 'incoming' | 'flow';
  telephonyProvider?: string | null;
};

type PhoneNumber = {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  isConflicted?: boolean;
  conflictReason?: string | null;
  conflictCampaignName?: string | null;
  conflictCampaignStatus?: string | null;
};

type Stats = {
  totalConnections: number;
  availableNumbers: number;
  totalAgents: number;
};

type IncomingConnectionsResponse = {
  connections: IncomingConnection[];
  availablePhoneNumbers: PhoneNumber[];
  incomingAgents: Agent[];
  stats: Stats;
};

// Plivo types
type PlivoAgent = {
  id: string;
  name: string;
  type: string;
  telephonyProvider: string;
};

type PlivoConnection = {
  phoneNumberId: string;
  phoneNumber: string;
  friendlyName: string | null;
  country: string;
  agent: PlivoAgent | null;
};

type PlivoAvailableNumber = {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  country: string;
  region: string | null;
  isConflicted: boolean;
  conflictReason: string | null;
};

type PlivoIncomingConnectionsResponse = {
  connections: PlivoConnection[];
  availablePhoneNumbers: PlivoAvailableNumber[];
  availableAgents: PlivoAgent[];
  stats: Stats;
};

// Twilio + OpenAI types
type TwilioOpenaiAgent = {
  id: string;
  name: string;
  type: string;
  telephonyProvider: string;
  openaiVoice?: string;
};

type TwilioOpenaiConnection = {
  id: string;
  agentId: string;
  phoneNumberId: string;
  createdAt: string;
  agent: TwilioOpenaiAgent | null;
  phoneNumber: {
    id: string;
    phoneNumber: string;
    friendlyName: string | null;
    country: string | null;
    status: string;
  } | null;
};

type TwilioOpenaiAvailableNumber = {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  country: string | null;
  isConflicted: boolean;
  conflictReason: string | null;
};

type TwilioOpenaiIncomingConnectionsResponse = {
  connections: TwilioOpenaiConnection[];
  availablePhoneNumbers: TwilioOpenaiAvailableNumber[];
  availableAgents: TwilioOpenaiAgent[];
  stats: Stats;
};

type EngineTab = 'twilio-elevenlabs' | 'plivo-openai' | 'twilio-openai' | 'custom-voice';

type VoiceEngineSettings = {
  plivo_openai_engine_enabled: boolean;
  twilio_openai_engine_enabled: boolean;
};

export default function IncomingConnectionsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const setPageMeta = useAppHeaderOptional()?.setPageMeta;

  useEffect(() => {
    if (!setPageMeta) return;
    setPageMeta({ hideTitle: true });
    return () => setPageMeta(null);
  }, [setPageMeta]);
  const [activeTab, setActiveTab] = useState<EngineTab>('twilio-elevenlabs');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConnection, setDeleteConnection] = useState<IncomingConnection | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedPhoneId, setSelectedPhoneId] = useState("");

  // Plivo state
  const [plivoCreateDialogOpen, setPlivoCreateDialogOpen] = useState(false);
  const [plivoDeleteConnection, setPlivoDeleteConnection] = useState<PlivoConnection | null>(null);
  const [selectedPlivoAgentId, setSelectedPlivoAgentId] = useState("");
  const [selectedPlivoPhoneId, setSelectedPlivoPhoneId] = useState("");

  // Twilio + OpenAI state
  const [twilioOpenaiCreateDialogOpen, setTwilioOpenaiCreateDialogOpen] = useState(false);
  const [twilioOpenaiDeleteConnection, setTwilioOpenaiDeleteConnection] = useState<TwilioOpenaiConnection | null>(null);
  const [selectedTwilioOpenaiAgentId, setSelectedTwilioOpenaiAgentId] = useState("");
  const [selectedTwilioOpenaiPhoneId, setSelectedTwilioOpenaiPhoneId] = useState("");

  const { isCustomVoiceEngineEnabled } = usePluginStatus();
  
  // Custom Voice Engine state
  const [cveCreateDialogOpen, setCveCreateDialogOpen] = useState(false);
  const [cveDeleteConnection, setCveDeleteConnection] = useState<IncomingConnection | null>(null);
  const [selectedCveAgentId, setSelectedCveAgentId] = useState("");
  const [selectedCvePhoneId, setSelectedCvePhoneId] = useState("");

  const { data, isLoading: connectionsLoading } = useQuery<IncomingConnectionsResponse>({
    queryKey: ["/api/incoming-connections"],
  });

  // Plivo incoming connections query
  const { data: plivoData, isLoading: plivoConnectionsLoading } = useQuery<PlivoIncomingConnectionsResponse>({
    queryKey: ["/api/plivo/incoming-connections"],
  });

  // Twilio + OpenAI incoming connections query
  const { data: twilioOpenaiData, isLoading: twilioOpenaiConnectionsLoading } = useQuery<TwilioOpenaiIncomingConnectionsResponse>({
    queryKey: ["/api/twilio-openai/incoming-connections"],
  });

  // Voice engine settings to determine which engines are enabled
  const { data: voiceEngineSettings } = useQuery<VoiceEngineSettings>({
    queryKey: ["/api/settings/voice-engine"],
  });
  const plivoEnabled = voiceEngineSettings?.plivo_openai_engine_enabled ?? false;
  const twilioOpenaiEnabled = voiceEngineSettings?.twilio_openai_engine_enabled ?? false;

  // Current user (for plan type detection)
  const { data: currentUser } = useQuery<{ planType: string }>({
    queryKey: ["/api/auth/me"],
  });
  const isFreePlan = currentUser?.planType === 'free';

  const tabCount = isCustomVoiceEngineEnabled ? 4 : 3;

  // Filter connections and agents by provider
  const rawConnections = data?.connections || [];
  const rawAgents = data?.incomingAgents || [];

  const connections = rawConnections.filter(c => c.agent?.telephonyProvider !== 'custom-voice-engine');
  const cveConnections = rawConnections.filter(c => c.agent?.telephonyProvider === 'custom-voice-engine');

  const availablePhoneNumbers = data?.availablePhoneNumbers || [];

  const agents = rawAgents.filter(a => a.telephonyProvider !== 'custom-voice-engine');
  const cveAgents = rawAgents.filter(a => a.telephonyProvider === 'custom-voice-engine');

  const createMutation = useMutation({
    mutationFn: async (data: { agentId: string; phoneNumberId: string }) => {
      return apiRequest("POST", "/api/incoming-connections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      toast({
        title: t("incomingConnections.toast.created"),
        description: t("incomingConnections.toast.createdDesc"),
      });
      setCreateDialogOpen(false);
      setSelectedAgentId("");
      setSelectedPhoneId("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t("incomingConnections.toast.createFailed"),
        description: error.message || t("incomingConnections.toast.createFailedDesc"),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/incoming-connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      toast({
        title: t("incomingConnections.toast.deleted"),
        description: t("incomingConnections.toast.deletedDesc"),
      });
      setDeleteConnection(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t("incomingConnections.toast.deleteFailed"),
        description: error.message || t("incomingConnections.toast.deleteFailedDesc"),
      });
    },
  });

  // Custom Voice Engine creation mutation
  const cveCreateMutation = useMutation({
    mutationFn: async (data: { agentId: string; phoneNumberId: string }) => {
      return apiRequest("POST", "/api/incoming-connections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      toast({
        title: "Connection Created",
        description: "Custom Voice incoming connection has been created successfully.",
      });
      setCveCreateDialogOpen(false);
      setSelectedCveAgentId("");
      setSelectedCvePhoneId("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Create Connection",
        description: error.message || "Could not create the incoming connection.",
      });
    },
  });

  const cveDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/incoming-connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      toast({
        title: "Connection Removed",
        description: "Custom Voice connection has been removed successfully.",
      });
      setCveDeleteConnection(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Remove Connection",
        description: error.message || "Could not remove the incoming connection.",
      });
    },
  });

  const handleCveCreate = () => {
    if (!selectedCveAgentId || !selectedCvePhoneId) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select both an agent and a phone number.",
      });
      return;
    }
    cveCreateMutation.mutate({
      agentId: selectedCveAgentId,
      phoneNumberId: selectedCvePhoneId,
    });
  };

  // Plivo mutations
  const plivoConnections = plivoData?.connections || [];
  const plivoAvailablePhoneNumbers = plivoData?.availablePhoneNumbers || [];
  const plivoAvailableAgents = plivoData?.availableAgents || [];
  const plivoStats = {
    totalConnections: plivoData?.stats?.totalConnections || 0,
    availableNumbers: plivoData?.stats?.availableNumbers || 0,
    totalAgents: plivoData?.stats?.totalAgents || 0,
  };

  // Merge Twilio + Plivo numbers for Custom Voice selection
  const allAvailableNumbersForCve = useMemo(() => {
    return [
      ...availablePhoneNumbers.map(p => ({ ...p, provider: 'twilio' })),
      ...plivoAvailablePhoneNumbers.map(p => ({ ...p, provider: 'plivo' }))
    ];
  }, [availablePhoneNumbers, plivoAvailablePhoneNumbers]);

  const plivoCreateMutation = useMutation({
    mutationFn: async (data: { agentId: string; phoneNumberId: string }) => {
      return apiRequest("POST", "/api/plivo/incoming-connections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plivo/incoming-connections"] });
      toast({
        title: "Connection Created",
        description: "Plivo incoming connection has been created successfully.",
      });
      setPlivoCreateDialogOpen(false);
      setSelectedPlivoAgentId("");
      setSelectedPlivoPhoneId("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Create Connection",
        description: error.message || "Could not create the incoming connection.",
      });
    },
  });

  const plivoDeleteMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      return apiRequest("DELETE", `/api/plivo/incoming-connections/${phoneNumberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plivo/incoming-connections"] });
      toast({
        title: "Connection Removed",
        description: "Plivo incoming connection has been removed successfully.",
      });
      setPlivoDeleteConnection(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Remove Connection",
        description: error.message || "Could not remove the incoming connection.",
      });
    },
  });

  const handlePlivoCreate = () => {
    if (!selectedPlivoAgentId || !selectedPlivoPhoneId) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select both an agent and a phone number.",
      });
      return;
    }
    plivoCreateMutation.mutate({
      agentId: selectedPlivoAgentId,
      phoneNumberId: selectedPlivoPhoneId,
    });
  };

  // Twilio + OpenAI data extraction
  const twilioOpenaiConnections = twilioOpenaiData?.connections || [];
  const twilioOpenaiAvailablePhoneNumbers = twilioOpenaiData?.availablePhoneNumbers || [];
  const twilioOpenaiAvailableAgents = twilioOpenaiData?.availableAgents || [];
  const twilioOpenaiStats = {
    totalConnections: twilioOpenaiData?.stats?.totalConnections || 0,
    availableNumbers: twilioOpenaiData?.stats?.availableNumbers || 0,
    totalAgents: twilioOpenaiData?.stats?.totalAgents || 0,
  };

  const twilioOpenaiCreateMutation = useMutation({
    mutationFn: async (data: { agentId: string; phoneNumberId: string }) => {
      return apiRequest("POST", "/api/twilio-openai/incoming-connections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/twilio-openai/incoming-connections"] });
      toast({
        title: "Connection Created",
        description: "Twilio + OpenAI incoming connection has been created successfully.",
      });
      setTwilioOpenaiCreateDialogOpen(false);
      setSelectedTwilioOpenaiAgentId("");
      setSelectedTwilioOpenaiPhoneId("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Create Connection",
        description: error.message || "Could not create the incoming connection.",
      });
    },
  });

  const twilioOpenaiDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/twilio-openai/incoming-connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/twilio-openai/incoming-connections"] });
      toast({
        title: "Connection Removed",
        description: "Twilio + OpenAI incoming connection has been removed successfully.",
      });
      setTwilioOpenaiDeleteConnection(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Remove Connection",
        description: error.message || "Could not remove the incoming connection.",
      });
    },
  });

  const handleTwilioOpenaiCreate = () => {
    if (!selectedTwilioOpenaiAgentId || !selectedTwilioOpenaiPhoneId) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select both an agent and a phone number.",
      });
      return;
    }
    twilioOpenaiCreateMutation.mutate({
      agentId: selectedTwilioOpenaiAgentId,
      phoneNumberId: selectedTwilioOpenaiPhoneId,
    });
  };

  const handleCreate = () => {
    if (!selectedAgentId || !selectedPhoneId) {
      toast({
        variant: "destructive",
        title: t("incomingConnections.toast.validationError"),
        description: t("incomingConnections.toast.validationErrorDesc"),
      });
      return;
    }

    createMutation.mutate({
      agentId: selectedAgentId,
      phoneNumberId: selectedPhoneId,
    });
  };

  // Get current tab's create dialog handler
  const handleNewConnection = () => {
    switch (activeTab) {
      case 'twilio-elevenlabs':
        setCreateDialogOpen(true);
        break;
      case 'plivo-openai':
        setPlivoCreateDialogOpen(true);
        break;
      case 'twilio-openai':
        setTwilioOpenaiCreateDialogOpen(true);
        break;
      case 'custom-voice':
        setCveCreateDialogOpen(true);
        break;
    }
  };

  // Calculate total stats
  const totalConnections = connections.length + plivoStats.totalConnections + twilioOpenaiStats.totalConnections;

  const engineTileClass = (isActive: boolean) =>
    `rounded-xl border bg-white px-4 py-3.5 cursor-pointer transition-all ${
      isActive ? "border-[#C7D7FF] shadow-sm" : "border-slate-200 hover:border-slate-300"
    }`;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900">
              <LinkIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-slate-900 leading-tight" data-testid="heading-incoming-connections">
                {t("incomingConnections.title")}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {t("incomingConnections.subtitle", { defaultValue: "Connect incoming agents to your phone numbers for receiving calls" })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewConnection}
            className="h-9 px-4 rounded-full bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-slate-800"
            data-testid="button-create-connection"
          >
            <Plus className="w-4 h-4" />
            {t("incomingConnections.newconnection", { defaultValue: "New Connection" })}
          </button>
        </div>

        <div className={`grid grid-cols-1 gap-3 ${tabCount === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <div
            className={engineTileClass(activeTab === 'twilio-elevenlabs')}
            onClick={() => setActiveTab('twilio-elevenlabs')}
            data-testid="engine-card-twilio-elevenlabs"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <SiTwilio className="h-4 w-4 text-red-500" />
              <span className="text-slate-400">+</span>
              <ElevenLabsIcon className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-slate-800">Twilio + ElevenLabs</span>
            </div>
            <p className="text-xs text-slate-500">
              {connections.length} active · {availablePhoneNumbers.length} available · {agents.length} agents
            </p>
          </div>

          <div
              className={engineTileClass(activeTab === 'plivo-openai')}
              onClick={() => setActiveTab('plivo-openai')}
              data-testid="engine-card-plivo-openai"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <Phone className="h-4 w-4 text-emerald-600" />
                <span className="text-slate-400">+</span>
                <SiOpenai className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-800">Plivo + OpenAI</span>
              </div>
              <p className="text-xs text-slate-500">
                {plivoStats.totalConnections} active · {plivoStats.availableNumbers} available · {plivoStats.totalAgents} agents
              </p>
            </div>

          <div
              className={engineTileClass(activeTab === 'twilio-openai')}
              onClick={() => setActiveTab('twilio-openai')}
              data-testid="engine-card-twilio-openai"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <SiTwilio className="h-4 w-4 text-red-500" />
                <span className="text-slate-400">+</span>
                <SiOpenai className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-800">Twilio + OpenAI</span>
              </div>
              <p className="text-xs text-slate-500">
                {twilioOpenaiStats.totalConnections} active · {twilioOpenaiStats.availableNumbers} available · {twilioOpenaiStats.totalAgents} agents
              </p>
            </div>

          {isCustomVoiceEngineEnabled && (
            <div
              className={engineTileClass(activeTab === 'custom-voice')}
              onClick={() => setActiveTab('custom-voice')}
              data-testid="engine-card-custom-voice"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                <Mic className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-medium text-slate-800">Custom Voice</span>
              </div>
              <p className="text-xs text-slate-500">
                {cveConnections.length} active · {allAvailableNumbersForCve.length} available · {cveAgents.length} agents
              </p>
            </div>
          )}
        </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EngineTab)} className="w-full pt-1">
        <TabsList className={`grid w-full mb-2 h-11 rounded-xl bg-slate-100 p-1 ${tabCount === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          <TabsTrigger value="twilio-elevenlabs" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-twilio-elevenlabs">
            <SiTwilio className="h-3.5 w-3.5 text-red-500" />
            <ElevenLabsIcon className="h-3.5 w-3.5 text-violet-600" />
            <span className="hidden sm:inline text-slate-700">Twilio + ElevenLabs</span>
          </TabsTrigger>
          <TabsTrigger value="plivo-openai" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-plivo-openai">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <SiOpenai className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline text-slate-700">Plivo + OpenAI</span>
          </TabsTrigger>
          <TabsTrigger value="twilio-openai" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-twilio-openai">
              <SiTwilio className="h-3.5 w-3.5 text-red-500" />
              <SiOpenai className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline text-slate-700">Twilio + OpenAI</span>
          </TabsTrigger>
          {isCustomVoiceEngineEnabled && (
            <TabsTrigger value="custom-voice" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-custom-voice">
              <Mic className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline text-slate-700">Custom Voice</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Twilio + ElevenLabs Content */}
        <TabsContent value="twilio-elevenlabs">
              {connectionsLoading ? (
                <div className="space-y-3 p-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : connections.length === 0 ? (
                <div className="text-center py-20 px-6" data-testid="empty-state">
                  <LinkIcon className="mx-auto h-12 w-12 text-slate-800 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("incomingConnections.empty.title", { defaultValue: "No connections" })}</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                    {t("incomingConnections.empty.description", { defaultValue: "Create your first connection to start receiving calls on your phone numbers" })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreateDialogOpen(true)}
                    className="h-10 px-5 rounded-full bg-[#6D5EF6] hover:bg-[#5B4CE6] text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                    data-testid="button-create-first-connection"
                  >
                    <Plus className="w-4 h-4" />
                    {t("incomingConnections.empty.createFirst", { defaultValue: "Create Your First Connection" })}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-5">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-white"
                      data-testid={`connection-card-${connection.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">
                          {connection.phoneNumber.phoneNumber}
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <ElevenLabsIcon className="h-4 w-4 text-violet-600" />
                            <span className="font-medium text-slate-900">{connection.agent.name}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {connection.phoneNumber.friendlyName && `${connection.phoneNumber.friendlyName} • `}
                            Language: {connection.agent.language || 'en'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                        onClick={() => setDeleteConnection(connection)}
                        data-testid={`button-delete-${connection.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
        </TabsContent>

        {/* Custom Voice Content */}
        {isCustomVoiceEngineEnabled && (
        <TabsContent value="custom-voice">
              {connectionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : cveConnections.length === 0 ? (
                <div className="text-center py-20 px-6" data-testid="cve-empty-state">
                  <LinkIcon className="mx-auto h-12 w-12 text-slate-800 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No connections</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                    Create your first connection to start receiving calls on your phone numbers
                  </p>
                  <button
                    type="button"
                    onClick={() => setCveCreateDialogOpen(true)}
                    disabled={allAvailableNumbersForCve.length === 0 || cveAgents.length === 0}
                    className="h-10 px-5 rounded-full bg-[#6D5EF6] hover:bg-[#5B4CE6] text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Connection
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cveConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="font-mono text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                          {connection.phoneNumber.phoneNumber}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-indigo-600" />
                            <span className="font-medium">{connection.agent.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {connection.phoneNumber.friendlyName && `${connection.phoneNumber.friendlyName} • `}
                            Language: {connection.agent.language || 'en'}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCveDeleteConnection(connection)}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
        </TabsContent>)}

        {/* Plivo + OpenAI Content */}
        <TabsContent value="plivo-openai">
              {plivoConnectionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : plivoConnections.length === 0 ? (
                <div className="text-center py-20 px-6" data-testid="plivo-no-connections">
                  <LinkIcon className="mx-auto h-12 w-12 text-slate-800 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No connections</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                    Create your first connection to start receiving calls on your phone numbers
                  </p>
                  <button
                    type="button"
                    onClick={() => setPlivoCreateDialogOpen(true)}
                    className="h-10 px-5 rounded-full bg-[#6D5EF6] hover:bg-[#5B4CE6] text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                    data-testid="button-create-first-plivo-connection"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Connection
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {plivoConnections.map((connection) => (
                    <div
                      key={connection.phoneNumberId}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate bg-card"
                      data-testid={`plivo-connection-card-${connection.phoneNumberId}`}
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="font-mono text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          {connection.phoneNumber}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <SiOpenai className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium">{connection.agent?.name || 'Unknown Agent'}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {connection.friendlyName && `${connection.friendlyName} • `}
                            Country: {connection.country}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPlivoDeleteConnection(connection)}
                        data-testid={`button-delete-plivo-${connection.phoneNumberId}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
        </TabsContent>

        {/* Twilio + OpenAI Content */}
        <TabsContent value="twilio-openai">
              {twilioOpenaiConnectionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : twilioOpenaiConnections.length === 0 ? (
                <div className="text-center py-20 px-6" data-testid="twilio-openai-no-connections">
                  <LinkIcon className="mx-auto h-12 w-12 text-slate-800 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No connections</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                    Create your first connection to start receiving calls on your phone numbers
                  </p>
                  <button
                    type="button"
                    onClick={() => setTwilioOpenaiCreateDialogOpen(true)}
                    className="h-10 px-5 rounded-full bg-[#6D5EF6] hover:bg-[#5B4CE6] text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                    data-testid="button-create-first-twilio-openai-connection"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Connection
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {twilioOpenaiConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate bg-card"
                      data-testid={`twilio-openai-connection-card-${connection.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="font-mono text-xs bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand">
                          {connection.phoneNumber?.phoneNumber || 'Unknown'}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <SiOpenai className="h-4 w-4 text-brand" />
                            <span className="font-medium">{connection.agent?.name || 'Unknown Agent'}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {connection.phoneNumber?.friendlyName && `${connection.phoneNumber.friendlyName} • `}
                            Country: {connection.phoneNumber?.country || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTwilioOpenaiDeleteConnection(connection)}
                        data-testid={`button-delete-twilio-openai-${connection.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
        </TabsContent>
      </Tabs>
      </div>

      {/* Twilio + ElevenLabs Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-connection">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiTwilio className="h-5 w-5 text-red-500" />
              <ElevenLabsIcon className="h-5 w-5 text-violet-600" />
              {t("incomingConnections.dialog.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("incomingConnections.dialog.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent">
                {t("incomingConnections.form.agentLabel")} <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger id="agent" data-testid="select-agent">
                  <SelectValue placeholder={t("incomingConnections.form.agentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      {t("incomingConnections.form.noAgents")}
                    </div>
                  ) : (
                    agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                {t("incomingConnections.form.phoneLabel")} <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
                <SelectTrigger id="phone" data-testid="select-phone">
                  <SelectValue placeholder={t("incomingConnections.form.phonePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availablePhoneNumbers.length === 0 ? (
                    isFreePlan ? (
                      <div className="p-3 space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {t("incomingConnections.form.freePlanNoPhones")}
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setLocation("/billing?tab=plans")}
                          data-testid="button-upgrade-for-phone"
                        >
                          {t("incomingConnections.form.upgradeNow")}
                        </Button>
                      </div>
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">
                        {t("incomingConnections.form.noPhones")}
                      </div>
                    )
                  ) : (
                    availablePhoneNumbers.map((phone) => (
                      phone.isConflicted ? (
                        <TooltipProvider key={phone.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative flex w-full cursor-not-allowed select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none opacity-50">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">{phone.phoneNumber}</span>
                                  <span className="text-xs text-destructive font-medium">(In Use)</span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p>{phone.conflictReason || "This phone is being used by an active campaign"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <SelectItem key={phone.id} value={phone.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{phone.phoneNumber}</span>
                            {phone.friendlyName && (
                              <span className="text-muted-foreground">({phone.friendlyName})</span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setSelectedAgentId(""); setSelectedPhoneId(""); }}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !selectedAgentId || !selectedPhoneId}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {createMutation.isPending ? t("incomingConnections.actions.creating") : t("incomingConnections.actions.createConnection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Twilio + ElevenLabs Delete Dialog */}
      <AlertDialog open={!!deleteConnection} onOpenChange={() => setDeleteConnection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("incomingConnections.dialog.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("incomingConnections.dialog.deleteDescription")}{" "}
              <span className="font-mono font-semibold">{deleteConnection?.phoneNumber.phoneNumber}</span>{" "}
              {t("incomingConnections.dialog.deleteDescriptionRoute")}{" "}
              <span className="font-semibold">{deleteConnection?.agent.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConnection && deleteMutation.mutate(deleteConnection.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("incomingConnections.actions.deleting") : t("incomingConnections.actions.deleteConnection")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plivo Create Connection Dialog */}
      <Dialog open={plivoCreateDialogOpen} onOpenChange={setPlivoCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-plivo-connection">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              <SiOpenai className="h-5 w-5 text-emerald-600" />
              Create Plivo + OpenAI Connection
            </DialogTitle>
            <DialogDescription>
              Connect a Plivo phone number to an OpenAI-powered agent for incoming calls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plivo-agent">OpenAI Agent <span className="text-destructive">*</span></Label>
              <Select value={selectedPlivoAgentId} onValueChange={setSelectedPlivoAgentId}>
                <SelectTrigger id="plivo-agent" data-testid="select-plivo-agent">
                  <SelectValue placeholder="Select an OpenAI agent" />
                </SelectTrigger>
                <SelectContent>
                  {plivoAvailableAgents.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No OpenAI agents available.</div>
                  ) : (
                    plivoAvailableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <SiOpenai className="h-3 w-3 text-emerald-600" />
                          <span>{agent.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plivo-phone">Plivo Phone Number <span className="text-destructive">*</span></Label>
              <Select value={selectedPlivoPhoneId} onValueChange={setSelectedPlivoPhoneId}>
                <SelectTrigger id="plivo-phone" data-testid="select-plivo-phone">
                  <SelectValue placeholder="Select a Plivo phone number" />
                </SelectTrigger>
                <SelectContent>
                  {plivoAvailablePhoneNumbers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No available Plivo phone numbers.</div>
                  ) : (
                    plivoAvailablePhoneNumbers.map((phone) => (
                      phone.isConflicted ? (
                        <TooltipProvider key={phone.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative flex w-full cursor-not-allowed select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none opacity-50">
                                <span className="font-mono">{phone.phoneNumber}</span>
                                <span className="text-xs text-destructive font-medium ml-2">(In Use)</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent><p>{phone.conflictReason}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <SelectItem key={phone.id} value={phone.id}>
                          <span className="font-mono">{phone.phoneNumber}</span>
                          <span className="text-xs text-muted-foreground ml-2">({phone.country})</span>
                        </SelectItem>
                      )
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPlivoCreateDialogOpen(false); setSelectedPlivoAgentId(""); setSelectedPlivoPhoneId(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handlePlivoCreate}
              disabled={plivoCreateMutation.isPending || !selectedPlivoAgentId || !selectedPlivoPhoneId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {plivoCreateMutation.isPending ? "Creating..." : "Create Connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plivo Delete Dialog */}
      <AlertDialog open={!!plivoDeleteConnection} onOpenChange={() => setPlivoDeleteConnection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Connection</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect <span className="font-mono font-semibold">{plivoDeleteConnection?.phoneNumber}</span>{" "}
              from <span className="font-semibold">{plivoDeleteConnection?.agent?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => plivoDeleteConnection && plivoDeleteMutation.mutate(plivoDeleteConnection.phoneNumberId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {plivoDeleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Twilio + OpenAI Create Dialog */}
      <Dialog open={twilioOpenaiCreateDialogOpen} onOpenChange={setTwilioOpenaiCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-twilio-openai-connection">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiTwilio className="h-5 w-5 text-red-500" />
              <SiOpenai className="h-5 w-5 text-brand" />
              Create Twilio + OpenAI Connection
            </DialogTitle>
            <DialogDescription>
              Connect a Twilio phone number to an OpenAI-powered agent for incoming calls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="twilio-openai-agent">OpenAI Agent <span className="text-destructive">*</span></Label>
              <Select value={selectedTwilioOpenaiAgentId} onValueChange={setSelectedTwilioOpenaiAgentId}>
                <SelectTrigger id="twilio-openai-agent" data-testid="select-twilio-openai-agent">
                  <SelectValue placeholder="Select an OpenAI agent" />
                </SelectTrigger>
                <SelectContent>
                  {twilioOpenaiAvailableAgents.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No OpenAI agents available.</div>
                  ) : (
                    twilioOpenaiAvailableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <SiOpenai className="h-3 w-3 text-brand" />
                          <span>{agent.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilio-openai-phone">Twilio Phone Number <span className="text-destructive">*</span></Label>
              <Select value={selectedTwilioOpenaiPhoneId} onValueChange={setSelectedTwilioOpenaiPhoneId}>
                <SelectTrigger id="twilio-openai-phone" data-testid="select-twilio-openai-phone">
                  <SelectValue placeholder="Select a Twilio phone number" />
                </SelectTrigger>
                <SelectContent>
                  {twilioOpenaiAvailablePhoneNumbers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No available Twilio phone numbers.</div>
                  ) : (
                    twilioOpenaiAvailablePhoneNumbers.map((phone) => (
                      phone.isConflicted ? (
                        <TooltipProvider key={phone.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative flex w-full cursor-not-allowed select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none opacity-50">
                                <span className="font-mono">{phone.phoneNumber}</span>
                                <span className="text-xs text-destructive font-medium ml-2">(In Use)</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent><p>{phone.conflictReason}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <SelectItem key={phone.id} value={phone.id}>
                          <span className="font-mono">{phone.phoneNumber}</span>
                          <span className="text-xs text-muted-foreground ml-2">({phone.country})</span>
                        </SelectItem>
                      )
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setTwilioOpenaiCreateDialogOpen(false); setSelectedTwilioOpenaiAgentId(""); setSelectedTwilioOpenaiPhoneId(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleTwilioOpenaiCreate}
              disabled={twilioOpenaiCreateMutation.isPending || !selectedTwilioOpenaiAgentId || !selectedTwilioOpenaiPhoneId}
              className="bg-brand text-brand-foreground"
            >
              {twilioOpenaiCreateMutation.isPending ? "Creating..." : "Create Connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Twilio + OpenAI Delete Dialog */}
      <AlertDialog open={!!twilioOpenaiDeleteConnection} onOpenChange={() => setTwilioOpenaiDeleteConnection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Connection</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect <span className="font-mono font-semibold">{twilioOpenaiDeleteConnection?.phoneNumber?.phoneNumber}</span>{" "}
              from <span className="font-semibold">{twilioOpenaiDeleteConnection?.agent?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => twilioOpenaiDeleteConnection && twilioOpenaiDeleteMutation.mutate(twilioOpenaiDeleteConnection.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {twilioOpenaiDeleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Custom Voice Create Dialog */}
      <Dialog open={cveCreateDialogOpen} onOpenChange={setCveCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-indigo-600" />
              Create Custom Voice Connection
            </DialogTitle>
            <DialogDescription>
              Connect any available phone number to a Custom Voice Engine agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cve-agent">Custom Voice Agent <span className="text-destructive">*</span></Label>
              <Select value={selectedCveAgentId} onValueChange={setSelectedCveAgentId}>
                <SelectTrigger id="cve-agent">
                  <SelectValue placeholder="Select a Custom Voice agent" />
                </SelectTrigger>
                <SelectContent>
                  {cveAgents.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No Custom Voice agents available.</div>
                  ) : (
                    cveAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cve-phone">Phone Number <span className="text-destructive">*</span></Label>
              <Select value={selectedCvePhoneId} onValueChange={setSelectedCvePhoneId}>
                <SelectTrigger id="cve-phone">
                  <SelectValue placeholder="Select a phone number" />
                </SelectTrigger>
                <SelectContent>
                  {allAvailableNumbersForCve.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No available phone numbers.</div>
                  ) : (
                    allAvailableNumbersForCve.map((phone) => (
                      phone.isConflicted ? (
                        <TooltipProvider key={phone.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative flex w-full cursor-not-allowed select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none opacity-50">
                                <span className="font-mono">{phone.phoneNumber}</span>
                                <span className="text-xs text-destructive font-medium ml-2">(In Use)</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent><p>{phone.conflictReason}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <SelectItem key={phone.id} value={phone.id}>
                          <span className="font-mono">{phone.phoneNumber}</span>
                          <span className="text-xs text-muted-foreground ml-2">({(phone as any).provider === 'plivo' ? 'Plivo' : 'Twilio'})</span>
                          {phone.friendlyName && (
                            <span className="text-xs text-muted-foreground ml-2">({phone.friendlyName})</span>
                          )}
                        </SelectItem>
                      )
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCveCreateDialogOpen(false); setSelectedCveAgentId(""); setSelectedCvePhoneId(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCveCreate}
              disabled={cveCreateMutation.isPending || !selectedCveAgentId || !selectedCvePhoneId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {cveCreateMutation.isPending ? "Creating..." : "Create Connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Voice Delete Dialog */}
      <AlertDialog open={!!cveDeleteConnection} onOpenChange={() => setCveDeleteConnection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Connection</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect <span className="font-mono font-semibold">{cveDeleteConnection?.phoneNumber.phoneNumber}</span>{" "}
              from <span className="font-semibold">{cveDeleteConnection?.agent.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cveDeleteConnection && cveDeleteMutation.mutate(cveDeleteConnection.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cveDeleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
