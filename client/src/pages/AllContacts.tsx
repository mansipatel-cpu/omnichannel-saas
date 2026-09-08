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
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import ExcelJS from "exceljs";
import { AuthStorage } from "@/lib/auth-storage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
import { usePagination } from "@/components/ui/data-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Users,
  UserCheck,
  Phone,
  MessageCircle,
  Download,
  Upload,
  Plus,
  Pencil,
  MoreVertical,
  Copy,
  Trash2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ListFilter,
  ChevronDown,
  Check,
  UserRound,
} from "lucide-react";

interface VoiceContact {
  id: string;
  phone: string;
  email: string | null;
  names: Array<{ firstName: string; lastName: string | null }>;
  campaigns: Array<{ id: string; name: string }>;
  status: string;
  source: "campaign" | "call";
  callCount: number;
  createdAt?: string | Date | null;
}

interface WaContact {
  id: string;
  name?: string;
  phone?: string;
  email?: string | null;
  status?: string;
  createdAt?: string | Date | null;
}

interface WaChannel {
  id: string;
}

type DirectoryStatus = "active" | "pending" | "inactive";
type ChannelFilter = "all" | "groups" | "contacts";

interface WaGroup {
  id: string;
  name: string;
}

interface DirectoryContact {
  id: string;
  voiceId?: string;
  waId?: string;
  voiceSource?: "campaign" | "call";
  name: string;
  handle: string;
  email: string | null;
  phone: string;
  whatsapp: boolean;
  voice: boolean;
  status: DirectoryStatus;
  createdAt: Date | null;
}

const AVATAR_COLORS = [
  "bg-[#1e293b] text-white",
  "bg-[#f97316] text-white",
  "bg-[#0d9488] text-white",
  "bg-[#7c3aed] text-white",
  "bg-[#2563eb] text-white",
  "bg-[#db2777] text-white",
  "bg-[#ea580c] text-white",
  "bg-[#0891b2] text-white",
];

function authFetch(url: string) {
  const headers: Record<string, string> = {};
  const authHeader = AuthStorage.getAuthHeader();
  if (authHeader) headers.Authorization = authHeader;
  return fetch(url, { credentials: "include", headers });
}

function normalizePhone(phone: string) {
  let cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;
  if (!cleaned.startsWith("+") && cleaned.length >= 10) cleaned = `+${cleaned}`;
  return cleaned;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function toHandle(name: string) {
  const parts = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `@${parts[0][0]}${parts[parts.length - 1]}`;
  return `@${parts[0] || "user"}`;
}

function avatarClass(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapStatus(raw?: string): DirectoryStatus {
  const status = (raw || "").toLowerCase();
  if (status === "pending") return "pending";
  if (["completed", "incoming_call", "outgoing_call", "active", "new", "qualified"].includes(status)) {
    return "active";
  }
  return "inactive";
}

function mergeStatus(voice?: string, wa?: string): DirectoryStatus {
  const statuses = [voice, wa].filter(Boolean).map(mapStatus);
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("active")) return "active";
  return "inactive";
}

function voiceName(contact: VoiceContact) {
  const name = contact.names?.[0];
  const full = `${name?.firstName || ""} ${name?.lastName || ""}`.trim();
  return full || contact.email || contact.phone || "Unknown";
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/[\s\-().+]/g, "");
  return /^\d{7,15}$/.test(digits);
}

function downloadBlob(content: Blob, fileName: string) {
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type ImportContactRow = {
  name: string;
  phone: string;
  email: string;
  groups: string[];
  tags: string[];
};

function cellToString(value: ExcelJS.CellValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellToString(value.result as ExcelJS.CellValue);
  }
  return "";
}

function mapImportRow(row: Record<string, string>): ImportContactRow {
  return {
    name: row.name || row["full name"] || "",
    phone: row.phone || row["phone number"] || "",
    email: row.email || row["email address"] || "",
    groups: [] as string[],
    tags: [] as string[],
  };
}

function parseCsv(text: string): ImportContactRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return mapImportRow(row);
  }).filter((row) => row.name || row.phone);
}

async function parseExcel(file: File): Promise<ImportContactRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values)
    ? headerRow.values.slice(1).map((header) => cellToString(header).toLowerCase())
    : [];

  const rows: ImportContactRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowData: Record<string, string> = {};
    if (Array.isArray(row.values)) {
      row.values.slice(1).forEach((cell, index) => {
        const key = headerValues[index];
        if (key) rowData[key] = cellToString(cell);
      });
    }
    const mapped = mapImportRow(rowData);
    if (mapped.name || mapped.phone) rows.push(mapped);
  });
  return rows;
}

function isExcelFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx")
    || file.type.includes("spreadsheetml");
}

function isRealVoiceId(id?: string) {
  return Boolean(id && !id.startsWith("call-") && !id.startsWith("twilio-") && !id.startsWith("plivo-") && !id.startsWith("sip-"));
}

function statusClass(status: DirectoryStatus) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "pending") return "bg-amber-50 text-amber-600";
  return "bg-slate-100 text-slate-500";
}

function statusLabel(status: DirectoryStatus) {
  if (status === "active") return "Active";
  if (status === "pending") return "Pending";
  return "Inactive";
}

export default function AllContacts() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { search: searchQuery, setSearch: setSearchQuery } = useAppHeader();
  const [statusFilter, setStatusFilter] = useState<"all" | DirectoryStatus>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("contacts");
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [monthDate, setMonthDate] = useState<Date | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DirectoryContact | null>(null);
  const [deleting, setDeleting] = useState<DirectoryContact | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const { data: voiceContacts = [], isLoading: voiceLoading } = useQuery<VoiceContact[]>({
    queryKey: ["/api/contacts/deduplicated"],
  });

  const { data: waContacts = [], isLoading: waLoading } = useQuery<WaContact[]>({
    queryKey: ["/api/whatsapp/contacts-all"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/whatsapp/contacts-all");
        if (!response.ok) return [];
        const result = await response.json();
        return Array.isArray(result) ? result : result?.data || [];
      } catch {
        return [];
      }
    },
  });

  const { data: activeChannel } = useQuery<WaChannel | null>({
    queryKey: ["/api/whatsapp/channels/active"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/whatsapp/channels/active");
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
  });

  const { data: waGroups = [] } = useQuery<WaGroup[]>({
    queryKey: ["/api/whatsapp/groups", activeChannel?.id],
    enabled: Boolean(activeChannel?.id),
    queryFn: async () => {
      try {
        const response = await authFetch(`/api/whatsapp/groups?channelId=${activeChannel?.id}`);
        if (!response.ok) return [];
        const result = await response.json();
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.groups)) return result.groups;
        return [];
      } catch {
        return [];
      }
    },
  });

  const directory = useMemo(() => {
    const map = new Map<string, DirectoryContact>();

    for (const contact of voiceContacts) {
      const phone = normalizePhone(contact.phone || "");
      if (!phone) continue;
      const name = voiceName(contact);
      map.set(phone, {
        id: `voice:${contact.id}`,
        voiceId: contact.id,
        voiceSource: contact.source,
        name,
        handle: toHandle(name),
        email: contact.email,
        phone,
        whatsapp: false,
        voice: true,
        status: mapStatus(contact.status),
        createdAt: parseDate(contact.createdAt),
      });
    }

    for (const contact of waContacts) {
      const phone = normalizePhone(contact.phone || "");
      if (!phone) continue;
      const existing = map.get(phone);
      const name = contact.name?.trim() || existing?.name || phone;
      const createdAt = parseDate(contact.createdAt);
      if (existing) {
        map.set(phone, {
          ...existing,
          id: `merged:${existing.voiceId || contact.id}`,
          waId: contact.id,
          name: existing.name !== "Unknown" ? existing.name : name,
          handle: toHandle(existing.name !== "Unknown" ? existing.name : name),
          email: existing.email || contact.email || null,
          whatsapp: true,
          status: mergeStatus(existing.status, contact.status),
          createdAt: existing.createdAt && createdAt
            ? existing.createdAt > createdAt ? existing.createdAt : createdAt
            : existing.createdAt || createdAt,
        });
      } else {
        map.set(phone, {
          id: `wa:${contact.id}`,
          waId: contact.id,
          name,
          handle: toHandle(name),
          email: contact.email || null,
          phone,
          whatsapp: true,
          voice: false,
          status: mapStatus(contact.status),
          createdAt,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }, [voiceContacts, waContacts]);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return directory.filter((contact) => {
      const matchesSearch =
        !query ||
        contact.name.toLowerCase().includes(query) ||
        contact.handle.toLowerCase().includes(query) ||
        contact.phone.toLowerCase().includes(query) ||
        (contact.email || "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
      const matchesChannel = channelFilter !== "groups";
      const matchesMonth =
        !monthDate ||
        (contact.createdAt &&
          contact.createdAt.getMonth() === monthDate.getMonth() &&
          contact.createdAt.getFullYear() === monthDate.getFullYear());
      return matchesSearch && matchesStatus && matchesChannel && matchesMonth;
    });
  }, [directory, searchQuery, statusFilter, channelFilter, monthDate]);

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(filteredContacts, 8);

  useEffect(() => {
    handlePageChange(1);
  }, [searchQuery, statusFilter, channelFilter, monthDate]);

  const now = new Date();
  const addedThisMonth = directory.filter((contact) => (
    contact.createdAt &&
    contact.createdAt.getMonth() === now.getMonth() &&
    contact.createdAt.getFullYear() === now.getFullYear()
  )).length;
  const activeCount = directory.filter((contact) => contact.status === "active").length;
  const whatsappCount = directory.filter((contact) => contact.whatsapp).length;
  const voiceCount = directory.filter((contact) => contact.voice).length;
  const total = directory.length;
  const monthTrend = total > 0 ? ((addedThisMonth / total) * 100).toFixed(1) : "0.0";
  const reachableRate = total > 0 ? ((activeCount / total) * 100).toFixed(1) : "0.0";
  const whatsappCoverage = total > 0 ? ((whatsappCount / total) * 100).toFixed(1) : "0.0";

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const pageIds = paginatedItems.map((contact) => contact.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const isLoading = voiceLoading || waLoading;

  const openCreate = () => {
    setLocation("/contacts/new");
  };

  const openEdit = (contact: DirectoryContact) => {
    setEditing(contact);
    setForm({ name: contact.name, email: contact.email || "", phone: contact.phone });
    setFormOpen(true);
  };

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: `Could not copy ${label.toLowerCase()}`, variant: "destructive" });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const email = form.email.trim();
      const phone = form.phone.trim();
      if (!name || !phone) throw new Error("Name and phone are required");
      if (!activeChannel?.id) throw new Error("Create a WhatsApp channel before adding contacts.");

      if (editing?.waId) {
        const response = await apiRequest("PUT", `/api/whatsapp/contacts/${editing.waId}`, { name, email, phone });
        return response.json();
      }

      const response = await apiRequest("POST", "/api/whatsapp/contacts", {
        name,
        email,
        phone,
        channelId: activeChannel.id,
        source: "manual",
        groups: [],
        tags: [],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      setFormOpen(false);
      setEditing(null);
      toast({ title: editing ? "Contact updated" : "Contact added" });
    },
    onError: (error: any) => {
      toast({
        title: editing ? "Failed to update contact" : "Failed to add contact",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contact: DirectoryContact) => {
      const tasks: Promise<Response>[] = [];
      if (contact.waId) {
        tasks.push(apiRequest("DELETE", `/api/whatsapp/contacts/${contact.waId}`));
      }
      if (contact.voiceId && contact.voiceSource === "campaign" && isRealVoiceId(contact.voiceId)) {
        tasks.push(apiRequest("DELETE", `/api/contacts/${contact.voiceId}`));
      }
      if (tasks.length === 0) throw new Error("This contact cannot be deleted from the directory.");
      await Promise.all(tasks);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      setDeleting(null);
      toast({ title: "Contact deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete contact",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const selectedContacts = useMemo(
    () => directory.filter((contact) => selectedIds.includes(contact.id)),
    [directory, selectedIds],
  );

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      if (selectedContacts.length === 0) throw new Error("No contacts selected");
      const results = await Promise.allSettled(
        selectedContacts.map(async (contact) => {
          const tasks: Promise<Response>[] = [];
          if (contact.waId) {
            tasks.push(apiRequest("DELETE", `/api/whatsapp/contacts/${contact.waId}`));
          }
          if (contact.voiceId && contact.voiceSource === "campaign" && isRealVoiceId(contact.voiceId)) {
            tasks.push(apiRequest("DELETE", `/api/contacts/${contact.voiceId}`));
          }
          if (tasks.length === 0) {
            throw new Error(`${contact.name} cannot be deleted from the directory.`);
          }
          await Promise.all(tasks);
        }),
      );
      const failed = results.filter((result) => result.status === "rejected").length;
      const deleted = results.length - failed;
      if (deleted === 0) throw new Error("No selected contacts could be deleted.");
      return { deleted, failed };
    },
    onSuccess: ({ deleted, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      setSelectedIds([]);
      setBulkDeleting(false);
      toast({
        title: failed > 0 ? "Partial delete completed" : "Contacts deleted",
        description: failed > 0 ? `${deleted} deleted, ${failed} failed` : `${deleted} contacts deleted`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete contacts",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const channelTriggerLabel = channelFilter === "groups" ? "Channel: Groups" : "Channel: All";

  const exportToCSV = () => {
    const rows = selectedIds.length > 0
      ? directory.filter((contact) => selectedIds.includes(contact.id))
      : filteredContacts;

    if (rows.length === 0) {
      toast({
        title: "No contacts to export",
        description: "Add some contacts before exporting",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Name", "Email", "Phone", "Channels", "Status", "Date Added"];
    const csvRows = rows.map((contact) => [
      contact.name,
      contact.email || "",
      contact.phone,
      [contact.whatsapp ? "WhatsApp" : "", contact.voice ? "Voice" : ""].filter(Boolean).join("; "),
      statusLabel(contact.status),
      contact.createdAt ? format(contact.createdAt, "MMM d, yyyy") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contacts_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${rows.length} contacts to CSV` });
  };

  const downloadSampleExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Contacts");
      worksheet.columns = [
        { header: "name", key: "name", width: 24 },
        { header: "phone", key: "phone", width: 18 },
        { header: "email", key: "email", width: 28 },
      ];
      worksheet.addRows([
        { name: "Alice Smith", phone: "1234567890", email: "alice@example.com" },
        { name: "Bob Johnson", phone: "9876543210", email: "bob@example.com" },
        { name: "Charlie Brown", phone: "5555555555", email: "charlie@example.com" },
      ]);
      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "sample_contacts.xlsx",
      );
      toast({ title: "Sample Excel file downloaded" });
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Could not create sample Excel file",
        variant: "destructive",
      });
    }
  };

  const importContacts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!activeChannel?.id) {
      toast({ title: "Create a WhatsApp channel before importing contacts.", variant: "destructive" });
      return;
    }

    try {
      setImporting(true);
      const parsed = isExcelFile(file) ? await parseExcel(file) : parseCsv(await file.text());
      const contacts = parsed.filter((contact) => contact.name && isValidPhone(contact.phone));
      if (contacts.length === 0) {
        throw new Error("No valid contacts found. Use columns name, phone, and email.");
      }

      const response = await apiRequest("POST", `/api/whatsapp/contacts/import?channelId=${activeChannel.id}`, { contacts });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || errorData?.message || "Import failed");
      }
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      toast({
        title: "Import completed",
        description: `${data.imported ?? contacts.length} contacts imported`,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const toggleAllPage = (checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, ...pageIds]));
      return current.filter((id) => !pageIds.includes(id));
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
  };

  const visiblePages = useMemo(() => {
    const pages: Array<number | "ellipsis"> = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <Link href="/dashboard" className="hover:text-slate-600">Home</Link>
        <span>&gt;</span>
        <span className="text-slate-600">Contacts</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Contacts</p>
              <p className="text-[28px] font-bold text-slate-900 mt-1" data-testid="text-total-contacts">{total.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-2">+{monthTrend}% this month</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#007BFF] flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Active contact</p>
              <p className="text-[28px] font-bold text-slate-900 mt-1">{activeCount.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-2">{reachableRate}% reachable rate</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">WhatsApp Enabled</p>
              <p className="text-[28px] font-bold text-slate-900 mt-1">{whatsappCount.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-2">{whatsappCoverage}% coverage</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Voice Calling Enabled</p>
              <p className="text-[28px] font-bold text-slate-900 mt-1">{voiceCount.toLocaleString()}</p>
              <p className="text-xs text-violet-500 mt-2">Automated IVR ready</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Phone className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative w-full lg:max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter users..."
                className="h-10 pl-9 bg-white border-slate-200"
                data-testid="input-search-contacts"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="h-10 w-full lg:w-[170px] bg-white border-slate-200">
                <SelectValue placeholder="Status: All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All Users</SelectItem>
                <SelectItem value="active">Status: Active</SelectItem>
                <SelectItem value="pending">Status: Pending</SelectItem>
                <SelectItem value="inactive">Status: Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={channelMenuOpen} onOpenChange={setChannelMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`h-10 w-full lg:w-[180px] justify-between bg-white font-normal ${
                    channelMenuOpen ? "border-[#007BFF] text-[#007BFF]" : "border-slate-200 text-slate-700"
                  }`}
                  data-testid="button-channel-filter"
                >
                  <span className="inline-flex items-center gap-2">
                    <ListFilter className="h-4 w-4" />
                    {channelTriggerLabel}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${channelMenuOpen ? "rotate-180" : ""}`} />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[360px] p-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]"
              >
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                    Filter by channel type
                  </p>
                  <button
                    type="button"
                    className="text-sm font-medium text-[#2F80FF] hover:underline"
                    onClick={() => {
                      setChannelFilter("all");
                      setChannelMenuOpen(false);
                    }}
                  >
                    Reset
                  </button>
                </div>

                <div className="p-2.5 space-y-1">
                  <button
                    type="button"
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      channelFilter === "groups" ? "bg-[#F3F8FF]" : "hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setChannelFilter("groups");
                      setChannelMenuOpen(false);
                    }}
                  >
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      channelFilter === "groups" ? "bg-[#2F80FF] text-white" : "bg-[#EAF3FF] text-[#5BA0FF]"
                    }`}>
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] font-semibold leading-5 ${
                        channelFilter === "groups" ? "text-[#2F80FF]" : "text-slate-900"
                      }`}>
                        Groups
                      </p>
                      <p className="text-[12px] leading-4 text-slate-400 mt-1">
                        Segmented audience &amp; internal groups
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EAF3FF] text-[#2F80FF] px-2.5 py-1 text-[12px] font-semibold tabular-nums shrink-0">
                      {waGroups.length.toLocaleString()}
                    </span>
                    {channelFilter === "groups" ? (
                      <Check className="h-4 w-4 text-[#2F80FF] shrink-0" strokeWidth={2.5} />
                    ) : (
                      <span className="w-4 shrink-0" aria-hidden />
                    )}
                  </button>

                  <button
                    type="button"
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      channelFilter === "contacts" ? "bg-[#F3F8FF]" : "hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setChannelFilter("contacts");
                      setChannelMenuOpen(false);
                    }}
                  >
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      channelFilter === "contacts" ? "bg-[#2F80FF] text-white" : "bg-[#EAF3FF] text-[#5BA0FF]"
                    }`}>
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] font-semibold leading-5 ${
                        channelFilter === "contacts" ? "text-[#1D4ED8]" : "text-slate-900"
                      }`}>
                        Contacts
                      </p>
                      <p className="text-[12px] leading-4 text-slate-400 mt-1">
                        Individual phone &amp; WhatsApp contacts
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-[12px] font-semibold tabular-nums shrink-0">
                      {total.toLocaleString()}
                    </span>
                    {channelFilter === "contacts" ? (
                      <Check className="h-4 w-4 text-[#2F80FF] shrink-0" strokeWidth={2.5} />
                    ) : (
                      <span className="w-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </div>

                <div className="border-t border-slate-100 px-4 py-3.5 text-center">
                  <Link href="/integrations" className="text-sm text-slate-500 hover:text-slate-700">
                    View All Channel Integrations
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 justify-start bg-white border-slate-200 font-normal">
                  <CalendarDays className="h-4 w-4 mr-2 text-slate-400" />
                  {monthDate ? format(monthDate, "MMMM yyyy") : format(now, "MMMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={monthDate}
                  onSelect={setMonthDate}
                  initialFocus
                />
                {monthDate && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setMonthDate(undefined)}>
                      Show all dates
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={exportToCSV}
              className="h-10 bg-white border-slate-200"
              data-testid="button-export-contacts"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="h-10 bg-white border-slate-200"
              data-testid="button-import-contacts"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "Importing..." : "Import CSV"}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={importContacts}
            />
            <Button
              variant="outline"
              onClick={() => void downloadSampleExcel()}
              className="h-10 bg-white border-slate-200"
              data-testid="button-sample-excel"
            >
              <Download className="h-4 w-4 mr-2" />
              Download sample excel
            </Button>
            <Button
              onClick={openCreate}
              className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
              data-testid="button-add-contact"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Contact
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {selectedIds.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/70">
            <p className="text-sm font-medium text-slate-700">
              {selectedIds.length} Contact{selectedIds.length === 1 ? "" : "s"} selected
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-9 bg-white border-slate-200"
                onClick={exportToCSV}
                data-testid="button-export-selected"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 bg-white border-slate-200"
                onClick={() => {
                  toast({
                    title: "Add to group",
                    description: waGroups.length > 0
                      ? "Group assignment will use your existing WhatsApp groups."
                      : "Create a WhatsApp group before assigning contacts.",
                  });
                }}
                data-testid="button-add-to-group"
              >
                Add to group
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 bg-white border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setBulkDeleting(true)}
                data-testid="button-delete-selected"
              >
                Delete selected
              </Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="w-12 pl-5">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={(checked) => toggleAllPage(checked === true)}
                    aria-label="Select all contacts on this page"
                  />
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">USER</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">EMAIL ADDRESS</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">PHONE NUMBER</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">CHANNELS</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">STATUS</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">DATE ADDED</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400 text-right pr-5">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-400 py-16">
                    Loading contacts...
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-400 py-16">
                    {channelFilter === "groups"
                      ? waGroups.length === 0
                        ? "No groups yet. Create a WhatsApp group to segment your audience."
                        : `${waGroups.length.toLocaleString()} groups available. Switch to Contacts to manage individual contacts.`
                      : searchQuery || statusFilter !== "all" || channelFilter !== "contacts" || monthDate
                        ? "No contacts match your filters."
                        : "No contacts yet. Add a contact to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((contact) => (
                  <TableRow key={contact.id} className="border-slate-100" data-testid={`row-contact-${contact.id}`}>
                    <TableCell className="pl-5">
                      <Checkbox
                        checked={selectedIds.includes(contact.id)}
                        onCheckedChange={(checked) => toggleOne(contact.id, checked === true)}
                        aria-label={`Select ${contact.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${avatarClass(contact.name)}`}>
                          {initials(contact.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{contact.name}</p>
                          <p className="text-xs text-slate-400">{contact.handle}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <div className="flex items-center gap-2">
                          <a href={`mailto:${contact.email}`} className="text-sm text-[#007BFF] hover:underline">
                            {contact.email}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyValue(contact.email || "", "Email")}
                            className="text-slate-400 hover:text-slate-600"
                            aria-label="Copy email"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                      {formatPhone(contact.phone)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.whatsapp && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[11px] font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            WhatsApp
                          </span>
                        )}
                        {contact.voice && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-600 px-2.5 py-1 text-[11px] font-medium">
                            <Phone className="h-3 w-3" />
                            Voice
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(contact.status)}`}>
                        {statusLabel(contact.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                      {contact.createdAt ? format(contact.createdAt, "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 bg-white border-slate-200 text-slate-700"
                          onClick={() => openEdit(contact)}
                          data-testid={`button-edit-contact-${contact.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {contact.email && (
                              <DropdownMenuItem onClick={() => copyValue(contact.email || "", "Email")}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy email
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => copyValue(contact.phone, "Phone")}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy phone
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleting(contact)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalItems > 0 && (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
            <p className="text-sm text-slate-400">
              Showing {startItem} to {endItem} of {totalItems.toLocaleString()} users.
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Show</span>
              <Select value={String(itemsPerPage)} onValueChange={(value) => handleItemsPerPageChange(Number(value))}>
                <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[8, 16, 24, 48].map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>per page</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-white border-slate-200"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              {visiblePages.map((page, index) =>
                page === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-slate-400">...</span>
                ) : (
                  <Button
                    key={page}
                    size="sm"
                    variant={currentPage === page ? "default" : "outline"}
                    className={currentPage === page
                      ? "h-8 w-8 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
                      : "h-8 w-8 bg-white border-slate-200"}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-white border-slate-200"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit contact" : "Add New Contact"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this contact’s name, email, or phone number."
                : "Add a contact to your directory. New contacts are saved to WhatsApp so they can be messaged immediately."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Full name</Label>
              <Input
                id="contact-name"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="James Thornton"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email address</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="james@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone number</Label>
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                placeholder="+1 (555) 201-4832"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : editing ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deleting?.name} ({deleting?.phone}) from the directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleting} onOpenChange={setBulkDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected contacts</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedIds.length} selected contact{selectedIds.length === 1 ? "" : "s"} from the directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate()}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
