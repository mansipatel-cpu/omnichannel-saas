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
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  Calendar,
  Target,
  BarChart3,
  Headphones,
  Sparkles,
  Mic,
  Bot,
  MessageSquare,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wand2,
  Volume2,
  FileText,
  Play,
  Check,
  Loader2,
  Zap,
  Info,
  Briefcase,
  Smile,
  Heart,
  Award,
  MessageCircle,
  User,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import VoiceSearchPicker from "@/components/VoiceSearchPicker";
import VoicePreviewButton from "@/components/VoicePreviewButton";
import OpenAIVoicePreviewButton from "@/components/OpenAIVoicePreviewButton";
import CVEVoicePreviewButton from "@/components/CVEVoicePreviewButton";
import PromptTemplatesLibrary from "@/components/PromptTemplatesLibrary";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_LANGUAGES, getLanguageLabel, isProviderSupported } from "@/lib/languages";
import { LanguageOptionLabel } from "@/components/LanguageProviderBadges";
import { usePluginStatus } from "@/hooks/use-plugin-status";

interface SipPhoneNumber {
  id: string;
  phoneNumber: string;
  label?: string;
  trunkId: string;
  engine: string;
}

interface UseCase {
  id: string;
  title: string;
  description: string;
  icon: typeof Phone;
  color: string;
  presetVoiceTone: string;
  presetPersonality: string;
  suggestedPrompt: string;
  suggestedFirstMessage: string;
  suggestedVoiceStyle: "professional" | "friendly" | "casual" | "authoritative";
}

const useCases: UseCase[] = [
  {
    id: "receptionist",
    title: "Receptionist",
    description: "Handle incoming calls, route to departments, answer FAQs",
    icon: Phone,
    color: "emerald",
    presetVoiceTone: "professional",
    presetPersonality: "helpful",
    suggestedPrompt: "You are a professional virtual receptionist for {{company_name}}. Your role is to:\n- Greet callers warmly and professionally\n- Answer common questions about business hours, location, and services\n- Route calls to the appropriate department or person\n- Take messages when someone is unavailable\n- Maintain a calm and helpful demeanor at all times\n\nBe concise but friendly. If you don't know something, offer to take a message or transfer to someone who can help.",
    suggestedFirstMessage: "Thank you for calling {{company_name}}. My name is {{agent_name}}. How may I assist you today?",
    suggestedVoiceStyle: "professional",
  },
  {
    id: "appointment",
    title: "Appointment Setter",
    description: "Schedule meetings, qualify leads, manage bookings",
    icon: Calendar,
    color: "blue",
    presetVoiceTone: "friendly",
    presetPersonality: "professional",
    suggestedPrompt: "You are an appointment scheduling assistant for {{company_name}}. Your responsibilities are:\n- Qualify callers to ensure they're a good fit\n- Check available time slots\n- Book appointments efficiently\n- Confirm date, time, and meeting details\n- Send confirmation information\n\nAsk qualifying questions naturally before booking. Be efficient with the caller's time while ensuring you gather all necessary information.",
    suggestedFirstMessage: "Hi there! Thanks for your interest in scheduling a meeting with {{company_name}}. I'd love to help you find a time that works. May I start by getting your name?",
    suggestedVoiceStyle: "friendly",
  },
  {
    id: "qualification",
    title: "Lead Qualification",
    description: "Screen prospects, score leads, gather requirements",
    icon: Target,
    color: "violet",
    presetVoiceTone: "confident",
    presetPersonality: "inquisitive",
    suggestedPrompt: "You are a lead qualification specialist for {{company_name}}. Your mission is to:\n- Understand the prospect's needs and pain points\n- Gather key information: budget, timeline, decision process\n- Score leads based on qualification criteria\n- Identify the best next steps for qualified leads\n- Politely disqualify poor-fit prospects\n\nAsk open-ended questions and listen carefully. Be conversational, not interrogative. Focus on understanding their situation before pitching solutions.",
    suggestedFirstMessage: "Hello! I'm reaching out from {{company_name}}. I'd love to learn a bit about your current situation to see if we might be able to help. Do you have a few minutes to chat?",
    suggestedVoiceStyle: "professional",
  },
  {
    id: "survey",
    title: "Survey & Feedback",
    description: "Conduct surveys, gather insights, collect feedback",
    icon: BarChart3,
    color: "amber",
    presetVoiceTone: "friendly",
    presetPersonality: "curious",
    suggestedPrompt: "You are a friendly survey conductor for {{company_name}}. Your goals are:\n- Make the survey feel like a natural conversation\n- Ask questions clearly and wait for complete responses\n- Probe for details when answers are vague\n- Thank respondents for their time and insights\n- Record feedback accurately\n\nKeep a warm, appreciative tone. Make respondents feel their opinions matter. Be patient and don't rush through questions.",
    suggestedFirstMessage: "Hi! I'm calling from {{company_name}} to gather some quick feedback about your recent experience with us. Your insights really help us improve. Would you have about 5 minutes to share your thoughts?",
    suggestedVoiceStyle: "friendly",
  },
  {
    id: "service",
    title: "Customer Service",
    description: "Resolve issues, answer questions, provide support",
    icon: Headphones,
    color: "rose",
    presetVoiceTone: "empathetic",
    presetPersonality: "patient",
    suggestedPrompt: "You are a customer service representative for {{company_name}}. Your priorities are:\n- Listen to customer concerns with empathy\n- Resolve issues quickly and effectively\n- Provide clear, accurate information\n- Escalate to a human agent when necessary\n- Follow up to ensure satisfaction\n\nAlways acknowledge the customer's feelings first. Stay calm even with frustrated callers. Focus on solutions, not blame.",
    suggestedFirstMessage: "Thank you for contacting {{company_name}} support. I'm here to help! What can I assist you with today?",
    suggestedVoiceStyle: "professional",
  },
  {
    id: "custom",
    title: "Custom Agent",
    description: "Build from scratch with full customization",
    icon: Sparkles,
    color: "slate",
    presetVoiceTone: "professional",
    presetPersonality: "helpful",
    suggestedPrompt: "",
    suggestedFirstMessage: "",
    suggestedVoiceStyle: "professional",
  },
];

const voiceToneOptions = [
  { value: "professional", label: "Professional", description: "Formal, polished, business-appropriate", icon: Briefcase, isDefault: true },
  { value: "friendly", label: "Friendly", description: "Warm, approachable, personable", icon: Smile },
  { value: "empathetic", label: "Empathetic", description: "Understanding, compassionate, supportive", icon: Heart },
  { value: "confident", label: "Confident", description: "Assured, decisive, trustworthy", icon: Award },
  { value: "casual", label: "Casual", description: "Relaxed, conversational, laid-back", icon: MessageCircle },
];

function extractTemplateVariables(text: string): string[] {
  const matches = text.match(/\{\{[\w.]+\}\}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function estimateAudioSeconds(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(0.5, words / 2.5);
  return `~${seconds.toFixed(1)}s audio`;
}

function getTelephonyLabel(provider: string): string {
  switch (provider) {
    case "plivo": return "OpenAI + Plivo";
    case "twilio_openai": return "OpenAI + Twilio";
    case "custom-voice-engine": return "Custom Voice Engine";
    case "elevenlabs-sip": return "ElevenLabs SIP";
    case "openai-sip": return "OpenAI SIP";
    default: return "ElevenLabs + Twilio";
  }
}

const personalityOptions = [
  { value: "helpful", label: "Helpful", description: "Eager to assist and solve problems" },
  { value: "professional", label: "Professional", description: "Business-focused and efficient" },
  { value: "patient", label: "Patient", description: "Takes time to explain and understand" },
  { value: "inquisitive", label: "Inquisitive", description: "Asks questions to understand needs" },
  { value: "curious", label: "Curious", description: "Interested in learning more" },
  { value: "energetic", label: "Energetic", description: "Enthusiastic and positive" },
];


// OpenAI Realtime API voices
const openaiVoices = [
  { value: "alloy", label: "Alloy", description: "Neutral and balanced" },
  { value: "echo", label: "Echo", description: "Warm and conversational" },
  { value: "shimmer", label: "Shimmer", description: "Clear and expressive" },
  { value: "ash", label: "Ash", description: "Soft and gentle" },
  { value: "ballad", label: "Ballad", description: "Melodic and soothing" },
  { value: "coral", label: "Coral", description: "Bright and friendly" },
  { value: "sage", label: "Sage", description: "Calm and wise" },
  { value: "verse", label: "Verse", description: "Poetic and articulate" },
  { value: "cedar", label: "Cedar", description: "Deep and grounded" },
  { value: "marin", label: "Marin", description: "Fresh and lively" },
];

export const customVoiceEngineVoices = [
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
  // Sarvam — Bulbul v3
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
  // Sarvam — Bulbul v2 (7 speakers)
  { value: "anushka", label: "Anushka (Sarvam)", description: "Female — default v2", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "manisha", label: "Manisha (Sarvam)", description: "Female — warm", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "vidya", label: "Vidya (Sarvam)", description: "Female — articulate", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "arya", label: "Arya (Sarvam)", description: "Female — energetic", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "abhilash", label: "Abhilash (Sarvam)", description: "Male — authoritative", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "karun", label: "Karun (Sarvam)", description: "Male — conversational", provider: "sarvam" as const, model: "bulbul:v2" as const },
  { value: "hitesh", label: "Hitesh (Sarvam)", description: "Male — professional", provider: "sarvam" as const, model: "bulbul:v2" as const },
];

interface AgentCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type WizardStep = "useCase" | "basics" | "personality" | "prompts" | "voice" | "review";

const steps: { id: WizardStep; title: string; icon: typeof Bot }[] = [
  { id: "useCase", title: "Use Case", icon: Target },
  { id: "basics", title: "Basic Info", icon: Bot },
  { id: "personality", title: "Personality", icon: MessageSquare },
  { id: "prompts", title: "Prompts", icon: FileText },
  { id: "voice", title: "Voice", icon: Mic },
  { id: "review", title: "Review", icon: CheckCircle2 },
];

function getSelectedTelephonyHint(provider: string): string {
  switch (provider) {
    case "plivo":
      return "India Optimized";
    case "twilio_openai":
    case "openai-sip":
      return "Realtime API";
    case "custom-voice-engine":
      return "Self-hosted Pipeline";
    case "elevenlabs-sip":
    case "twilio":
    default:
      return "High-Fidelity Audio";
  }
}

export function AgentCreationWizard({ open, onOpenChange, onSuccess }: AgentCreationWizardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>("useCase");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Fetch voice engine setting to check if Plivo+OpenAI or Twilio+OpenAI is enabled
  const { data: voiceEngineSettings } = useQuery<{ plivo_openai_engine_enabled: boolean; twilio_openai_engine_enabled: boolean; default_tts_model?: string }>({
    queryKey: ["/api/settings/voice-engine"],
    staleTime: 60000, // Cache for 1 minute
  });

  // Check if SIP plugin is enabled and which engines are allowed
  const { isSipPluginEnabled, sipEnginesAllowed, isCustomVoiceEngineEnabled } = usePluginStatus();
  const isElevenLabsSipAllowed = isSipPluginEnabled && sipEnginesAllowed.includes("elevenlabs-sip");
  const isOpenAISipAllowed = isSipPluginEnabled && sipEnginesAllowed.includes("openai-sip");

  // Fetch SIP phone numbers when SIP plugin is enabled
  const { data: sipPhoneNumbersResponse, isLoading: isSipNumbersLoading } = useQuery<{ success: boolean; data: SipPhoneNumber[] }>({
    queryKey: ["/api/sip/phone-numbers"],
    enabled: isSipPluginEnabled,
  });
  const sipPhoneNumbers = sipPhoneNumbersResponse?.data || [];

  const isPlivoEnabled = voiceEngineSettings?.plivo_openai_engine_enabled ?? false;
  const isTwilioOpenaiEnabled = voiceEngineSettings?.twilio_openai_engine_enabled ?? false;
  const hasAlternateEngines = isPlivoEnabled || isTwilioOpenaiEnabled || isElevenLabsSipAllowed || isOpenAISipAllowed || isCustomVoiceEngineEnabled;

  // Fetch CVE admin settings for active TTS provider
  const { data: cveSettings } = useQuery<{ success: boolean; data: { tts: { activeProvider: string } } }>({
    queryKey: ["/api/voice-engine/admin/provider-keys"],
    staleTime: 30000,
    enabled: isCustomVoiceEngineEnabled,
  });
  const activeTtsProvider = cveSettings?.data?.tts?.activeProvider || "deepgram";
  const activeSttProvider = (cveSettings?.data as any)?.stt?.activeProvider || "deepgram";

  const [formData, setFormData] = useState({
    useCase: "",
    name: "",
    elevenLabsVoiceId: "",
    language: "en",
    voiceTone: "professional",
    personality: "helpful",
    systemPrompt: "",
    firstMessage: "",
    voiceStability: 0.5,
    voiceSimilarityBoost: 0.85,
    voiceSpeed: 1.0,
    turnTimeout: 1.5,
    // Telephony provider selection
    telephonyProvider: "twilio" as "twilio" | "plivo" | "twilio_openai" | "elevenlabs-sip" | "openai-sip" | "custom-voice-engine",
    openaiVoice: "alloy",
    // SIP phone number selection (for SIP engines)
    sipPhoneNumberId: "",
  });

  const selectedUseCase = useMemo(() => 
    useCases.find(uc => uc.id === formData.useCase),
    [formData.useCase]
  );

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "useCase":
        return !!formData.useCase;
      case "basics": {
        // Voice is optional here so users can preview later steps; required only on create
        const isSipEngine = formData.telephonyProvider === "elevenlabs-sip" || formData.telephonyProvider === "openai-sip";
        const hasSipPhoneNumber = !isSipEngine || !!formData.sipPhoneNumberId;
        return !!formData.name && hasSipPhoneNumber;
      }
      case "personality":
        return !!formData.voiceTone && !!formData.personality;
      case "prompts":
        return !!formData.systemPrompt;
      case "voice":
        return true;
      case "review":
        return true;
      default:
        return false;
    }
  }, [currentStep, formData]);

  const hasValidVoice = useMemo(() => {
    const isOpenAIOrCve =
      formData.telephonyProvider === "plivo" ||
      formData.telephonyProvider === "twilio_openai" ||
      formData.telephonyProvider === "openai-sip" ||
      formData.telephonyProvider === "custom-voice-engine";
    return isOpenAIOrCve ? !!formData.openaiVoice : !!formData.elevenLabsVoiceId;
  }, [formData.telephonyProvider, formData.openaiVoice, formData.elevenLabsVoiceId]);

  const validationHint = useMemo(() => {
    if (canProceed || currentStep !== "basics") return null;
    const missing: string[] = [];
    if (!formData.name) missing.push(t('wizard.hint.enterName', { defaultValue: 'enter an agent name' }));
    const isSipEngine = formData.telephonyProvider === "elevenlabs-sip" || formData.telephonyProvider === "openai-sip";
    if (isSipEngine && !formData.sipPhoneNumberId) {
      missing.push(t('wizard.hint.selectSipNumber', { defaultValue: 'select a SIP phone number' }));
    }
    if (missing.length === 0) return null;
    return t('wizard.hint.toContinue', { 
      defaultValue: 'Please {{items}} to continue',
      items: missing.join(` ${t('wizard.hint.and', { defaultValue: 'and' })} `)
    });
  }, [canProceed, currentStep, formData, t]);

  const handleUseCaseSelect = (useCaseId: string) => {
    const useCase = useCases.find(uc => uc.id === useCaseId);
    if (useCase) {
      setFormData(prev => ({
        ...prev,
        useCase: useCaseId,
        voiceTone: useCase.presetVoiceTone,
        personality: useCase.presetPersonality,
        systemPrompt: useCase.suggestedPrompt,
        firstMessage: useCase.suggestedFirstMessage,
      }));
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const resetWizard = () => {
    setCurrentStep("useCase");
    setFormData({
      useCase: "",
      name: "",
      elevenLabsVoiceId: "",
      language: "en",
      voiceTone: "professional",
      personality: "helpful",
      systemPrompt: "",
      firstMessage: "",
      voiceStability: 0.5,
      voiceSimilarityBoost: 0.85,
      voiceSpeed: 1.0,
      turnTimeout: 1.5,
      telephonyProvider: "twilio",
      openaiVoice: "alloy",
      sipPhoneNumberId: "",
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (formData.telephonyProvider === "custom-voice-engine") {
        const payload = {
          name: formData.name,
          description: "",
          systemPrompt: formData.systemPrompt,
          firstMessage: formData.firstMessage || "Hello! How can I help you today?",
          language: formData.language || "en",
          llmModel: "openai/gpt-4o-mini",
          temperature: 0.7,
          maxTokens: 500,
          ttsVoice: formData.openaiVoice || "aura-asteria-en",
          ttsProvider: activeTtsProvider,
          sttProvider: activeSttProvider,
          interruptible: true,
          silenceTimeoutMs: 5000,
          maxDurationSeconds: 600,
          endCallOnSilence: false,
          businessRules: [],
          enableMemory: true,
          memoryRetentionDays: 90,
        };
        const res = await apiRequest("POST", "/api/voice-engine/agents", payload);
        return res.json();
      }

      const isSipEngine = formData.telephonyProvider === "elevenlabs-sip" || formData.telephonyProvider === "openai-sip";
      const isOpenAIVoice = formData.telephonyProvider === "plivo" || formData.telephonyProvider === "twilio_openai" || formData.telephonyProvider === "openai-sip";
      const isElevenLabsVoice = formData.telephonyProvider === "twilio" || formData.telephonyProvider === "elevenlabs-sip";
      
      const payload = {
        type: "incoming",
        name: formData.name,
        elevenLabsVoiceId: isElevenLabsVoice ? formData.elevenLabsVoiceId : undefined,
        openaiModel: isOpenAIVoice ? "gpt-realtime-1.5" : undefined,
        language: formData.language,
        voiceTone: formData.voiceTone,
        personality: formData.personality,
        systemPrompt: formData.systemPrompt,
        firstMessage: formData.firstMessage || "Hello! How can I help you today?",
        voiceStability: formData.voiceStability,
        voiceSimilarityBoost: formData.voiceSimilarityBoost,
        voiceSpeed: formData.voiceSpeed,
        turnTimeout: formData.turnTimeout,
        temperature: 0.5,
        // Telephony provider configuration
        telephonyProvider: formData.telephonyProvider,
        openaiVoice: isOpenAIVoice ? formData.openaiVoice : undefined,
        // SIP configuration
        sipPhoneNumberId: isSipEngine ? formData.sipPhoneNumberId : undefined,
      };
      const res = await apiRequest("POST", "/api/agents", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Agent Created!",
        description: `Your ${formData.name} agent is ready to use.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-engine/agents"] });
      onOpenChange(false);
      resetWizard();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isOpenAITelephony =
    formData.telephonyProvider === "plivo" ||
    formData.telephonyProvider === "twilio_openai" ||
    formData.telephonyProvider === "openai-sip";
  const isOpenAIOrCveVoice =
    isOpenAITelephony || formData.telephonyProvider === "custom-voice-engine";
  const isElevenLabsTelephony =
    formData.telephonyProvider === "twilio" ||
    formData.telephonyProvider === "elevenlabs-sip";

  const selectedVoiceLabel = formData.telephonyProvider === "custom-voice-engine"
    ? (customVoiceEngineVoices.find(v => v.value === formData.openaiVoice)?.label || formData.openaiVoice || "Asteria (Deepgram)")
    : isOpenAITelephony
      ? (openaiVoices.find(v => v.value === formData.openaiVoice)?.label || formData.openaiVoice)
      : (formData.elevenLabsVoiceId || "Not selected");

  const selectedVoiceDescription = formData.telephonyProvider === "custom-voice-engine"
    ? (customVoiceEngineVoices.find(v => v.value === formData.openaiVoice)?.description || "Deepgram Nova-2 voice")
    : isOpenAITelephony
      ? (openaiVoices.find(v => v.value === formData.openaiVoice)?.description || "OpenAI Realtime voice")
      : "ElevenLabs premium voice";

  const systemPromptVars = extractTemplateVariables(formData.systemPrompt);
  const firstMessageVars = extractTemplateVariables(formData.firstMessage);

  const handleSaveDraft = () => {
    toast({
      title: "Draft Saved",
      description: "Your agent draft has been saved. You can continue later.",
    });
    onOpenChange(false);
    resetWizard();
  };

  const renderStep = () => {
    switch (currentStep) {
      case "useCase":
        return (
          <div className="flex flex-col gap-6">
            <div className="text-center space-y-2">
              <h3 className="text-[22px] font-semibold tracking-tight text-gray-900">
                What will your AI agent do?
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                Choose a use case to get started with optimized settings and pre-trained prompts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {useCases.map((useCase) => {
                const selected = formData.useCase === useCase.id;
                const Icon = useCase.icon;
                return (
                  <button
                    type="button"
                    key={useCase.id}
                    className={cn(
                      "relative text-left p-4 rounded-xl border bg-white transition-all duration-150",
                      selected
                        ? "border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => handleUseCaseSelect(useCase.id)}
                    data-testid={`usecase-${useCase.id}`}
                  >
                    {selected && (
                      <Check className="absolute top-3.5 right-3.5 h-4 w-4 text-blue-600 stroke-[2.5]" />
                    )}
                    <div className="flex items-start gap-3 pr-5">
                      <Icon className="h-5 w-5 text-gray-700 mt-0.5 shrink-0" strokeWidth={1.75} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-[15px] font-semibold text-gray-900 leading-none">
                            {useCase.title}
                          </h4>
                          {useCase.id === "receptionist" && (
                            <span className="text-[11px] text-gray-400 font-normal">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-gray-500 leading-snug">
                          {useCase.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="h-4 w-4 text-gray-400 shrink-0" />
                <p className="text-xs text-gray-500 leading-relaxed">
                  You can fine-tune speech models, response temperature, and knowledge bases in subsequent steps.
                </p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                Estimated setup: 3 mins
              </span>
            </div>
          </div>
        );

      case "basics": {
        const ProviderRadio = ({ selected }: { selected: boolean }) => (
          <span
            className={cn(
              "absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center border-2 shrink-0",
              selected ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
            )}
          >
            {selected && <Check className="h-3 w-3 text-white stroke-[3]" />}
          </span>
        );

        return (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-[22px] font-semibold tracking-tight text-gray-900">Basic Information</h3>
              <p className="text-sm text-gray-500">
                Name your agent and choose its voice engine architecture.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-800">
                  Agent Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={selectedUseCase ? `My ${selectedUseCase.title} Agent` : "Enter agent name"}
                  className="h-11 rounded-lg border-gray-200 shadow-none focus-visible:ring-blue-500"
                  data-testid="input-agent-name"
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-gray-800">
                    Telephony & Engine Provider <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-xs text-gray-400">
                    Selected: {getSelectedTelephonyHint(formData.telephonyProvider)}
                  </span>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <button
                    type="button"
                    className={cn(
                      "relative text-left p-3.5 rounded-xl border-2 transition-all bg-white min-h-[132px]",
                      formData.telephonyProvider === "twilio"
                        ? "border-blue-600"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => setFormData(prev => ({ ...prev, telephonyProvider: "twilio", sipPhoneNumberId: "" }))}
                    data-testid="provider-twilio"
                  >
                    <ProviderRadio selected={formData.telephonyProvider === "twilio"} />
                    <p className="font-semibold text-gray-900 pr-7 text-[14px]">ElevenLabs + Twilio</p>
                    <p className="text-[12px] text-gray-500 mt-1.5 leading-snug">
                      Premium voice quality, 30+ languages, conversational latency tuning.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        98ms TTFB
                      </span>
                      <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50/50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Ultra-HQ
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "relative text-left p-3.5 rounded-xl border-2 transition-all bg-white min-h-[132px]",
                      formData.telephonyProvider === "twilio_openai"
                        ? "border-blue-600"
                        : "border-gray-200 hover:border-gray-300",
                      !isTwilioOpenaiEnabled && "opacity-60"
                    )}
                    onClick={() => {
                      if (!isTwilioOpenaiEnabled) return;
                      setFormData(prev => ({ ...prev, telephonyProvider: "twilio_openai", sipPhoneNumberId: "" }));
                    }}
                    data-testid="provider-twilio-openai"
                  >
                    <ProviderRadio selected={formData.telephonyProvider === "twilio_openai"} />
                    <p className="font-semibold text-gray-900 pr-7 text-[14px]">OpenAI + Twilio</p>
                    <p className="text-[12px] text-gray-500 mt-1.5 leading-snug">
                      Real-time AI, international direct inbound dial with session resumption.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        Realtime API
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "relative text-left p-3.5 rounded-xl border-2 transition-all bg-white min-h-[132px]",
                      formData.telephonyProvider === "plivo"
                        ? "border-blue-600"
                        : "border-gray-200 hover:border-gray-300",
                      !isPlivoEnabled && "opacity-60"
                    )}
                    onClick={() => {
                      if (!isPlivoEnabled) return;
                      setFormData(prev => ({ ...prev, telephonyProvider: "plivo", sipPhoneNumberId: "" }));
                    }}
                    data-testid="provider-plivo"
                  >
                    <ProviderRadio selected={formData.telephonyProvider === "plivo"} />
                    <p className="font-semibold text-gray-900 pr-7 text-[14px]">OpenAI + Plivo</p>
                    <p className="text-[12px] text-gray-500 mt-1.5 leading-snug">
                      Real-time AI optimized for local Indian numbers & APAC carrier routes.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        India Optimized
                      </span>
                    </div>
                  </button>
                </div>

                {(isElevenLabsSipAllowed || isOpenAISipAllowed || isCustomVoiceEngineEnabled) && (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                    {isElevenLabsSipAllowed && (
                      <button
                        type="button"
                        className={cn(
                          "relative text-left p-3.5 rounded-xl border-2 transition-all bg-white",
                          formData.telephonyProvider === "elevenlabs-sip"
                            ? "border-blue-600"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => setFormData(prev => ({ ...prev, telephonyProvider: "elevenlabs-sip", sipPhoneNumberId: "" }))}
                        data-testid="provider-elevenlabs-sip"
                      >
                        <ProviderRadio selected={formData.telephonyProvider === "elevenlabs-sip"} />
                        <p className="font-semibold text-gray-900 pr-7 text-[14px] flex items-center gap-1.5">
                          ElevenLabs SIP
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Plugin</Badge>
                        </p>
                        <p className="text-[12px] text-gray-500 mt-1.5">Your own SIP trunk</p>
                      </button>
                    )}
                    {isOpenAISipAllowed && (
                      <button
                        type="button"
                        className={cn(
                          "relative text-left p-3.5 rounded-xl border-2 transition-all bg-white",
                          formData.telephonyProvider === "openai-sip"
                            ? "border-blue-600"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => setFormData(prev => ({ ...prev, telephonyProvider: "openai-sip", sipPhoneNumberId: "" }))}
                        data-testid="provider-openai-sip"
                      >
                        <ProviderRadio selected={formData.telephonyProvider === "openai-sip"} />
                        <p className="font-semibold text-gray-900 pr-7 text-[14px] flex items-center gap-1.5">
                          OpenAI SIP
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Plugin</Badge>
                        </p>
                        <p className="text-[12px] text-gray-500 mt-1.5">Your own SIP trunk</p>
                      </button>
                    )}
                    {isCustomVoiceEngineEnabled && (
                      <button
                        type="button"
                        className={cn(
                          "relative text-left p-3.5 rounded-xl border-2 transition-all bg-white",
                          formData.telephonyProvider === "custom-voice-engine"
                            ? "border-blue-600"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => setFormData(prev => ({ ...prev, telephonyProvider: "custom-voice-engine", sipPhoneNumberId: "" }))}
                        data-testid="provider-custom-voice-engine"
                      >
                        <ProviderRadio selected={formData.telephonyProvider === "custom-voice-engine"} />
                        <p className="font-semibold text-gray-900 pr-7 text-[14px] flex items-center gap-1.5">
                          Custom Voice Engine
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Plugin</Badge>
                        </p>
                        <p className="text-[12px] text-gray-500 mt-1.5">Self-hosted FreeSWITCH pipeline</p>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {(formData.telephonyProvider === "elevenlabs-sip" || formData.telephonyProvider === "openai-sip") && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-800">
                    {t('wizard.sipPhoneNumber', { defaultValue: 'SIP Phone Number' })} <span className="text-red-500">*</span>
                  </Label>
                  {(() => {
                    if (isSipNumbersLoading) {
                      return (
                        <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          <span className="text-sm text-gray-500">{t('wizard.loadingSipNumbers', { defaultValue: 'Loading SIP phone numbers...' })}</span>
                        </div>
                      );
                    }
                    const filtered = sipPhoneNumbers.filter(p =>
                      p.engine === formData.telephonyProvider
                    );
                    if (filtered.length === 0) {
                      return (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                          <Info className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-gray-500">
                            {t('wizard.noSipNumbers', { defaultValue: 'No SIP phone numbers available for this engine. Please set up a SIP trunk and import phone numbers in your' })}{' '}
                            <a href="/phone-numbers" target="_blank" className="text-blue-600 underline underline-offset-2" data-testid="link-sip-settings">
                              {t('wizard.sipSettings', { defaultValue: 'SIP settings' })}
                            </a>{' '}
                            {t('wizard.first', { defaultValue: 'first.' })}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <Select
                        value={formData.sipPhoneNumberId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, sipPhoneNumberId: value }))}
                      >
                        <SelectTrigger data-testid="select-sip-phone-number" className="h-11 rounded-lg border-gray-200">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <SelectValue placeholder={t('wizard.selectSipNumber', { defaultValue: 'Select a SIP phone number' })} />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {filtered.map((num) => (
                            <SelectItem key={num.id} value={num.id}>
                              <span>{num.phoneNumber}</span>
                              {num.label && <span className="ml-2 text-gray-400">({num.label})</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 relative min-w-0">
                  <Label className="text-sm font-medium text-gray-800">
                    Voice <span className="text-red-500">*</span>
                  </Label>
                  {formData.telephonyProvider === "custom-voice-engine" ? (
                    <div className="flex gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <Select
                          value={formData.openaiVoice || "aura-asteria-en"}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, openaiVoice: value }))}
                        >
                          <SelectTrigger data-testid="select-cve-voice" className="w-full h-11 rounded-lg border-gray-200">
                            <SelectValue placeholder="Select Voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {customVoiceEngineVoices
                              .filter(v => v.provider === activeTtsProvider)
                              .map((voice) => (
                              <SelectItem key={voice.value} value={voice.value}>
                                <div className="flex flex-col">
                                  <span>{voice.label}</span>
                                  <span className="text-xs text-muted-foreground">{voice.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <CVEVoicePreviewButton
                        voiceId={formData.openaiVoice || "aura-asteria-en"}
                        voiceName={customVoiceEngineVoices.find(v => v.value === (formData.openaiVoice || "aura-asteria-en"))?.label}
                        provider={customVoiceEngineVoices.find(v => v.value === (formData.openaiVoice || "aura-asteria-en"))?.provider}
                      />
                    </div>
                  ) : isOpenAITelephony ? (
                    <div className="flex gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <Select
                          value={formData.openaiVoice}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, openaiVoice: value }))}
                        >
                          <SelectTrigger data-testid="select-openai-voice" className="w-full h-11 rounded-lg border-gray-200">
                            <SelectValue placeholder="Select OpenAI voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {openaiVoices.map((voice) => (
                              <SelectItem key={voice.value} value={voice.value}>
                                <div className="flex flex-col">
                                  <span>{voice.label}</span>
                                  <span className="text-xs text-muted-foreground">{voice.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <OpenAIVoicePreviewButton
                        voiceId={formData.openaiVoice}
                        voiceName={openaiVoices.find(v => v.value === formData.openaiVoice)?.label}
                        speed={formData.voiceSpeed}
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <VoiceSearchPicker
                          value={formData.elevenLabsVoiceId}
                          onChange={(voiceId) => setFormData(prev => ({ ...prev, elevenLabsVoiceId: voiceId }))}
                          placeholder="Select a voice"
                        />
                      </div>
                      <VoicePreviewButton
                        voiceId={formData.elevenLabsVoiceId}
                        voiceSettings={{
                          stability: formData.voiceStability,
                          similarity_boost: formData.voiceSimilarityBoost,
                          speed: formData.voiceSpeed,
                        }}
                        onSettingsChange={(settings) => {
                          setFormData(prev => ({
                            ...prev,
                            voiceStability: settings.stability,
                            voiceSimilarityBoost: settings.similarity_boost,
                            voiceSpeed: settings.speed ?? prev.voiceSpeed,
                          }));
                        }}
                        previewText={formData.firstMessage || undefined}
                        language={formData.language || undefined}
                        compact
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium text-gray-800">Language</Label>
                    <span className="inline-flex gap-1">
                      <span className="inline-flex items-center justify-center rounded px-1.5 h-5 text-[10px] font-semibold bg-gray-100 text-gray-500">EL</span>
                      <span className="inline-flex items-center justify-center rounded px-1.5 h-5 text-[10px] font-semibold bg-gray-100 text-gray-500">OA</span>
                    </span>
                  </div>
                  <Select
                    value={formData.language}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger data-testid="select-language" className="h-11 rounded-lg border-gray-200">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES
                      .filter((lang) => {
                        const isElevenLabs = formData.telephonyProvider === "twilio" || formData.telephonyProvider === "elevenlabs-sip";
                        const providerType = isElevenLabs ? "elevenlabs" : "openai";
                        return isProviderSupported(lang.value, providerType);
                      })
                      .map((lang) => (
                          <SelectItem
                            key={lang.value}
                            value={lang.value}
                          >
                            <LanguageOptionLabel
                              label={t(`agents.languages.${lang.value}`, { defaultValue: lang.label })}
                              providers={lang.providers}
                              compact
                            />
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "personality":
        return (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-[22px] font-semibold tracking-tight text-gray-900">
                Personality & Tone
              </h3>
              <p className="text-sm text-gray-500">
                Define how your agent sounds and behaves.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 px-0.5">
                  <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                    Voice Tone
                  </span>
                  <span className="text-xs text-gray-400">Select dominant style</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {voiceToneOptions.map((option) => {
                    const ToneIcon = option.icon;
                    const selected = formData.voiceTone === option.value;
                    return (
                      <button
                        type="button"
                        key={option.value}
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all bg-white",
                          selected
                            ? "border-blue-600"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => setFormData(prev => ({ ...prev, voiceTone: option.value }))}
                        data-testid={`tone-${option.value}`}
                      >
                        <div
                          className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                            selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                          )}
                        >
                          <ToneIcon className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[14px] text-gray-900 leading-none">
                              {option.label}
                            </span>
                            {option.isDefault && (
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-gray-500 mt-1 leading-snug">
                            {option.description}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center border-2",
                            selected ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
                          )}
                        >
                          {selected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-gray-900">Personality</span>
                <div className="grid grid-cols-2 gap-2">
                  {personalityOptions.map((option) => {
                    const selected = formData.personality === option.value;
                    return (
                      <button
                        type="button"
                        key={option.value}
                        className={cn(
                          "relative text-left px-3.5 py-3 rounded-xl border transition-all bg-white",
                          selected
                            ? "border-gray-800"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => setFormData(prev => ({ ...prev, personality: option.value }))}
                        data-testid={`personality-${option.value}`}
                      >
                        {selected && (
                          <Check className="absolute top-3 right-3 h-4 w-4 text-gray-800 stroke-[2.5]" />
                        )}
                        <span className="font-semibold text-[14px] text-gray-900 pr-6 leading-none">
                          {option.label}
                        </span>
                        <p className="text-[12px] text-gray-500 mt-1.5 leading-snug">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case "prompts":
        return (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-gray-900">Configure Prompts</h3>
                <p className="text-sm text-gray-500">
                  Customize what your agent says and how it behaves across incoming callers.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-lg border-gray-200"
                onClick={() => setTemplatesOpen(true)}
                data-testid="button-use-template"
              >
                <FileText className="h-4 w-4 mr-2" />
                Use Template
                <ChevronDown className="h-3.5 w-3.5 ml-1.5 opacity-60" />
              </Button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor="systemPrompt" className="text-sm font-medium text-gray-700">
                    System Prompt <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-normal bg-gray-100 text-gray-600 border-0">
                      GPT-4o Telephony Fine-tuned
                    </Badge>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      onClick={() => toast({ title: "Prompt looks good", description: "No critical issues detected in your system prompt." })}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Optimize
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                  <Textarea
                    id="systemPrompt"
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder="Describe your agent's role, responsibilities, and behavior guidelines..."
                    className="min-h-[150px] resize-none border-0 rounded-none focus-visible:ring-0 shadow-none"
                    data-testid="textarea-system-prompt"
                  />
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/80">
                    <div className="flex flex-wrap gap-1.5 min-w-0">
                      {systemPromptVars.length > 0 ? (
                        systemPromptVars.map((variable) => (
                          <Badge key={variable} variant="secondary" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-0">
                            {variable}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-400">No variables detected</span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {formData.systemPrompt.length} chars
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor="firstMessage" className="text-sm font-medium text-gray-700">
                    First Message <span className="text-gray-400 font-normal">(Initial Caller Greeting)</span>
                  </Label>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <Volume2 className="h-3.5 w-3.5" />
                    Spoken immediately on connect
                  </span>
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                  <Textarea
                    id="firstMessage"
                    value={formData.firstMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstMessage: e.target.value }))}
                    placeholder="What your agent says when answering a call..."
                    className="min-h-[80px] resize-none border-0 rounded-none focus-visible:ring-0 shadow-none"
                    data-testid="textarea-first-message"
                  />
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/80">
                    <div className="flex flex-wrap gap-1.5 min-w-0">
                      {firstMessageVars.length > 0 ? (
                        firstMessageVars.map((variable) => (
                          <Badge
                            key={variable}
                            variant="secondary"
                            className="text-[10px] font-mono bg-blue-50 text-blue-700 border-0 cursor-pointer"
                            onClick={() => setFormData(prev => ({ ...prev, firstMessage: prev.firstMessage + variable }))}
                            data-testid={`badge-wizard-variable-${variable.replace(/[{}]/g, '')}`}
                          >
                            {variable}
                          </Badge>
                        ))
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {['{{first_name}}', '{{company_name}}', '{{agent_name}}'].map((variable) => (
                            <Badge
                              key={variable}
                              variant="secondary"
                              className="text-[10px] font-mono cursor-pointer hover:bg-blue-50"
                              onClick={() => setFormData(prev => ({ ...prev, firstMessage: prev.firstMessage + variable }))}
                              data-testid={`badge-wizard-variable-${variable.replace(/[{}]/g, '')}`}
                            >
                              {variable}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {estimateAudioSeconds(formData.firstMessage || "")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
              <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Prompt Templates</DialogTitle>
                  <DialogDescription>
                    Choose a template to use as a starting point
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                  <PromptTemplatesLibrary
                    mode="select"
                    onSelectTemplate={(template) => {
                      setFormData(prev => ({
                        ...prev,
                        systemPrompt: template.systemPrompt,
                        firstMessage: template.firstMessage || prev.firstMessage,
                        voiceTone: template.suggestedVoiceTone || prev.voiceTone,
                        personality: template.suggestedPersonality || prev.personality,
                      }));
                      setTemplatesOpen(false);
                      toast({
                        title: "Template Applied",
                        description: "Template has been applied to your agent.",
                      });
                    }}
                  />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        );

      case "voice":
        return (
          <div className="space-y-8 py-2">
            <div className="text-center space-y-2">
              <h3 className="text-[22px] font-semibold tracking-tight text-gray-900">
                Fine-tune Voice
              </h3>
              <p className="text-sm text-gray-500">
                {isOpenAIOrCveVoice
                  ? formData.telephonyProvider === "custom-voice-engine"
                    ? "Custom Voice Engine voices are optimized for low-latency streaming"
                    : "OpenAI voice settings are optimized automatically"
                  : "Voice settings are optimized automatically"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Volume2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] text-gray-500">
                      <span className="uppercase tracking-wide font-medium text-gray-500">Selected Voice:</span>{" "}
                      <span className="font-semibold text-gray-900 text-[15px] normal-case tracking-normal">
                        {selectedVoiceLabel || "Not selected"}
                      </span>
                    </p>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Default
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedVoiceDescription || "Voice selected for this agent"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "review": {
        const reviewStepper = [
          { id: "role", label: "Role" },
          { id: "identity", label: "Identity" },
          { id: "voice", label: "Voice" },
          { id: "engine", label: "Engine" },
          { id: "rules", label: "Rules" },
          { id: "review", label: "Review" },
        ];

        const languageLabel = t(`agents.languages.${formData.language}`, {
          defaultValue: getLanguageLabel(formData.language),
        });

        const sampleButton = isOpenAIOrCveVoice ? (
          formData.telephonyProvider === "custom-voice-engine" ? (
            <CVEVoicePreviewButton
              voiceId={formData.openaiVoice || "aura-asteria-en"}
              voiceName={selectedVoiceLabel}
              provider={customVoiceEngineVoices.find(v => v.value === (formData.openaiVoice || "aura-asteria-en"))?.provider}
            />
          ) : (
            <OpenAIVoicePreviewButton
              voiceId={formData.openaiVoice}
              voiceName={selectedVoiceLabel}
              speed={formData.voiceSpeed}
            />
          )
        ) : formData.elevenLabsVoiceId ? (
          <VoicePreviewButton
            voiceId={formData.elevenLabsVoiceId}
            voiceSettings={{
              stability: formData.voiceStability,
              similarity_boost: formData.voiceSimilarityBoost,
              speed: formData.voiceSpeed,
            }}
            previewText={formData.firstMessage || undefined}
            language={formData.language || undefined}
            compact
          />
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-[11px] font-medium text-blue-600"
          >
            <Play className="h-3 w-3" />
            Sample
          </button>
        );

        return (
          <div className="space-y-5">
            <div className="flex items-center px-1 pt-1">
              {reviewStepper.map((step, index) => {
                const isLast = index === reviewStepper.length - 1;
                const isActive = step.id === "review";
                return (
                  <div key={step.id} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-blue-600 text-white">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                      <span
                        className={cn(
                          "text-[11px] text-center truncate w-full",
                          isActive ? "font-semibold text-blue-600" : "text-gray-400"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className="h-0.5 bg-blue-600 flex-1 min-w-[10px] mb-5 -mx-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 mb-1">
                <Check className="h-7 w-7 text-white stroke-[3]" />
              </div>
              <h3 className="text-[22px] font-semibold tracking-tight text-gray-900">
                Review Your Agent
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Everything looks good! Review the configured telephony parameters and deploy your agent.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-gray-100">
                <div className="bg-white p-4">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Use Case</p>
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-sm font-semibold text-blue-600">
                      {selectedUseCase?.title || "Custom"}
                    </span>
                  </div>
                </div>
                <div className="bg-white p-4">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Name</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-sm font-semibold text-blue-600 truncate">{formData.name}</span>
                  </div>
                </div>
                <div className="bg-white p-4">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Telephony Provider</p>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-900">
                      {getTelephonyLabel(formData.telephonyProvider)}
                    </span>
                  </div>
                </div>
                <div className="bg-white p-4">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Voice</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{selectedVoiceLabel}</span>
                    {sampleButton}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Language</p>
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-gray-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-900 truncate">{languageLabel}</span>
                  </div>
                </div>
                <div className="bg-white p-4">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Voice Tone</p>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 capitalize">
                    {formData.voiceTone}
                  </span>
                </div>
                <div className="bg-white p-4">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Personality</p>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 capitalize">
                    {formData.personality}
                  </span>
                </div>
                <div className="bg-white p-4">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Response Buffer</p>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-900">
                      {isOpenAITelephony
                        ? "Realtime WebRTC (~400ms)"
                        : `${formData.turnTimeout.toFixed(1)}s`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 p-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 min-h-[72px]">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">System Prompt</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                    {formData.systemPrompt || "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 min-h-[64px]">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">First Message</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {formData.firstMessage || "Hello! How can I help you today?"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }
    }
  };

  const renderFooter = () => {
    if (currentStep === "useCase") {
      return (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 bg-gray-50/70">
          <button
            type="button"
            disabled
            className="inline-flex items-center text-sm text-gray-300 cursor-not-allowed"
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="h-4 w-4 mr-0.5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
              onClick={() => {
                onOpenChange(false);
                resetWizard();
              }}
            >
              Cancel
            </button>
            <Button
              onClick={goNext}
              disabled={!canProceed}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 px-5"
              data-testid="button-wizard-next"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      );
    }

    if (currentStep === "basics") {
      return (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 bg-white">
          <Button
            variant="outline"
            onClick={goBack}
            className="rounded-lg border-gray-200 h-10 px-4"
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            {canProceed && (
              <span className="text-xs text-gray-400 hidden sm:inline">
                Step 2 of 6 completed
              </span>
            )}
            <Button
              onClick={goNext}
              disabled={!canProceed}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 px-5"
              data-testid="button-wizard-next"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          {validationHint && (
            <p className="sr-only" data-testid="text-wizard-hint">
              {validationHint}
            </p>
          )}
        </div>
      );
    }

    if (currentStep === "personality") {
      return (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 bg-white">
          <Button
            variant="outline"
            onClick={goBack}
            className="rounded-lg border-gray-200 h-10 px-4"
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={goNext}
            disabled={!canProceed}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 px-5"
            data-testid="button-wizard-next"
          >
            Continue
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      );
    }

    if (currentStep === "prompts") {
      return (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
          <Button
            variant="outline"
            onClick={goBack}
            className="rounded-lg"
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="text-gray-500" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button
              onClick={goNext}
              disabled={!canProceed}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg min-w-[110px]"
              data-testid="button-wizard-next"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      );
    }

    if (currentStep === "voice") {
      return (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 bg-white">
          <button
            type="button"
            onClick={goBack}
            className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center"
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="h-4 w-4 mr-0.5" />
            Back
          </button>
          <Button
            onClick={goNext}
            disabled={!canProceed}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 px-5"
            data-testid="button-wizard-next"
          >
            Continue
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      );
    }

    if (currentStep === "review") {
      return (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 bg-white">
          <Button
            variant="outline"
            onClick={goBack}
            className="rounded-lg border-gray-200 h-10 px-4"
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
              onClick={() => {
                onOpenChange(false);
                resetWizard();
              }}
            >
              Cancel
            </button>
            <Button
              onClick={() => {
                if (!hasValidVoice) {
                  toast({
                    title: "Voice required",
                    description: "Go back to Basic Info and select a voice before creating the agent.",
                    variant: "destructive",
                  });
                  return;
                }
                createMutation.mutate();
              }}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 px-5"
              data-testid="button-wizard-create"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Create Agent
                </>
              )}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
        <Button
          variant="outline"
          onClick={goBack}
          className="rounded-lg"
          data-testid="button-wizard-back"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={goNext}
          disabled={!canProceed}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg min-w-[110px]"
          data-testid="button-wizard-next"
        >
          Continue
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetWizard();
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent
        className={cn(
          "p-0 gap-0 sm:rounded-2xl bg-white shadow-xl border border-gray-200",
          currentStep === "personality"
            ? "max-w-[640px] max-h-[90vh] !flex flex-col overflow-hidden"
            : currentStep === "voice"
              ? "max-w-[560px] overflow-visible"
              : currentStep === "review"
                ? "max-w-[600px] max-h-[90vh] !flex flex-col overflow-hidden"
                : "max-w-[880px] overflow-visible"
        )}
        hideCloseButton={false}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                currentStep === "voice" ? "bg-blue-50" : "bg-blue-600"
              )}
            >
              {currentStep === "review" ? (
                <Bot className="h-5 w-5 text-white" />
              ) : (
                <Wand2 className={cn("h-5 w-5", currentStep === "voice" ? "text-blue-600" : "text-white")} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 leading-none">Create AI Agent</h2>
                {currentStep === "personality" ? (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600">
                    Step {currentStepIndex + 1} of {steps.length}
                  </span>
                ) : currentStep !== "voice" ? (
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                    WIZARD
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-sm text-gray-500">
                  Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex].title}
                </p>
                {currentStep === "voice" && (
                  <div className="flex items-center gap-1">
                    {steps.map((step, index) => (
                      <div
                        key={step.id}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          index <= currentStepIndex ? "w-4 bg-blue-600" : "w-4 bg-gray-200"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {currentStep !== "personality" && currentStep !== "voice" && currentStep !== "review" && (
            <div className="flex items-center gap-1.5 pt-2.5 pr-7">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    index <= currentStepIndex ? "bg-blue-600" : "bg-gray-300"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {currentStep !== "review" && (
          <div className="h-px bg-gray-200 relative shrink-0">
            <div
              className="absolute left-0 top-0 h-[2px] -mt-px bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.max(12, progress)}%` }}
            />
          </div>
        )}

        {currentStep === "personality" || currentStep === "review" ? (
          <div
            className={cn(
              "min-h-0 overflow-y-auto overscroll-contain px-5 py-4",
              currentStep === "review" ? "max-h-[72vh]" : "max-h-[55vh]"
            )}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className={cn("px-6", currentStep === "voice" ? "py-8" : "py-6")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        <div className="shrink-0">
          {renderFooter()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AgentCreationWizard;
