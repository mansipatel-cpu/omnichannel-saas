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
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Plus, Search, Trash2, Edit, Bot, Sparkles, GitBranch, Mic, Video, Play, FlaskConical, ArrowUpDown, Wand2 } from "lucide-react";
import { useDemoMode } from "@/components/DemoModeBanner";
import AgentVersionHistory from "@/components/AgentVersionHistory";
import { useToast } from "@/hooks/use-toast";
import { useAppHeaderOptional } from "@/components/AppPageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AgentCreationWizard from "@/components/AgentCreationWizard";
import { getLanguageLabel } from "@/lib/languages";
import { usePluginStatus } from "@/hooks/use-plugin-status";

interface Agent {
  id: string;
  type: 'incoming' | 'flow' | 'custom_engine';
  name: string;
  voiceTone: string;
  personality: string;
  systemPrompt: string;
  elevenLabsAgentId: string | null;
  elevenLabsVoiceId: string | null;
  agentLink: string | null;
  language: string | null;
  llmModel: string | null;
  firstMessage: string | null;
  temperature: number | null;
  knowledgeBaseIds: string[] | null;
  config: any;
  flowId: string | null;
  maxDurationSeconds: number | null;
  voiceStability: number | null;
  voiceSimilarityBoost: number | null;
  voiceSpeed: number | null;
  turnTimeout: number | null;
  transferEnabled: boolean | null;
  transferPhoneNumber: string | null;
  detectLanguageEnabled: boolean | null;
  endConversationEnabled: boolean | null;
  appointmentBookingEnabled: boolean | null;
  expressiveMode: boolean | null;
  telephonyProvider: 'twilio' | 'plivo' | 'twilio_openai' | 'elevenlabs-sip' | 'openai-sip' | 'custom-voice-engine' | null;
  openaiVoice: string | null;
  createdAt: string;
}

// OpenAI Realtime API voice options (for Plivo+OpenAI and Twilio+OpenAI engines)
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

const customVoiceEngineVoices = [
  // Deepgram
  { value: "aura-asteria-en", label: "Asteria (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-luna-en", label: "Luna (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-stella-en", label: "Stella (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-athena-en", label: "Athena (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-hera-en", label: "Hera (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-orion-en", label: "Orion (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-arcas-en", label: "Arcas (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-perseus-en", label: "Perseus (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-angus-en", label: "Angus (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-orpheus-en", label: "Orpheus (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-helios-en", label: "Helios (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-zeus-en", label: "Zeus (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-2-asteria-en", label: "Asteria Aura-2 (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-2-luna-en", label: "Luna Aura-2 (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-2-stella-en", label: "Stella Aura-2 (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-2-athena-en", label: "Athena Aura-2 (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-2-hera-en", label: "Hera Aura-2 (Deepgram)", description: "English - Female", provider: "deepgram" as const },
  { value: "aura-2-orion-en", label: "Orion Aura-2 (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-2-arcas-en", label: "Arcas Aura-2 (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-2-perseus-en", label: "Perseus Aura-2 (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-2-angus-en", label: "Angus Aura-2 (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-2-orpheus-en", label: "Orpheus Aura-2 (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-2-helios-en", label: "Helios Aura-2 (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-2-zeus-en", label: "Zeus Aura-2 (Deepgram)", description: "English - Male", provider: "deepgram" as const },
  { value: "aura-2-amira-de", label: "Amira (Deepgram)", description: "German - Female", provider: "deepgram" as const },
  { value: "aura-2-lukas-de", label: "Lukas (Deepgram)", description: "German - Male", provider: "deepgram" as const },
  { value: "aura-2-rhea-nl", label: "Rhea (Deepgram)", description: "Dutch - Female", provider: "deepgram" as const },
  { value: "aura-2-nils-nl", label: "Nils (Deepgram)", description: "Dutch - Male", provider: "deepgram" as const },
  { value: "aura-2-chloe-fr", label: "Chloe (Deepgram)", description: "French - Female", provider: "deepgram" as const },
  { value: "aura-2-nicolas-fr", label: "Nicolas (Deepgram)", description: "French - Male", provider: "deepgram" as const },
  { value: "aura-2-bianca-it", label: "Bianca (Deepgram)", description: "Italian - Female", provider: "deepgram" as const },
  { value: "aura-2-giulio-it", label: "Giulio (Deepgram)", description: "Italian - Male", provider: "deepgram" as const },
  { value: "aura-2-akira-ja", label: "Akira (Deepgram)", description: "Japanese - Female", provider: "deepgram" as const },
  { value: "aura-2-hikari-ja", label: "Hikari (Deepgram)", description: "Japanese - Male", provider: "deepgram" as const },
  { value: "aura-2-carmen-es", label: "Carmen (Deepgram)", description: "Spanish - Female", provider: "deepgram" as const },
  { value: "aura-2-miguel-es", label: "Miguel (Deepgram)", description: "Spanish - Male", provider: "deepgram" as const },
  // Sarvam — Bulbul v3 (30+ speakers, model: "bulbul:v3")
  // Per-language recommended speakers from Sarvam API docs
  { value: "shubh", label: "Shubh (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["en", "hi", "te", "kn", "od", "ml"] },
  { value: "aditya", label: "Aditya (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "rahul", label: "Rahul (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "rohan", label: "Rohan (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["ta"] },
  { value: "amit", label: "Amit (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "dev", label: "Dev (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "ratan", label: "Ratan (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["en", "te", "kn", "ta", "mr", "gu"] },
  { value: "varun", label: "Varun (Sarvam)", description: "Male — dramatic/suspense", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "manan", label: "Manan (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "sumit", label: "Sumit (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "kabir", label: "Kabir (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "aayan", label: "Aayan (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "ashutosh", label: "Ashutosh (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["hi"] },
  { value: "advait", label: "Advait (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "anand", label: "Anand (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "tarun", label: "Tarun (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "sunny", label: "Sunny (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "mani", label: "Mani (Sarvam)", description: "Male — best overall CER", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["pa"] },
  { value: "gokul", label: "Gokul (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "vijay", label: "Vijay (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "mohit", label: "Mohit (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "rehan", label: "Rehan (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["bn"] },
  { value: "soham", label: "Soham (Sarvam)", description: "Male", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "priya", label: "Priya (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["hi", "te", "mr", "gu"] },
  { value: "neha", label: "Neha (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["te", "kn"] },
  { value: "ritu", label: "Ritu (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["ta", "od", "mr", "gu"] },
  { value: "pooja", label: "Pooja (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["od", "ml"] },
  { value: "simran", label: "Simran (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "kavya", label: "Kavya (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "ishita", label: "Ishita (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["en", "kn", "ta"] },
  { value: "shreya", label: "Shreya (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "roopa", label: "Roopa (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["bn", "pa"] },
  { value: "tanya", label: "Tanya (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "shruti", label: "Shruti (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "suhani", label: "Suhani (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const, languages: ["hi", "bn", "pa"] },
  { value: "kavitha", label: "Kavitha (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const },
  { value: "rupali", label: "Rupali (Sarvam)", description: "Female", provider: "sarvam" as const, model: "bulbul:v3" as const },
  // Sarvam — Bulbul v2 (7 speakers, model: "bulbul:v2")
  { value: "anushka", label: "Anushka (Sarvam)", description: "Female — default v2", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "manisha", label: "Manisha (Sarvam)", description: "Female — warm", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "vidya", label: "Vidya (Sarvam)", description: "Female — articulate", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "arya", label: "Arya (Sarvam)", description: "Female — energetic", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "abhilash", label: "Abhilash (Sarvam)", description: "Male — authoritative", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "karun", label: "Karun (Sarvam)", description: "Male — conversational", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "hitesh", label: "Hitesh (Sarvam)", description: "Male — professional", provider: "sarvam" as const, model: "bulbul:v2" as const },
];

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

interface KnowledgeBaseItem {
  id: string;
  type: string;
  title: string;
  content?: string;
  url?: string;
  fileUrl?: string;
  elevenLabsDocId: string | null;
  storageSize: number;
  createdAt: string;
}

// LLM cost estimates per minute (in USD)
const MODEL_COSTS: Record<string, { llm: number; name: string; speed: string }> = {
  // ElevenLabs Models
  "glm-45-air-fp8": { llm: 0.0106, name: "GLM-4.5-Air", speed: "Balanced" },
  "qwen3-30b-a3b": { llm: 0.0033, name: "Qwen3-30B-A3B", speed: "Ultra Fast" },
  "gpt-oss-120b": { llm: 0.02, name: "GPT-OSS-120B", speed: "High Quality" },

  // Google Models
  "gemini-2.5-flash": { llm: 0.005, name: "Gemini 2.5 Flash", speed: "Very Fast" },
  "gemini-2.5-flash-lite": { llm: 0.003, name: "Gemini 2.5 Flash Lite", speed: "Ultra Fast" },
  "gemini-2.0-flash": { llm: 0.004, name: "Gemini 2.0 Flash", speed: "Very Fast" },
  "gemini-2.0-flash-lite": { llm: 0.002, name: "Gemini 2.0 Flash Lite", speed: "Ultra Fast" },

  // OpenAI Models
  "gpt-4o": { llm: 0.02, name: "GPT-4o", speed: "Balanced" },
  "gpt-4o-mini": { llm: 0.006, name: "GPT-4o Mini", speed: "Fast" },
  "gpt-4-turbo": { llm: 0.04, name: "GPT-4 Turbo", speed: "High Quality" },
  "gpt-3.5-turbo": { llm: 0.003, name: "GPT-3.5 Turbo", speed: "Very Fast" },

  // Anthropic Models
  "claude-3-5-sonnet": { llm: 0.06, name: "Claude 3.5 Sonnet", speed: "High Quality" },
  "claude-3-haiku": { llm: 0.01, name: "Claude 3 Haiku", speed: "Fast" },
};

const VOICE_COST = 0.10; // $0.10 per minute for voice service

const CVE_STT_COSTS: Record<string, number> = {
  "deepgram": 0.0125,
  "nova-2": 0.0125,
  "nova-3": 0.015,
  "nova-2-medical": 0.03,
  "sarvam": 0.02,
  "saaras:v3": 0.02,
};

const CVE_TTS_COSTS: Record<string, number> = {
  "deepgram": 0.015,
  "aura": 0.015,
  "aura-2": 0.02,
  "sarvam": 0.03,
  "bulbul:v3": 0.03,
};

const CVE_LLM_COSTS: Record<string, number> = {
  "gemini-2.5-flash-lite": 0.002,
  "gemini-2.0-flash-lite": 0.002,
  "gemini-2.0-flash-exp": 0.004,
  "gemini-2.0-flash": 0.004,
  "gemini-2.5-flash": 0.005,
  "gemini-3.5-flash": 0.006,
  "gemini-3.6-flash": 0.007,
  "gemini-2.5-pro": 0.02,
  "gemini-2.0-pro": 0.02,
  "openai/gpt-4o-mini": 0.006,
  "openai/gpt-4o": 0.02,
  "google/gemini-flash-1.5": 0.005,
  "google/gemini-pro-1.5": 0.02,
  "anthropic/claude-3.5-sonnet": 0.06,
  "gpt-4o-mini": 0.006,
  "gpt-4o": 0.02,
  "gpt-4-turbo": 0.04,
  "claude-3-5-sonnet": 0.06,
};

function CVEEstimatedCost({
  sttProvider,
  sttModel,
  ttsProvider,
  ttsModel,
  llmModel,
}: {
  sttProvider: string;
  sttModel: string;
  ttsProvider: string;
  ttsModel: string;
  llmModel: string;
}) {
  const sttKey = sttModel || sttProvider || "deepgram";
  const sttCost = CVE_STT_COSTS[sttKey] || CVE_STT_COSTS[sttProvider] || 0.0125;

  let ttsKey = ttsModel || ttsProvider || "deepgram";
  if (ttsKey === "aura-2" || ttsKey.startsWith("aura-2-")) {
    ttsKey = "aura-2";
  } else if (ttsKey === "aura" || ttsKey.startsWith("aura-")) {
    ttsKey = "aura";
  }
  const ttsCost = CVE_TTS_COSTS[ttsKey] || CVE_TTS_COSTS[ttsProvider] || 0.015;

  let llmCost = CVE_LLM_COSTS[llmModel];
  if (llmCost === undefined) {
    const lowerModel = (llmModel || "").toLowerCase();
    if (lowerModel.includes("mini") || lowerModel.includes("lite") || lowerModel.includes("flash")) {
      llmCost = 0.005;
    } else if (lowerModel.includes("pro") || lowerModel.includes("sonnet") || lowerModel.includes("4o") || lowerModel.includes("turbo")) {
      llmCost = 0.025;
    } else {
      llmCost = 0.015;
    }
  }

  const totalCost = sttCost + ttsCost + llmCost;
  const inrRate = 95;
  const toInr = (usd: number) => usd * inrRate;

  return (
    <div className="mt-4 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-transparent dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-transparent text-xs shadow-sm">
      <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300 mb-2.5">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Custom Voice Engine - Cost Breakdown Estimate</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <span>STT ({sttKey})</span>
          </span>
          <span className="font-mono font-medium text-right">
            <span>${sttCost.toFixed(4)}/min</span>
            <span className="text-[10px] text-muted-foreground ml-1.5">(₹{toInr(sttCost).toFixed(2)}/min)</span>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <span>TTS ({ttsKey})</span>
          </span>
          <span className="font-mono font-medium text-right">
            <span>${ttsCost.toFixed(4)}/min</span>
            <span className="text-[10px] text-muted-foreground ml-1.5">(₹{toInr(ttsCost).toFixed(2)}/min)</span>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <span>LLM Response ({(llmModel || "").split("/").pop()})</span>
          </span>
          <span className="font-mono font-medium text-right">
            <span>${llmCost.toFixed(4)}/min</span>
            <span className="text-[10px] text-muted-foreground ml-1.5">(₹{toInr(llmCost).toFixed(2)}/min)</span>
          </span>
        </div>
        <div className="h-px bg-indigo-100/50 dark:bg-indigo-950/50 my-2" />
        <div className="flex justify-between items-center text-sm font-semibold">
          <span className="text-indigo-900 dark:text-indigo-200">Total Rough Price</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-mono text-right">
            <span>${totalCost.toFixed(4)}/min</span>
            <span className="text-xs text-muted-foreground font-normal ml-2">(₹{toInr(totalCost).toFixed(2)}/min)</span>
          </span>
        </div>
      </div>
    </div>
  );
}


export default function Agents() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isDemoMode } = useDemoMode();
  const appHeader = useAppHeaderOptional();
  const setPageMeta = appHeader?.setPageMeta;

  useEffect(() => {
    if (!setPageMeta) return;
    setPageMeta({ hideTitle: true });
    return () => setPageMeta(null);
  }, [setPageMeta]);

  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<'all' | 'incoming' | 'flow' | 'cve'>('all');
  const [engineFilter, setEngineFilter] = useState<'all' | 'twilio' | 'plivo' | 'twilio_openai' | 'elevenlabs-sip' | 'openai-sip'>('all');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    type: "incoming" as 'incoming' | 'flow' | 'custom_engine',
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
    // System Tools configuration
    transferEnabled: false,
    transferPhoneNumber: "",
    detectLanguageEnabled: false,
    endConversationEnabled: false,
    appointmentBookingEnabled: false,
    messagingEmailEnabled: false,
    messagingWhatsappEnabled: false,
    messagingEmailTemplate: "",
    messagingWhatsappTemplate: "",
    messagingWhatsappVariables: "",
    expressiveMode: false,
    // Flow Agent specific fields
    flowId: "",
    maxDurationSeconds: 600,
    voiceStability: 0.5,
    voiceSimilarityBoost: 0.85,
    voiceSpeed: 1.0,
    turnTimeout: 1.5,
    // Telephony Provider selection (Twilio/ElevenLabs, Plivo/OpenAI, Twilio/OpenAI, or SIP engines)
    telephonyProvider: "twilio" as "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip" | "custom-voice-engine",
    openaiVoice: "aura-asteria-en",
    sttProvider: "deepgram",
    sttModel: "",
    ttsProvider: "deepgram",
    ttsModel: "",
  });

  // Animation state for success/failure feedback
  const [animationState, setAnimationState] = useState<'idle' | 'success' | 'error'>('idle');

  // Check if SIP plugin is enabled and which engines are allowed
  const { isSipPluginEnabled, sipEnginesAllowed, isCustomVoiceEngineEnabled } = usePluginStatus();
  const isElevenLabsSipAllowed = isSipPluginEnabled && sipEnginesAllowed.includes("elevenlabs-sip");
  const isOpenAISipAllowed = isSipPluginEnabled && sipEnginesAllowed.includes("openai-sip");

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });
  const combinedAgents = agents;
  const combinedLoading = agentsLoading;

  const { data: voices = [] } = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
  });

  // Voice lookup helper - only uses account voices
  const getVoiceName = useMemo(() => {
    const voiceMap = new Map(voices.map(v => [v.voice_id, v.name]));
    return (voiceId: string | null): string | null => {
      if (!voiceId) return null;
      return voiceMap.get(voiceId) || null;
    };
  }, [voices]);

  const { data: knowledgeBase = [] } = useQuery<KnowledgeBaseItem[]>({
    queryKey: ["/api/knowledge-base"],
  });

  // Fetch available LLM models for current user (filtered by plan tier)
  const { data: availableLLMModels = [] } = useQuery<Array<{
    id: string;
    modelId: string;
    name: string;
    provider: string;
    tier: 'free' | 'pro';
    isActive: boolean;
  }>>({
    queryKey: ["/api/llm-models/available"],
  });

  const { data: flows = [] } = useQuery<Array<{ id: string; name: string; description: string }>>({
    queryKey: ["/api/flow-automation/flows"],
  });

  // Fetch voice engine settings to check if Plivo+OpenAI or Twilio+OpenAI is enabled
  const { data: voiceEngineSettings } = useQuery<{ plivo_openai_engine_enabled: boolean; twilio_openai_engine_enabled: boolean; default_tts_model?: string }>({
    queryKey: ["/api/settings/voice-engine"],
    staleTime: 60000,
  });

  const isPlivoEnabled = voiceEngineSettings?.plivo_openai_engine_enabled ?? false;
  const isTwilioOpenaiEnabled = voiceEngineSettings?.twilio_openai_engine_enabled ?? false;
  const isV3TtsModel = (voiceEngineSettings?.default_tts_model || '').includes('v3');

  // Fetch CVE admin settings for active TTS provider and OpenRouter models
  const { data: cveSettings } = useQuery<{ success: boolean; data: { stt: { activeProvider: string, allowedProviders?: string[], deepgramAllowedModels?: string[], sarvamAllowedModels?: string[] }, tts: { activeProvider: string, allowedProviders?: string[], deepgramAllowedModels?: string[], sarvamAllowedModels?: string[] }; llm: { activeProvider?: string; defaultModel: string; allowedModels?: string[] } } }>({
    queryKey: ["/api/voice-engine/admin/provider-keys"],
    staleTime: 30000,
    enabled: isCustomVoiceEngineEnabled,
  });
  const activeTtsProvider = cveSettings?.data?.tts?.activeProvider || "deepgram";
  const activeSttProvider = cveSettings?.data?.stt?.activeProvider || "deepgram";
  const allowedTtsProviders = cveSettings?.data?.tts?.allowedProviders || [activeTtsProvider];
  const allowedSttProviders = cveSettings?.data?.stt?.allowedProviders || [activeSttProvider];

  const currentSttAllowedModels = formData.sttProvider === 'deepgram'
    ? (cveSettings?.data?.stt?.deepgramAllowedModels || ['nova-2', 'nova-2-phonecall'])
    : (cveSettings?.data?.stt?.sarvamAllowedModels || ['saaras:v3']);

  const sarvamSupportedLanguages = ['en', 'hi', 'bn', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'or', 'od'];

  const rawDeepgramAllowed = cveSettings?.data?.tts?.deepgramAllowedModels || ['aura-2', 'aura'];
  const mappedDeepgramAllowed = Array.from(new Set(rawDeepgramAllowed.map(m => m.startsWith('aura-2') ? 'aura-2' : 'aura')));

  const currentTtsAllowedModels = (formData.ttsProvider === 'deepgram'
    ? mappedDeepgramAllowed
    : (cveSettings?.data?.tts?.sarvamAllowedModels || ['bulbul:v3', 'bulbul:v2']))
    .filter(m => {
      if (!formData.language) return true;
      if (formData.ttsProvider === 'deepgram') {
        if (formData.language.toLowerCase() !== 'en') {
          return m === 'aura-2';
        }
        return true;
      }
      if (formData.ttsProvider === 'sarvam') {
        return sarvamSupportedLanguages.includes(formData.language.toLowerCase());
      }
      return true;
    });

  const { data: orModelsData, isLoading: isOrModelsLoading } = useQuery<{
    success: boolean;
    data: { id: string; name: string; context_length: number }[];
  }>({
    queryKey: ["/api/voice-engine/admin/provider-keys/openrouter-models"],
    staleTime: 5 * 60 * 1000,
    enabled: isCustomVoiceEngineEnabled,
  });
  const allOrModels = orModelsData?.data ?? [];
  const allowedModels = cveSettings?.data?.llm?.allowedModels || [];
  const orModels = allowedModels.length > 0
    ? allOrModels.filter(m => allowedModels.includes(m.id))
    : allOrModels;

  const [orSearch, setOrSearch] = useState("");



  const hasAlternateEngines = isPlivoEnabled || isTwilioOpenaiEnabled || isElevenLabsSipAllowed || isOpenAISipAllowed || isCustomVoiceEngineEnabled;

  const { data: emailTemplatesResponse } = useQuery<{ success: boolean; data: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/messaging/email-templates"],
    staleTime: 60000,
  });
  const emailTemplates = emailTemplatesResponse?.data || [];
  const hasEmailTemplates = emailTemplates.length > 0;

  const { data: whatswaySettingsResponse } = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/messaging/whatsway/settings"],
    staleTime: 60000,
  });
  const { data: metaWhatsAppSettingsResponse } = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/messaging/meta-whatsapp/settings"],
    staleTime: 60000,
  });
  const isWhatsAppActive = !!(whatswaySettingsResponse?.data?.isActive || metaWhatsAppSettingsResponse?.data?.isActive);

  const { data: whatswayTemplatesResponse } = useQuery<{ success: boolean; data: Array<{ name: string; id?: string; components?: any[] }> }>({
    queryKey: ["/api/messaging/whatsway/templates"],
    enabled: !!(whatswaySettingsResponse?.data?.isActive),
    staleTime: 60000,
  });
  const { data: metaTemplatesResponse } = useQuery<{ success: boolean; data: Array<{ name: string; id?: string; components?: any[] }> }>({
    queryKey: ["/api/messaging/meta-whatsapp/templates"],
    enabled: !!(metaWhatsAppSettingsResponse?.data?.isActive),
    staleTime: 60000,
  });
  const whatsappTemplates = whatswayTemplatesResponse?.data || metaTemplatesResponse?.data || [];

  const getWhatsAppTemplateVariables = (templateName: string): number[] => {
    const template = whatsappTemplates.find(t => t.name === templateName);
    if (!template?.components) return [];
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    if (!bodyComponent?.text) return [];
    const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((m: string) => parseInt(m.replace(/[{}]/g, '')));
  };

  const getWhatsAppTemplateHeaderInfo = (templateName: string): { format: string; hasVariable: boolean; text?: string } | null => {
    const template = whatsappTemplates.find(t => t.name === templateName);
    if (!template?.components) return null;
    const headerComp = template.components.find((c: any) => c.type === 'HEADER');
    if (!headerComp) return null;
    const format = (headerComp.format || '').toUpperCase();
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
      return { format, hasVariable: true, text: headerComp.text };
    }
    if (format === 'TEXT' && headerComp.text) {
      const matches = headerComp.text.match(/\{\{\d+\}\}/g) || [];
      if (matches.length > 0) return { format, hasVariable: true, text: headerComp.text };
    }
    return null;
  };

  const getWhatsAppTemplateButtonVariables = (templateName: string): Array<{ index: number; label: string; url: string }> => {
    const template = whatsappTemplates.find(t => t.name === templateName);
    if (!template?.components) return [];
    const buttonsComponent = template.components.find((c: any) => c.type === 'BUTTONS' || c.type === 'buttons');
    if (!buttonsComponent?.buttons || !Array.isArray(buttonsComponent.buttons)) return [];
    const result: Array<{ index: number; label: string; url: string }> = [];
    buttonsComponent.buttons.forEach((btn: any, index: number) => {
      if (btn.type === 'URL' && btn.url && btn.url.includes('{{')) {
        result.push({ index, label: btn.text || `Button ${index + 1}`, url: btn.url });
      }
    });
    return result;
  };

  const parseWhatsAppVariables = (varsJson: string): Record<string, { mode: 'fixed' | 'collect'; value: string; componentType?: string }> => {
    try {
      if (!varsJson) return {};
      const parsed = JSON.parse(varsJson);
      const result: Record<string, { mode: 'fixed' | 'collect'; value: string; componentType?: string }> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'string') {
          result[key] = { mode: 'collect', value: val };
        } else if (val && typeof val === 'object' && 'mode' in (val as any)) {
          result[key] = val as { mode: 'fixed' | 'collect'; value: string; componentType?: string };
        }
      }
      return result;
    } catch {
      return {};
    }
  };

  // Fetch OpenAI Realtime models (for Plivo+OpenAI or Twilio+OpenAI engine)
  const { data: openaiModelsData } = useQuery<{
    tier: 'free' | 'pro';
    models: string[];
    description: string;
    allTiers: Record<string, { models: string[]; description: string }>;
  }>({
    queryKey: ["/api/plivo/openai/models"],
    enabled: isPlivoEnabled || isTwilioOpenaiEnabled || formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai",
    staleTime: 60000,
  });

  // OpenAI Realtime models with display info
  const openaiRealtimeModels = useMemo(() => {
    if (!openaiModelsData?.models) return [];

    const modelInfo: Record<string, { name: string; tier: 'free' | 'pro'; description: string }> = {
      'gpt-realtime-2': { name: 'GPT Realtime 2', tier: 'pro', description: 'Advanced GPT-5-class reasoning realtime voice model' },
      'gpt-realtime-translate': { name: 'GPT Realtime Translate', tier: 'pro', description: 'Live translation model from 70+ languages' },
      'gpt-realtime-whisper': { name: 'GPT Realtime Whisper', tier: 'pro', description: 'Streaming live speech-to-text transcription model' },
      'gpt-realtime-1.5': { name: 'GPT Realtime 1.5', tier: 'pro', description: 'The best voice model for audio in, audio out' },
      'gpt-realtime': { name: 'GPT Realtime', tier: 'pro', description: 'Realtime text and audio inputs and outputs' },
      'gpt-realtime-mini': { name: 'GPT Realtime Mini', tier: 'free', description: 'A cost-efficient version of GPT Realtime' },
      'gpt-4o-realtime-preview': { name: 'GPT-4o Realtime Preview', tier: 'pro', description: 'Preview model for projects without GA access' },
      'gpt-4o-mini-realtime-preview': { name: 'GPT-4o Mini Realtime Preview', tier: 'free', description: 'Preview mini model for projects without GA access' },
    };

    return openaiModelsData.models.map(modelId => {
      const info = modelInfo[modelId] || { name: modelId, tier: 'free' as const, description: 'OpenAI Realtime model' };
      return {
        id: modelId,
        modelId,
        name: info.name,
        tier: info.tier,
        description: info.description,
      };
    });
  }, [openaiModelsData]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const isCve = editingAgent?.telephonyProvider === "custom-voice-engine";
      if (isCve) {
        const payload = {
          name: data.name,
          description: (editingAgent as any)?.description || "",
          systemPrompt: data.systemPrompt,
          firstMessage: data.firstMessage || "Hello! How can I help you today?",
          language: data.language || "en",
          llmModel: data.llmModel || "openai/gpt-4o-mini",
          temperature: data.temperature ?? 0.7,
          maxTokens: 500,
          ttsVoice: data.openaiVoice || "aura-asteria-en",
          ttsProvider: data.ttsProvider || "deepgram",
          sttProvider: data.sttProvider || "deepgram",
          sttModel: data.sttModel || "",
          ttsModel: data.ttsModel || "",
          interruptible: true,
          silenceTimeoutMs: 5000,
          maxDurationSeconds: data.maxDurationSeconds ?? 600,
          endCallOnSilence: false,
          businessRules: [],
          enableMemory: true,
          memoryRetentionDays: 90,
          isActive: true,
          detectLanguageEnabled: data.detectLanguageEnabled || false,
          knowledgeBaseIds: data.knowledgeBaseIds || [],
          appointmentBookingEnabled: data.appointmentBookingEnabled || false,
          endConversationEnabled: data.endConversationEnabled || false,
          transferEnabled: data.transferEnabled || false,
          transferPhoneNumber: data.transferPhoneNumber || "",
          messagingEmailEnabled: data.messagingEmailEnabled || false,
          messagingWhatsappEnabled: data.messagingWhatsappEnabled || false,
          messagingEmailTemplate: data.messagingEmailTemplate || "",
          messagingWhatsappTemplate: data.messagingWhatsappTemplate || "",
        };
        const res = await apiRequest("PUT", `/api/voice-engine/agents/${id}`, payload);
        return res.json();
      }
      const res = await apiRequest("PATCH", `/api/agents/${id}`, data);
      return res.json();
    },
    onSuccess: (data) => {
      // Trigger success animation
      setAnimationState('success');
      setTimeout(() => {
        setAnimationState('idle');
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/voice-engine/agents"] });
        setEditingAgent(null);
        resetForm();
      }, 1500);

      if (data.warning) {
        toast({
          title: t('agents.toast.updated'),
          description: data.warning,
        });
      } else {
        toast({ title: t('agents.toast.updated') });
      }
    },
    onError: (error: any) => {
      // Trigger error animation
      setAnimationState('error');
      setTimeout(() => setAnimationState('idle'), 600);
      toast({
        title: t('agents.toast.updateFailed'),
        description: error.message || t('agents.toast.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const isCve = deletingAgent?.telephonyProvider === "custom-voice-engine";
      const endpoint = isCve ? `/api/voice-engine/agents/${id}` : `/api/agents/${id}`;
      const res = await apiRequest("DELETE", endpoint);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-engine/agents"] });
      setDeletingAgent(null);
      toast({ title: t('agents.toast.deleted') });
    },
    onError: (error: any) => {
      toast({
        title: t('agents.toast.deleteFailed'),
        description: error.message || t('agents.toast.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      type: "incoming" as 'incoming' | 'flow' | 'custom_engine',
      name: "",
      voiceTone: "professional",
      personality: "helpful",
      systemPrompt: "",
      elevenLabsVoiceId: "",
      language: "en",
      llmModel: "gpt-4o-mini",
      firstMessage: "Hello! How can I help you today?",
      temperature: 0.5,
      knowledgeBaseIds: [],
      // System Tools configuration
      transferEnabled: false,
      transferPhoneNumber: "",
      detectLanguageEnabled: false,
      endConversationEnabled: false,
      appointmentBookingEnabled: false,
      messagingEmailEnabled: false,
      messagingWhatsappEnabled: false,
      messagingEmailTemplate: "",
      messagingWhatsappTemplate: "",
      messagingWhatsappVariables: "",
      expressiveMode: false,
      flowId: "",
      maxDurationSeconds: 600,
      voiceStability: 0.5,
      voiceSimilarityBoost: 0.85,
      voiceSpeed: 1.0,
      turnTimeout: 1.5,
      // Telephony Provider selection
      telephonyProvider: "twilio" as "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip" | "custom-voice-engine",
      openaiVoice: "alloy",
      sttProvider: "deepgram",
      sttModel: "",
      ttsProvider: "deepgram",
      ttsModel: "",
    });
  };

  const handleEdit = (agent: Agent) => {
    setLocation(`/agents/${agent.id}/edit`);
  };

  const handleUpdate = () => {
    if (!editingAgent) return;

    // Validate call transfer configuration for incoming agents
    if (formData.type === 'incoming' && formData.transferEnabled && !formData.transferPhoneNumber.trim()) {
      toast({
        title: t('agents.toast.missingTransferPhone'),
        description: t('agents.toast.transferPhoneRequired'),
        variant: "destructive",
      });
      return;
    }
    if (formData.type === 'incoming' && formData.messagingEmailEnabled && !formData.messagingEmailTemplate) {
      toast({
        title: t('agents.toast.missingFields'),
        description: "Please select an email template when email sending is enabled.",
        variant: "destructive",
      });
      return;
    }
    if (formData.type === 'incoming' && formData.messagingWhatsappEnabled && !formData.messagingWhatsappTemplate) {
      toast({
        title: t('agents.toast.missingFields'),
        description: "Please select a WhatsApp template when WhatsApp sending is enabled.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ id: editingAgent.id, data: formData });
  };

  const filteredAgents = combinedAgents
    .filter((agent) => {
      // Filter by type
      if (typeFilter === 'cve') {
        if (agent.telephonyProvider !== 'custom-voice-engine') {
          return false;
        }
      } else if (typeFilter === 'incoming') {
        if (agent.type !== 'incoming' || agent.telephonyProvider === 'custom-voice-engine') {
          return false;
        }
      } else if (typeFilter === 'flow') {
        if (agent.type !== 'flow' || agent.telephonyProvider === 'custom-voice-engine') {
          return false;
        }
      }
      // Filter by engine/telephony provider
      if (engineFilter !== 'all') {
        const agentProvider = agent.telephonyProvider || 'twilio';
        if (agentProvider !== engineFilter) {
          return false;
        }
      }
      // Filter by search query
      return agent.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

  // Pagination for agents grid
  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(filteredAgents, 9);

  const cveCount = combinedAgents.filter(a => a.telephonyProvider === 'custom-voice-engine').length;
  const incomingCount = combinedAgents.filter(a => a.type === 'incoming' && a.telephonyProvider !== 'custom-voice-engine').length;
  const flowCount = combinedAgents.filter(a => a.type === 'flow' && a.telephonyProvider !== 'custom-voice-engine').length;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 md:p-7">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-[#2F6BFF] flex items-center justify-center shadow-sm shrink-0">
                  <FlaskConical className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {t('agents.title', 'AI Agents')}
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {t('agents.description', 'Create and manage your conversational AI agents')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {isDemoMode && (
                  <Button
                    variant="outline"
                    onClick={() => setIsVideoOpen(true)}
                    className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium"
                    data-testid="button-watch-demo-agents"
                  >
                    <Video className="h-4 w-4 mr-2 text-[#2F6BFF]" />
                    <span>Watch Demo Video</span>
                  </Button>
                )}
                <Button
                  onClick={() => setWizardOpen(true)}
                  variant="outline"
                  className="bg-white border-[#2F6BFF]/40 text-[#2F6BFF] hover:bg-blue-50 hover:text-[#2F6BFF] font-medium"
                  data-testid="button-wizard-agent"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {t('agents.guidedWizard', 'Guided Wizard')}
                </Button>
                <Button
                  onClick={() => setLocation("/agents/new")}
                  className="bg-[#2F6BFF] hover:bg-[#1F5AEF] text-white border-transparent shadow-sm font-medium"
                  data-testid="button-create-agent"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('agents.createNew', 'New Agent')}
                </Button>
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white border border-slate-200/80 px-5 py-4 shadow-sm">
                <div className="text-3xl font-bold text-[#2F6BFF] tabular-nums leading-none">
                  {combinedAgents.length}
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('agents.stats.totalAgents', 'Total Agents')}
                </div>
              </div>

              <div className="rounded-xl bg-white border border-slate-200/80 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-emerald-500 tabular-nums leading-none">
                    {incomingCount}
                  </div>
                  <GitBranch className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('agents.type.incoming', 'Incoming')}
                </div>
              </div>

              <div className="rounded-xl bg-white border border-slate-200/80 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-[#2F6BFF] tabular-nums leading-none">
                    {flowCount}
                  </div>
                  <ArrowUpDown className="h-4 w-4 text-[#2F6BFF]" />
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('agents.type.flow', 'Flow')}
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search Row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200 rounded-md shadow-sm w-fit">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
                data-testid="button-filter-all"
              >
                {t('common.all', 'All')} ({combinedAgents.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('incoming')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  typeFilter === 'incoming'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
                data-testid="button-filter-incoming"
              >
                <GitBranch className={`h-3.5 w-3.5 ${typeFilter === 'incoming' ? 'text-white' : 'text-slate-400'}`} />
                {t('agents.type.incoming', 'Incoming')} ({incomingCount})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('flow')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  typeFilter === 'flow'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
                data-testid="button-filter-flow"
              >
                <ArrowUpDown className={`h-3.5 w-3.5 ${typeFilter === 'flow' ? 'text-white' : 'text-slate-400'}`} />
                {t('agents.type.flow', 'Flow')} ({flowCount})
              </button>
              {isCustomVoiceEngineEnabled && (
                <button
                  type="button"
                  onClick={() => setTypeFilter('cve')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    typeFilter === 'cve'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                  data-testid="button-filter-cve"
                >
                  <Bot className={`h-3.5 w-3.5 ${typeFilter === 'cve' ? 'text-white' : 'text-slate-400'}`} />
                  Custom Voice ({cveCount})
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:ml-auto">
              {hasAlternateEngines && (
                <Select
                  value={engineFilter}
                  onValueChange={(value) => setEngineFilter(value as typeof engineFilter)}
                >
                  <SelectTrigger
                    className="w-full sm:w-44 h-10 bg-white border-slate-200 rounded-xl shadow-sm"
                    data-testid="select-engine-filter"
                  >
                    <SelectValue placeholder="All Engines" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Engines</SelectItem>
                    <SelectItem value="twilio">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-violet-500" />
                        ElevenLabs + Twilio
                      </div>
                    </SelectItem>
                    {isTwilioOpenaiEnabled && (
                      <SelectItem value="twilio_openai">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-brand" />
                          OpenAI + Twilio
                        </div>
                      </SelectItem>
                    )}
                    {isPlivoEnabled && (
                      <SelectItem value="plivo">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          OpenAI + Plivo
                        </div>
                      </SelectItem>
                    )}
                    {isElevenLabsSipAllowed && (
                      <SelectItem value="elevenlabs-sip">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-orange-500" />
                          ElevenLabs SIP
                        </div>
                      </SelectItem>
                    )}
                    {isOpenAISipAllowed && (
                      <SelectItem value="openai-sip">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-pink-500" />
                          OpenAI SIP
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('agents.searchPlaceholder', 'Search agents...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-white border-slate-200 rounded-xl shadow-sm"
                  data-testid="input-search-agents"
                />
              </div>
            </div>
          </div>

          {combinedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-5 animate-pulse rounded-2xl border-slate-200">
                  <div className="h-6 bg-slate-100 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-slate-100 rounded w-full mb-2" />
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                </Card>
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-blue-50 flex items-center justify-center">
                <FlaskConical className="h-7 w-7 text-[#2F6BFF]" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? t('agents.noAgentsFound') : t('agents.noAgents')}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? t('agents.noMatchingSearch')
                  : t('agents.getStarted')}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setLocation("/agents/new")}
                  className="bg-[#2F6BFF] hover:bg-[#1F5AEF] text-white border-transparent"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('agents.createFirstAgent')}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedItems.map((agent) => {
                  const isCve = agent.telephonyProvider === 'custom-voice-engine';
                  const isOpenAIProvider = agent.telephonyProvider === "plivo" || agent.telephonyProvider === "twilio_openai" || agent.telephonyProvider === "openai-sip";
                  const cveVoiceObj = isCve ? customVoiceEngineVoices.find(v => v.value === agent.openaiVoice) : null;
                  const voiceName = isCve
                    ? cveVoiceObj?.label || agent.openaiVoice || null
                    : isOpenAIProvider
                      ? openaiVoices.find(v => v.value === agent.openaiVoice)?.label || null
                      : getVoiceName(agent.elevenLabsVoiceId);
                  const languageName = agent.language ? t(`agents.languages.${agent.language}`, { defaultValue: getLanguageLabel(agent.language) }) : t('agents.languages.en');

                  const isIncoming = agent.type === 'incoming' && !isCve;
                  const iconBg = isCve
                    ? 'bg-orange-100 text-orange-600'
                    : isIncoming
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-blue-100 text-[#2F6BFF]';
                  const badgeClass = isCve
                    ? 'bg-orange-50 text-orange-700 border-orange-100'
                    : isIncoming
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-blue-50 text-[#2F6BFF] border-blue-100';

                  const personaLabel = isCve
                    ? [voiceName, cveVoiceObj?.description].filter(Boolean).join(' — ')
                    : [voiceName, agent.voiceTone, agent.personality].filter(Boolean).join(' - ');
                  const styleTags = isCve
                    ? [languageName, cveVoiceObj?.provider].filter(Boolean)
                    : [languageName, agent.voiceTone, agent.personality].filter(Boolean);

                  return (
                    <Card
                      key={agent.id}
                      className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 group"
                      data-testid={`card-agent-${agent.id}`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                              {isCve ? <Bot className="h-4 w-4" /> : isIncoming ? <GitBranch className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />}
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate" data-testid="text-agent-name">
                                {agent.name}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`shrink-0 text-[11px] font-medium rounded-full px-2 py-0 border ${badgeClass}`}
                                data-testid={`badge-agent-type-${agent.type}`}
                              >
                                {isCve ? "Custom Voice" : isIncoming ? t('agents.type.incoming') : t('agents.type.flow')}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <AgentVersionHistory
                              agentId={agent.id}
                              agentName={agent.name}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-700"
                              onClick={() => handleEdit(agent)}
                              data-testid="button-edit-agent"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-destructive"
                              onClick={() => setDeletingAgent(agent)}
                              data-testid="button-delete-agent"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
                            <Mic className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate" data-testid="text-agent-voice">
                              {personaLabel || t('agents.voiceNotSet')}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 pl-5">
                            {styleTags.map((tag, idx) => (
                              <span key={`${tag}-${idx}`} className="capitalize" data-testid={idx === 0 ? 'text-agent-language' : undefined}>
                                {tag}
                                {idx < styleTags.length - 1 ? <span className="text-slate-300 ml-2">·</span> : null}
                              </span>
                            ))}
                          </div>
                          {agent.config?.model && MODEL_COSTS[agent.config.model] && (
                            <div className={`flex items-center gap-2 text-xs font-medium pl-5 ${isCve ? 'text-orange-600' : isIncoming ? 'text-emerald-600' : 'text-[#2F6BFF]'}`}>
                              <span>≈ ${(VOICE_COST + MODEL_COSTS[agent.config.model].llm).toFixed(3)}/min</span>
                              <span className="opacity-40">·</span>
                              <span>{MODEL_COSTS[agent.config.model].speed}</span>
                            </div>
                          )}
                        </div>

                        {agent.systemPrompt && (
                          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                              {agent.systemPrompt}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                itemsPerPageOptions={[9, 18, 27, 45]}
                data-testid="agents-pagination"
              />
            </div>
          )}


          <AlertDialog open={!!deletingAgent} onOpenChange={() => setDeletingAgent(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('agents.delete.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('agents.delete.description', { name: deletingAgent?.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deletingAgent && deleteMutation.mutate(deletingAgent.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Guided Agent Creation Wizard */}
          <AgentCreationWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
            }}
          />

          {isDemoMode && (
            <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
              <DialogContent className="sm:max-w-[850px] p-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                <DialogHeader className="p-4 pb-2 text-left">
                  <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Play className="h-5 w-5 text-blue-400 fill-blue-400" />
                    AI Agents Demonstration Video
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Watch a walkthrough on creating and configuring AI voice agents.
                  </DialogDescription>
                </DialogHeader>
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
                  {isVideoOpen && (
                    <iframe
                      src="https://drive.google.com/file/d/1aZZMTubUwnuSrwzC0xlfHGXLlDAaPg3c/preview"
                      className="w-full h-full border-0"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      title="AI Agents Demo Video"
                    />
                  )}
                </div>
                <div className="p-3 pt-2 text-right">
                  <a
                    href="https://drive.google.com/file/d/1aZZMTubUwnuSrwzC0xlfHGXLlDAaPg3c/view?usp=drive_link"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    Open in Google Drive &rarr;
                  </a>
                </div>
              </DialogContent>
            </Dialog>
          )}
    </div>
  );
}
