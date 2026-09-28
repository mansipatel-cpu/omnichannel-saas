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
import { useTranslation } from 'react-i18next';
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Search, Download, Loader2, Phone, Clock, Calendar, Eye, Play, Pause, PhoneIncoming, PhoneOff, CheckCircle2, ArrowDown, ArrowUp, XCircle, FileText, Mic, Globe, Video } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/shared/hooks/use-toast";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { formatSipEndpoint } from "@/shared/utils/formatters";
import { useDemoMode } from "@/shared/components/DemoModeBanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
export default function Calls() {
    const { t } = useTranslation();
    const { isDemoMode } = useDemoMode();
    const [isVideoOpen, setIsVideoOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sentimentFilter, setSentimentFilter] = useState("all");
    const [directionFilter, setDirectionFilter] = useState("all");
    const [leadFilter, setLeadFilter] = useState("all");
    const [playingCallId, setPlayingCallId] = useState(null);
    const [loadingRecording, setLoadingRecording] = useState(null);
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const audioRef = useRef(null);
    const currentPlayingIdRef = useRef(null);
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [activeTab, setActiveTab] = useState("all");
    // Reset page to 1 when filters or tab change
    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter, sentimentFilter, directionFilter, leadFilter, activeTab]);
    const { data: publicSettings } = useQuery({
        queryKey: ["/api/settings/public"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok)
                throw new Error("Failed to fetch public settings");
            return res.json();
        }
    });
    const systemTimezone = publicSettings?.system_timezone || "UTC";
    const formatCallDate = (dateString) => {
        if (!dateString)
            return "";
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: systemTimezone,
                timeZoneName: 'short'
            }).format(date);
        }
        catch (e) {
            return dateString || "";
        }
    };
    const { data: paginatedData, isLoading } = useQuery({
        queryKey: ["/api/calls", page, pageSize, searchQuery, statusFilter, sentimentFilter, directionFilter, leadFilter, activeTab],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                tab: activeTab,
            });
            if (searchQuery)
                params.append("search", searchQuery);
            if (statusFilter !== "all")
                params.append("status", statusFilter);
            if (sentimentFilter !== "all")
                params.append("sentiment", sentimentFilter);
            if (directionFilter !== "all")
                params.append("direction", directionFilter);
            if (leadFilter !== "all")
                params.append("classification", leadFilter);
            const headers = {};
            const authHeader = AuthStorage.getAuthHeader();
            if (authHeader) {
                headers["Authorization"] = authHeader;
            }
            const res = await fetch(`/api/calls?${params.toString()}`, {
                headers,
                credentials: "include",
            });
            if (!res.ok)
                throw new Error("Failed to fetch calls");
            return res.json();
        }
    });
    const calls = paginatedData?.data || [];
    const handleExportCsv = async () => {
        try {
            const params = new URLSearchParams();
            if (searchQuery)
                params.append("search", searchQuery);
            if (statusFilter !== "all")
                params.append("status", statusFilter);
            if (sentimentFilter !== "all")
                params.append("sentiment", sentimentFilter);
            if (directionFilter !== "all")
                params.append("direction", directionFilter);
            if (leadFilter !== "all")
                params.append("classification", leadFilter);
            params.append("tab", activeTab);
            const requestHeaders = {};
            const authHeader = AuthStorage.getAuthHeader();
            if (authHeader) {
                requestHeaders["Authorization"] = authHeader;
            }
            const res = await fetch(`/api/calls?${params.toString()}`, {
                headers: requestHeaders,
                credentials: "include",
            });
            if (!res.ok)
                throw new Error("Failed to fetch calls for export");
            const exportCalls = await res.json();
            if (exportCalls.length === 0) {
                toast({
                    title: t('common.noData'),
                    description: t('calls.noCallsToExport'),
                    variant: "destructive",
                });
                return;
            }
            const headers = [
                'ID',
                'Phone Number',
                'Contact Name',
                'Status',
                'Direction',
                'Duration (seconds)',
                'Classification',
                'Sentiment',
                'Campaign',
                'Agent',
                'Engine',
                'Created At'
            ];
            const rows = exportCalls.map(call => {
                const contactName = call.contact
                    ? `${call.contact.firstName} ${call.contact.lastName || ''}`.trim()
                    : '';
                const phoneNumber = call.phoneNumber || call.fromNumber || call.toNumber || '';
                return [
                    call.id,
                    phoneNumber,
                    contactName,
                    call.status,
                    call.callDirection || 'outgoing',
                    call.duration?.toString() || '0',
                    call.classification || '',
                    call.sentiment || '',
                    call.campaign?.name || '',
                    call.agent?.name || '',
                    call.engine || 'elevenlabs',
                    call.createdAt
                ];
            });
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `calls_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({
                title: t('common.exportSuccess'),
                description: t('calls.exportedCalls', { count: exportCalls.length }),
            });
        }
        catch (err) {
            toast({
                title: "Export failed",
                description: "An error occurred while fetching calls for export.",
                variant: "destructive",
            });
        }
    };
    const formatDuration = (seconds) => {
        if (!seconds)
            return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case "completed":
                return <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">{t('calls.status.completed')}</span>;
            case "failed":
                return <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-500">{t('calls.status.failed')}</span>;
            case "credit_failed":
                return (<Badge className="bg-rose-50 text-rose-600 border-rose-200 font-medium gap-1" data-testid="badge-credit-failed">
            <XCircle className="h-3 w-3"/>
            Not Billed
          </Badge>);
            case "in_progress":
            case "in-progress":
                return <Badge className="bg-amber-50 text-amber-600 border-amber-200 font-medium">{t('calls.status.inProgress')}</Badge>;
            case "initiated":
            case "pending":
                return <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{status}</span>;
            case "ended":
                return <Badge className="bg-slate-50 text-slate-500 border-slate-200 font-medium">{t('calls.status.ended')}</Badge>;
            default:
                return <Badge className="bg-slate-50 text-slate-500 border-slate-200 font-medium">{status}</Badge>;
        }
    };
    const getEngineBadge = (engine) => {
        if (engine === 'twilio-openai') {
            return <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">OpenAI + Twilio</span>;
        }
        if (engine === 'plivo-openai') {
            return <Badge className="bg-orange-50 text-orange-600 border-orange-200 font-medium">Plivo + OpenAI</Badge>;
        }
        if (engine === 'openai') {
            return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 font-medium">OpenAI</Badge>;
        }
        if (engine === 'custom-voice-engine') {
            return <Badge className="bg-blue-50 text-blue-600 border-blue-200 font-medium">Custom Voice</Badge>;
        }
        return <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600">ElevenLabs</span>;
    };
    const getWidgetBadge = (call) => {
        if (!call.widgetId)
            return null;
        return (<Badge className="bg-brand/10 text-brand border-brand/20 gap-1">
        <Globe className="h-3 w-3"/>
        {call.widget?.name || 'Widget'}
      </Badge>);
    };
    const formatRelativeTime = (dateString) => {
        if (!dateString)
            return null;
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true });
        }
        catch {
            return null;
        }
    };
    const hasRecording = (call) => {
        if (call.recordingUrl || call.elevenLabsConversationId)
            return true;
        if (call.engine === 'twilio-openai' || call.engine === 'plivo-openai' || call.engine === 'custom-voice-engine')
            return true;
        return false;
    };
    const handlePlayRecording = async (e, call) => {
        e.stopPropagation();
        if (playingCallId === call.id) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingCallId(null);
            currentPlayingIdRef.current = null;
            return;
        }
        if (audioRef.current) {
            audioRef.current.pause();
        }
        currentPlayingIdRef.current = call.id;
        setLoadingRecording(call.id);
        try {
            const headers = {};
            const authHeader = AuthStorage.getAuthHeader();
            if (authHeader) {
                headers["Authorization"] = authHeader;
            }
            const response = await fetch(`/api/calls/${call.id}/recording`, {
                headers,
                credentials: "include",
            });
            if (currentPlayingIdRef.current !== call.id) {
                return;
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to fetch recording");
            }
            const blob = await response.blob();
            if (currentPlayingIdRef.current !== call.id) {
                return;
            }
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            if (currentPlayingIdRef.current !== call.id) {
                URL.revokeObjectURL(audioUrl);
                return;
            }
            audioRef.current = audio;
            setPlayingCallId(call.id);
            setLoadingRecording(null);
            audio.onended = () => {
                if (currentPlayingIdRef.current === call.id) {
                    setPlayingCallId(null);
                    audioRef.current = null;
                }
                URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = () => {
                if (currentPlayingIdRef.current === call.id) {
                    setPlayingCallId(null);
                    audioRef.current = null;
                }
                toast({
                    title: "Playback Error",
                    description: "Unable to play this recording.",
                    variant: "destructive",
                });
            };
            await audio.play();
        }
        catch (error) {
            if (currentPlayingIdRef.current === call.id) {
                setLoadingRecording(null);
                setPlayingCallId(null);
            }
            toast({
                title: "Recording Unavailable",
                description: error.message || "Could not load recording. Try syncing recordings first.",
                variant: "destructive",
            });
        }
    };
    const totalCalls = paginatedData?.stats?.totalCalls || 0;
    const completedCalls = paginatedData?.stats?.completedCalls || 0;
    const incomingCalls = paginatedData?.stats?.incomingCalls || 0;
    const outgoingCalls = paginatedData?.stats?.outgoingCalls || 0;
    const allCount = paginatedData?.stats?.allCount || 0;
    const transcribedCount = paginatedData?.stats?.transcribedCount || 0;
    const recordingsCount = paginatedData?.stats?.recordingsCount || 0;
    if (isLoading) {
        return (<div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
      </div>);
    }
    const callTitle = (call) => {
        if (call.widgetId) {
            return call.widget?.name || call.metadata?.widgetName || "Website Widget";
        }
        if (call.callDirection === "incoming") {
            return formatSipEndpoint(call.fromNumber, call.engine) || call.contact?.phone || call.phoneNumber || `Call ${call.id.slice(0, 8)}`;
        }
        return formatSipEndpoint(call.toNumber, call.engine) || call.contact?.phone || call.phoneNumber || `Call ${call.id.slice(0, 8)}`;
    };
    const iconFor = (call) => {
        if (call.status === "failed" || call.status === "busy" || call.status === "no-answer" || call.status === "credit_failed") {
            return (<div className="h-10 w-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
          <PhoneOff className="h-4 w-4"/>
        </div>);
        }
        if (call.callDirection === "incoming") {
            return (<div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
          <PhoneIncoming className="h-4 w-4"/>
        </div>);
        }
        return (<div className="h-10 w-10 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center shrink-0">
        <Phone className="h-[18px] w-[18px]"/>
      </div>);
    };
    const renderCallCard = (call, testIdPrefix = "") => {
        const missed = call.status === "failed" || call.status === "busy" || call.status === "no-answer" || call.status === "no_answer";
        const accent = call.status === "completed" ? "bg-emerald-500" :
            missed || call.status === "credit_failed" ? "bg-rose-500" :
                "bg-amber-400";
        return (<div key={call.id} className="relative flex items-center gap-4 bg-white border border-slate-200 rounded-2xl pl-5 pr-4 py-4" data-testid={`card-call-${testIdPrefix}${call.id}`}>
        <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${accent}`}/>
        {iconFor(call)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-slate-900 truncate">{callTitle(call)}</h3>
            {getEngineBadge(call.engine)}
            {getWidgetBadge(call)}
            {getStatusBadge(call.status)}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5"/>
              {formatDuration(call.duration)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5"/>
              {formatRelativeTime(call.createdAt) || formatCallDate(call.createdAt)}
            </span>
          </div>
          {(hasRecording(call) || call.transcript || missed) && (<div className="flex items-center gap-2 mt-2">
              {hasRecording(call) && (<span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                  <Mic className="h-3 w-3"/>
                  Recording
                </span>)}
              {call.transcript && (<span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
                  <FileText className="h-3 w-3"/>
                  Transcript
                </span>)}
              {missed && (<span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-500">
                  Line Busy / No Answer
                </span>)}
            </div>)}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-center">
          {hasRecording(call) && (<button type="button" className="h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center hover:bg-slate-50" onClick={(e) => handlePlayRecording(e, call)} disabled={loadingRecording === call.id} data-testid={`button-play-${testIdPrefix}${call.id}`}>
              {loadingRecording === call.id ? (<Loader2 className="h-4 w-4 animate-spin"/>) : playingCallId === call.id ? (<Pause className="h-4 w-4"/>) : (<Play className="h-4 w-4 ml-0.5"/>)}
            </button>)}
          <button type="button" className="h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50" onClick={() => setLocation(`/calls/${call.id}`)} data-testid={`button-view-details-${testIdPrefix}${call.id}`}>
            <Eye className="h-4 w-4 text-slate-500"/>
            View Details
          </button>
        </div>
      </div>);
    };
    const callsPagination = (testId) => {
        const totalItems = paginatedData?.pagination.totalItems || 0;
        const totalPages = paginatedData?.pagination.totalPages || 1;
        if (totalItems === 0)
            return null;
        const startItem = (page - 1) * pageSize + 1;
        const endItem = Math.min(page * pageSize, totalItems);
        const pages = [];
        const windowStart = Math.max(1, Math.min(page - 1, totalPages - 3));
        for (let i = windowStart; i <= Math.min(totalPages, windowStart + 3); i++)
            pages.push(i);
        return (<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2" data-testid={testId}>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>Showing {startItem} to {endItem} of {totalItems} calls</span>
          <span className="hidden sm:inline">Per page:</span>
          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="h-8 w-[68px] rounded-md border-slate-200 bg-white text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((option) => (<SelectItem key={option} value={String(option)}>{option}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="h-8 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-600 disabled:opacity-40" onClick={() => setPage(page - 1)} disabled={page <= 1}>
            Previous
          </button>
          {pages.map((n) => (<button key={n} type="button" className={`h-8 min-w-8 px-2 rounded-md text-sm ${n === page ? "bg-[#2F6BFF] text-white" : "bg-white border border-slate-200 text-slate-600"}`} onClick={() => setPage(n)}>
              {n}
            </button>))}
          {totalPages > pages[pages.length - 1] && (<>
              <span className="px-1 text-slate-400">...</span>
              <button type="button" className="h-8 min-w-8 px-2 rounded-md bg-white border border-slate-200 text-sm text-slate-600" onClick={() => setPage(totalPages)}>
                {totalPages}
              </button>
            </>)}
          <button type="button" className="h-8 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-600 disabled:opacity-40" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
            Next
          </button>
        </div>
      </div>);
    };
    const statCard = (icon, value, label, testId) => (<div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <div className="flex items-center gap-2 text-slate-900">
        {icon}
        <span className="text-[22px] leading-none font-semibold" data-testid={testId}>{value}</span>
      </div>
      <p className="text-xs text-slate-500 mt-2">{label}</p>
    </div>);
    return (<div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#2F6BFF] flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-white"/>
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-slate-900 leading-tight">Calls & Conversations</h1>
              <p className="text-sm text-slate-500 mt-0.5">View recordings, transcripts, and AI analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode && (<Button variant="outline" onClick={() => setIsVideoOpen(true)} data-testid="button-watch-demo-calls">
                <Video className="h-4 w-4 mr-2"/>
                Watch Demo
              </Button>)}
            <button type="button" onClick={handleExportCsv} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium" data-testid="button-export-calls">
              <Download className="h-4 w-4"/>
              Export
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCard(<Phone className="h-4 w-4 text-sky-500"/>, totalCalls, "Total Calls", "text-total-calls")}
          {statCard(<CheckCircle2 className="h-4 w-4 text-emerald-500"/>, completedCalls, "Completed")}
          {statCard(<ArrowDown className="h-4 w-4 text-emerald-500"/>, incomingCalls, "Incoming")}
          {statCard(<ArrowUp className="h-4 w-4 text-sky-500"/>, outgoingCalls, "Outgoing")}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
          <Input placeholder="Search calls..." className="pl-9 h-10 rounded-lg border-slate-200 bg-white shadow-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search-calls"/>
        </div>
        <div className="flex items-center gap-2 flex-wrap ml-auto">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[128px] h-10 rounded-lg border-slate-200 bg-white" data-testid="select-filter-status">
            <SelectValue placeholder={t('calls.details.status')}/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('calls.filters.allStatus')}</SelectItem>
            <SelectItem value="completed">{t('calls.status.completed')}</SelectItem>
            <SelectItem value="failed">{t('calls.status.failed')}</SelectItem>
            <SelectItem value="credit_failed" data-testid="filter-status-credit-failed">Not Billed - Low Credits</SelectItem>
            <SelectItem value="in_progress">{t('calls.status.inProgress')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="w-[140px] h-10 rounded-lg border-slate-200 bg-white" data-testid="select-filter-sentiment">
            <SelectValue placeholder={t('calls.details.sentiment')}/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('calls.filters.allSentiment')}</SelectItem>
            <SelectItem value="positive">{t('calls.sentiment.positive')}</SelectItem>
            <SelectItem value="neutral">{t('calls.sentiment.neutral')}</SelectItem>
            <SelectItem value="negative">{t('calls.sentiment.negative')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-[140px] h-10 rounded-lg border-slate-200 bg-white" data-testid="select-filter-direction">
            <SelectValue placeholder={t('calls.details.direction')}/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('calls.filters.allDirections')}</SelectItem>
            <SelectItem value="incoming">{t('calls.filters.incoming')}</SelectItem>
            <SelectItem value="outgoing">{t('calls.filters.outgoing')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={leadFilter} onValueChange={setLeadFilter}>
          <SelectTrigger className="w-[110px] h-10 rounded-lg border-slate-200 bg-white" data-testid="select-filter-lead">
            <SelectValue placeholder={t('calls.filters.leadQuality')}/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('calls.filters.allLeads')}</SelectItem>
            <SelectItem value="hot">{t('calls.classification.hot')}</SelectItem>
            <SelectItem value="warm">{t('calls.classification.warm')}</SelectItem>
            <SelectItem value="cold">{t('calls.classification.cold')}</SelectItem>
            <SelectItem value="lost">{t('calls.classification.lost')}</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-10 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="all" className="rounded-md px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-all">
            {t('calls.allCalls')} ({allCount})
          </TabsTrigger>
          <TabsTrigger value="transcribed" className="rounded-md px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-transcribed">
            {t('calls.transcribed')} ({transcribedCount})
          </TabsTrigger>
          <TabsTrigger value="recordings" className="rounded-md px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm" data-testid="tab-recordings">
            {t('calls.recordings')} ({recordingsCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          {calls.length === 0 ? (<Card className="p-12 text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4"/>
              <h3 className="font-medium text-lg mb-1">{t('calls.noCalls')}</h3>
              <p className="text-muted-foreground text-sm">
                {paginatedData?.stats?.totalCalls === 0
                ? t('calls.createCampaignToStart')
                : t('calls.noMatchingFilters')}
              </p>
            </Card>) : (<>
              <div className="grid gap-3">
                {calls.map((call) => renderCallCard(call))}
              </div>
              {callsPagination("pagination-all-calls")}
            </>)}
        </TabsContent>

        <TabsContent value="transcribed" className="space-y-3">
          {calls.length === 0 ? (<Card className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4"/>
              <h3 className="font-medium text-lg mb-1">{t('calls.noTranscribed')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('calls.transcriptsWillAppear')}
              </p>
            </Card>) : (<>
              <div className="grid gap-3">
                {calls.map((call) => renderCallCard(call, "transcribed-"))}
              </div>
              {callsPagination("pagination-transcribed-calls")}
            </>)}
        </TabsContent>

        <TabsContent value="recordings" className="space-y-3">
          {calls.length === 0 ? (<Card className="p-12 text-center">
              <Mic className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4"/>
              <h3 className="font-medium text-lg mb-1">{t('calls.noRecordings')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('calls.trySyncRecordings')}
              </p>
            </Card>) : (<>
              <div className="grid gap-3">
                {calls.map((call) => renderCallCard(call, "recording-"))}
              </div>
              {callsPagination("pagination-recordings-calls")}
            </>)}
        </TabsContent>
      </Tabs>

      {isDemoMode && (<Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent className="sm:max-w-[850px] p-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <DialogHeader className="p-4 pb-2 text-left">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-blue-400 fill-blue-400"/>
                Call Logs & Analytics Demonstration Video
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Watch a demonstration on reviewing call logs, audio recordings, transcripts, and AI analysis.
              </DialogDescription>
            </DialogHeader>
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
              {isVideoOpen && (<iframe src="https://drive.google.com/file/d/1NFAlAXnwjw_GiWKOM83F2MpkLgFCZeSc/preview" className="w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title="Call Logs Demo Video"/>)}
            </div>
            <div className="p-3 pt-2 text-right">
              <a href="https://drive.google.com/file/d/1NFAlAXnwjw_GiWKOM83F2MpkLgFCZeSc/view?usp=drive_link" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1 font-medium">
                Open in Google Drive &rarr;
              </a>
            </div>
          </DialogContent>
        </Dialog>)}
    </div>);
}
