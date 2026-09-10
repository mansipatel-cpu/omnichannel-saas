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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Download,
  Loader2,
  Phone,
  PhoneOff,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
import { queryClient } from "@/lib/queryClient";
import { AuthStorage } from "@/lib/auth-storage";

interface Contact {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  customFields?: Record<string, any>;
  status: string;
  createdAt: string;
}

interface Call {
  id: string;
  contactId: string | null;
  status: string;
  duration: number | null;
  startedAt: string | null;
  endedAt: string | null;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  goal?: string | null;
  script?: string | null;
  agentId?: string | null;
  phoneNumberId?: string | null;
  sipPhoneNumberId?: string | null;
  plivoPhoneNumberId?: string | null;
  totalContacts: number;
  completedCalls: number;
  successfulCalls: number;
  failedCalls: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  scheduleEnabled?: boolean;
  scheduleTimeStart?: string | null;
  scheduleTimeEnd?: string | null;
  scheduleDays?: string[] | null;
  scheduleTimezone?: string | null;
}

interface Agent {
  id: string;
  name: string;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string | null;
}

function statusBadgeClass(status: string) {
  const key = status.toLowerCase();
  if (key === "completed") return "bg-emerald-50 text-emerald-600";
  if (key === "in_progress" || key === "in-progress" || key === "running") return "bg-blue-50 text-blue-600";
  if (key === "scheduled") return "bg-violet-50 text-violet-600";
  if (key === "paused") return "bg-red-50 text-red-500";
  if (key === "failed") return "bg-red-50 text-red-500";
  return "bg-orange-50 text-orange-600";
}

function formatStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pending",
    draft: "Draft",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    "in-progress": "In Progress",
    running: "In Progress",
    paused: "Paused",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return map[status.toLowerCase()] || status;
}

function formatScheduleWindow(campaign: Campaign) {
  if (!campaign.scheduleEnabled || !campaign.scheduleTimeStart || !campaign.scheduleTimeEnd) {
    return "Anytime";
  }

  const formatTime = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    if (Number.isNaN(h)) return value;
    const date = new Date();
    date.setHours(h, m || 0, 0, 0);
    return format(date, "hh:mm a");
  };

  const dayLabels = (campaign.scheduleDays || [])
    .map((d) => d.slice(0, 3))
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());

  const days =
    dayLabels.length === 5 &&
    ["Mon", "Tue", "Wed", "Thu", "Fri"].every((d) =>
      dayLabels.some((x) => x.toLowerCase().startsWith(d.toLowerCase().slice(0, 3)))
    )
      ? "Mon-Fri"
      : dayLabels.length
        ? dayLabels.join(", ")
        : "All days";

  const tz = campaign.scheduleTimezone || "UTC";
  const tzShort =
    tz === "Asia/Kolkata" || tz === "Asia/Calcutta"
      ? "IST"
      : tz === "America/New_York"
        ? "ET"
        : tz.split("/").pop()?.replace(/_/g, " ") || tz;

  return `${formatTime(campaign.scheduleTimeStart)} - ${formatTime(campaign.scheduleTimeEnd)} (${days}, ${tzShort})`;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setPageMeta } = useAppHeader();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contactsOpen, setContactsOpen] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    setPageMeta({
      title: "Campaign Details",
      subtitle: "Review campaign performance, configuration, and call recipients.",
    });
    return () => setPageMeta(null);
  }, [setPageMeta]);

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: [`/api/campaigns/${id}`],
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as Campaign | undefined;
      const status = data?.status?.toLowerCase();
      return status === "running" || status === "in-progress" || status === "in_progress" ? 3000 : false;
    },
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: [`/api/campaigns/${id}/contacts`],
    enabled: !!id,
  });

  const { data: calls = [] } = useQuery<Call[]>({
    queryKey: [`/api/campaigns/${id}/calls`],
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: sipPhoneNumbersResponse } = useQuery<{ success?: boolean; data?: PhoneNumber[] } | PhoneNumber[]>({
    queryKey: ["/api/sip/phone-numbers"],
  });

  const { data: plivoPhoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/plivo/phone-numbers"],
  });

  const sipPhoneNumbers = Array.isArray(sipPhoneNumbersResponse)
    ? sipPhoneNumbersResponse
    : sipPhoneNumbersResponse?.data || [];

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const authHeader = AuthStorage.getAuthHeader();
      const res = await fetch(`/api/campaigns/${id}/contacts/upload`, {
        method: "POST",
        credentials: "include",
        headers: authHeader ? { Authorization: authHeader } : {},
        body: uploadData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload contacts");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${id}/contacts`] });
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({
        title: "Contacts uploaded",
        description: "Contacts were added to this campaign successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleExportCSV = async () => {
    try {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers.Authorization = authHeader;

      const response = await fetch(`/api/campaigns/${id}/export`, { headers });
      if (!response.ok) throw new Error("Failed to export campaign");

      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `campaign-export-${new Date().toISOString().split("T")[0]}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) filename = filenameMatch[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export ready",
        description: "Campaign CSV downloaded successfully.",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not export campaign data.",
        variant: "destructive",
      });
    }
  };

  const agentName = useMemo(() => {
    if (!campaign?.agentId) return "—";
    return agents.find((a) => a.id === campaign.agentId)?.name || "—";
  }, [agents, campaign?.agentId]);

  const outboundNumber = useMemo(() => {
    if (!campaign) return "—";
    const allPhones = [...phoneNumbers, ...sipPhoneNumbers, ...plivoPhoneNumbers];
    const match =
      allPhones.find((p) => p.id === campaign.phoneNumberId) ||
      allPhones.find((p) => p.id === campaign.sipPhoneNumberId) ||
      allPhones.find((p) => p.id === campaign.plivoPhoneNumberId);
    if (!match) return "Not assigned";
    return match.friendlyName
      ? `${match.phoneNumber} (${match.friendlyName})`
      : `${match.phoneNumber} (Primary Outbound)`;
  }, [campaign, phoneNumbers, sipPhoneNumbers, plivoPhoneNumbers]);

  const getLatestCallForContact = (contactId: string) => {
    const contactCalls = calls.filter((c) => c.contactId === contactId);
    if (contactCalls.length === 0) return undefined;
    return contactCalls.reduce((latest, c) => {
      const latestStarted = latest.startedAt ? new Date(latest.startedAt).getTime() : 0;
      const cStarted = c.startedAt ? new Date(c.startedAt).getTime() : 0;
      return cStarted > latestStarted ? c : latest;
    });
  };

  const getContactStatus = (contact: Contact) => {
    const call = getLatestCallForContact(contact.id);
    if (!call) return contact.status || "pending";
    return call.status;
  };

  const contactStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: "Pending",
      completed: "Completed",
      failed: "Failed",
      "no-answer": "No Answer",
      busy: "Busy",
      "in-progress": "In Progress",
      ringing: "Ringing",
      credit_failed: "Low Credits",
    };
    return map[status] || status;
  };

  if (campaignLoading || contactsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4 pb-8">
        <Button variant="ghost" onClick={() => setLocation("/campaigns")} className="text-slate-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Button>
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Campaign not found</h3>
          <p className="text-slate-500">This campaign may have been deleted or you do not have access.</p>
        </div>
      </div>
    );
  }

  const progress =
    campaign.totalContacts > 0
      ? Math.round((campaign.completedCalls / campaign.totalContacts) * 100)
      : 0;

  const pendingCalls = Math.max(
    campaign.totalContacts - campaign.completedCalls - campaign.failedCalls,
    0
  );

  const successRate =
    campaign.completedCalls > 0
      ? Math.round((campaign.successfulCalls / campaign.completedCalls) * 100)
      : 0;

  const failureRate =
    campaign.totalContacts > 0
      ? Math.round((campaign.failedCalls / campaign.totalContacts) * 100)
      : 0;

  const pendingRate =
    campaign.totalContacts > 0
      ? Math.round((pendingCalls / campaign.totalContacts) * 100)
      : 0;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <Link href="/dashboard" className="hover:text-slate-600">
          Dashboard
        </Link>
        <span>&gt;</span>
        <Link href="/campaigns" className="hover:text-slate-600">
          Campaigns
        </Link>
        <span>&gt;</span>
        <span className="text-slate-600">Campaign Details</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => setLocation("/campaigns")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            {campaign.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Campaign ID: {campaign.id}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          className="h-10 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          data-testid="button-export"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-2">Status</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(campaign.status)}`}
          >
            {formatStatusLabel(campaign.status)}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-2">Total recipients</p>
          <p className="text-2xl font-semibold text-slate-900">{campaign.totalContacts}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-2">Started</p>
          <p className="text-sm font-medium text-slate-800">
            {campaign.startedAt
              ? format(new Date(campaign.startedAt), "MMM d, yyyy 'at' h:mm a")
              : "Not started"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-2">Progress</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#007BFF] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-slate-700">{progress}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="card-successful-calls">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Successful Calls</p>
              <p className="text-2xl font-semibold text-slate-900">{campaign.successfulCalls}</p>
              <p className="text-xs text-slate-400">{successRate}% success rate</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="card-failed-calls">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
              <PhoneOff className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Failed Calls</p>
              <p className="text-2xl font-semibold text-slate-900">{campaign.failedCalls}</p>
              <p className="text-xs text-slate-400">{failureRate}% failure rate</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="card-pending-calls">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending Calls</p>
              <p className="text-2xl font-semibold text-slate-900">{pendingCalls}</p>
              <p className="text-xs text-slate-400">{pendingRate}% remaining</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Campaign Details & AI Configuration</h2>
          <p className="text-sm text-slate-500 mt-1">
            Telephony parameters, active conversational agent, and scheduling.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Campaign Name</p>
            <div className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-800">
              {campaign.name}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Campaign Type</p>
            <div className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-800">
              {campaign.type || "—"}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Status</p>
            <div className="h-11 rounded-xl border border-slate-200 bg-white px-3 flex items-center">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(campaign.status)}`}
              >
                {formatStatusLabel(campaign.status)}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">AI Agent</p>
            <div className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center gap-2 text-sm text-slate-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{agentName}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Telephony Outbound Number</p>
            <div className="h-11 rounded-xl border border-blue-100 bg-blue-50/70 px-3 flex items-center gap-2 text-sm text-slate-800">
              <Phone className="h-3.5 w-3.5 text-[#007BFF] shrink-0" />
              <span className="truncate">{outboundNumber}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Created</p>
            <div className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-800">
              {campaign.createdAt
                ? format(new Date(campaign.createdAt), "MMM d, yyyy 'at' h:mm a")
                : "—"}
            </div>
          </div>

          <div className="md:col-span-2 xl:col-span-2">
            <p className="text-xs font-medium text-slate-500 mb-1.5">Campaign Goal (Optional)</p>
            <div className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
              {campaign.goal || "—"}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Call Scheduling Window</p>
            <div className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-800">
              {formatScheduleWindow(campaign)}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setContactsOpen((open) => !open)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50/60"
        >
          <span className="text-base font-semibold text-slate-900">
            {contactsOpen ? "Hide Contacts" : "Show Contacts"}
          </span>
          {contactsOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>

        {contactsOpen && (
          <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Add new contacts to this campaign</p>
              <p className="text-sm text-slate-500 mt-0.5">Upload CSV File</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setCsvFile(file);
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50/50 hover:bg-blue-50/40 hover:border-[#007BFF]/60 transition-colors px-6 py-10 text-center"
            >
              <CloudUpload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
              {csvFile ? (
                <p className="text-sm font-semibold text-slate-800">{csvFile.name}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-800">Click to upload CSV file</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Include columns: name, phone, email (optional)
                  </p>
                </>
              )}
            </button>

            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
                <p className="text-sm font-semibold text-slate-800">CSV Format Example:</p>
                <a
                  href="/campaign_template.csv"
                  download="campaign_template.csv"
                  className="text-sm font-medium text-[#007BFF] hover:underline"
                >
                  Download Sample CSV
                </a>
              </div>
              <pre className="px-4 py-3 text-xs sm:text-sm text-slate-600 overflow-x-auto bg-white leading-relaxed">
{`phone_number, language, voice_id, first_message, prompt, city, other_dyn_variable
+12345678900, en,,,, London,
+48517067931, pl,,,, Warsaw,`}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-10 bg-white border-slate-200"
                disabled={!csvFile || uploadMutation.isPending}
                onClick={() => {
                  setCsvFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-10 bg-slate-900 hover:bg-slate-800 text-white border-transparent"
                disabled={!csvFile || uploadMutation.isPending}
                onClick={() => csvFile && uploadMutation.mutate(csvFile)}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Call Recipients</h2>
          <p className="text-sm text-slate-400">{contacts.length} Total contacts</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">Phone Number</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">Name</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">Email</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">Language</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">City</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400">Status</TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 py-14">
                    No contacts added to this campaign yet.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => {
                  const status = getContactStatus(contact);
                  const language =
                    contact.customFields?.language ||
                    contact.customFields?.Language ||
                    "—";
                  const city =
                    contact.customFields?.city ||
                    contact.customFields?.City ||
                    "—";
                  return (
                    <TableRow key={contact.id} className="border-slate-100">
                      <TableCell className="text-sm text-slate-800">{contact.phone}</TableCell>
                      <TableCell className="text-sm text-slate-800">
                        {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{contact.email || "—"}</TableCell>
                      <TableCell className="text-sm text-slate-500">{String(language)}</TableCell>
                      <TableCell className="text-sm text-slate-500">{String(city)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(status)}`}
                        >
                          {status === "completed" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : status === "failed" || status === "no-answer" || status === "busy" ? (
                            <XCircle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {contactStatusLabel(status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-400">—</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
