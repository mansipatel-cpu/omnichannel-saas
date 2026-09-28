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
import { useMutation, useQuery } from "@tanstack/react-query";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { apiRequest, apiRequestFormData, queryClient } from "@/shared/lib/queryClient";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppHeader } from "@/shared/components/AppPageHeader";
import { useBranding } from "@/shared/components/BrandingProvider";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/shared/components/ui/select";
import { MARKETING_SUBTYPES, WHATSAPP_LANGUAGES } from "@wa/lib/template-constants";
import { ArrowLeft, Zap, Check, Trash2, MessageCircle, Link2, Phone, Smile, ShieldCheck, Clock, ExternalLink, CheckCircle2, PlusCircle, SlidersHorizontal, } from "lucide-react";
const HEADER_FORMATS = [
    { value: "none", label: "None" },
    { value: "text", label: "Text" },
    { value: "image", label: "Image" },
    { value: "video", label: "Video" },
    { value: "document", label: "Document" },
];
const BUTTON_KIND_LABEL = {
    QUICK_REPLY: "Quick Reply",
    URL: "Visit Website URL",
    PHONE_NUMBER: "Phone Call",
};
function authFetch(url) {
    const headers = {};
    const authHeader = AuthStorage.getAuthHeader();
    if (authHeader)
        headers.Authorization = authHeader;
    return fetch(url, { credentials: "include", headers });
}
function nextId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function extractVars(text) {
    return Array.from(text.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1]));
}
function highlightBody(text, samples) {
    const parts = text.split(/(\{\{\d+\}\})/g);
    return parts.map((part, index) => {
        const match = part.match(/\{\{(\d+)\}\}/);
        if (!match)
            return <span key={index}>{part}</span>;
        const n = Number(match[1]);
        const value = samples[n]?.trim();
        return (<span key={index} className="text-[#007BFF] font-medium">
        {value || part}
      </span>);
    });
}
function SectionBadge({ n }) {
    return (<span className="h-6 w-6 rounded-md bg-[#007BFF] text-white text-xs font-semibold flex items-center justify-center">
      {n}
    </span>);
}
export default function CreateWhatwayTemplate() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const { setPageMeta } = useAppHeader();
    const { branding } = useBranding();
    const bodyRef = useRef(null);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("MARKETING");
    const [language, setLanguage] = useState("en_US");
    const [marketingType, setMarketingType] = useState("CUSTOM");
    const [headerFormat, setHeaderFormat] = useState("text");
    const [headerTitle, setHeaderTitle] = useState("");
    const [headerFile, setHeaderFile] = useState(null);
    const [body, setBody] = useState("");
    const [samples, setSamples] = useState({});
    const [footer, setFooter] = useState("");
    const [buttons, setButtons] = useState([]);
    useEffect(() => {
        setPageMeta({
            title: "Create Whatway Template",
            subtitle: "Configure WhatsApp Business API HSM template specification for campaigns and automated dispatches.",
        });
        return () => setPageMeta(null);
    }, [setPageMeta]);
    const { data: activeChannel } = useQuery({
        queryKey: ["/api/whatsapp/channels/active"],
        queryFn: async () => {
            try {
                const response = await authFetch("/api/whatsapp/channels/active");
                if (!response.ok)
                    return null;
                return response.json();
            }
            catch {
                return null;
            }
        },
    });
    const nameValid = /^[a-z0-9_]+$/.test(name) && name.length >= 3;
    const bodyVars = useMemo(() => Array.from(new Set(extractVars(body))).sort((a, b) => a - b), [body]);
    const sequential = bodyVars.length === 0 || bodyVars.every((value, index) => value === index + 1);
    const hasOptOut = /stop|unsubscribe|opt.?out/i.test(footer);
    const authSafe = category !== "AUTHENTICATION" || !/(discount|promo|offer|sale)/i.test(body);
    const checks = [
        { ok: sequential, label: "Variable ordering is strictly sequential {{1}}, {{2}}, {{3}}" },
        { ok: authSafe, label: "No promotional claims in auth payload" },
        { ok: category === "AUTHENTICATION" || hasOptOut, label: "Opt-out text present in message footer" },
    ];
    const passCount = checks.filter((item) => item.ok).length;
    const passRate = Math.round((passCount / checks.length) * 100);
    const insertAtCursor = (snippet) => {
        const el = bodyRef.current;
        if (!el) {
            setBody((current) => current + snippet);
            return;
        }
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const next = body.slice(0, start) + snippet + body.slice(end);
        setBody(next);
        requestAnimationFrame(() => {
            el.focus();
            const pos = start + snippet.length;
            el.setSelectionRange(pos, pos);
        });
    };
    const wrapSelection = (before, after = before) => {
        const el = bodyRef.current;
        if (!el)
            return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selected = body.slice(start, end) || "text";
        const next = body.slice(0, start) + before + selected + after + body.slice(end);
        setBody(next);
    };
    const addVariable = () => {
        const next = (bodyVars[bodyVars.length - 1] || 0) + 1;
        insertAtCursor(`{{${next}}}`);
    };
    const addHeaderVariable = () => {
        if (headerTitle.includes("{{1}}"))
            return;
        setHeaderTitle((current) => `${current}{{1}}`);
    };
    const addButton = () => {
        if (buttons.length >= 3)
            return;
        const types = ["QUICK_REPLY", "URL", "PHONE_NUMBER"];
        const type = types[buttons.length] || "QUICK_REPLY";
        setButtons((current) => [...current, { id: nextId(), type, text: "" }]);
    };
    const updateButton = (id, patch) => {
        setButtons((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    };
    const syncMutation = useMutation({
        mutationFn: async () => {
            if (!activeChannel?.id)
                throw new Error("Create a WhatsApp channel before syncing templates.");
            const response = await apiRequest("POST", "/api/whatsapp/templates/sync", { channelId: activeChannel.id });
            return response.json();
        },
        onSuccess: () => toast({ title: "Templates synced" }),
        onError: (error) => toast({ title: "Sync failed", description: error.message, variant: "destructive" }),
    });
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!nameValid)
                throw new Error("Template name must be lowercase letters, numbers, and underscores.");
            if (!body.trim())
                throw new Error("Message body is required");
            if (!activeChannel?.id)
                throw new Error("Create a WhatsApp channel before saving a template.");
            if (!sequential)
                throw new Error("Variables must be sequential: {{1}}, {{2}}, {{3}}.");
            const formData = new FormData();
            formData.append("name", name.trim());
            formData.append("category", category);
            formData.append("language", language);
            formData.append("body", body.trim());
            formData.append("channelId", activeChannel.id);
            if (footer.trim())
                formData.append("footer", footer.trim());
            if (headerFormat === "text" && headerTitle.trim())
                formData.append("header", headerTitle.trim());
            if (headerFormat !== "none" && headerFormat !== "text" && headerFile) {
                formData.append("mediaFile", headerFile);
                formData.append("mediaType", headerFormat);
            }
            if (marketingType && marketingType !== "CUSTOM")
                formData.append("marketingSubType", marketingType);
            if (bodyVars.length) {
                formData.append("samples", JSON.stringify(bodyVars.map((n) => samples[n] || `Sample ${n}`)));
            }
            const payload = buttons
                .filter((item) => item.text.trim())
                .map((item) => {
                if (item.type === "URL")
                    return { type: "URL", text: item.text, url: item.url || "" };
                if (item.type === "PHONE_NUMBER")
                    return { type: "PHONE_NUMBER", text: item.text, phone_number: item.phone || "" };
                return { type: "QUICK_REPLY", text: item.text };
            });
            if (payload.length)
                formData.append("buttons", JSON.stringify(payload));
            return apiRequestFormData("POST", "/api/whatsapp/templates", formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
            toast({ title: "Template created" });
            setLocation("/templates");
        },
        onError: (error) => {
            toast({ title: "Failed to create template", description: error.message || "Please try again", variant: "destructive" });
        },
    });
    const brandName = branding?.app_name || "Official";
    const fieldClass = "h-11 bg-[#F4F6F8] border-transparent rounded-md";
    return (<div className="space-y-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-slate-400">
          <Link href="/dashboard" className="hover:text-slate-600">Home</Link>
          <span>/</span>
          <Link href="/templates" className="hover:text-slate-600">Templates</Link>
          <span>/</span>
          <span className="text-slate-600">Add Whatway Template</span>
        </div>
        <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="h-10 shrink-0 bg-white border-slate-200 text-[#007BFF]" data-testid="button-meta-sync">
          <Zap className="h-4 w-4 mr-2"/>
          Meta Sync
        </Button>
      </div>

      <button type="button" onClick={() => setLocation("/templates")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800" data-testid="button-back-templates">
        <ArrowLeft className="h-4 w-4"/>
        Back
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <SectionBadge n={1}/>
                <h3 className="font-semibold text-slate-900">Basic Information</h3>
              </div>
              <span className="text-xs text-slate-400">Required Fields *</span>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Template Name *</Label>
                  <span className="text-xs text-slate-400">Unique Meta identifier</span>
                </div>
                <div className="relative">
                  <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="seasonal_promo_discount_q3" className={fieldClass}/>
                  {nameValid && <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500"/>}
                </div>
                <p className="text-xs text-slate-400">Lowercase letters, numbers, and underscores only. This cannot be modified once approved.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <Select value={category} onValueChange={(value) => {
            setCategory(value);
            if (value !== "MARKETING")
                setMarketingType("CUSTOM");
        }}>
                    <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Language *</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WHATSAPP_LANGUAGES.map((item) => (<SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Marketing Type</Label>
                  <Select value={marketingType} onValueChange={setMarketingType} disabled={category !== "MARKETING"}>
                    <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MARKETING_SUBTYPES.map((item) => (<SelectItem key={item.value} value={item.value}>
                          {item.value === "CUSTOM" ? "Custom Promotional" : item.label}
                        </SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <SectionBadge n={2}/>
                <h3 className="font-semibold text-slate-900">Header Configuration</h3>
              </div>
              <span className="text-xs text-slate-400">Optional Header</span>
            </div>
            <div className="inline-flex rounded-md bg-[#F4F6F8] p-1 mb-4">
              {HEADER_FORMATS.map((format) => (<button key={format.value} type="button" onClick={() => setHeaderFormat(format.value)} className={`h-9 px-3 rounded-md text-sm ${headerFormat === format.value ? "bg-white text-[#007BFF] shadow-sm" : "text-slate-500"}`}>
                  {format.label}
                </button>))}
            </div>
            {headerFormat === "text" && (<div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Header Title</Label>
                  <button type="button" onClick={addHeaderVariable} className="text-sm text-[#007BFF]">
                    + Add Variable {"{{1}}"}
                  </button>
                </div>
                <Input value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value.slice(0, 60))} placeholder="Special Offer: 30% Off Your Next Transfer!" className={fieldClass}/>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Keep headers concise to grab immediate recipient attention.</span>
                  <span>{headerTitle.length} / 60</span>
                </div>
              </div>)}
            {(headerFormat === "image" || headerFormat === "video" || headerFormat === "document") && (<Input type="file" onChange={(e) => setHeaderFile(e.target.files?.[0] || null)} className="h-11 bg-[#F4F6F8] border-transparent rounded-md pt-2.5"/>)}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SectionBadge n={3}/>
                <h3 className="font-semibold text-slate-900">Message Body <span className="text-red-500">*</span></h3>
              </div>
              <span className="rounded-full bg-blue-50 text-[#007BFF] text-xs font-medium px-2.5 py-1">Max 1024 chars</span>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-[#F4F6F8] border-b border-slate-200">
                <button type="button" className="h-8 w-8 rounded-md text-sm font-bold" onClick={() => wrapSelection("*")}>B</button>
                <button type="button" className="h-8 w-8 rounded-md text-sm italic" onClick={() => wrapSelection("_")}>I</button>
                <button type="button" className="h-8 w-8 rounded-md text-sm line-through" onClick={() => wrapSelection("~")}>T</button>
                <button type="button" className="h-8 w-8 rounded-md text-sm" onClick={() => wrapSelection("```")}>&lt;&gt;</button>
                <span className="w-px h-5 bg-slate-200 mx-1"/>
                <button type="button" className="h-8 px-2 rounded-md text-sm text-slate-600 flex items-center gap-1" onClick={() => insertAtCursor("🙂")}>
                  <Smile className="h-4 w-4"/> Emoji
                </button>
                <button type="button" onClick={addVariable} className="ml-auto h-8 px-3 rounded-md border border-[#007BFF] text-[#007BFF] text-sm">
                  {"{}"} + Add Variable
                </button>
              </div>
              <Textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value.slice(0, 1024))} rows={6} className="border-0 rounded-none min-h-[140px] resize-none focus-visible:ring-0" placeholder="Hello {{1}}, we noticed you haven't completed your deposit..."/>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
              <span>Variables must be sequential: {"{{1}}, {{2}}, {{3}}"}</span>
              <span>{body.length} / 1024</span>
            </div>
            {bodyVars.length > 0 && (<div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-slate-400"/>
                    Sample Parameter Values (Required for Meta Review)
                  </p>
                  <span className="text-xs text-slate-400">Previews real content</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyVars.map((n) => (<div key={n} className="space-y-1.5">
                      <Label className="text-xs text-[#007BFF]">{"{{"}{n}{"}}"} Sample</Label>
                      <Input value={samples[n] || ""} onChange={(e) => setSamples((current) => ({ ...current, [n]: e.target.value }))} className={fieldClass} placeholder={`Value for {{${n}}}`}/>
                    </div>))}
                </div>
              </div>)}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <SectionBadge n={4}/>
                <h3 className="font-semibold text-slate-900">Footer & Interactive Actions</h3>
              </div>
              <span className="text-xs text-slate-400">Optional CTA Triggers</span>
            </div>
            <div className="space-y-1.5 mb-5">
              <div className="flex items-center justify-between">
                <Label>Footer Disclaimer</Label>
                <span className="text-xs text-slate-400">{footer.length} / 60</span>
              </div>
              <Input value={footer} onChange={(e) => setFooter(e.target.value.slice(0, 60))} placeholder="Reply STOP to unsubscribe" className={fieldClass}/>
              <p className="text-xs text-slate-400">Include opt-out guidance (e.g. Reply STOP) to ensure high Meta approval rates.</p>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">Interactive Buttons (Up to 3)</p>
              <button type="button" onClick={addButton} disabled={buttons.length >= 3} className="text-sm text-[#007BFF] disabled:opacity-40">
                + Add Button
              </button>
            </div>
            <div className="space-y-3">
              {buttons.map((button, index) => (<div key={button.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md bg-slate-100 text-xs font-semibold flex items-center justify-center">{index + 1}</span>
                      {button.type === "QUICK_REPLY" && <MessageCircle className="h-4 w-4 text-[#007BFF]"/>}
                      {button.type === "URL" && <Link2 className="h-4 w-4 text-[#007BFF]"/>}
                      {button.type === "PHONE_NUMBER" && <Phone className="h-4 w-4 text-[#007BFF]"/>}
                      <Select value={button.type} onValueChange={(value) => updateButton(button.id, { type: value })}>
                        <SelectTrigger className="h-8 w-[200px] border-0 shadow-none text-[#007BFF] px-0">
                          <SelectValue>{BUTTON_KIND_LABEL[button.type]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                          <SelectItem value="URL">Visit Website URL</SelectItem>
                          <SelectItem value="PHONE_NUMBER">Phone Call</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <button type="button" onClick={() => setButtons((current) => current.filter((item) => item.id !== button.id))} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>
                  {button.type === "QUICK_REPLY" ? (<Input value={button.text} onChange={(e) => updateButton(button.id, { text: e.target.value })} placeholder="Button label" className={fieldClass}/>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input value={button.text} onChange={(e) => updateButton(button.id, { text: e.target.value })} placeholder="Button label" className={fieldClass}/>
                      {button.type === "URL" ? (<Input value={button.url || ""} onChange={(e) => updateButton(button.id, { url: e.target.value })} placeholder="https://" className={fieldClass}/>) : (<Input value={button.phone || ""} onChange={(e) => updateButton(button.id, { phone: e.target.value })} placeholder="+1 800 555 0199" className={fieldClass}/>)}
                    </div>)}
                </div>))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500 shrink-0">
              <ShieldCheck className="h-4 w-4 text-emerald-500"/>
              Verified Meta Account
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => setLocation("/templates")} className="h-10 min-w-[160px] px-5 rounded-md bg-white border-slate-200" data-testid="button-cancel-template">
                Cancel
              </Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="h-10 min-w-[160px] px-5 rounded-md bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent" data-testid="button-create-whatway-template">
                <PlusCircle className="h-4 w-4 mr-2"/>
                {createMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5 xl:sticky xl:top-6 self-start">
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500"/>
              <p className="text-sm font-semibold text-slate-800">Live Template Preview</p>
            </div>
            <div className="p-4 bg-slate-50">
              <div className="mx-auto w-[280px] rounded-[2rem] bg-slate-900 p-2 shadow-lg">
                <div className="rounded-[1.6rem] overflow-hidden bg-[#e5ddd5] min-h-[420px]">
                  <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-white/20"/>
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        {brandName}
                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-200"/>
                      </p>
                      <p className="text-[10px] text-white/70">WhatsApp Business</p>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      {headerFormat === "text" && headerTitle && (<p className="text-sm font-semibold text-slate-900 mb-1">{headerTitle.replace("{{1}}", samples[1] || "{{1}}")}</p>)}
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {body ? highlightBody(body, samples) : <span className="text-slate-400">Message body will appear here.</span>}
                      </p>
                      {footer && <p className="text-[11px] text-slate-400 mt-2">{footer}</p>}
                      <p className="text-[10px] text-slate-400 text-right mt-1">10:42 AM ✓✓</p>
                    </div>
                    {buttons.filter((item) => item.text).map((item) => (<div key={item.id} className="bg-white rounded-lg px-3 py-2 text-center text-sm text-[#007BFF] border border-slate-100">
                        {item.text}
                      </div>))}
                    <p className="text-[10px] text-center text-amber-800/80 bg-amber-50 rounded-md py-1">Messages are end-to-end encrypted.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${passRate === 100 ? "bg-emerald-500" : "bg-amber-500"}`}/>
                <p className="text-sm font-semibold text-slate-800">Meta Compliance Pre-Check</p>
              </div>
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${passRate === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {passRate}% Pass
              </span>
            </div>
            <div className="space-y-2">
              {checks.map((item) => (<div key={item.label} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className={`h-4 w-4 mt-0.5 ${item.ok ? "text-emerald-500" : "text-slate-300"}`}/>
                  <span>{item.label}</span>
                </div>))}
              <div className="flex items-start gap-2 text-sm text-slate-500 pt-1">
                <Clock className="h-4 w-4 mt-0.5 text-[#007BFF]"/>
                Estimated approval SLA: ~15 minutes via Cloud API
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>Quality Score: Tier-1 High</span>
              <a href="https://developers.facebook.com/docs/whatsapp/message-templates" target="_blank" rel="noreferrer" className="text-[#007BFF] inline-flex items-center gap-1">
                Meta Guidelines <ExternalLink className="h-3 w-3"/>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>);
}
