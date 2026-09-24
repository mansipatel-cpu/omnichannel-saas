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
import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import PromptTemplatesLibrary from "@/components/PromptTemplatesLibrary";
import VoiceSearchPicker from "@/components/VoiceSearchPicker";
import VoicePreviewButton from "@/components/VoicePreviewButton";
import OpenAIVoicePreviewButton from "@/components/OpenAIVoicePreviewButton";
import { SUPPORTED_LANGUAGES, isProviderSupported } from "@/lib/languages";
import { LanguageOptionLabel } from "@/components/LanguageProviderBadges";
import {
  ArrowLeft,
  Bot,
  BookOpen,
  Check,
  Circle,
  GitBranch,
  IdCard,
  Phone,
  Settings2,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BLUE_SLIDER = {
  rangeClassName: "bg-[#2F6BFF]",
  thumbClassName: "border-[#2F6BFF]",
} as const;

const openaiVoices = [
  { value: "alloy", label: "Alloy", description: "Versatile and balanced" },
  { value: "echo", label: "Echo", description: "Warm and confident" },
  { value: "shimmer", label: "Shimmer", description: "Clear and expressive" },
  { value: "ash", label: "Ash", description: "Soft and gentle" },
  { value: "ballad", label: "Ballad", description: "Melodic and soothing" },
  { value: "coral", label: "Coral", description: "Bright and friendly" },
  { value: "sage", label: "Sage", description: "Calm and wise" },
  { value: "verse", label: "Verse", description: "Poetic and articulate" },
  { value: "cedar", label: "Cedar", description: "Deep and grounded" },
  { value: "marin", label: "Marin", description: "Fresh and lively" },
];

type TelephonyProvider =
  | "twilio"
  | "plivo"
  | "twilio_openai"
  | "elevenlabs-sip"
  | "openai-sip"
  | "custom-voice-engine";

type AgentType = "incoming" | "flow" | "custom_engine";

interface ExistingAgent {
  id: string;
  type?: string | null;
  name?: string | null;
  description?: string | null;
  voiceTone?: string | null;
  personality?: string | null;
  systemPrompt?: string | null;
  elevenLabsVoiceId?: string | null;
  language?: string | null;
  llmModel?: string | null;
  firstMessage?: string | null;
  temperature?: number | null;
  knowledgeBaseIds?: string[] | null;
  transferEnabled?: boolean | null;
  transferPhoneNumber?: string | null;
  detectLanguageEnabled?: boolean | null;
  endConversationEnabled?: boolean | null;
  appointmentBookingEnabled?: boolean | null;
  messagingEmailEnabled?: boolean | null;
  messagingWhatsappEnabled?: boolean | null;
  messagingEmailTemplate?: string | null;
  messagingWhatsappTemplate?: string | null;
  flowId?: string | null;
  maxDurationSeconds?: number | null;
  voiceStability?: number | null;
  voiceSimilarityBoost?: number | null;
  voiceSpeed?: number | null;
  telephonyProvider?: string | null;
  openaiVoice?: string | null;
  config?: Record<string, unknown> | null;
}

interface KnowledgeBaseItem {
  id: string;
  title: string;
  type: string;
}

interface LLMModel {
  id: string;
  modelId: string;
  name: string;
  provider: string;
  tier: "free" | "pro";
  isActive: boolean;
}

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm p-6 md:p-7",
        className,
      )}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-slate-600" />
          </div>
        )}
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function SelectableCard({
  selected,
  onClick,
  children,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "relative w-full text-left rounded-xl border-2 p-4 transition-all",
        selected
          ? "border-[#2F6BFF] bg-[#2F6BFF]/[0.04] shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80",
      )}
    >
      <div className="absolute top-3.5 right-3.5">
        {selected ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2F6BFF] text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : (
          <Circle className="h-5 w-5 text-slate-300" />
        )}
      </div>
      {children}
    </button>
  );
}

const emptyForm = {
  type: "incoming" as AgentType,
  name: "",
  voiceTone: "professional",
  personality: "helpful",
  systemPrompt: "",
  elevenLabsVoiceId: "",
  language: "en",
  llmModel: "gpt-4o-mini",
  firstMessage: "Hello! How can I help you today?",
  temperature: 0.5,
  knowledgeBaseIds: [] as string[],
  transferEnabled: false,
  transferPhoneNumber: "",
  detectLanguageEnabled: false,
  endConversationEnabled: false,
  appointmentBookingEnabled: false,
  flowId: "",
  voiceStability: 0.55,
  voiceSimilarityBoost: 0.85,
  voiceSpeed: 1.0,
  telephonyProvider: "twilio" as TelephonyProvider,
  openaiVoice: "alloy",
};

function mapAgentToForm(agent: ExistingAgent) {
  const provider = (agent.telephonyProvider || "twilio") as TelephonyProvider;
  const type: AgentType =
    provider === "custom-voice-engine" || agent.type === "custom_engine"
      ? "custom_engine"
      : agent.type === "flow"
        ? "flow"
        : "incoming";

  return {
    type,
    name: agent.name || "",
    voiceTone: agent.voiceTone || "professional",
    personality: agent.personality || "helpful",
    systemPrompt: agent.systemPrompt || "",
    elevenLabsVoiceId: agent.elevenLabsVoiceId || "",
    language: agent.language || "en",
    llmModel: agent.llmModel || "gpt-4o-mini",
    firstMessage: agent.firstMessage || "Hello! How can I help you today?",
    temperature: agent.temperature ?? 0.5,
    knowledgeBaseIds: agent.knowledgeBaseIds || [],
    transferEnabled: agent.transferEnabled ?? false,
    transferPhoneNumber: agent.transferPhoneNumber || "",
    detectLanguageEnabled: agent.detectLanguageEnabled ?? false,
    endConversationEnabled: agent.endConversationEnabled ?? false,
    appointmentBookingEnabled: agent.appointmentBookingEnabled ?? false,
    flowId: agent.flowId || "",
    voiceStability: agent.voiceStability ?? 0.55,
    voiceSimilarityBoost: agent.voiceSimilarityBoost ?? 0.85,
    voiceSpeed: agent.voiceSpeed ?? 1.0,
    telephonyProvider: provider,
    openaiVoice: agent.openaiVoice || "alloy",
  };
}

export default function CreateAgent() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isEditRoute, editParams] = useRoute<{ id: string }>("/agents/:id/edit");
  const agentId = isEditRoute ? editParams?.id : undefined;
  const isEdit = Boolean(agentId);
  const { setPageMeta } = useAppHeader();
  const { isCustomVoiceEngineEnabled } = usePluginStatus();

  const [formData, setFormData] = useState(emptyForm);
  const [sourceAgent, setSourceAgent] = useState<ExistingAgent | null>(null);

  const { data: existingAgent, isLoading: isLoadingAgent, isError: isAgentError } = useQuery<ExistingAgent>({
    queryKey: ["/api/agents", agentId],
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existingAgent) return;
    setSourceAgent(existingAgent);
    setFormData(mapAgentToForm(existingAgent));
  }, [existingAgent]);

  useEffect(() => {
    setPageMeta({
      title: isEdit ? "Edit Agent" : "Create AI Agent",
      subtitle: isEdit
        ? "Update type, persona, telephony, model, and prompts."
        : "Configure type, persona, telephony, model, and prompts.",
    });
    return () => setPageMeta(null);
  }, [setPageMeta, isEdit]);

  const { data: knowledgeBase = [] } = useQuery<KnowledgeBaseItem[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const { data: availableLLMModels = [] } = useQuery<LLMModel[]>({
    queryKey: ["/api/llm-models/available"],
  });

  const { data: flows = [] } = useQuery<Array<{ id: string; name: string; description?: string }>>({
    queryKey: ["/api/flow-automation/flows"],
  });

  const { data: voiceEngineSettings } = useQuery<{
    plivo_openai_engine_enabled: boolean;
    twilio_openai_engine_enabled: boolean;
  }>({
    queryKey: ["/api/settings/voice-engine"],
    staleTime: 60000,
  });

  const isPlivoEnabled = voiceEngineSettings?.plivo_openai_engine_enabled ?? true;
  const isTwilioOpenaiEnabled = voiceEngineSettings?.twilio_openai_engine_enabled ?? true;
  const isOpenAIEngine =
    formData.telephonyProvider === "plivo" ||
    formData.telephonyProvider === "twilio_openai" ||
    formData.telephonyProvider === "openai-sip";
  const isCustomEngine = formData.telephonyProvider === "custom-voice-engine" || formData.type === "custom_engine";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit && agentId && sourceAgent?.telephonyProvider === "custom-voice-engine") {
        const config = sourceAgent.config || {};
        const payload = {
          name: formData.name,
          description: sourceAgent.description || "",
          systemPrompt: formData.systemPrompt,
          firstMessage: formData.firstMessage || "Hello! How can I help you today?",
          language: formData.language || "en",
          llmModel: formData.llmModel || "openai/gpt-4o-mini",
          temperature: formData.temperature ?? 0.7,
          maxTokens: 500,
          ttsVoice: formData.openaiVoice || "aura-asteria-en",
          ttsProvider: (config.ttsProvider as string) || "deepgram",
          sttProvider: (config.sttProvider as string) || "deepgram",
          sttModel: (config.sttModel as string) || "",
          ttsModel: (config.ttsModel as string) || "",
          interruptible: true,
          silenceTimeoutMs: 5000,
          maxDurationSeconds: sourceAgent.maxDurationSeconds ?? 600,
          endCallOnSilence: false,
          businessRules: [],
          enableMemory: true,
          memoryRetentionDays: 90,
          isActive: true,
          detectLanguageEnabled: formData.detectLanguageEnabled || false,
          knowledgeBaseIds: formData.knowledgeBaseIds || [],
          appointmentBookingEnabled: formData.appointmentBookingEnabled || false,
          endConversationEnabled: formData.endConversationEnabled || false,
          transferEnabled: formData.transferEnabled || false,
          transferPhoneNumber: formData.transferPhoneNumber || "",
          messagingEmailEnabled: sourceAgent.messagingEmailEnabled || false,
          messagingWhatsappEnabled: sourceAgent.messagingWhatsappEnabled || false,
          messagingEmailTemplate: sourceAgent.messagingEmailTemplate || "",
          messagingWhatsappTemplate: sourceAgent.messagingWhatsappTemplate || "",
        };
        const res = await apiRequest("PUT", `/api/voice-engine/agents/${agentId}`, payload);
        return res.json();
      }

      const payload = {
        name: formData.name,
        voiceTone: formData.voiceTone,
        personality: formData.personality,
        systemPrompt: formData.systemPrompt,
        elevenLabsVoiceId: formData.elevenLabsVoiceId,
        language: formData.language,
        llmModel: formData.llmModel,
        firstMessage: formData.firstMessage,
        temperature: formData.temperature,
        knowledgeBaseIds: formData.knowledgeBaseIds,
        transferEnabled: formData.transferEnabled,
        transferPhoneNumber: formData.transferPhoneNumber,
        detectLanguageEnabled: formData.detectLanguageEnabled,
        endConversationEnabled: formData.endConversationEnabled,
        appointmentBookingEnabled: formData.appointmentBookingEnabled,
        flowId: formData.flowId,
        voiceStability: formData.voiceStability,
        voiceSimilarityBoost: formData.voiceSimilarityBoost,
        voiceSpeed: formData.voiceSpeed,
        telephonyProvider: formData.telephonyProvider,
        openaiVoice: formData.openaiVoice,
        ...(isEdit ? {} : { type: formData.type }),
      };

      const res = isEdit && agentId
        ? await apiRequest("PATCH", `/api/agents/${agentId}`, payload)
        : await apiRequest("POST", "/api/agents", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/voice-engine/agents"] });
      toast({ title: isEdit ? "Agent updated" : "Agent created" });
      setLocation("/agents");
    },
    onError: (error: any) => {
      toast({
        title: isEdit ? "Failed to update agent" : "Failed to create agent",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (isEdit && !sourceAgent) return;
    if (!formData.name.trim()) {
      toast({ title: "Missing fields", description: "Please enter an agent name.", variant: "destructive" });
      return;
    }
    if (formData.type === "incoming" || formData.type === "custom_engine") {
      const hasVoice = isOpenAIEngine || isCustomEngine ? !!formData.openaiVoice : !!formData.elevenLabsVoiceId;
      if (!hasVoice) {
        toast({ title: "Missing fields", description: "Please select a voice profile.", variant: "destructive" });
        return;
      }
      if (!formData.systemPrompt.trim()) {
        toast({ title: "Missing fields", description: "System prompt is required.", variant: "destructive" });
        return;
      }
      if (formData.transferEnabled && !formData.transferPhoneNumber.trim()) {
        toast({
          title: "Missing fields",
          description: "Enter a transfer phone number or disable call transfer.",
          variant: "destructive",
        });
        return;
      }
    }
    if (formData.type === "flow" && !formData.flowId) {
      toast({ title: "Missing fields", description: "Please select a flow.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const selectType = (type: AgentType) => {
    if (isEdit) {
      toast({
        title: "Agent type can't be changed",
        description: "Create a new agent if you need a different type.",
      });
      return;
    }
    update("type", type);
  };

  const update = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const setProvider = (provider: TelephonyProvider) => {
    setFormData((prev) => ({
      ...prev,
      telephonyProvider: provider,
      openaiVoice: provider === "twilio" ? prev.openaiVoice : prev.openaiVoice || "alloy",
    }));
  };

  const langProviders =
    formData.telephonyProvider === "twilio" || formData.telephonyProvider === "elevenlabs-sip"
      ? (["elevenlabs"] as const)
      : formData.telephonyProvider === "custom-voice-engine"
        ? (["elevenlabs", "openai"] as const)
        : (["openai"] as const);

  if (isEdit && (isLoadingAgent || !sourceAgent)) {
    return (
      <div className="space-y-4 py-10">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Agents
        </Link>
        <p className="text-sm text-slate-500">
          {isAgentError ? "This agent could not be loaded." : "Loading agent..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        data-testid="link-back-to-agents"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AI Agents
      </Link>

      {/* 1. Agent Type */}
      <SectionCard>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            1. Agent Type <span className="text-red-500">*</span>
          </h2>
          <p className="text-sm text-slate-500">Choose the execution architecture</p>
        </div>
        <div className={cn("grid grid-cols-1 gap-4", formData.type === "custom_engine" ? "md:grid-cols-3" : "md:grid-cols-2")}>
          <SelectableCard
            selected={formData.type === "incoming"}
            onClick={() => selectType("incoming")}
            testId="card-type-incoming"
          >
            <div className="flex items-start gap-3 pr-8">
              <div className="h-10 w-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900">Incoming Agent</h3>
                  {formData.type === "incoming" && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-[11px] font-medium rounded-full px-2">
                      <span className="mr-1">•</span> Active
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Open-ended AI conversations. Best for receiving calls on purchased phone numbers and
                  human-like natural dialogue.
                </p>
              </div>
            </div>
          </SelectableCard>

          <SelectableCard
            selected={formData.type === "flow"}
            onClick={() => selectType("flow")}
            testId="card-type-flow"
          >
            <div className="flex items-start gap-3 pr-8">
              <div className="h-10 w-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                <GitBranch className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Flow Agent</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Deterministic flow-based execution. Best for bulk campaigns, reminders, confirmations,
                  and predictable scripted interactions.
                </p>
              </div>
            </div>
          </SelectableCard>

          {formData.type === "custom_engine" && (
            <SelectableCard
              selected
              onClick={() => selectType("custom_engine")}
              testId="card-type-custom-engine"
            >
              <div className="flex items-start gap-3 pr-8">
                <div className="h-10 w-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Custom Engine Agent</h3>
                  <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                    Self-hosted voice pipeline. Voice, prompts, and tools use the same layout as other agents.
                  </p>
                </div>
              </div>
            </SelectableCard>
          )}
        </div>
      </SectionCard>

      {/* 2. Agent Basics & Persona */}
      <SectionCard>
        <SectionHeader
          icon={IdCard}
          title="Agent Basics & Persona"
          subtitle="Define identity tags, core mission parameters, and dialogue demeanor"
        />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">
              Agent Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="agent-name"
              placeholder="Customer Support Agent"
              value={formData.name}
              onChange={(e) => update("name", e.target.value)}
              className="h-11"
              data-testid="input-agent-name"
            />
          </div>

          {formData.type === "flow" && (
            <div className="space-y-2">
              <Label>
                Flow <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.flowId} onValueChange={(v) => update("flowId", v)}>
                <SelectTrigger className="h-11" data-testid="select-flow">
                  <SelectValue placeholder="Select a flow" />
                </SelectTrigger>
                <SelectContent>
                  {flows.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No flows available — create one in Flow Builder
                    </SelectItem>
                  ) : (
                    flows.map((flow) => (
                      <SelectItem key={flow.id} value={flow.id}>
                        {flow.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label>Voice Tone</Label>
                <InfoTooltip content="How the agent should sound during conversation." />
              </div>
              <Select value={formData.voiceTone} onValueChange={(v) => update("voiceTone", v)}>
                <SelectTrigger className="h-11" data-testid="select-voice-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label>Personality</Label>
                <InfoTooltip content="The behavioral style of the agent." />
              </div>
              <Select value={formData.personality} onValueChange={(v) => update("personality", v)}>
                <SelectTrigger className="h-11" data-testid="select-personality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="helpful">Helpful</SelectItem>
                  <SelectItem value="empathetic">Empathetic</SelectItem>
                  <SelectItem value="assertive">Assertive</SelectItem>
                  <SelectItem value="concise">Concise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 3. Telephony & Speech Engine */}
      <SectionCard>
        <SectionHeader
          icon={Phone}
          title="Telephony & Speech Engine"
          subtitle="Route connectivity provider and select primary speech synthesis profiles"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <SelectableCard
            selected={formData.telephonyProvider === "twilio"}
            onClick={() => setProvider("twilio")}
            testId="card-provider-twilio"
          >
            <div className="pr-6">
              <h3 className="font-semibold text-slate-900 text-sm">ElevenLabs + Twilio</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Premium voice quality, 30+ languages, lowest jitter
              </p>
            </div>
          </SelectableCard>

          {(isTwilioOpenaiEnabled || formData.telephonyProvider === "twilio_openai") && (
            <SelectableCard
              selected={formData.telephonyProvider === "twilio_openai"}
              onClick={() => setProvider("twilio_openai")}
              testId="card-provider-twilio-openai"
            >
              <div className="pr-6">
                <h3 className="font-semibold text-slate-900 text-sm">OpenAI + Twilio</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Real-time AI, international SIP routing
                </p>
              </div>
            </SelectableCard>
          )}

          {(isPlivoEnabled || formData.telephonyProvider === "plivo") && (
            <SelectableCard
              selected={formData.telephonyProvider === "plivo"}
              onClick={() => setProvider("plivo")}
              testId="card-provider-plivo"
            >
              <div className="pr-6">
                <h3 className="font-semibold text-slate-900 text-sm">OpenAI + Plivo</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Real-time AI, optimized for domestic & India numbers
                </p>
              </div>
            </SelectableCard>
          )}

          {formData.telephonyProvider === "elevenlabs-sip" && (
            <SelectableCard selected onClick={() => setProvider("elevenlabs-sip")} testId="card-provider-elevenlabs-sip">
              <div className="pr-6">
                <h3 className="font-semibold text-slate-900 text-sm">ElevenLabs SIP</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Native SIP trunk with ElevenLabs voice</p>
              </div>
            </SelectableCard>
          )}

          {formData.telephonyProvider === "openai-sip" && (
            <SelectableCard selected onClick={() => setProvider("openai-sip")} testId="card-provider-openai-sip">
              <div className="pr-6">
                <h3 className="font-semibold text-slate-900 text-sm">OpenAI SIP</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">OpenAI Realtime over your SIP trunk</p>
              </div>
            </SelectableCard>
          )}

          {formData.telephonyProvider === "custom-voice-engine" && (
            <SelectableCard selected onClick={() => setProvider("custom-voice-engine")} testId="card-provider-cve">
              <div className="pr-6">
                <h3 className="font-semibold text-slate-900 text-sm">Custom Voice Engine</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Self-hosted speech pipeline</p>
              </div>
            </SelectableCard>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5 space-y-2">
            <Label>
              Voice Profile <span className="text-red-500">*</span>
            </Label>
            {isCustomEngine ? (
              <Input
                value={formData.openaiVoice}
                onChange={(e) => update("openaiVoice", e.target.value)}
                placeholder="aura-asteria-en"
                className="h-11"
                data-testid="input-cve-voice"
              />
            ) : isOpenAIEngine ? (
              <Select value={formData.openaiVoice} onValueChange={(v) => update("openaiVoice", v)}>
                <SelectTrigger className="h-11" data-testid="select-openai-voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {openaiVoices.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label} — {voice.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <VoiceSearchPicker
                value={formData.elevenLabsVoiceId}
                onChange={(voiceId) => update("elevenLabsVoiceId", voiceId)}
                placeholder="Bella - Professional, Bright, Warm"
              />
            )}
          </div>

          <div className="lg:col-span-3">
            {isCustomEngine ? null : isOpenAIEngine ? (
              <OpenAIVoicePreviewButton
                voiceId={formData.openaiVoice}
                voiceName={openaiVoices.find((v) => v.value === formData.openaiVoice)?.label}
                language={formData.language}
              />
            ) : (
              <VoicePreviewButton
                voiceId={formData.elevenLabsVoiceId}
                voiceSettings={{
                  stability: formData.voiceStability,
                  similarity_boost: formData.voiceSimilarityBoost,
                  speed: formData.voiceSpeed,
                }}
                language={formData.language}
              />
            )}
          </div>

          <div className="lg:col-span-4 space-y-2">
            <Label>
              Language & Accent <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.language} onValueChange={(v) => update("language", v)}>
              <SelectTrigger className="h-11" data-testid="select-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.filter((lang) =>
                  langProviders.some((p) => isProviderSupported(lang.value, p)),
                ).map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <LanguageOptionLabel label={lang.label} providers={[...langProviders]} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* 4. AI Model & Voice Tuning */}
      <SectionCard>
        <SectionHeader
          icon={Settings2}
          title="AI Model & Voice Tuning"
          subtitle="Balance reasoning intelligence, latency envelopes, and acoustic behavior"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label>
                  LLM Model <span className="text-red-500">*</span>
                </Label>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-[11px]">
                  Free Tier Included
                </Badge>
              </div>
              <Select value={formData.llmModel} onValueChange={(v) => update("llmModel", v)}>
                <SelectTrigger className="h-11" data-testid="select-llm-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLLMModels.length === 0 ? (
                    <>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini (OpenAI)</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o (OpenAI)</SelectItem>
                    </>
                  ) : (
                    availableLLMModels.map((model) => (
                      <SelectItem key={model.id} value={model.modelId}>
                        <span className="flex items-center gap-2">
                          {model.name}
                          {model.tier === "free" ? (
                            <span className="text-[10px] text-emerald-600">Free</span>
                          ) : (
                            <span className="text-[10px] text-violet-600">Pro</span>
                          )}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Temperature</Label>
                <span className="text-sm font-medium text-slate-700">{formData.temperature.toFixed(1)}</span>
              </div>
              <Slider
                min={0}
                max={isOpenAIEngine ? 2 : 1}
                step={0.1}
                value={[formData.temperature]}
                onValueChange={(v) => update("temperature", v[0])}
                data-testid="slider-temperature"
                {...BLUE_SLIDER}
              />
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Deterministic (0.2)", value: 0.2 },
                  { label: "Creative (0.5)", value: 0.5 },
                  { label: "More Creative (0.8)", value: 0.8 },
                ].map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => update("temperature", preset.value)}
                    className={cn(
                      "rounded-md",
                      Math.abs(formData.temperature - preset.value) < 0.05 &&
                        "border-[#2F6BFF] text-[#2F6BFF] bg-[#2F6BFF]/5",
                    )}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {!isOpenAIEngine && !isCustomEngine && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Stability</Label>
                  <span className="text-sm text-slate-600">{Math.round(formData.voiceStability * 100)}%</span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[formData.voiceStability]}
                  onValueChange={(v) => update("voiceStability", v[0])}
                  {...BLUE_SLIDER}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Similarity Boost</Label>
                  <span className="text-sm text-slate-600">
                    {Math.round(formData.voiceSimilarityBoost * 100)}%
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[formData.voiceSimilarityBoost]}
                  onValueChange={(v) => update("voiceSimilarityBoost", v[0])}
                  {...BLUE_SLIDER}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Speech Speed</Label>
                  <span className="text-sm text-slate-600">{formData.voiceSpeed.toFixed(2)}x</span>
                </div>
                <Slider
                  min={0.7}
                  max={1.2}
                  step={0.01}
                  value={[formData.voiceSpeed]}
                  onValueChange={(v) => update("voiceSpeed", v[0])}
                  {...BLUE_SLIDER}
                />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* 5. Templates + Prompt + Tools */}
      <SectionCard>
        <SectionHeader
          icon={BookOpen}
          title="Start from a Pre-built Template (Optional)"
          subtitle="Apply a validated agent prompt, voice calibration, and variables."
        />
        <PromptTemplatesLibrary
          onSelectTemplate={(template) => {
            setFormData((prev) => ({
              ...prev,
              systemPrompt: template.systemPrompt,
              firstMessage: template.firstMessage || prev.firstMessage,
              voiceTone: template.suggestedVoiceTone || prev.voiceTone,
              personality: template.suggestedPersonality || prev.personality,
            }));
          }}
        />

        <div className="mt-8 space-y-5 border-t border-slate-100 pt-6">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <Label htmlFor="system-prompt">
                System Instructions / Core Prompt <span className="text-red-500">*</span>
              </Label>
              <span className="text-xs text-slate-500">
                Supports dynamic variables: {"{{company_name}}"}, {"{{customer_name}}"}
              </span>
            </div>
            <Textarea
              id="system-prompt"
              rows={5}
              value={formData.systemPrompt}
              onChange={(e) => update("systemPrompt", e.target.value)}
              placeholder="You are a customer service representative for {{company_name}}. Your priority is to assist callers..."
              className="min-h-[120px]"
              data-testid="input-system-prompt"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="first-message">First message</Label>
            <Textarea
              id="first-message"
              rows={2}
              value={formData.firstMessage}
              onChange={(e) => update("firstMessage", e.target.value)}
              data-testid="input-first-message"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Knowledge Base (Optional)</Label>
              <InfoTooltip content="Select documents this agent can use during calls." />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 max-h-48 overflow-y-auto space-y-1">
              {knowledgeBase.length === 0 ? (
                <p className="text-sm text-slate-500 px-1 py-2">No knowledge base items yet.</p>
              ) : (
                knowledgeBase.map((kb) => (
                  <label
                    key={kb.id}
                    className="flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-2 hover:bg-white"
                  >
                    <Checkbox
                      checked={formData.knowledgeBaseIds.includes(kb.id)}
                      onCheckedChange={(checked) => {
                        setFormData((prev) => ({
                          ...prev,
                          knowledgeBaseIds: checked
                            ? [...prev.knowledgeBaseIds, kb.id]
                            : prev.knowledgeBaseIds.filter((id) => id !== kb.id),
                        }));
                      }}
                    />
                    <span className="text-sm text-slate-700 truncate">{kb.title}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-slate-500">Select knowledge base documents to train this agent</p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <Wrench className="h-4 w-4 text-rose-600" />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-sm font-semibold text-slate-900">System Tools</Label>
                <InfoTooltip content="Enable built-in capabilities the agent can use during calls." />
              </div>
            </div>

            {[
              {
                key: "transferEnabled" as const,
                title: "Enable Call Transfer",
                desc: "Agent can transfer calls to human operators when requested.",
              },
              {
                key: "detectLanguageEnabled" as const,
                title: "Enable Language Detection",
                desc: "Automatically detect and respond in caller's language (89 languages).",
              },
              {
                key: "endConversationEnabled" as const,
                title: "Enable End Conversation",
                desc: "Let agent intelligently end conversation when appropriate.",
              },
              {
                key: "appointmentBookingEnabled" as const,
                title: "Enable Appointment Booking",
                desc: "Let agent book appointments during calls.",
              },
            ].map((tool) => (
              <label key={tool.key} className="flex items-start gap-3 cursor-pointer py-1">
                <Checkbox
                  className="mt-0.5"
                  checked={formData[tool.key]}
                  onCheckedChange={(checked) => update(tool.key, checked as boolean)}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{tool.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{tool.desc}</p>
                </div>
              </label>
            ))}

            {formData.transferEnabled && (
              <div className="pl-7 space-y-2">
                <Label>Transfer Phone Number</Label>
                <Input
                  placeholder="+15551234567"
                  value={formData.transferPhoneNumber}
                  onChange={(e) => update("transferPhoneNumber", e.target.value)}
                  className="h-11 max-w-sm"
                />
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 px-6"
          onClick={() => setLocation("/agents")}
          data-testid="button-cancel-create-agent"
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-11 px-6 bg-[#2F6BFF] hover:bg-[#2558d9] text-white border-transparent gap-2"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid={isEdit ? "button-save-agent" : "button-submit-create-agent"}
        >
          <Bot className="h-4 w-4" />
          {saveMutation.isPending ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Agent" : "Create Agent"}
        </Button>
      </div>

      {isCustomVoiceEngineEnabled && (
        <p className="text-xs text-slate-400 text-center">
          Custom Voice Engine agents can still be created from the Guided Wizard on the Agents page.
        </p>
      )}
    </div>
  );
}
