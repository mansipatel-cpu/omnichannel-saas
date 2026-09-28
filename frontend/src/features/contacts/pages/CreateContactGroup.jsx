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
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { apiRequest, queryClient } from "@/shared/lib/queryClient";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppHeader } from "@/shared/components/AppPageHeader";
import { usePagination } from "@/shared/components/ui/data-pagination";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/shared/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/shared/components/ui/dialog";
import { Search, FolderKanban, Plus, Phone, MessageCircle, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight, } from "lucide-react";
const GROUP_CATEGORIES = [
    "Customer Segments",
    "Internal Teams",
    "Campaign Audiences",
    "VIP / Priority",
    "Support Escalations",
];
const AVATAR_COLORS = [
    "bg-[#1e293b] text-white",
    "bg-[#f97316] text-white",
    "bg-[#0d9488] text-white",
    "bg-[#7c3aed] text-white",
    "bg-[#2563eb] text-white",
    "bg-[#db2777] text-white",
];
function authFetch(url) {
    const headers = {};
    const authHeader = AuthStorage.getAuthHeader();
    if (authHeader)
        headers.Authorization = authHeader;
    return fetch(url, { credentials: "include", headers });
}
function normalizePhone(phone) {
    let cleaned = phone.replace(/[\s\-().]/g, "");
    if (cleaned.startsWith("00"))
        cleaned = `+${cleaned.slice(2)}`;
    if (!cleaned.startsWith("+") && cleaned.length >= 10)
        cleaned = `+${cleaned}`;
    return cleaned;
}
function formatPhone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
}
function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return "U";
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
function toHandle(name) {
    const parts = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
    if (parts.length >= 2)
        return `@${parts[0][0]}${parts[parts.length - 1]}`;
    return `@${parts[0] || "user"}`;
}
function avatarClass(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1)
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function voiceName(contact) {
    const first = contact.names?.[0];
    if (!first)
        return contact.phone || "Unknown";
    return [first.firstName, first.lastName].filter(Boolean).join(" ") || contact.phone || "Unknown";
}
function slugifyGroupId(name) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 24);
    return slug ? `grp_${slug}` : "grp_new";
}
export default function CreateContactGroup() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const { setSearch, setPageMeta } = useAppHeader();
    const [groupName, setGroupName] = useState("");
    const [category, setCategory] = useState(GROUP_CATEGORIES[0]);
    const [description, setDescription] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [channelFilter, setChannelFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState([]);
    const [successOpen, setSuccessOpen] = useState(false);
    const [createdSummary, setCreatedSummary] = useState({
        name: "",
        count: 0,
        channels: "WhatsApp",
    });
    useEffect(() => {
        setSearch("");
        setPageMeta({
            title: "Create New Contact Group",
            subtitle: "Configure group details and select contacts to include in this group.",
        });
        return () => setPageMeta(null);
    }, [setSearch, setPageMeta]);
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
    const { data: voiceContacts = [], isLoading: voiceLoading, refetch: refetchVoice } = useQuery({
        queryKey: ["/api/contacts/deduplicated"],
    });
    const { data: waContacts = [], isLoading: waLoading, refetch: refetchWa, } = useQuery({
        queryKey: ["/api/whatsapp/contacts-all"],
        queryFn: async () => {
            try {
                const response = await authFetch("/api/whatsapp/contacts-all");
                if (!response.ok)
                    return [];
                const result = await response.json();
                return Array.isArray(result) ? result : result?.data || [];
            }
            catch {
                return [];
            }
        },
    });
    const directory = useMemo(() => {
        const map = new Map();
        for (const contact of voiceContacts) {
            const phone = normalizePhone(contact.phone || "");
            if (!phone)
                continue;
            const name = voiceName(contact);
            map.set(phone, {
                id: `voice:${contact.id}`,
                voiceId: contact.id,
                name,
                handle: toHandle(name),
                email: contact.email,
                phone,
                whatsapp: false,
                voice: true,
                status: (contact.status || "active").toLowerCase(),
                groups: [],
            });
        }
        for (const contact of waContacts) {
            const phone = normalizePhone(contact.phone || "");
            if (!phone)
                continue;
            const existing = map.get(phone);
            const name = contact.name?.trim() || existing?.name || phone;
            const groups = Array.isArray(contact.groups) ? contact.groups : [];
            if (existing) {
                map.set(phone, {
                    ...existing,
                    id: `merged:${existing.voiceId || contact.id}`,
                    waId: contact.id,
                    name: existing.name !== "Unknown" ? existing.name : name,
                    handle: toHandle(existing.name !== "Unknown" ? existing.name : name),
                    email: existing.email || contact.email || null,
                    whatsapp: true,
                    status: existing.status || (contact.status || "active").toLowerCase(),
                    groups: groups.length > 0 ? groups : existing.groups,
                });
            }
            else {
                map.set(phone, {
                    id: `wa:${contact.id}`,
                    waId: contact.id,
                    name,
                    handle: toHandle(name),
                    email: contact.email || null,
                    phone,
                    whatsapp: true,
                    voice: false,
                    status: (contact.status || "active").toLowerCase(),
                    groups,
                });
            }
        }
        return Array.from(map.values());
    }, [voiceContacts, waContacts]);
    const filteredContacts = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const queryDigits = query.replace(/\D/g, "");
        return directory.filter((contact) => {
            const phoneDigits = contact.phone.replace(/\D/g, "");
            const matchesSearch = !query ||
                contact.name.toLowerCase().includes(query) ||
                contact.handle.toLowerCase().includes(query) ||
                (contact.email || "").toLowerCase().includes(query) ||
                contact.phone.toLowerCase().includes(query) ||
                (queryDigits.length >= 7 && phoneDigits.includes(queryDigits));
            const matchesChannel = channelFilter === "all" ||
                (channelFilter === "whatsapp" && contact.whatsapp) ||
                (channelFilter === "voice" && contact.voice);
            const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
            return matchesSearch && matchesChannel && matchesStatus && !!contact.waId;
        });
    }, [directory, searchQuery, channelFilter, statusFilter]);
    const { currentPage, totalPages, totalItems, itemsPerPage, paginatedItems, handlePageChange, handleItemsPerPageChange, } = usePagination(filteredContacts, 10);
    useEffect(() => {
        handlePageChange(1);
    }, [searchQuery, channelFilter, statusFilter]);
    const pageIds = paginatedItems.map((contact) => contact.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    const somePageSelected = pageIds.some((id) => selectedIds.includes(id));
    const selectedContacts = useMemo(() => directory.filter((contact) => selectedIds.includes(contact.id) && contact.waId), [directory, selectedIds]);
    const selectedCount = selectedContacts.length;
    const previewId = slugifyGroupId(groupName || "new");
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    const visiblePages = useMemo(() => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i += 1)
                pages.push(i);
            return pages;
        }
        pages.push(1);
        if (currentPage > 3)
            pages.push("ellipsis");
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i += 1)
            pages.push(i);
        if (currentPage < totalPages - 2)
            pages.push("ellipsis");
        pages.push(totalPages);
        return pages;
    }, [currentPage, totalPages]);
    const toggleAllPage = (checked) => {
        setSelectedIds((current) => {
            if (checked)
                return Array.from(new Set([...current, ...pageIds]));
            return current.filter((id) => !pageIds.includes(id));
        });
    };
    const toggleOne = (id, checked) => {
        setSelectedIds((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
    };
    const createMutation = useMutation({
        mutationFn: async () => {
            const name = groupName.trim();
            if (!name)
                throw new Error("Group name is required");
            if (!activeChannel?.id)
                throw new Error("Create a WhatsApp channel before creating groups.");
            if (selectedContacts.length === 0)
                throw new Error("Select at least one WhatsApp contact.");
            const createRes = await apiRequest("POST", "/api/whatsapp/groups", {
                name,
                description: description.trim(),
                channelId: activeChannel.id,
            });
            const createData = await createRes.json();
            if (!createRes.ok || createData?.success === false) {
                throw new Error(createData?.error || "Failed to create group");
            }
            const contactIds = selectedContacts.map((contact) => contact.waId).filter(Boolean);
            const addRes = await apiRequest("POST", "/api/whatsapp/groups/add-contacts", {
                contactIds,
                groupName: name,
                channelId: activeChannel.id,
            });
            const addData = await addRes.json().catch(() => ({}));
            if (!addRes.ok) {
                throw new Error(addData?.error || "Group created, but failed to add contacts");
            }
            const hasVoice = selectedContacts.some((contact) => contact.voice);
            const hasWhatsApp = selectedContacts.some((contact) => contact.whatsapp);
            const channels = hasWhatsApp && hasVoice
                ? "WhatsApp & Voice Calling"
                : hasVoice
                    ? "Voice Calling"
                    : "WhatsApp";
            return {
                name,
                count: contactIds.length,
                channels,
                category,
            };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/groups"] });
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/groups/contact-counts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts-all"] });
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
            setCreatedSummary({
                name: result.name,
                count: result.count,
                channels: result.channels,
            });
            setSuccessOpen(true);
        },
        onError: (error) => {
            toast({
                title: "Failed to create group",
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const goToGroups = () => {
        setSuccessOpen(false);
        setLocation("/contacts?view=groups");
    };
    const isLoading = voiceLoading || waLoading;
    return (<div className="space-y-5 pb-6">
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <Link href="/dashboard" className="hover:text-slate-600">Home</Link>
        <span>&gt;</span>
        <Link href="/contacts" className="hover:text-slate-600">Contacts</Link>
        <span>&gt;</span>
        <span className="text-slate-600">Create Group</span>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 md:p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-[#EAF3FF] text-[#2F80FF] flex items-center justify-center shrink-0">
            <FolderKanban className="h-5 w-5"/>
          </div>
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Target Group Profile</h2>
            <p className="text-sm text-slate-500">
              Step 1 of 2: Group Metadata &amp; Channel Allocation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="group-name" className="text-sm font-semibold text-slate-800">
                Group Name <span className="text-red-500">*</span>
              </Label>
              <span className="text-[11px] text-slate-400 font-mono">ID: {previewId}</span>
            </div>
            <Input id="group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="VIP Customer Care Escalations" className="h-11 rounded-lg border-slate-200"/>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-800">Group Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 rounded-lg border-slate-200">
                <SelectValue placeholder="Select category"/>
              </SelectTrigger>
              <SelectContent>
                {GROUP_CATEGORIES.map((item) => (<SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5 mt-4">
          <Label htmlFor="group-description" className="text-sm font-semibold text-slate-800">
            Description &amp; Operational Notes
          </Label>
          <Textarea id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="High-priority tier 1 customer accounts for WhatsApp and voice outreach..." rows={3} className="min-h-[96px] resize-none rounded-lg border-slate-200"/>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 space-y-3">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contacts by name, email, or phone..." className="h-10 pl-9 bg-white border-slate-200"/>
            </div>
            <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value)}>
              <SelectTrigger className="h-10 w-full xl:w-[240px] bg-white border-slate-200">
                <SelectValue placeholder="Channel"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Channel: All (WhatsApp &amp; Voice)</SelectItem>
                <SelectItem value="whatsapp">Channel: WhatsApp</SelectItem>
                <SelectItem value="voice">Channel: Voice</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
              <SelectTrigger className="h-10 w-full xl:w-[160px] bg-white border-slate-200">
                <SelectValue placeholder="Status"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="active">Status: Active</SelectItem>
                <SelectItem value="pending">Status: Pending</SelectItem>
                <SelectItem value="inactive">Status: Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200 shrink-0" onClick={() => {
            void refetchVoice();
            void refetchWa();
        }} title="Refresh contacts">
              <RefreshCw className="h-4 w-4"/>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="w-12 pl-5">
                  <Checkbox checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false} onCheckedChange={(checked) => toggleAllPage(checked === true)} aria-label="Select all contacts on this page"/>
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">
                  CONTACT DETAILS
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">
                  EMAIL ADDRESS
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">
                  PHONE NUMBER
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">
                  ENABLED CHANNELS
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400 pr-5">
                  CURRENT GROUPS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (<TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-16">
                    Loading contacts...
                  </TableCell>
                </TableRow>) : paginatedItems.length === 0 ? (<TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-16">
                    {searchQuery || channelFilter !== "all" || statusFilter !== "all"
                ? "No contacts match your filters."
                : "No WhatsApp contacts available to add."}
                  </TableCell>
                </TableRow>) : (paginatedItems.map((contact) => (<TableRow key={contact.id} className="border-slate-100">
                    <TableCell className="pl-5">
                      <Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={(checked) => toggleOne(contact.id, checked === true)} aria-label={`Select ${contact.name}`}/>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${avatarClass(contact.name)}`}>
                          {initials(contact.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{contact.name}</p>
                          <p className="text-xs text-slate-400">{contact.handle}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {contact.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                      {formatPhone(contact.phone)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.whatsapp && (<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[11px] font-medium">
                            <MessageCircle className="h-3 w-3"/>
                            WhatsApp
                          </span>)}
                        {contact.voice && (<span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 px-2.5 py-1 text-[11px] font-medium">
                            <Phone className="h-3 w-3"/>
                            Voice
                          </span>)}
                      </div>
                    </TableCell>
                    <TableCell className="pr-5">
                      {contact.groups.length > 0 ? (<div className="flex flex-wrap gap-1.5">
                          {contact.groups.map((group) => (<span key={group} className="inline-flex rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-[11px] font-medium">
                              {group}
                            </span>))}
                        </div>) : (<span className="text-sm text-slate-400">—</span>)}
                    </TableCell>
                  </TableRow>)))}
            </TableBody>
          </Table>
        </div>

        {totalItems > 0 && (<div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <p>
                Showing <span className="font-semibold text-slate-700">{startItem}</span> to{" "}
                <span className="font-semibold text-slate-700">{endItem}</span> of{" "}
                <span className="font-semibold text-slate-700">{totalItems.toLocaleString()}</span> contacts
              </p>
              <div className="flex items-center gap-2">
                <span>Show</span>
                <Select value={String(itemsPerPage)} onValueChange={(value) => handleItemsPerPageChange(Number(value))}>
                  <SelectTrigger className="h-8 w-[120px] bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 16, 24, 48].map((option) => (<SelectItem key={option} value={String(option)}>
                        {option} per page
                      </SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8" disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1"/>
                Previous
              </Button>
              {visiblePages.map((page, index) => page === "ellipsis" ? (<span key={`e-${index}`} className="px-2 text-slate-400">
                    …
                  </span>) : (<Button key={page} variant={page === currentPage ? "default" : "outline"} size="sm" className={`h-8 w-8 ${page === currentPage ? "bg-[#2F80FF] hover:bg-[#256fe0] text-white border-transparent" : ""}`} onClick={() => handlePageChange(page)}>
                    {page}
                  </Button>))}
              <Button variant="outline" size="sm" className="h-8" disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>
                Next
                <ChevronRight className="h-4 w-4 ml-1"/>
              </Button>
            </div>
          </div>)}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button variant="outline" className="h-10 bg-white border-slate-200" onClick={() => setLocation("/contacts?view=groups")}>
          Cancel
        </Button>
        <Button className="h-10 bg-[#2F80FF] hover:bg-[#256fe0] text-white border-transparent" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-1.5"/>
          {createMutation.isPending
            ? "Creating..."
            : `Save & Create Group (${selectedCount})`}
        </Button>
      </div>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-[440px] gap-0 p-0 overflow-hidden rounded-2xl border border-slate-200">
          <DialogHeader className="px-6 pt-8 pb-2 items-center text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8"/>
            </div>
            <DialogTitle className="text-[20px] font-semibold text-slate-900">
              Group Created Successfully!
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Your new contact group has been created and synced across WhatsApp &amp; Voice channels.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Group Name</span>
                <span className="font-semibold text-slate-900 text-right">{createdSummary.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Total Contacts</span>
                <span className="font-semibold text-slate-900">
                  {createdSummary.count} contact{createdSummary.count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Assigned Channels</span>
                <span className="font-semibold text-slate-900 text-right">{createdSummary.channels}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Status</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"/>
                  Active
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-1 sm:justify-stretch gap-2">
            <Button variant="outline" className="h-10 flex-1 border-slate-200" onClick={() => {
            setSuccessOpen(false);
            setLocation("/contacts");
        }}>
              Close
            </Button>
            <Button className="h-10 flex-1 bg-[#2F80FF] hover:bg-[#256fe0] text-white border-transparent" onClick={goToGroups}>
              Go to Groups
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
