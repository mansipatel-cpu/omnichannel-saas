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
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  CheckCircle2,
  Headphones,
  Mic,
  Plus,
  Shield,
  User,
} from "lucide-react";

const CATEGORIES = [
  { value: "billing", label: "Voice Call / Billing & Collections" },
  { value: "sales", label: "Voice Call / Sales" },
  { value: "support", label: "Voice Call / Support" },
  { value: "appointment", label: "Transactional" },
  { value: "survey", label: "Voice Call / Survey" },
  { value: "general", label: "Voice Call / General" },
];

const LANGUAGES = [
  { value: "en_US", label: "English (US) - Neutral" },
  { value: "en_GB", label: "English (UK) - Neutral" },
  { value: "en_IN", label: "English (India) - Neutral" },
  { value: "es_US", label: "Spanish (US)" },
  { value: "hi_IN", label: "Hindi (India)" },
];

const VARIABLE_TAGS = [
  { key: "first_name", label: "Recipient Name" },
  { key: "amount", label: "Outstanding Due" },
  { key: "due_date", label: "Due Date" },
];

const VOICE_TONES = [
  { value: "Professional", description: "Calm, clear, corporate." },
  { value: "Empathetic", description: "Warm, supportive, gentle." },
  { value: "Urgent", description: "Direct, alert, time-sensitive." },
  { value: "Friendly", description: "Conversational, upbeat." },
];

const PERSONALITIES = [
  { value: "Financial Advisor", description: "Composed, authoritative yet respectful and helpful.", icon: User },
  { value: "Support Specialist", description: "Patient, solutions-oriented, and reassuring guide.", icon: Headphones },
  { value: "Compliance Officer", description: "Strict adherence to regulatory disclosures and clarity.", icon: Shield },
];

function SectionBadge({ n }: { n: number }) {
  return (
    <span className="h-6 w-6 rounded-full bg-[#007BFF] text-white text-xs font-semibold flex items-center justify-center">
      {n}
    </span>
  );
}

function extractVars(text: string) {
  return Array.from(new Set(Array.from(text.matchAll(/\{\{(\w+)\}\}/g)).map((match) => match[1])));
}

export default function CreateAgentLabTemplate() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setPageMeta } = useAppHeader();
  const greetingRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("billing");
  const [language, setLanguage] = useState("en_US");
  const [description, setDescription] = useState("");
  const [greeting, setGreeting] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [personality, setPersonality] = useState("Financial Advisor");

  useEffect(() => {
    setPageMeta({
      title: "Create AgentLab Voice Template",
      subtitle: "Configure automated AI voice calling scripts, prompts, tones, and conversational personality.",
    });
    return () => setPageMeta(null);
  }, [setPageMeta]);

  const nameValid = /^[a-z0-9_]+$/.test(name) && name.length >= 3;
  const detectedVars = useMemo(() => extractVars(`${greeting}\n${prompt}`), [greeting, prompt]);
  const visibleTags = useMemo(() => {
    const known = VARIABLE_TAGS.filter((item) => detectedVars.includes(item.key) || greeting.length === 0);
    const extra = detectedVars
      .filter((key) => !VARIABLE_TAGS.some((item) => item.key === key))
      .map((key) => ({ key, label: key.replace(/_/g, " ") }));
    return greeting.length === 0 ? VARIABLE_TAGS : [...known, ...extra];
  }, [detectedVars, greeting.length]);

  const insertVariable = (key: string) => {
    const snippet = `{{${key}}}`;
    const el = greetingRef.current;
    if (!el) {
      setGreeting((current) => `${current}${snippet}`.slice(0, 380));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${greeting.slice(0, start)}${snippet}${greeting.slice(end)}`.slice(0, 380);
    setGreeting(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!nameValid) throw new Error("Template name must be lowercase letters, numbers, and underscores.");
      if (!description.trim()) throw new Error("Description is required");
      if (!greeting.trim()) throw new Error("First message is required");
      if (!prompt.trim()) throw new Error("System prompt is required");

      const response = await apiRequest("POST", "/api/prompt-templates", {
        name: name.trim(),
        description: description.trim(),
        category,
        systemPrompt: prompt.trim(),
        firstMessage: greeting.trim(),
        variables: extractVars(`${greeting}\n${prompt}`),
        suggestedVoiceTone: `${tone} • ${LANGUAGES.find((item) => item.value === language)?.label || language}`,
        suggestedPersonality: personality,
        isPublic: false,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "Voice template created" });
      setLocation("/templates");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create template",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const fieldClass = "h-11 bg-[#F4F6F8] border-transparent rounded-md";

  return (
    <div className="space-y-4 pb-8 max-w-5xl">
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <Link href="/dashboard" className="hover:text-slate-600">Home</Link>
        <span>/</span>
        <Link href="/templates" className="hover:text-slate-600">Templates</Link>
        <span>/</span>
        <span className="text-slate-600">Add AgentLab Template</span>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <SectionBadge n={1} />
          <h3 className="text-sm font-bold tracking-wide text-slate-800">TEMPLATE SPECIFICATIONS</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Template Name <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Mic className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="agentlab_balance_reminder_v2"
                className={`${fieldClass} pl-9 pr-10`}
              />
              {nameValid && <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />}
            </div>
            <p className="text-xs text-slate-400">Lowercase letters, numbers, and underscores only. Used to invoke template via API and Dial Trunks.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category <span className="text-red-500">*</span></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Synthesis Language & Accent</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-red-500">*</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe when this voice script should be used."
              className="bg-[#F4F6F8] border-transparent rounded-md min-h-[110px]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <SectionBadge n={2} />
          <h3 className="text-sm font-bold tracking-wide text-slate-800">PROMPT & CONVERSATIONAL FLOW</h3>
        </div>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>First Message (Call Greeting) <span className="text-red-500">*</span></Label>
              <span className="text-xs text-slate-400">{greeting.length} / 380 chars</span>
            </div>
            <Textarea
              ref={greetingRef}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value.slice(0, 380))}
              rows={4}
              placeholder="Hello {{first_name}}, this is an automated priority notification..."
              className="bg-[#F4F6F8] border-transparent rounded-md min-h-[110px]"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {visibleTags.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => insertVariable(tag.key)}
                  className="h-7 px-2.5 rounded-md bg-blue-50 text-[#007BFF] text-xs font-medium"
                >
                  {`{{${tag.key}}}`} = {tag.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Prompt (Agent Behavior & System Instructions) <span className="text-red-500">*</span></Label>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-blue-50">
                <p className="text-sm font-semibold text-slate-800">Agent Persona Directives</p>
                <p className="text-xs text-slate-500 font-mono">Model: GPT-4o-mini-voice</p>
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                placeholder="You are AgentLab, an intelligent voice representative..."
                className="border-0 rounded-none min-h-[180px] resize-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <SectionBadge n={3} />
          <h3 className="text-sm font-bold tracking-wide text-slate-800">VOICE TONE & PERSONALITY SETTINGS</h3>
        </div>
        <div className="space-y-5">
          <div>
            <Label className="mb-3 block">Suggested Voice Tone</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {VOICE_TONES.map((item) => {
                const selected = tone === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTone(item.value)}
                    className={`relative text-left rounded-xl border p-4 bg-white ${
                      selected ? "border-[#007BFF]" : "border-slate-200"
                    }`}
                  >
                    {selected && (
                      <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-[#007BFF]" />
                    )}
                    <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="mb-3 block">Suggested Personality</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PERSONALITIES.map((item) => {
                const selected = personality === item.value;
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPersonality(item.value)}
                    className={`relative text-left rounded-xl border p-4 bg-white ${
                      selected ? "border-[#007BFF]" : "border-slate-200"
                    }`}
                  >
                    {selected && (
                      <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-[#007BFF]" />
                    )}
                    <Icon className={`h-4 w-4 mb-2 ${selected ? "text-[#007BFF]" : "text-slate-400"}`} />
                    <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setLocation("/templates")}
          className="rounded-md h-10 px-4 text-slate-600"
          data-testid="button-cancel-agentlab-template"
        >
          Cancel
        </Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="h-10 min-w-[200px] px-5 rounded-md bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
          data-testid="button-create-agentlab-template"
        >
          <Plus className="h-4 w-4 mr-2" />
          {createMutation.isPending ? "Creating..." : "Create Voice Template"}
        </Button>
      </div>
    </div>
  );
}
