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
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Play, Pause, Download, Loader2, Phone, Clock, Calendar, MessageSquare, CheckCircle2, XCircle, User, Volume2, Target, Mail, Bot, ChevronLeft, ChevronRight, Globe, AlertTriangle, RotateCcw, RotateCw } from "lucide-react";
import { format } from "date-fns";
import { AuthStorage } from "@/lib/auth-storage";
import { formatSipEndpoint } from "@/lib/formatters";

interface Contact {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone: string;
  email?: string | null;
}

interface Campaign {
  id: string;
  name: string;
}

interface Call {
  id: string;
  campaignId: string | null;
  contactId: string | null;
  phoneNumber?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  elevenLabsConversationId?: string | null;
  twilioSid?: string | null;
  plivoCallUuid?: string | null;
  transcript: string | null;
  aiSummary: string | null;
  classification: string | null;
  sentiment: string | null;
  metadata: Record<string, any> | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  callDirection: string | null;
  contact?: Contact | null;
  campaign?: Campaign | null;
  engine?: 'elevenlabs' | 'twilio-openai' | 'plivo-openai' | 'openai' | 'custom-voice-engine';
  agent?: { id: string; name: string } | null;
  widgetId?: string | null;
  widget?: { id: string; name: string } | null;
}

export default function CallDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  const { data: publicSettings } = useQuery<{ system_timezone?: string }>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      if (!res.ok) throw new Error("Failed to fetch public settings");
      return res.json();
    }
  });
  const systemTimezone = publicSettings?.system_timezone || "UTC";

  const formatCallDate = (dateString: string | null) => {
    if (!dateString) return "";
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
    } catch (e) {
      return dateString || "";
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (waveformRef.current && call?.duration) {
      const rect = waveformRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const percentage = Math.max(0, Math.min(1, clickX / width));
      const newTime = percentage * call.duration;
      setCurrentTime(newTime);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  };

  // Sync playback rate when user toggles speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const { data: call, isLoading: callLoading } = useQuery<Call>({
    queryKey: [`/api/calls/${id}`],
    enabled: !!id,
  });

  // Fetch all calls to enable next/previous navigation
  const { data: allCalls } = useQuery<Call[]>({
    queryKey: ["/api/calls"],
  });

  // Find current call index and get prev/next call IDs
  const currentIndex = allCalls?.findIndex(c => c.id === id) ?? -1;
  const prevCall = currentIndex > 0 ? allCalls?.[currentIndex - 1] : null;
  const nextCall = currentIndex >= 0 && currentIndex < (allCalls?.length ?? 0) - 1 ? allCalls?.[currentIndex + 1] : null;

  // Extract contact and campaign from the call object (now embedded)
  const contact = call?.contact;
  const campaign = call?.campaign;

  const hasRecording = call?.engine !== 'openai' && (call?.recordingUrl || call?.elevenLabsConversationId || call?.twilioSid || call?.plivoCallUuid || call?.engine === 'custom-voice-engine');

  // Fetch recording as blob with authentication
  useEffect(() => {
    const abortController = new AbortController();
    let fetchedBlobUrl: string | null = null;
    
    // Fetch recording if we have either a recordingUrl OR an elevenLabsConversationId
    // Skip OpenAI widget calls - they use WebRTC and don't have server-side recordings
    if (call?.engine !== 'openai' && (call?.recordingUrl || call?.elevenLabsConversationId || call?.twilioSid || call?.plivoCallUuid || call?.engine === 'custom-voice-engine') && id) {
      const fetchRecording = async () => {
        try {
          if (!AuthStorage.isAuthenticated()) {
            console.error('No authentication token found');
            return;
          }
          
          const headers: Record<string, string> = {};
          const authHeader = AuthStorage.getAuthHeader();
          if (authHeader) {
            headers['Authorization'] = authHeader;
          }
          
          const response = await fetch(`/api/calls/${id}/recording`, {
            headers,
            credentials: 'include',
            signal: abortController.signal
          });
          
          if (response.ok) {
            const blob = await response.blob();
            
            // Check if this fetch was aborted before creating blob URL
            if (!abortController.signal.aborted) {
              fetchedBlobUrl = URL.createObjectURL(blob);
              
              // Revoke old blob URL before setting new one
              setRecordingBlobUrl((prevUrl) => {
                if (prevUrl) {
                  URL.revokeObjectURL(prevUrl);
                }
                return fetchedBlobUrl;
              });
            }
          } else {
            console.error('Failed to fetch recording:', response.statusText);
          }
        } catch (error: any) {
          // Ignore abort errors
          if (error.name !== 'AbortError') {
            console.error('Failed to fetch recording:', error);
          }
        }
      };
      
      fetchRecording();
    }
    
    // Cleanup: abort in-flight request and revoke any blob URLs
    return () => {
      abortController.abort();
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Revoke the blob URL created by this effect instance
      if (fetchedBlobUrl) {
        URL.revokeObjectURL(fetchedBlobUrl);
      }
      
      // Clear state on unmount
      setRecordingBlobUrl((prevUrl) => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
      });
    };
  }, [call?.engine, call?.recordingUrl, call?.elevenLabsConversationId, call?.twilioSid, call?.plivoCallUuid, id]);

  if (callLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/calls")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Calls
        </Button>
        <Card className="p-16 text-center">
          <h3 className="text-lg font-semibold mb-2">Call not found</h3>
          <p className="text-muted-foreground">The call you're looking for doesn't exist</p>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">completed</span>;
      case "failed":
        return <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-500">failed</span>;
      case "credit_failed":
        return (
          <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-500" data-testid="badge-status-credit-failed">
            Not Billed
          </span>
        );
      case "no-answer":
        return <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">No answer</span>;
      case "busy":
        return <span className="inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">Busy</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{status}</span>;
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    switch (sentiment) {
      case "positive":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Positive</Badge>;
      case "negative":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Negative</Badge>;
      case "neutral":
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">Neutral</Badge>;
      default:
        return <Badge variant="outline">{sentiment}</Badge>;
    }
  };

  const getEngineBadge = (engine?: string) => {
    if (engine === 'twilio-openai') {
      return <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">OpenAI + Twilio</span>;
    }
    if (engine === 'plivo-openai') {
      return <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">Plivo + OpenAI</span>;
    }
    if (engine === 'openai') {
      return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">OpenAI</span>;
    }
    if (engine === 'custom-voice-engine') {
      return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">Custom Voice</span>;
    }
    return <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600">ElevenLabs</span>;
  };

  const getWidgetBadge = () => {
    if (!call.widgetId) return null;
    return (
      <Badge className="bg-brand/10 text-brand border-brand/20 gap-1">
        <Globe className="h-3 w-3" />
        Widget
      </Badge>
    );
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isIncoming = call.callDirection === 'incoming';
  const primaryNumber = isIncoming 
    ? formatSipEndpoint(call.fromNumber, call.engine) || contact?.phone || call.phoneNumber || "Unknown"
    : formatSipEndpoint(call.toNumber, call.engine) || contact?.phone || call.phoneNumber || "Unknown";
  const secondaryNumber = isIncoming 
    ? formatSipEndpoint(call.toNumber, call.engine) || "Your number"
    : formatSipEndpoint(call.fromNumber, call.engine) || "Your number";
  
  // For widget calls, show widget name instead of Unknown
  const contactName = call.widgetId 
    ? (call.widget?.name || (call.metadata as any)?.widgetName || 'Website Widget')
    : (contact && contact.firstName && contact.firstName.toLowerCase() !== 'unknown'
      ? `${contact.firstName} ${contact.lastName || ""}`.trim()
      : primaryNumber);

  const creditError = (call.metadata as any)?.creditError
    || (call.metadata as any)?.creditDeductionError
    || 'Insufficient credits';
  const creditsRequired = (call.metadata as any)?.creditsRequired;
  const callTime = call.startedAt || call.createdAt;
  const dateTimeLabel = formatCallDate(callTime);
  const callDateLine = callTime
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: systemTimezone }).format(new Date(callTime))
    : "—";
  const callClockLine = callTime
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: systemTimezone }).format(new Date(callTime))
    : "";

  const handleExportLogs = () => {
    const payload = {
      id: call.id,
      status: call.status,
      direction: call.callDirection,
      from: call.fromNumber,
      to: call.toNumber,
      duration: call.duration,
      transcript: call.transcript,
      aiSummary: call.aiSummary,
      createdAt: call.createdAt,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      metadata: call.metadata,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `call-logs-${call.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pillButton = "h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-40";

  return (
    <div className="space-y-4">
      {call.status === 'credit_failed' && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          data-testid="banner-credit-failed"
        >
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-700 dark:text-red-300">
                This call was not billed because your credits ran out mid-call.
              </p>
              <p className="text-red-700/80 dark:text-red-300/80 mt-1">
                The call connected and ran to completion, but we could not deduct the
                {creditsRequired ? ` ${creditsRequired} ` : ' '}credits required ({creditError}).
                No further calls will be billed until you top up.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLocation('/billing')}
            data-testid="button-topup-credits"
            className="shrink-0"
          >
            Top Up Credits
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button type="button" className={pillButton} onClick={() => setLocation("/calls")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Calls
        </button>
        <div className="flex items-center gap-2">
          <button type="button" className={pillButton} onClick={() => prevCall && setLocation(`/calls/${prevCall.id}`)} disabled={!prevCall} data-testid="button-prev-call">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button type="button" className={pillButton} onClick={() => nextCall && setLocation(`/calls/${nextCall.id}`)} disabled={!nextCall} data-testid="button-next-call">
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-[#2F6BFF] flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[17px] font-semibold text-slate-900 truncate">{primaryNumber}</h1>
                {getEngineBadge(call.engine)}
                {getWidgetBadge()}
                {getStatusBadge(call.status)}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {isIncoming ? "Incoming Call" : "Outgoing Call"}
                {" - "}
                {isIncoming ? `From: ${primaryNumber}` : `To: ${primaryNumber}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50 shrink-0"
            onClick={handleExportLogs}
            data-testid="button-download"
          >
            <Download className="h-4 w-4" />
            Export Logs
          </button>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-4 w-4" />
              Duration
            </div>
            <p className="mt-2 text-[22px] leading-none font-semibold text-[#2F6BFF]">{formatDuration(call.duration)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="h-4 w-4" />
              Date & Time
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{dateTimeLabel || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MessageSquare className="h-4 w-4" />
              Transcript
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{call.transcript ? "Available" : "None"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Volume2 className="h-4 w-4" />
              Recording
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{hasRecording ? "Available" : "None"}</p>
          </div>
        </div>
      </div>

      {hasRecording && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-slate-700/50 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Volume2 className="h-5 w-5 text-blue-400" />
              <h3 className="text-sm font-medium text-slate-300">Audio Recording</h3>
            </div>
            
            {recordingBlobUrl ? (
              <div className="flex items-center gap-4">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                  onClick={() => {
                    if (audioRef.current) {
                      const newTime = Math.max(0, audioRef.current.currentTime - 10);
                      audioRef.current.currentTime = newTime;
                      setCurrentTime(newTime);
                    }
                  }}
                  title="Rewind 10s"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  className="rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 shrink-0 hover:bg-blue-500"
                  onClick={() => {
                    if (audioRef.current) {
                      if (isPlaying) {
                        audioRef.current.pause();
                      } else {
                        audioRef.current.play();
                      }
                    }
                  }}
                  data-testid="button-play-pause"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                  onClick={() => {
                    if (audioRef.current && call.duration) {
                      const newTime = Math.min(call.duration, audioRef.current.currentTime + 10);
                      audioRef.current.currentTime = newTime;
                      setCurrentTime(newTime);
                    }
                  }}
                  title="Forward 10s"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                
                <div className="flex-1">
                  <div 
                    ref={waveformRef}
                    onClick={handleWaveformClick}
                    className="h-16 bg-slate-800/50 rounded-xl flex items-center justify-center px-4 border border-slate-700/30 cursor-pointer hover:bg-slate-800/80 transition-all relative overflow-hidden group"
                    title="Click to seek"
                  >
                    <div className="flex items-end gap-[3px] h-12 w-full select-none pointer-events-none">
                      {Array.from({ length: 60 }).map((_, i) => {
                        const height = 25 + Math.abs(Math.sin(i * 0.35) * 45 + Math.cos(i * 0.2) * 25);
                        const isActive = call.duration && currentTime > 0 
                          ? i < (currentTime / call.duration) * 60 
                          : false;
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-all duration-150 ${
                              isActive ? 'bg-blue-500' : 'bg-slate-600/60'
                            } group-hover:opacity-90`}
                            style={{
                              height: `${height}%`,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r from-blue-500/20 to-blue-500/20" />
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 px-1 flex-wrap gap-2">
                    <span className="text-sm font-mono text-blue-400">
                      {formatDuration(Math.floor(currentTime))}
                    </span>
                    
                    {/* Playback speed selector */}
                    <div className="flex items-center gap-1 bg-slate-800/40 rounded-full px-2.5 py-0.5 border border-slate-700/30">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Speed:</span>
                      {[1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => setPlaybackRate(rate)}
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-all ${
                            playbackRate === rate 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>

                    <span className="text-sm font-mono text-slate-500">
                      {formatDuration(call.duration)}
                    </span>
                  </div>
                </div>
                
                <audio
                  ref={audioRef}
                  src={recordingBlobUrl}
                  onPlay={handlePlay}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onTimeUpdate={(e) => {
                    setCurrentTime(e.currentTarget.currentTime);
                  }}
                  onLoadedMetadata={(e) => {
                    if (audioRef.current) {
                      audioRef.current.playbackRate = playbackRate;
                    }
                    if (!call.duration && e.currentTarget.duration) {
                      setCurrentTime(0);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                <span className="text-sm text-slate-400">Loading recording...</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none bg-transparent p-0 border-b border-slate-200">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent px-0 pb-2.5 shadow-none data-[state=active]:border-[#2F6BFF] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-slate-900 text-slate-500" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="transcription" className="rounded-none border-b-2 border-transparent px-0 pb-2.5 shadow-none data-[state=active]:border-[#2F6BFF] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-slate-900 text-slate-500" data-testid="tab-transcription">Transcription</TabsTrigger>
          <TabsTrigger value="metadata" className="rounded-none border-b-2 border-transparent px-0 pb-2.5 shadow-none data-[state=active]:border-[#2F6BFF] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-slate-900 text-slate-500" data-testid="tab-metadata">Client data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">AI Summary</h3>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 leading-relaxed">
              {call.aiSummary || "No AI summary available for this call. The call may still be processing or did not complete successfully."}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</p>
              </div>
              <div>{getStatusBadge(call.status)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Duration</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatDuration(call.duration)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Call Time</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">{callDateLine}</p>
              {callClockLine ? <p className="text-xs text-slate-500 mt-0.5">{callClockLine}</p> : null}
            </div>
          </div>

          {/* Contact & Campaign Info */}
          {(contact || campaign || (call.callDirection === 'incoming' && call.metadata?.incomingAgentName)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Card */}
              {contact && (
                <div className="bg-white dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</p>
                      <p className="font-semibold text-foreground">{contact.firstName} {contact.lastName || ""}</p>
                    </div>
                  </div>
                  <div className="space-y-2 pl-[52px]">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{contact.phone}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Campaign Card */}
              {campaign && (
                <div className="bg-white dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                      <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campaign</p>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto font-semibold text-foreground underline-offset-4 hover:underline"
                        onClick={() => setLocation(`/campaigns/${campaign.id}`)}
                        data-testid="link-campaign"
                      >
                        {campaign.name}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Incoming Agent Card */}
              {call.callDirection === 'incoming' && call.metadata?.incomingAgentName && (
                <div className="bg-white dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Incoming Agent</p>
                      <p className="font-semibold text-foreground">{call.metadata.incomingAgentName}</p>
                    </div>
                  </div>
                  {call.metadata?.calledNumber && (
                    <div className="pl-[52px]">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>Called: {call.metadata.calledNumber}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transcription">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold">Call Transcript</h3>
            </div>
            
            {call.transcript ? (
              <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
                {(() => {
                  let parsed: any = call.transcript;
                  if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
                  }
                  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].role && ('message' in parsed[0] || 'content' in parsed[0])) {
                    return parsed
                      .filter((entry: any) => (entry.message || entry.content) && (entry.message || entry.content).trim())
                      .map((entry: any, index: number) => {
                        const isAgent = entry.role === 'agent' || entry.role === 'ai' || entry.role === 'assistant';
                        const speaker = isAgent ? 'Agent' : 'User';
                        const message = entry.message || entry.content;
                        return (
                          <div 
                            key={index} 
                            className={`flex gap-3 ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}
                            data-testid={`transcript-entry-${index}`}
                          >
                            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                              isAgent 
                                ? 'bg-blue-500/10 dark:bg-blue-500/20' 
                                : 'bg-emerald-500/10 dark:bg-emerald-500/20'
                            }`}>
                              {isAgent ? (
                                <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              )}
                            </div>
                            <div className={`flex-1 max-w-[80%] ${isAgent ? '' : 'flex flex-col items-end'}`}>
                              <div className={`rounded-2xl px-4 py-3 ${
                                isAgent 
                                  ? 'bg-slate-100 dark:bg-slate-800/80 rounded-tl-md' 
                                  : 'bg-blue-500/10 dark:bg-blue-600/20 rounded-tr-md'
                              }`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-medium ${
                                    isAgent ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                                  }`} data-testid={`transcript-speaker-${index}`}>
                                    {speaker}
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed" data-testid={`transcript-message-${index}`}>{message}</p>
                              </div>
                            </div>
                          </div>
                        );
                      });
                  }
                  const textTranscript = typeof call.transcript === 'string' ? call.transcript : JSON.stringify(call.transcript, null, 2);
                  return textTranscript.split('\n').filter((line: string) => line.trim()).map((line: string, index: number) => {
                    const timestampMatch = line.match(/^\[(\d{2}:\d{2})\]\s*(.+)/);
                    const speakerMatch = timestampMatch ? timestampMatch[2].match(/^(Agent|User|AI|Customer):\s*(.+)/) : null;
                    
                    if (timestampMatch && speakerMatch) {
                      const timestamp = timestampMatch[1];
                      const speaker = speakerMatch[1];
                      const message = speakerMatch[2];
                      const isAgent = speaker === 'Agent' || speaker === 'AI';
                      
                      return (
                        <div 
                          key={index} 
                          className={`flex gap-3 ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}
                          data-testid={`transcript-entry-${index}`}
                        >
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                            isAgent 
                              ? 'bg-blue-500/10 dark:bg-blue-500/20' 
                              : 'bg-emerald-500/10 dark:bg-emerald-500/20'
                          }`}>
                            {isAgent ? (
                              <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </div>
                          <div className={`flex-1 max-w-[80%] ${isAgent ? '' : 'flex flex-col items-end'}`}>
                            <div className={`rounded-2xl px-4 py-3 ${
                              isAgent 
                                ? 'bg-slate-100 dark:bg-slate-800/80 rounded-tl-md' 
                                : 'bg-blue-500/10 dark:bg-blue-600/20 rounded-tr-md'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium ${
                                  isAgent ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`} data-testid={`transcript-speaker-${index}`}>
                                  {speaker}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono" data-testid={`transcript-timestamp-${index}`}>
                                  {timestamp}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed" data-testid={`transcript-message-${index}`}>{message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={index} className="px-4 py-2">
                        <p className="text-sm leading-relaxed text-muted-foreground">{line}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No transcript available for this call. The call may still be processing or did not complete successfully.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="metadata">
          <Card className="p-5 rounded-2xl border-slate-200 shadow-none">
            <h3 className="text-lg font-semibold mb-4">Call Metadata</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Call ID</div>
                <div className="font-mono">{call.id}</div>

                {call.metadata?.twilioCallSid && (
                  <>
                    <div className="text-muted-foreground">Twilio Call SID</div>
                    <div className="font-mono text-xs">{call.metadata.twilioCallSid}</div>
                  </>
                )}

                {contact && (
                  <>
                    <div className="text-muted-foreground">Contact ID</div>
                    <div className="font-mono">{contact.id}</div>
                  </>
                )}

                <div className="text-muted-foreground">Created At</div>
                <div>{format(new Date(call.createdAt), "MMM d, yyyy 'at' h:mm:ss a")}</div>

                {call.endedAt && (
                  <>
                    <div className="text-muted-foreground">Ended At</div>
                    <div>{format(new Date(call.endedAt), "MMM d, yyyy 'at' h:mm:ss a")}</div>
                  </>
                )}

                {call.metadata && Object.keys(call.metadata).length > 0 && (
                  <>
                    <div className="text-muted-foreground col-span-2 mt-4 font-medium">Additional Metadata</div>
                    <div className="col-span-2">
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                        {JSON.stringify(call.metadata, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
