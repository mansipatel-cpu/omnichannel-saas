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
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { Link, FileText, Type, Search, ChevronDown, FileStack, Trash2, Upload, Globe, FileType, Crown, Zap, Lock, BookOpen, Loader2, CheckCircle2, AlertCircle, Brain, RefreshCw, Video, Play } from "lucide-react";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { useDemoMode } from "@/shared/components/DemoModeBanner";
import { useAppHeaderOptional } from "@/shared/components/AppPageHeader";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/shared/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/shared/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/shared/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/shared/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, } from "@/shared/components/ui/tooltip";
import { Card } from "@/shared/components/ui/card";
import { useToast } from "@/shared/hooks/use-toast";
import { queryClient, apiRequest } from "@/shared/lib/queryClient";
import { DataPagination, usePagination } from "@/shared/components/ui/data-pagination";
export default function KnowledgeBase() {
    const { t } = useTranslation();
    const [, setLocation] = useLocation();
    const appHeader = useAppHeaderOptional();
    const setPageMeta = appHeader?.setPageMeta;
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState(null);
    useEffect(() => {
        if (!setPageMeta)
            return;
        setPageMeta({ hideTitle: true });
        return () => setPageMeta(null);
    }, [setPageMeta]);
    const { isDemoMode } = useDemoMode();
    const [isVideoOpen, setIsVideoOpen] = useState(false);
    const [urlDialogOpen, setUrlDialogOpen] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const [urlName, setUrlName] = useState("");
    const [textDialogOpen, setTextDialogOpen] = useState(false);
    const [textInput, setTextInput] = useState("");
    const [textName, setTextName] = useState("");
    const [fileDialogOpen, setFileDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const fileInputRef = useRef(null);
    const [deletingItem, setDeletingItem] = useState(null);
    const { toast } = useToast();
    const { data: user, isLoading: userLoading, isError: userError } = useQuery({
        queryKey: ['/api/auth/me'],
    });
    const { data: limits, isLoading: limitsLoading, isError: limitsError } = useQuery({
        queryKey: ["/api/user/limits"],
        enabled: !!user,
    });
    // If limits fetch fails, default open (allow access) to avoid false lockout for paid users
    const kbAllowed = !!limitsError || (!limitsLoading && (limits?.knowledgeBases?.max ?? 0) > 0);
    const { data: storageUsage } = useQuery({
        queryKey: ["/api/rag-knowledge/storage"],
        enabled: kbAllowed,
    });
    const { data: knowledgeBase = [], isLoading, refetch } = useQuery({
        queryKey: ["/api/rag-knowledge"],
        enabled: kbAllowed,
        refetchInterval: (query) => {
            const items = query.state.data;
            const hasProcessingItems = items?.some(item => item.ragStatus === 'processing');
            return hasProcessingItems ? 3000 : false;
        },
    });
    const uploadFileMutation = useMutation({
        mutationFn: async (data) => {
            const formData = new FormData();
            formData.append('file', data.file);
            if (data.name) {
                formData.append('name', data.name);
            }
            const headers = {};
            const authHeader = AuthStorage.getAuthHeader();
            if (authHeader) {
                headers['Authorization'] = authHeader;
            }
            const response = await fetch('/api/rag-knowledge/upload', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: formData,
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || t('knowledgeBase.errors.uploadFailed'));
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
            setFileDialogOpen(false);
            setSelectedFile(null);
            setFileName('');
            toast({
                title: t('knowledgeBase.toast.fileUploaded'),
                description: t('knowledgeBase.toast.fileUploadedDesc'),
            });
        },
        onError: (error) => {
            toast({
                title: t('knowledgeBase.toast.uploadFailed'),
                description: error.message || t('knowledgeBase.toast.uploadFailedDesc'),
                variant: "destructive",
            });
        },
    });
    const addUrlMutation = useMutation({
        mutationFn: async (data) => {
            const res = await apiRequest('POST', '/api/rag-knowledge/url', data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
            setUrlDialogOpen(false);
            setUrlInput('');
            setUrlName('');
            toast({
                title: t('knowledgeBase.toast.urlAdded'),
                description: t('knowledgeBase.toast.urlAddedDesc'),
            });
        },
        onError: (error) => {
            toast({
                title: t('knowledgeBase.toast.urlFailed'),
                description: error.message || t('knowledgeBase.toast.urlFailedDesc'),
                variant: "destructive",
            });
        },
    });
    const addTextMutation = useMutation({
        mutationFn: async (data) => {
            const res = await apiRequest('POST', '/api/rag-knowledge/text', data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
            setTextDialogOpen(false);
            setTextInput('');
            setTextName('');
            toast({
                title: t('knowledgeBase.toast.textAdded'),
                description: t('knowledgeBase.toast.textAddedDesc'),
            });
        },
        onError: (error) => {
            toast({
                title: t('knowledgeBase.toast.textFailed'),
                description: error.message || t('knowledgeBase.toast.textFailedDesc'),
                variant: "destructive",
            });
        },
    });
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const res = await apiRequest('DELETE', `/api/rag-knowledge/${id}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
            setDeletingItem(null);
            toast({
                title: t('common.delete'),
                description: t('knowledgeBase.toast.deleted'),
            });
        },
        onError: () => {
            toast({
                title: t('common.error'),
                description: t('knowledgeBase.toast.deleteFailed'),
                variant: "destructive",
            });
        },
    });
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 20 * 1024 * 1024) {
                toast({
                    title: t('knowledgeBase.toast.fileTooLarge'),
                    description: t('knowledgeBase.toast.fileTooLargeDesc'),
                    variant: "destructive",
                });
                return;
            }
            setSelectedFile(file);
            if (!fileName) {
                setFileName(file.name);
            }
        }
    };
    const handleUploadFile = () => {
        if (!selectedFile) {
            toast({
                title: t('knowledgeBase.toast.noFileSelected'),
                description: t('knowledgeBase.toast.noFileSelectedDesc'),
                variant: "destructive",
            });
            return;
        }
        uploadFileMutation.mutate({ file: selectedFile, name: fileName || selectedFile.name });
    };
    const handleAddUrl = () => {
        if (!urlInput) {
            toast({
                title: t('knowledgeBase.toast.urlRequired'),
                description: t('knowledgeBase.toast.urlRequiredDesc'),
                variant: "destructive",
            });
            return;
        }
        addUrlMutation.mutate({ url: urlInput, name: urlName || urlInput });
    };
    const handleAddText = () => {
        if (!textInput || !textName) {
            toast({
                title: t('knowledgeBase.toast.requiredFields'),
                description: t('knowledgeBase.toast.requiredFieldsDesc'),
                variant: "destructive",
            });
            return;
        }
        if (textInput.length > 300000) {
            toast({
                title: t('knowledgeBase.toast.textTooLong'),
                description: t('knowledgeBase.toast.textTooLongDesc'),
                variant: "destructive",
            });
            return;
        }
        addTextMutation.mutate({ text: textInput, name: textName });
    };
    const filteredItems = knowledgeBase.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = !typeFilter || item.type === typeFilter;
        return matchesSearch && matchesType;
    });
    const { currentPage, totalPages, totalItems, itemsPerPage, paginatedItems, handlePageChange, handleItemsPerPageChange, } = usePagination(filteredItems, 10);
    const totalSize = knowledgeBase.reduce((sum, item) => sum + item.storageSize, 0);
    const formatBytes = (bytes) => {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    const getTypeIcon = (type) => {
        switch (type) {
            case 'url':
                return <Globe className="h-4 w-4"/>;
            case 'file':
                return <FileText className="h-4 w-4"/>;
            case 'text':
                return <Type className="h-4 w-4"/>;
            default:
                return <FileType className="h-4 w-4"/>;
        }
    };
    const statusColor = (status) => {
        switch (status) {
            case 'processing':
                return "#2563EB";
            case 'completed':
                return "#16A34A";
            case 'failed':
                return "#EF4444";
            default:
                return "#94A3B8";
        }
    };
    const getStatusIcon = (status) => {
        const color = statusColor(status);
        switch (status) {
            case 'processing':
                return <Loader2 className="h-4 w-4 animate-spin" style={{ color }}/>;
            case 'completed':
                return <CheckCircle2 className="h-4 w-4" style={{ color }}/>;
            case 'failed':
                return <AlertCircle className="h-4 w-4" style={{ color }}/>;
            default:
                return <Loader2 className="h-4 w-4" style={{ color }}/>;
        }
    };
    const getStatusText = (status) => {
        switch (status) {
            case 'processing':
                return t('knowledgeBase.status.processing');
            case 'completed':
                return t('knowledgeBase.status.ready');
            case 'failed':
                return t('knowledgeBase.status.failed');
            default:
                return t('knowledgeBase.status.pending');
        }
    };
    if (userLoading || (!!user && limitsLoading && !limitsError)) {
        return (<div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>);
    }
    if (userError) {
        return (<div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('knowledgeBase.title')}</h1>
        </div>
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">{t('knowledgeBase.unableToLoad')}</h2>
          <p className="text-muted-foreground">
            {t('knowledgeBase.unableToLoadDesc')}
          </p>
        </Card>
      </div>);
    }
    // If limits API errored, don't lock (fail open to avoid falsely blocking paid users)
    const isKbLocked = !limitsError && (limits?.knowledgeBases?.max ?? 0) === 0;
    if (isKbLocked) {
        return (<div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('knowledgeBase.title')}</h1>
        </div>

        <div className="p-8 text-center border rounded-lg">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <BookOpen className="w-20 h-20 text-muted-foreground/30"/>
                <Lock className="w-8 h-8 text-primary absolute -bottom-1 -right-1 bg-background rounded-full p-1"/>
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">{t('knowledgeBase.unlock.title')}</h2>
              <p className="text-muted-foreground text-lg">
                {t('knowledgeBase.unlock.description')}
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg mb-4">{t('knowledgeBase.unlock.proFeatures')}</h3>
              <div className="grid gap-3 text-left">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="font-medium">{t('knowledgeBase.unlock.uploadDocs')}</p>
                    <p className="text-sm text-muted-foreground">{t('knowledgeBase.unlock.uploadDocsDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="font-medium">{t('knowledgeBase.unlock.addWebContent')}</p>
                    <p className="text-sm text-muted-foreground">{t('knowledgeBase.unlock.addWebContentDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="font-medium">{t('knowledgeBase.unlock.customText')}</p>
                    <p className="text-sm text-muted-foreground">{t('knowledgeBase.unlock.customTextDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="font-medium">{t('knowledgeBase.unlock.aiSearch')}</p>
                    <p className="text-sm text-muted-foreground">{t('knowledgeBase.unlock.aiSearchDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="font-medium">{t('knowledgeBase.unlock.storage')}</p>
                    <p className="text-sm text-muted-foreground">{t('knowledgeBase.unlock.storageDesc')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button size="lg" className="gap-2" onClick={() => setLocation('/account')} data-testid="button-upgrade-to-pro">
                <Crown className="w-5 h-5"/>
                {t('knowledgeBase.unlock.upgradeButton')}
              </Button>
              <p className="text-sm text-muted-foreground mt-3">
                {t('knowledgeBase.unlock.upgradeDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>);
    }
    const urlCount = knowledgeBase.filter(item => item.type === 'url').length;
    const fileCount = knowledgeBase.filter(item => item.type === 'file').length;
    const textCount = knowledgeBase.filter(item => item.type === 'text').length;
    const processingCount = knowledgeBase.filter(item => item.ragStatus === 'processing').length;
    const totalChunks = knowledgeBase.reduce((sum, item) => sum + (item.chunkCount || 0), 0);
    const maxStorageBytes = storageUsage?.maxStorageBytes || 20 * 1024 * 1024;
    const usedStorageBytes = storageUsage?.usedStorageBytes ?? totalSize;
    const storagePercent = Math.min(100, storageUsage?.usagePercent ?? Math.round((usedStorageBytes / maxStorageBytes) * 100));
    const statLabelClass = "mt-1.5 text-sm text-slate-500";
    return (<div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-5 py-5 md:px-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#2563EB" }}>
              <BookOpen className="h-6 w-6 text-white"/>
            </div>
            <div>
              <h1 className="text-xl md:text-[22px] font-bold text-slate-900 tracking-tight">
                {t('knowledgeBase.title')}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {t('knowledgeBase.description')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {isDemoMode && (<Button variant="outline" onClick={() => setIsVideoOpen(true)} className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium shadow-sm" data-testid="button-watch-demo-kb">
                <Video className="h-4 w-4 mr-2" style={{ color: "#2563EB" }}/>
                <span>Watch Demo Video</span>
              </Button>)}
            <Button onClick={() => setUrlDialogOpen(true)} className="text-white border-transparent shadow-sm font-medium hover:opacity-90" style={{ backgroundColor: "#2563EB" }} data-testid="button-add-url">
              <Link className="h-4 w-4 mr-2"/>
              {t('knowledgeBase.actions.addUrl')}
            </Button>
            <Button variant="outline" onClick={() => setFileDialogOpen(true)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium shadow-sm" data-testid="button-add-files">
              <FileText className="h-4 w-4 mr-2"/>
              {t('knowledgeBase.actions.addFiles')}
            </Button>
            <Button variant="outline" onClick={() => setTextDialogOpen(true)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium shadow-sm" data-testid="button-create-text">
              <Type className="h-4 w-4 mr-2"/>
              {t('knowledgeBase.actions.createText')}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-5 py-4">
          <div className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "#2563EB" }}>
            {knowledgeBase.length}
          </div>
          <div className={statLabelClass}>{t('knowledgeBase.stats.totalItems')}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "#2563EB" }}>
              {totalChunks}
            </div>
            <Brain className="h-4 w-4" style={{ color: "#2563EB" }}/>
          </div>
          <div className={statLabelClass}>{t('knowledgeBase.stats.knowledgeChunks')}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "#16A34A" }}>
              {urlCount + fileCount}
            </div>
            <FileText className="h-4 w-4" style={{ color: "#16A34A" }}/>
          </div>
          <div className={statLabelClass}>{t('knowledgeBase.stats.docsAndUrls')}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "#F97316" }}>
              {textCount}
            </div>
            <Type className="h-4 w-4" style={{ color: "#F97316" }}/>
          </div>
          <div className={statLabelClass}>{t('knowledgeBase.stats.textEntries')}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums" style={{ color: "#2563EB" }}>
              {formatBytes(usedStorageBytes)}
            </span>
            <span className="text-sm text-slate-400">/ {formatBytes(maxStorageBytes)}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${storagePercent}%`, backgroundColor: "#2563EB" }}/>
          </div>
          <div className={statLabelClass}>{t('knowledgeBase.stats.storageUsed')}</div>
        </div>
      </div>

      {processingCount > 0 && (<div className="rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#2563EB" }}/>
          <span className="text-sm text-slate-600">
            {t('knowledgeBase.processing.message', { count: processingCount })}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => refetch()} data-testid="button-refresh-status">
            <RefreshCw className="h-3 w-3 mr-1"/>
            {t('common.refresh')}
          </Button>
        </div>)}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
          <Input placeholder={t('knowledgeBase.searchPlaceholder')} className="h-11 pl-10 bg-white border-slate-200 shadow-sm rounded-lg" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search-knowledge-base"/>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 bg-white border-slate-200 shadow-sm font-normal text-slate-700 min-w-[128px] justify-between" data-testid="button-filter-type">
              {typeFilter ? t(`knowledgeBase.types.${typeFilter}`) : t('knowledgeBase.filters.allTypes')}
              <ChevronDown className="h-4 w-4 text-slate-400"/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTypeFilter(null)}>
              {t('knowledgeBase.filters.allTypes')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('file')}>
              <FileText className="mr-2 h-4 w-4"/>
              {t('knowledgeBase.types.file')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('url')}>
              <Link className="mr-2 h-4 w-4"/>
              {t('knowledgeBase.types.url')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('text')}>
              <Type className="mr-2 h-4 w-4"/>
              {t('knowledgeBase.types.text')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (<div className="rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center py-24 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-4"/>
          <p className="text-sm text-slate-500">{t('knowledgeBase.loading')}</p>
        </div>) : filteredItems.length === 0 ? (<div className="rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-50 border border-slate-200">
            <FileStack className="h-8 w-8 text-slate-400"/>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">{t('knowledgeBase.empty.title')}</h3>
          <p className="text-sm text-slate-500">
            {searchQuery || typeFilter ? t('knowledgeBase.empty.adjustFilters') : t('knowledgeBase.empty.uploadFirst')}
          </p>
        </div>) : (<>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-200">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('knowledgeBase.table.name')}</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('common.type')}</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('knowledgeBase.table.aiStatus')}</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('knowledgeBase.table.chunks')}</TableHead>
                  <TableHead className="hidden sm:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('knowledgeBase.table.size')}</TableHead>
                  <TableHead className="hidden lg:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('knowledgeBase.table.created')}</TableHead>
                  <TableHead className="w-[90px] text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('knowledgeBase.table.actions', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => (<TableRow key={item.id} className="border-slate-100" data-testid={`row-kb-item-${item.id}`}>
                    <TableCell className="font-medium text-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-400">{getTypeIcon(item.type)}</span>
                        <span className="truncate max-w-[280px]">{item.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: "#111827" }}>
                        {item.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(item.ragStatus)}
                            <span className="text-sm font-medium" style={{ color: statusColor(item.ragStatus) }}>
                              {getStatusText(item.ragStatus)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.ragStatus === 'completed'
                    ? t('knowledgeBase.tooltips.indexed')
                    : item.ragStatus === 'processing'
                        ? t('knowledgeBase.tooltips.generating')
                        : item.ragStatus === 'failed'
                            ? t('knowledgeBase.tooltips.failed')
                            : t('knowledgeBase.tooltips.waiting')}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-slate-600 hidden md:table-cell">
                      {item.chunkCount || 0}
                    </TableCell>
                    <TableCell className="text-slate-600 hidden sm:table-cell">
                      {formatBytes(item.storageSize)}
                    </TableCell>
                    <TableCell className="text-slate-600 hidden lg:table-cell">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDeletingItem(item)} data-testid={`button-delete-${item.id}`}>
                        <Trash2 className="h-4 w-4" style={{ color: "#EF4444" }}/>
                      </Button>
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>
          </div>
          <DataPagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={handlePageChange} onItemsPerPageChange={handleItemsPerPageChange}/>
        </>)}

      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('knowledgeBase.dialog.addUrl.title')}</DialogTitle>
            <DialogDescription>
              {t('knowledgeBase.dialog.addUrl.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">{t('knowledgeBase.labels.url')}</Label>
              <Input id="url" placeholder={t('knowledgeBase.placeholders.url')} value={urlInput} onChange={(e) => setUrlInput(e.target.value)} data-testid="input-url"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-name">{t('knowledgeBase.labels.nameOptional')}</Label>
              <Input id="url-name" placeholder={t('knowledgeBase.placeholders.urlName')} value={urlName} onChange={(e) => setUrlName(e.target.value)} data-testid="input-url-name"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddUrl} disabled={addUrlMutation.isPending} data-testid="button-submit-url">
              {addUrlMutation.isPending ? t('knowledgeBase.actions.adding') : t('knowledgeBase.actions.addUrl')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('knowledgeBase.dialog.uploadFile.title')}</DialogTitle>
            <DialogDescription>
              {t('knowledgeBase.dialog.uploadFile.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">{t('knowledgeBase.labels.file')}</Label>
              <div className="flex gap-2">
                <Input type="file" id="file" ref={fileInputRef} onChange={handleFileSelect} accept=".txt,.md,.html,.htm,.json,.xml,.csv" className="hidden"/>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1" data-testid="button-select-file">
                  <Upload className="h-4 w-4 mr-2"/>
                  {selectedFile ? selectedFile.name : t('knowledgeBase.actions.chooseFile')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-name">{t('knowledgeBase.labels.nameOptional')}</Label>
              <Input id="file-name" placeholder={t('knowledgeBase.placeholders.fileName')} value={fileName} onChange={(e) => setFileName(e.target.value)} data-testid="input-file-name"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
            setFileDialogOpen(false);
            setSelectedFile(null);
            setFileName('');
        }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUploadFile} disabled={!selectedFile || uploadFileMutation.isPending} data-testid="button-submit-file">
              {uploadFileMutation.isPending ? t('knowledgeBase.actions.uploading') : t('knowledgeBase.actions.uploadFile')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('knowledgeBase.dialog.createText.title')}</DialogTitle>
            <DialogDescription>
              {t('knowledgeBase.dialog.createText.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="text-name">{t('common.name')}</Label>
              <Input id="text-name" placeholder={t('knowledgeBase.placeholders.textName')} value={textName} onChange={(e) => setTextName(e.target.value)} data-testid="input-text-name"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-content">{t('knowledgeBase.labels.content')}</Label>
              <Textarea id="text-content" placeholder={t('knowledgeBase.placeholders.textContent')} value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={10} className="resize-none font-mono text-sm" data-testid="input-text-content"/>
              <p className="text-xs text-muted-foreground">
                {textInput.length.toLocaleString()} / 300,000 {t('knowledgeBase.labels.characters')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddText} disabled={addTextMutation.isPending} data-testid="button-submit-text">
              {addTextMutation.isPending ? t('knowledgeBase.actions.adding') : t('knowledgeBase.actions.addText')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledgeBase.dialog.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledgeBase.dialog.delete.description', { title: deletingItem?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
              {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isDemoMode && (<Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent className="sm:max-w-[850px] p-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <DialogHeader className="p-4 pb-2 text-left">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-violet-400 fill-violet-400"/>
                Knowledge Base Demonstration Video
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Watch a demonstration on uploading and managing knowledge base documents & RAG data.
              </DialogDescription>
            </DialogHeader>
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
              {isVideoOpen && (<iframe src="https://drive.google.com/file/d/1F6IA7TViri_AjdrGcH8TrAygcYWagtT0/preview" className="w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title="Knowledge Base Demo Video"/>)}
            </div>
            <div className="p-3 pt-2 text-right">
              <a href="https://drive.google.com/file/d/1F6IA7TViri_AjdrGcH8TrAygcYWagtT0/view?usp=drive_link" target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline inline-flex items-center gap-1 font-medium">
                Open in Google Drive &rarr;
              </a>
            </div>
          </DialogContent>
        </Dialog>)}
    </div>);
}
