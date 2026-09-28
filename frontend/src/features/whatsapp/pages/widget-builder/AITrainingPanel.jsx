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
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiRequestFormData, queryClient } from "@wa/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@wa/components/ui/card";
import { Label } from "@wa/components/ui/label";
import { Input } from "@wa/components/ui/input";
import { Textarea } from "@wa/components/ui/textarea";
import { Button } from "@wa/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@wa/components/ui/select";
import { Switch } from "@wa/components/ui/switch";
import { Badge } from "@wa/components/ui/badge";
import { ScrollArea } from "@wa/components/ui/scroll-area";
import { Separator } from "@wa/components/ui/separator";
import { Slider } from "@wa/components/ui/slider";
import { useToast } from "@wa/hooks/use-toast";
import { Globe, FileUp, Plus, Trash2, RefreshCw, BookOpen, MessageSquare, AlertTriangle, CheckCircle2, Clock, XCircle, Loader2, X, Send, Database, Brain, Shield, Sparkles, Eye, Save, Settings, Key, Cpu, Check, } from "lucide-react";
export default function AITrainingPanel({ config, updateConfig, siteId, channelId, }) {
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [urlInput, setUrlInput] = useState("");
    const [urlName, setUrlName] = useState("");
    const [newQuestion, setNewQuestion] = useState("");
    const [newAnswer, setNewAnswer] = useState("");
    const [newCategory, setNewCategory] = useState("general");
    const [newTriggerPhrase, setNewTriggerPhrase] = useState("");
    const [activeSection, setActiveSection] = useState("training");
    const [testMessage, setTestMessage] = useState("");
    const [testMessages, setTestMessages] = useState([]);
    const [isTesting, setIsTesting] = useState(false);
    const [newTriggerWord, setNewTriggerWord] = useState("");
    const [aiConfigForm, setAiConfigForm] = useState({
        provider: "vertex",
        apiKey: "",
        model: "gemini-1.5-flash",
        endpoint: "https://api.openai.com/v1",
        temperature: 0.1,
        maxTokens: 2048,
        words: [],
        isActive: true,
    });
    const isVertex = aiConfigForm.provider === "vertex";
    const [aiConfigId, setAiConfigId] = useState(null);
    const [isSavingAiConfig, setIsSavingAiConfig] = useState(false);
    const { data: aiConfigData, refetch: refetchAiConfig } = useQuery({
        queryKey: ["/api/whatsapp/ai-settings/channel", channelId],
        queryFn: async () => {
            if (!channelId)
                return null;
            const res = await apiRequest("GET", `/api/whatsapp/ai-settings/channel/${channelId}`);
            if (!res.ok)
                return null;
            return await res.json();
        },
        enabled: !!channelId,
    });
    useEffect(() => {
        if (aiConfigData) {
            setAiConfigId(aiConfigData.id || null);
            let parsedWords = [];
            if (Array.isArray(aiConfigData.words)) {
                parsedWords = aiConfigData.words;
            }
            else if (typeof aiConfigData.words === "string") {
                try {
                    parsedWords = JSON.parse(aiConfigData.words);
                }
                catch {
                    parsedWords = [];
                }
            }
            setAiConfigForm({
                provider: aiConfigData.provider || "openai",
                apiKey: aiConfigData.apiKey || "",
                model: aiConfigData.model || "gpt-4o-mini",
                endpoint: aiConfigData.endpoint || "https://api.openai.com/v1",
                temperature: parseFloat(aiConfigData.temperature) || 0.7,
                maxTokens: parseInt(aiConfigData.maxTokens) || 2048,
                words: parsedWords,
                isActive: aiConfigData.isActive ?? false,
            });
        }
        else if (aiConfigData === null) {
            setAiConfigId(null);
            setAiConfigForm({
                provider: "vertex",
                apiKey: "",
                model: "gemini-1.5-flash",
                endpoint: "https://api.openai.com/v1",
                temperature: 0.1,
                maxTokens: 2048,
                words: [],
                isActive: false,
            });
        }
    }, [aiConfigData]);
    const handleActiveToggle = async (newValue) => {
        if (!aiConfigId) {
            toast({ title: "Save configuration first", description: "Please save your AI provider configuration before enabling.", variant: "destructive" });
            return;
        }
        setAiConfigForm(prev => ({ ...prev, isActive: newValue }));
        try {
            const res = await apiRequest("PUT", `/api/whatsapp/ai-settings/${aiConfigId}`, { isActive: newValue });
            if (!res.ok)
                throw new Error("Failed to update");
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/ai-settings/channel", channelId] });
            toast({ title: "Updated", description: `AI ${newValue ? "enabled" : "disabled"} successfully.` });
        }
        catch {
            setAiConfigForm(prev => ({ ...prev, isActive: !newValue }));
            toast({ title: "Error", description: "Failed to update AI status.", variant: "destructive" });
        }
    };
    const saveAiConfig = async () => {
        try {
            setIsSavingAiConfig(true);
            const method = aiConfigId ? "PUT" : "POST";
            const url = aiConfigId ? `/api/whatsapp/ai-settings/${aiConfigId}` : "/api/whatsapp/ai-settings";
            const res = await apiRequest(method, url, { ...aiConfigForm, channelId });
            if (!res.ok)
                throw new Error("Failed to save");
            const saved = await res.json();
            if (saved?.id)
                setAiConfigId(saved.id);
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/ai-settings/channel", channelId] });
            toast({ title: "Saved", description: "AI configuration saved successfully." });
        }
        catch {
            toast({ title: "Error", description: "Failed to save AI configuration.", variant: "destructive" });
        }
        finally {
            setIsSavingAiConfig(false);
        }
    };
    const [isSavingBehavior, setIsSavingBehavior] = useState(false);
    const saveBehaviorConfig = async () => {
        if (!siteId)
            return;
        try {
            setIsSavingBehavior(true);
            const siteRes = await apiRequest("GET", `/api/whatsapp/active-site?channelId=${channelId}`);
            const currentSite = siteRes.ok ? await siteRes.json() : null;
            const existingWidgetConfig = currentSite?.widgetConfig || {};
            const res = await apiRequest("PATCH", `/api/whatsapp/sites/${siteId}`, {
                widgetConfig: {
                    ...existingWidgetConfig,
                    systemPrompt: config.systemPrompt,
                    aiTone: config.aiTone,
                    aiMaxResponseLength: config.aiMaxResponseLength,
                    aiFallbackMessage: config.aiFallbackMessage,
                    escalationRules: config.escalationRules,
                    trainFromKB: config.trainFromKB,
                },
            });
            if (!res.ok)
                throw new Error("Failed to save");
            toast({ title: "Saved", description: "Settings saved successfully." });
        }
        catch {
            toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
        }
        finally {
            setIsSavingBehavior(false);
        }
    };
    const { data: sources = [], refetch: refetchSources } = useQuery({
        queryKey: ["/api/whatsapp/training", siteId, "sources"],
        queryFn: async () => {
            if (!siteId)
                return [];
            const res = await apiRequest("GET", `/api/whatsapp/training/${siteId}/sources`);
            return res.json();
        },
        enabled: !!siteId,
        refetchInterval: 5000,
    });
    const { data: qaPairs = [], refetch: refetchQa } = useQuery({
        queryKey: ["/api/whatsapp/training", siteId, "qa"],
        queryFn: async () => {
            if (!siteId)
                return [];
            const res = await apiRequest("GET", `/api/whatsapp/training/${siteId}/qa`);
            return res.json();
        },
        enabled: !!siteId,
    });
    const { data: preview } = useQuery({
        queryKey: ["/api/whatsapp/training", siteId, "preview"],
        queryFn: async () => {
            if (!siteId)
                return { sources: [], chunks: [], qaPairs: [] };
            const res = await apiRequest("GET", `/api/whatsapp/training/${siteId}/preview`);
            return res.json();
        },
        enabled: !!siteId && activeSection === "preview",
        refetchInterval: 10000,
    });
    const { data: stats } = useQuery({
        queryKey: ["/api/whatsapp/training", siteId, "stats"],
        queryFn: async () => {
            if (!siteId)
                return { totalChunks: 0, totalQaPairs: 0, sources: [] };
            const res = await apiRequest("GET", `/api/whatsapp/training/${siteId}/stats`);
            return res.json();
        },
        enabled: !!siteId,
        refetchInterval: 10000,
    });
    const addUrlMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", `/api/whatsapp/training/${siteId}/url`, {
                url: urlInput,
                name: urlName || urlInput,
                channelId,
            });
            return res.json();
        },
        onSuccess: () => {
            setUrlInput("");
            setUrlName("");
            refetchSources();
            toast({ title: "URL added", description: "Website content is being processed..." });
        },
        onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
    });
    const uploadDocMutation = useMutation({
        mutationFn: async (file) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("channelId", channelId || "");
            const res = await apiRequestFormData("POST", `/api/whatsapp/training/${siteId}/document`, formData);
            if (!res.ok)
                throw new Error((await res.json()).error || "Upload failed");
            return res.json();
        },
        onSuccess: () => {
            refetchSources();
            toast({ title: "Document uploaded", description: "Content is being processed..." });
        },
        onError: (err) => {
            toast({ title: "Upload error", description: err.message, variant: "destructive" });
        },
    });
    const deleteSourceMutation = useMutation({
        mutationFn: async (sourceId) => {
            await apiRequest("DELETE", `/api/whatsapp/training/source/${sourceId}`);
        },
        onSuccess: () => {
            refetchSources();
            toast({ title: "Source deleted" });
        },
    });
    const reprocessMutation = useMutation({
        mutationFn: async (sourceId) => {
            await apiRequest("POST", `/api/whatsapp/training/source/${sourceId}/reprocess`);
        },
        onSuccess: () => {
            refetchSources();
            toast({ title: "Reprocessing started" });
        },
    });
    const addQaMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", `/api/whatsapp/training/${siteId}/qa`, {
                question: newQuestion,
                answer: newAnswer,
                category: newCategory,
                channelId,
            });
            return res.json();
        },
        onSuccess: () => {
            setNewQuestion("");
            setNewAnswer("");
            setNewCategory("general");
            refetchQa();
            toast({ title: "Q&A pair added" });
        },
        onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
    });
    const deleteQaMutation = useMutation({
        mutationFn: async (qaId) => {
            await apiRequest("DELETE", `/api/whatsapp/training/qa/${qaId}`);
        },
        onSuccess: () => {
            refetchQa();
            toast({ title: "Q&A pair deleted" });
        },
    });
    const toggleQaMutation = useMutation({
        mutationFn: async ({ qaId, isActive }) => {
            await apiRequest("PUT", `/api/whatsapp/training/qa/${qaId}`, { isActive, channelId });
        },
        onSuccess: () => refetchQa(),
    });
    const syncKbMutation = useMutation({
        mutationFn: async () => {
            const kbRes = await apiRequest("GET", `/api/whatsapp/widget/kb/${siteId}`);
            const kbData = await kbRes.json();
            const articles = kbData?.categories?.flatMap((cat) => (cat.articles || []).map((a) => ({ ...a, category: cat.name }))) || [];
            const res = await apiRequest("POST", `/api/whatsapp/training/${siteId}/kb-sync`, {
                channelId,
                articles,
            });
            return res.json();
        },
        onSuccess: (data) => {
            refetchSources();
            toast({
                title: "Knowledge Base synced",
                description: `${data.articleCount || 0} articles synced for AI training`,
            });
        },
        onError: (err) => {
            toast({ title: "KB sync error", description: err.message, variant: "destructive" });
        },
    });
    const sendTestMessage = async () => {
        if (!testMessage.trim() || !siteId)
            return;
        const userMsg = testMessage;
        setTestMessages((prev) => [...prev, { role: "user", text: userMsg }]);
        setTestMessage("");
        setIsTesting(true);
        try {
            const res = await apiRequest("POST", `/api/whatsapp/training/${siteId}/test-chat`, {
                message: userMsg,
                channelId,
                widgetConfig: config,
            });
            const data = await res.json();
            if (!res.ok) {
                setTestMessages((prev) => [
                    ...prev,
                    { role: "error", text: data.error || "Failed to get response" },
                ]);
            }
            else {
                setTestMessages((prev) => [
                    ...prev,
                    {
                        role: "bot",
                        text: data.response,
                        context: data.contextUsed,
                    },
                ]);
            }
        }
        catch (err) {
            setTestMessages((prev) => [
                ...prev,
                { role: "error", text: err.message },
            ]);
        }
        finally {
            setIsTesting(false);
        }
    };
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadDocMutation.mutate(file);
        }
        if (fileInputRef.current)
            fileInputRef.current.value = "";
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case "completed":
                return <CheckCircle2 className="h-4 w-4 text-green-500"/>;
            case "processing":
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin"/>;
            case "pending":
                return <Clock className="h-4 w-4 text-yellow-500"/>;
            case "error":
                return <XCircle className="h-4 w-4 text-red-500"/>;
            default:
                return <Clock className="h-4 w-4 text-gray-400"/>;
        }
    };
    const escalation = config.escalationRules || {
        enabled: true,
        maxAttempts: 3,
        triggerPhrases: [],
        escalationMessage: "",
    };
    const updateEscalation = (key, value) => {
        updateConfig("escalationRules", { ...escalation, [key]: value });
    };
    if (!siteId) {
        return (<Card className="rounded-xl border border-slate-200 bg-white">
        <CardContent className="py-8 text-center text-slate-500">
          <Brain className="h-12 w-12 mx-auto mb-3 opacity-50"/>
          <p className="font-medium text-slate-700">Save your widget configuration first</p>
          <p className="text-sm mt-1">AI training requires a saved site configuration to work.</p>
        </CardContent>
      </Card>);
    }
    const sectionTabs = [
        { key: "training", icon: Brain, label: "Training Data" },
        { key: "qa", icon: MessageSquare, label: "Q&A Pairs" },
        { key: "behavior", icon: Shield, label: "AI Behavior" },
        { key: "escalation", icon: AlertTriangle, label: "Escalation" },
        { key: "test", icon: Sparkles, label: "Test Chat" },
        { key: "preview", icon: Eye, label: "Data Preview" },
    ];
    const tempDisplay = Number(aiConfigForm.temperature ?? 0).toFixed(1);
    return (<div className="space-y-4">
      {/* AI Provider Configuration — always first */}
      <Card className="rounded-xl border border-slate-200 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Settings className="h-4 w-4 text-[#007BFF]"/>
              AI Provider Configuration
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-600">Assistant Active</Label>
              <Switch checked={aiConfigForm.isActive} onCheckedChange={handleActiveToggle}/>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-slate-700">
                  <Settings className="h-3.5 w-3.5 text-[#007BFF]"/> Provider
                </Label>
                <Select value={aiConfigForm.provider} onValueChange={(v) => {
            setAiConfigForm((prev) => ({
                ...prev,
                provider: v,
                model: v === "vertex"
                    ? prev.model.startsWith("gemini")
                        ? prev.model
                        : "gemini-1.5-flash"
                    : prev.model.startsWith("gpt") || prev.model.startsWith("o")
                        ? prev.model
                        : "gpt-4o-mini",
            }));
        }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="vertex">Google Vertex AI (Gemini)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-slate-700">
                  <Cpu className="h-3.5 w-3.5 text-[#007BFF]"/> Model
                </Label>
                <Select value={aiConfigForm.model} onValueChange={(v) => setAiConfigForm((prev) => ({ ...prev, model: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model"/>
                  </SelectTrigger>
                  <SelectContent>
                    {isVertex ? (<>
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                        <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                      </>) : (<>
                        <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                        <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                        <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="o3-mini">o3-mini</SelectItem>
                        <SelectItem value="o1">o1</SelectItem>
                        <SelectItem value="o1-mini">o1-mini</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      </>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              {isVertex ? (<div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5"/>
                  <p className="text-sm text-green-800">
                    Uses <span className="font-medium">vertex_credential.json</span> service
                    account — no API key needed.
                  </p>
                </div>) : (<div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-slate-700">
                    <Key className="h-3.5 w-3.5 text-[#007BFF]"/> API Key
                  </Label>
                  <Input type="password" value={aiConfigForm.apiKey} onChange={(e) => setAiConfigForm((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="sk-..."/>
                </div>)}

              <div className="space-y-3">
                <Label className="text-slate-700">
                  Temperature ({tempDisplay})
                </Label>
                <Slider value={[aiConfigForm.temperature]} min={0} max={2} step={0.1} onValueChange={(vals) => setAiConfigForm((prev) => ({
            ...prev,
            temperature: vals[0] ?? 0.7,
        }))}/>
                <p className="text-xs text-slate-500">
                  Higher = more creative, Lower = more precise
                </p>
                <p className="text-xs text-slate-500">Current: {tempDisplay}</p>
              </div>
            </div>
          </div>

          {!isVertex && (<>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-[#007BFF]"/> Max Tokens
                </Label>
                <Input type="number" value={aiConfigForm.maxTokens} onChange={(e) => setAiConfigForm((prev) => ({
                ...prev,
                maxTokens: parseInt(e.target.value) || 2048,
            }))}/>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-slate-700">
                  <MessageSquare className="h-3.5 w-3.5 text-[#007BFF]"/> Trigger Words
                </Label>
                <p className="text-xs text-slate-500">
                  AI will only respond when a message contains one of these words (applies to
                  both widget chat and team inbox)
                </p>
                <div className="flex gap-2">
                  <Input placeholder="e.g., hello, help, pricing" value={newTriggerWord} onChange={(e) => setNewTriggerWord(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter" && newTriggerWord.trim()) {
                    e.preventDefault();
                    setAiConfigForm((prev) => ({
                        ...prev,
                        words: [...prev.words, newTriggerWord.trim()],
                    }));
                    setNewTriggerWord("");
                }
            }}/>
                  <Button size="sm" variant="outline" type="button" className="border-slate-200" onClick={() => {
                if (newTriggerWord.trim()) {
                    setAiConfigForm((prev) => ({
                        ...prev,
                        words: [...prev.words, newTriggerWord.trim()],
                    }));
                    setNewTriggerWord("");
                }
            }}>
                    <Plus className="h-4 w-4"/>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {aiConfigForm.words.map((word, i) => (<Badge key={i} variant="secondary" className="text-xs">
                      {word}
                      <button className="ml-1" onClick={() => setAiConfigForm((prev) => ({
                    ...prev,
                    words: prev.words.filter((_, idx) => idx !== i),
                }))}>
                        <X className="h-3 w-3"/>
                      </button>
                    </Badge>))}
                  {aiConfigForm.words.length === 0 && (<p className="text-xs text-slate-500 italic">
                      No trigger words defined — AI will respond to all messages
                    </p>)}
                </div>
              </div>
            </>)}

          <div className="flex justify-end">
            <Button onClick={saveAiConfig} disabled={isSavingAiConfig} className="bg-[#007BFF] hover:bg-[#0069d9] text-white">
              {isSavingAiConfig ? (<Loader2 className="h-4 w-4 mr-2 animate-spin"/>) : (<Save className="h-4 w-4 mr-2"/>)}
              {isSavingAiConfig ? "Saving..." : "Save Provider Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {sectionTabs.map(({ key, icon: Icon, label }) => {
            const isActive = activeSection === key;
            return (<button key={key} type="button" onClick={() => setActiveSection(key)} className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${isActive
                    ? "bg-[#007BFF] text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-4 w-4"/>
              {label}
            </button>);
        })}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-blue-50 p-3 text-center">
          <p className="text-2xl font-bold text-[#007BFF]">
            {stats?.sources?.length || 0}
          </p>
          <p className="text-xs text-slate-500">Sources</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-blue-50 p-3 text-center">
          <p className="text-2xl font-bold text-[#007BFF]">
            {stats?.totalChunks || 0}
          </p>
          <p className="text-xs text-slate-500">Chunks</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {stats?.totalQaPairs || 0}
          </p>
          <p className="text-xs text-slate-500">Q&A Pairs</p>
        </div>
      </div>

      {activeSection === "training" && (<div className="space-y-4">
          <Card className="rounded-xl border border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <BookOpen className="h-4 w-4 text-[#007BFF]"/>
                Knowledge Base Integration
              </CardTitle>
              <CardDescription>
                Sync your knowledge base articles as AI training data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Train from Knowledge Base</Label>
                  <p className="text-xs text-slate-500">
                    Use KB articles to answer customer questions
                  </p>
                </div>
                <Switch checked={config.trainFromKB} onCheckedChange={(checked) => updateConfig("trainFromKB", checked)}/>
              </div>
              {config.trainFromKB && (<Button onClick={() => syncKbMutation.mutate()} disabled={syncKbMutation.isPending} variant="outline" className="w-full border-slate-200">
                  {syncKbMutation.isPending ? (<Loader2 className="h-4 w-4 mr-2 animate-spin"/>) : (<RefreshCw className="h-4 w-4 mr-2"/>)}
                  Sync Knowledge Base Articles
                </Button>)}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <Globe className="h-4 w-4 text-[#007BFF]"/>
                Website URL Training
              </CardTitle>
              <CardDescription>
                Add website URLs to scrape and train the AI from
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="https://example.com/about" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}/>
              <Input placeholder="Source name (optional)" value={urlName} onChange={(e) => setUrlName(e.target.value)}/>
              <Button onClick={() => addUrlMutation.mutate()} disabled={!urlInput.trim() || addUrlMutation.isPending} className="w-full bg-[#007BFF] hover:bg-[#0069d9] text-white" size="sm">
                {addUrlMutation.isPending ? (<Loader2 className="h-4 w-4 mr-2 animate-spin"/>) : (<Plus className="h-4 w-4 mr-2"/>)}
                Add URL
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <FileUp className="h-4 w-4 text-[#007BFF]"/>
                Document Upload
              </CardTitle>
              <CardDescription>
                Upload PDF, TXT, CSV, DOCX, or Markdown files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.csv,.md,.docx" onChange={handleFileUpload}/>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadDocMutation.isPending} className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors py-8 px-4 text-center disabled:opacity-50">
                {uploadDocMutation.isPending ? (<Loader2 className="h-8 w-8 mx-auto mb-2 text-[#007BFF] animate-spin"/>) : (<FileUp className="h-8 w-8 mx-auto mb-2 text-[#007BFF]"/>)}
                <p className="text-sm font-medium text-slate-700">
                  {uploadDocMutation.isPending ? "Uploading..." : "Click to upload a document"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Max 10MB. Supported: PDF, TXT, CSV, DOCX, MD
                </p>
              </button>
            </CardContent>
          </Card>

          {sources.length > 0 && (<Card className="rounded-xl border border-slate-200 bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                  <Database className="h-4 w-4 text-[#007BFF]"/>
                  Training Sources ({sources.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sources.map((source) => (<div key={source.id} className="flex items-center justify-between p-2 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getStatusIcon(source.status)}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{source.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs border-slate-200">
                              {source.type}
                            </Badge>
                            {source.chunkCount > 0 && (<span className="text-xs text-slate-500">
                                {source.chunkCount} chunks
                              </span>)}
                            {source.errorMessage && (<span className="text-xs text-red-500 truncate max-w-[150px]">
                                {source.errorMessage}
                              </span>)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {source.status === "error" && (<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reprocessMutation.mutate(source.id)}>
                            <RefreshCw className="h-3 w-3"/>
                          </Button>)}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteSourceMutation.mutate(source.id)}>
                          <Trash2 className="h-3 w-3"/>
                        </Button>
                      </div>
                    </div>))}
                </div>
              </CardContent>
            </Card>)}
        </div>)}

      {activeSection === "qa" && (<div className="space-y-4">
          <Card className="rounded-xl border border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-800">Add Q&A Pair</CardTitle>
              <CardDescription>
                Add custom question-answer pairs for the AI to learn from
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Question</Label>
                <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="What are your business hours?"/>
              </div>
              <div className="space-y-2">
                <Label>Answer</Label>
                <Textarea value={newAnswer} onChange={(e) => setNewAnswer(e.target.value)} placeholder="We are open Monday-Friday, 9 AM to 6 PM EST." rows={3}/>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="pricing">Pricing</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="shipping">Shipping</SelectItem>
                    <SelectItem value="returns">Returns</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => addQaMutation.mutate()} disabled={!newQuestion.trim() || !newAnswer.trim() || addQaMutation.isPending} className="w-full bg-[#007BFF] hover:bg-[#0069d9] text-white">
                {addQaMutation.isPending ? (<Loader2 className="h-4 w-4 mr-2 animate-spin"/>) : (<Plus className="h-4 w-4 mr-2"/>)}
                Add Q&A Pair
              </Button>
            </CardContent>
          </Card>

          {qaPairs.length > 0 && (<Card className="rounded-xl border border-slate-200 bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-800">
                  Existing Q&A Pairs ({qaPairs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {qaPairs.map((qa) => (<div key={qa.id} className={`p-3 border border-slate-200 rounded-xl space-y-2 ${!qa.isActive ? "opacity-50" : ""}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs border-slate-200 text-[#007BFF]">
                                {qa.category}
                              </Badge>
                              {!qa.isActive && (<Badge variant="secondary" className="text-xs">
                                  Disabled
                                </Badge>)}
                            </div>
                            <p className="text-sm font-medium text-slate-800">
                              Q: {qa.question}
                            </p>
                            <p className="text-sm text-slate-500 mt-1">A: {qa.answer}</p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Switch checked={qa.isActive} onCheckedChange={(checked) => toggleQaMutation.mutate({ qaId: qa.id, isActive: checked })}/>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteQaMutation.mutate(qa.id)}>
                              <Trash2 className="h-3 w-3"/>
                            </Button>
                          </div>
                        </div>
                      </div>))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>)}
        </div>)}

      {activeSection === "behavior" && (<div className="space-y-4">
          <Card className="rounded-xl border border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-800">System Prompt</CardTitle>
              <CardDescription>
                Define how the AI should behave and respond to customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={config.systemPrompt} onChange={(e) => updateConfig("systemPrompt", e.target.value)} rows={6} placeholder="You are a helpful customer support assistant..." maxLength={4000}/>
              <p className="text-xs text-slate-500">
                {config.systemPrompt?.length || 0} / 4000 characters
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-800">Response Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Response Tone</Label>
                <Select value={config.aiTone} onValueChange={(value) => updateConfig("aiTone", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Response Length</Label>
                <Select value={config.aiMaxResponseLength?.toString()} onValueChange={(value) => updateConfig("aiMaxResponseLength", parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">Short (~100 words)</SelectItem>
                    <SelectItem value="200">Medium (~200 words)</SelectItem>
                    <SelectItem value="300">Long (~300 words)</SelectItem>
                    <SelectItem value="500">Very Long (~500 words)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fallback Message</Label>
                <Textarea value={config.aiFallbackMessage} onChange={(e) => updateConfig("aiFallbackMessage", e.target.value)} rows={2} placeholder="I'm sorry, I don't have the information you're looking for."/>
                <p className="text-xs text-slate-500">
                  Shown when the AI cannot generate a response
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveBehaviorConfig} disabled={isSavingBehavior} className="bg-[#007BFF] hover:bg-[#0069d9] text-white">
              {isSavingBehavior ? (<Loader2 className="h-4 w-4 mr-2 animate-spin"/>) : (<Save className="h-4 w-4 mr-2"/>)}
              {isSavingBehavior ? "Saving..." : "Save AI Settings"}
            </Button>
          </div>
        </div>)}

      {activeSection === "escalation" && (<div className="space-y-4">
          <Card className="rounded-xl border border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <AlertTriangle className="h-4 w-4 text-[#007BFF]"/>
                Escalation Rules
              </CardTitle>
              <CardDescription>
                Configure when the AI should transfer conversations to human agents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Auto-Escalation</Label>
                  <p className="text-xs text-slate-500">
                    Automatically transfer to an agent when AI can&apos;t help
                  </p>
                </div>
                <Switch checked={escalation.enabled} onCheckedChange={(checked) => updateEscalation("enabled", checked)}/>
              </div>

              {escalation.enabled && (<>
                  <Separator />

                  <div className="space-y-2">
                    <Label>Max Unanswered Attempts</Label>
                    <Select value={escalation.maxAttempts?.toString() || "3"} onValueChange={(value) => updateEscalation("maxAttempts", parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">After 1 failed attempt</SelectItem>
                        <SelectItem value="2">After 2 failed attempts</SelectItem>
                        <SelectItem value="3">After 3 failed attempts</SelectItem>
                        <SelectItem value="5">After 5 failed attempts</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Transfer to agent after this many questions the AI couldn&apos;t answer
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Trigger Phrases</Label>
                    <p className="text-xs text-slate-500">
                      Immediately escalate when user mentions these phrases
                    </p>
                    <div className="flex gap-2">
                      <Input placeholder="e.g., speak to manager" value={newTriggerPhrase} onChange={(e) => setNewTriggerPhrase(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter" && newTriggerPhrase.trim()) {
                        updateEscalation("triggerPhrases", [
                            ...(escalation.triggerPhrases || []),
                            newTriggerPhrase.trim(),
                        ]);
                        setNewTriggerPhrase("");
                    }
                }}/>
                      <Button size="sm" variant="outline" className="border-slate-200" onClick={() => {
                    if (newTriggerPhrase.trim()) {
                        updateEscalation("triggerPhrases", [
                            ...(escalation.triggerPhrases || []),
                            newTriggerPhrase.trim(),
                        ]);
                        setNewTriggerPhrase("");
                    }
                }}>
                        <Plus className="h-4 w-4"/>
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(escalation.triggerPhrases || []).map((phrase, i) => (<Badge key={i} variant="secondary" className="text-xs">
                          {phrase}
                          <button className="ml-1" onClick={() => updateEscalation("triggerPhrases", escalation.triggerPhrases.filter((_, idx) => idx !== i))}>
                            <X className="h-3 w-3"/>
                          </button>
                        </Badge>))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Escalation Message</Label>
                    <Textarea value={escalation.escalationMessage || ""} onChange={(e) => updateEscalation("escalationMessage", e.target.value)} rows={2} placeholder="Let me connect you with a team member who can help you better."/>
                    <p className="text-xs text-slate-500">
                      Message shown to user when transferring to an agent
                    </p>
                  </div>
                </>)}
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={saveBehaviorConfig} disabled={isSavingBehavior} className="bg-[#007BFF] hover:bg-[#0069d9] text-white">
              {isSavingBehavior ? (<Loader2 className="h-4 w-4 mr-2 animate-spin"/>) : (<Save className="h-4 w-4 mr-2"/>)}
              {isSavingBehavior ? "Saving..." : "Save Escalation Rules"}
            </Button>
          </div>
        </div>)}

      {activeSection === "test" && (<Card className="rounded-xl border border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Sparkles className="h-4 w-4 text-[#007BFF]"/>
              Test AI Chat
            </CardTitle>
            <CardDescription>
              Test how your AI responds using current training data and settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <ScrollArea className="h-[350px] p-3">
                {testMessages.length === 0 && (<div className="flex items-center justify-center h-[300px] text-center text-slate-500">
                    <div>
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50 text-[#007BFF]"/>
                      <p className="text-sm">Send a message to test the AI</p>
                      <p className="text-xs mt-1">
                        Uses your actual training data and system prompt
                      </p>
                    </div>
                  </div>)}
                <div className="space-y-3">
                  {testMessages.map((msg, i) => (<div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 ${msg.role === "user"
                    ? "bg-[#007BFF] text-white"
                    : msg.role === "error"
                        ? "bg-red-100 text-red-800"
                        : "bg-slate-100 text-slate-800"}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        {msg.context && (<div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-70">
                            Context: {msg.context.chunksFound} chunks,{" "}
                            {msg.context.qaPairsFound} Q&A pairs used
                          </div>)}
                      </div>
                    </div>))}
                  {isTesting && (<div className="flex justify-start">
                      <div className="bg-slate-100 rounded-xl px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#007BFF]"/>
                      </div>
                    </div>)}
                </div>
              </ScrollArea>
              <div className="border-t border-slate-200 p-2 flex gap-2">
                <Input placeholder="Type a test message..." value={testMessage} onChange={(e) => setTestMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTestMessage()} disabled={isTesting}/>
                <Button size="icon" onClick={sendTestMessage} disabled={!testMessage.trim() || isTesting} className="bg-[#007BFF] hover:bg-[#0069d9] text-white">
                  <Send className="h-4 w-4"/>
                </Button>
              </div>
            </div>
            {testMessages.length > 0 && (<Button variant="outline" size="sm" className="mt-2 border-slate-200" onClick={() => setTestMessages([])}>
                Clear Chat
              </Button>)}
          </CardContent>
        </Card>)}

      {activeSection === "preview" && (<div className="space-y-4">
          <Card className="rounded-xl border border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <Eye className="h-4 w-4 text-[#007BFF]"/>
                Training Data Overview
              </CardTitle>
              <CardDescription>
                All indexed content the AI uses to answer questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!preview ||
                (preview.sources.length === 0 && preview.qaPairs.length === 0) ? (<div className="text-center py-6 text-slate-500">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50"/>
                  <p className="text-sm">No training data yet</p>
                  <p className="text-xs mt-1">
                    Add URLs, documents, or Q&A pairs to train your AI
                  </p>
                </div>) : (<div className="space-y-4">
                  {preview.sources.length > 0 && (<div>
                      <h4 className="text-sm font-medium mb-2 text-slate-800">
                        Sources ({preview.sources.length})
                      </h4>
                      <div className="space-y-2">
                        {preview.sources.map((source) => (<div key={source.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                            {getStatusIcon(source.status)}
                            <span className="font-medium">{source.name}</span>
                            <Badge variant="outline" className="text-xs ml-auto border-slate-200">
                              {source.type}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {source.chunkCount} chunks
                            </span>
                          </div>))}
                      </div>
                    </div>)}

                  {preview.chunks.length > 0 && (<div>
                      <h4 className="text-sm font-medium mb-2 text-slate-800">
                        Content Chunks ({preview.chunks.length})
                      </h4>
                      <ScrollArea className="max-h-[250px]">
                        <div className="space-y-2">
                          {preview.chunks.slice(0, 20).map((chunk) => (<div key={chunk.id} className="p-2 border border-slate-200 rounded-xl text-xs">
                              <div className="flex items-center gap-1 mb-1">
                                {chunk.hasEmbedding ? (<Badge className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">
                                    Embedded
                                  </Badge>) : (<Badge variant="outline" className="text-[10px] border-slate-200">
                                    Text Only
                                  </Badge>)}
                              </div>
                              <p className="text-slate-500">{chunk.contentPreview}</p>
                            </div>))}
                          {preview.chunks.length > 20 && (<p className="text-xs text-center text-slate-500 py-2">
                              + {preview.chunks.length - 20} more chunks
                            </p>)}
                        </div>
                      </ScrollArea>
                    </div>)}

                  {preview.qaPairs.length > 0 && (<div>
                      <h4 className="text-sm font-medium mb-2 text-slate-800">
                        Q&A Pairs ({preview.qaPairs.length})
                      </h4>
                      <div className="space-y-2">
                        {preview.qaPairs.map((qa) => (<div key={qa.id} className="p-2 border border-slate-200 rounded-xl text-sm">
                            <p className="font-medium text-slate-800">Q: {qa.question}</p>
                            <p className="text-slate-500 text-xs mt-1">A: {qa.answer}</p>
                          </div>))}
                      </div>
                    </div>)}
                </div>)}
            </CardContent>
          </Card>
        </div>)}
    </div>);
}
