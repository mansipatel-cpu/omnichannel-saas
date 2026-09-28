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
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Search, Play, Pause, Mic, AlertCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import OpenAIVoicePreviewButton from "@/features/agents/components/OpenAIVoicePreviewButton";
const OPENAI_VOICES = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral, versatile voice suitable for a wide range of applications', gender: 'Neutral', style: 'Balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm, engaging voice with a friendly tone', gender: 'Male', style: 'Warm' },
    { id: 'shimmer', name: 'Shimmer', description: 'Expressive, dynamic voice with clear articulation', gender: 'Female', style: 'Expressive' },
    { id: 'ash', name: 'Ash', description: 'Calm, professional voice ideal for business contexts', gender: 'Male', style: 'Professional' },
    { id: 'ballad', name: 'Ballad', description: 'Smooth, melodic voice with a soothing quality', gender: 'Female', style: 'Melodic' },
    { id: 'coral', name: 'Coral', description: 'Bright, energetic voice with an upbeat tone', gender: 'Female', style: 'Energetic' },
    { id: 'sage', name: 'Sage', description: 'Wise, authoritative voice conveying expertise', gender: 'Male', style: 'Authoritative' },
    { id: 'verse', name: 'Verse', description: 'Articulate, clear voice perfect for narration', gender: 'Neutral', style: 'Narrative' },
    { id: 'cedar', name: 'Cedar', description: 'Deep, resonant voice with a grounded presence', gender: 'Male', style: 'Deep' },
    { id: 'marin', name: 'Marin', description: 'Fresh, youthful voice with modern appeal', gender: 'Female', style: 'Youthful' },
];
export default function Voices() {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [playingVoice, setPlayingVoice] = useState(null);
    const audioRef = useRef(null);
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    const { data: accountVoices, isLoading, isError, error } = useQuery({
        queryKey: ["/api/elevenlabs/voices"],
        staleTime: 60000,
    });
    const filteredVoices = useMemo(() => {
        if (!accountVoices)
            return [];
        if (!debouncedSearch)
            return accountVoices;
        const searchLower = debouncedSearch.toLowerCase();
        return accountVoices.filter(v => v.name.toLowerCase().includes(searchLower) ||
            v.labels?.language?.toLowerCase().includes(searchLower) ||
            v.labels?.gender?.toLowerCase().includes(searchLower) ||
            v.labels?.accent?.toLowerCase().includes(searchLower) ||
            v.category?.toLowerCase().includes(searchLower));
    }, [accountVoices, debouncedSearch]);
    const filteredOpenAIVoices = useMemo(() => {
        if (!debouncedSearch)
            return OPENAI_VOICES;
        const searchLower = debouncedSearch.toLowerCase();
        return OPENAI_VOICES.filter(v => v.name.toLowerCase().includes(searchLower) ||
            v.description.toLowerCase().includes(searchLower) ||
            v.gender.toLowerCase().includes(searchLower) ||
            v.style.toLowerCase().includes(searchLower));
    }, [debouncedSearch]);
    const handlePlayPreview = (voiceId, previewUrl) => {
        if (!previewUrl)
            return;
        if (playingVoice === voiceId) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            setPlayingVoice(null);
            return;
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        const audio = new Audio(previewUrl);
        audioRef.current = audio;
        audio.play();
        setPlayingVoice(voiceId);
        audio.onended = () => {
            setPlayingVoice(null);
            audioRef.current = null;
        };
    };
    const formatLanguageName = (code) => {
        const languageNames = {
            en: "English",
            es: "Spanish",
            fr: "French",
            de: "German",
            it: "Italian",
            pt: "Portuguese",
            ja: "Japanese",
            ko: "Korean",
            zh: "Chinese",
            ru: "Russian",
            ar: "Arabic",
            hi: "Hindi",
            nl: "Dutch",
            pl: "Polish",
            sv: "Swedish",
            tr: "Turkish",
            id: "Indonesian",
            th: "Thai",
            vi: "Vietnamese",
            cs: "Czech",
            el: "Greek",
            hu: "Hungarian",
            ro: "Romanian",
            uk: "Ukrainian",
            he: "Hebrew",
            ms: "Malay",
            fil: "Filipino",
            da: "Danish",
            fi: "Finnish",
            no: "Norwegian",
            sk: "Slovak",
            bg: "Bulgarian",
            hr: "Croatian",
            lt: "Lithuanian",
            lv: "Latvian",
            sl: "Slovenian",
            et: "Estonian",
        };
        return languageNames[code?.toLowerCase()] || code?.toUpperCase() || "Unknown";
    };
    const totalVoiceCount = (accountVoices?.length || 0) + OPENAI_VOICES.length;
    const filteredCount = filteredVoices.length + filteredOpenAIVoices.length;
    const pill = "inline-flex items-center rounded-full bg-[#F4F6F8] px-2.5 py-1 text-[11px] font-medium text-slate-500 capitalize";
    const accentPill = "inline-flex items-center rounded-full border border-[#2F6BFF] bg-white px-2.5 py-1 text-[11px] font-medium text-[#2F6BFF] capitalize";
    const playButton = (isPlaying, onClick, testId) => (<button type="button" onClick={onClick} className="h-7 w-7 text-slate-400 hover:text-slate-700 inline-flex items-center justify-center shrink-0" data-testid={testId}>
      {isPlaying ? <Pause className="h-4 w-4"/> : <Play className="h-4 w-4 fill-slate-400"/>}
    </button>);
    const voiceTitle = (name, extra) => extra ? `${name} - ${extra}` : name;
    return (<div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-[#2F6BFF] flex items-center justify-center shrink-0">
          <Mic className="h-5 w-5 text-white"/>
        </div>
        <div>
          <h1 className="text-[17px] font-semibold text-slate-900 leading-tight">Voice Library</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Browse and preview {totalVoiceCount || 21} voices for your agents
          </p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
        <Input placeholder="Search voices by name, accent, or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 rounded-lg border-slate-200 bg-white" data-testid="input-search-voices"/>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Total Voices</span>
        <span>Showing {filteredCount} of {totalVoiceCount} voices</span>
      </div>

      {isError && (<Alert variant="destructive" data-testid="alert-voices-error">
          <AlertCircle className="h-4 w-4"/>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>
            {error?.message || t('voices.errorLoading', 'Failed to load voices. Please check your ElevenLabs API key configuration.')}
          </AlertDescription>
        </Alert>)}

      {isLoading ? (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (<div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <Skeleton className="h-5 w-3/4 mb-3"/>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16"/>
                <Skeleton className="h-5 w-12"/>
              </div>
            </div>))}
        </div>) : filteredCount === 0 ? (<Card className="p-16 text-center">
          <Mic className="h-12 w-12 mx-auto mb-4 text-muted-foreground"/>
          <h3 className="text-lg font-semibold mb-2">
            {debouncedSearch
                ? t('voices.noVoicesMatch', 'No voices match your search')
                : t('voices.noVoicesAvailable', 'No voices available')}
          </h3>
          <p className="text-muted-foreground">
            {debouncedSearch
                ? t('voices.tryDifferentSearch', 'Try a different search term')
                : t('voices.voicesWillAppear', 'Your voices will appear here')}
          </p>
        </Card>) : (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredVoices.map((voice) => (<div key={voice.voice_id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 min-h-[132px]" data-testid={`card-voice-${voice.voice_id}`}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-slate-900 truncate" data-testid="text-voice-name">
                  {voiceTitle(voice.name, voice.labels?.descriptive || voice.labels?.use_case)}
                </h3>
                {voice.preview_url && playButton(playingVoice === voice.voice_id, () => handlePlayPreview(voice.voice_id, voice.preview_url), "button-play-voice")}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {voice.labels?.language && <span className={pill}>{formatLanguageName(voice.labels.language)}</span>}
                {voice.labels?.gender && <span className={pill}>{voice.labels.gender}</span>}
                {voice.labels?.accent && <span className={pill}>{voice.labels.accent}</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-6">
                {voice.category && <span className={accentPill}>{voice.category}</span>}
                {voice.labels?.age && <span className={pill}>{voice.labels.age}</span>}
              </div>
            </div>))}
          {filteredOpenAIVoices.map((voice) => (<div key={voice.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 min-h-[132px]" data-testid={`card-openai-voice-${voice.id}`}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-slate-900 truncate" data-testid="text-openai-voice-name">
                  {voiceTitle(voice.name, voice.style)}
                </h3>
                <OpenAIVoicePreviewButton voiceId={voice.id} voiceName={voice.name}/>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={pill}>English</span>
                <span className={pill}>{voice.gender}</span>
                <span className={pill}>{voice.style}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-6">
                <span className={accentPill}>OpenAI</span>
              </div>
            </div>))}
        </div>)}
    </div>);
}
