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
import { format } from "date-fns";
import { AuthStorage } from "@/lib/auth-storage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";
import { CreateCampaignForm } from "@wa/components/campaigns/CreateCampaignForm";
import { AuthProvider } from "@wa/contexts/auth-context";

type ChannelType = "whatsapp" | "calling";

interface WaChannel {
  id: string;
  messagingLimitInfo?: { tier?: string; label?: string };
  healthDetails?: { messaging_limit?: string };
}

interface WaTemplate {
  id: string;
  name?: string;
  language?: string;
  body?: string;
  headerType?: string;
  headerText?: string;
  footerText?: string;
}

interface WaGroup {
  id: string;
  name?: string;
  contact_count?: number;
}

interface WaContact {
  id: string;
  name?: string;
  phone?: string;
  groups?: string[];
}

interface VoiceAgent {
  id: string;
  name: string;
}

function authFetch(url: string) {
  const headers: Record<string, string> = {};
  const authHeader = AuthStorage.getAuthHeader();
  if (authHeader) headers.Authorization = authHeader;
  return fetch(url, { credentials: "include", headers });
}

function asArray<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { data?: unknown }).data)) {
    return (result as { data: T[] }).data;
  }
  if (result && typeof result === "object" && Array.isArray((result as { groups?: unknown }).groups)) {
    return (result as { groups: T[] }).groups;
  }
  return [];
}

const fieldClass = "h-11 bg-[#F4F6F8] border-transparent rounded-md";

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWhatsAppValidPhone(phone?: string) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8;
}

function readChannelFromUrl(): ChannelType {
  if (typeof window === "undefined") return "whatsapp";
  const params = new URLSearchParams(window.location.search);
  return params.get("channel") === "calling" ? "calling" : "whatsapp";
}

export default function CreateCampaign() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { setPageMeta } = useAppHeader();

  const [channel, setChannel] = useState<ChannelType>(readChannelFromUrl);

  // WhatsApp form state
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
  const [scheduledTime, setScheduledTime] = useState("");
  const [autoRetry, setAutoRetry] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [requiresHeaderImage, setRequiresHeaderImage] = useState(false);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);

  // Calling form state
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [scheduleType, setScheduleType] = useState("");
  const [sendTime, setSendTime] = useState("");
  const [sendTimeOpen, setSendTimeOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setChannel(readChannelFromUrl());
  }, [location]);

  useEffect(() => {
    setPageMeta({
      title: "Create Campaign",
      subtitle:
        channel === "whatsapp"
          ? "Configure audience, messaging template, scheduling, and channel delivery rules."
          : "Set up a new calling campaign for your agents.",
    });
    return () => setPageMeta(null);
  }, [setPageMeta, channel]);

  useEffect(() => {
    setAudience("");
    setTemplateId("");
    setShowErrors(false);
    setSelectedTemplate(null);
    setVariableMapping({});
    setScheduledTime("");
    setAutoRetry(false);
    setSelectedGroup("all");
    setSelectedContacts([]);
    setRequiresHeaderImage(false);
    setUploadedMediaId(null);
  }, [channel]);

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

  const { data: messagingLimitData } = useQuery({
    queryKey: ["/api/whatsapp/channels/messaging-limit", activeChannel?.id],
    enabled: Boolean(activeChannel?.id) && channel === "whatsapp",
    queryFn: async () => {
      const res = await authFetch(`/api/whatsapp/channels/${activeChannel?.id}/messaging-limit`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const messagingLimit: number | null =
    messagingLimitData == null
      ? null
      : messagingLimitData.limit === "unlimited"
        ? Infinity
        : Number(messagingLimitData.limit) || null;

  const messagingTier =
    messagingLimitData?.tier ||
    activeChannel?.messagingLimitInfo?.tier ||
    activeChannel?.healthDetails?.messaging_limit ||
    "UNKNOWN";

  const { data: waTemplates = [] } = useQuery<WaTemplate[]>({
    queryKey: ["/api/whatsapp/templates", activeChannel?.id],
    enabled: Boolean(activeChannel?.id) && channel === "whatsapp",
    queryFn: async () => {
      try {
        const response = await authFetch(
          `/api/whatsapp/templates?channelId=${activeChannel?.id}&limit=100`
        );
        if (!response.ok) return [];
        return asArray<WaTemplate>(await response.json());
      } catch {
        return [];
      }
    },
  });

  const { data: waGroups = [] } = useQuery<WaGroup[]>({
    queryKey: ["/api/whatsapp/groups", activeChannel?.id],
    enabled: Boolean(activeChannel?.id) && channel === "whatsapp",
    queryFn: async () => {
      try {
        const response = await authFetch(`/api/whatsapp/groups?channelId=${activeChannel?.id}`);
        if (!response.ok) return [];
        return asArray<WaGroup>(await response.json());
      } catch {
        return [];
      }
    },
  });

  const { data: waContacts = [] } = useQuery<WaContact[]>({
    queryKey: ["/api/whatsapp/contacts-all", activeChannel?.id],
    enabled: Boolean(activeChannel?.id) && channel === "whatsapp",
    queryFn: async () => {
      try {
        const url = activeChannel?.id
          ? `/api/whatsapp/contacts-all?channelId=${activeChannel.id}`
          : "/api/whatsapp/contacts-all";
        const response = await authFetch(url);
        if (!response.ok) return [];
        return asArray<WaContact>(await response.json());
      } catch {
        return [];
      }
    },
  });

  const { data: agents = [] } = useQuery<VoiceAgent[]>({
    queryKey: ["/api/agents"],
    enabled: channel === "calling",
  });

  const filteredContacts = useMemo(() => {
    if (selectedGroup === "all") return waContacts;
    return waContacts.filter((contact) => {
      const groups = contact.groups || [];
      return groups.includes(selectedGroup) || groups.some((g) => {
        const match = waGroups.find((group) => group.name === selectedGroup);
        return match ? g === match.id || g === match.name : false;
      });
    });
  }, [waContacts, selectedGroup, waGroups]);

  useEffect(() => {
    setSelectedContacts((prev) =>
      prev.filter((id) => filteredContacts.some((contact) => contact.id === id))
    );
  }, [filteredContacts]);

  const sendDate = parseLocalInput(sendTime);

  const handleSendDateSelect = (date?: Date) => {
    if (!date) return;
    const current = parseLocalInput(sendTime);
    date.setHours(current?.getHours() ?? 9, current?.getMinutes() ?? 0, 0, 0);
    setSendTime(toLocalInput(date));
    if (!scheduleType || scheduleType === "immediate") setScheduleType("scheduled");
  };

  const handleSendClockChange = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    const next = parseLocalInput(sendTime) || new Date();
    next.setHours(hours || 0, minutes || 0, 0, 0);
    setSendTime(toLocalInput(next));
    if (!scheduleType || scheduleType === "immediate") setScheduleType("scheduled");
  };

  const createWhatsAppMutation = useMutation({
    mutationFn: async (formData: {
      name: string;
      description?: string;
      variableMapping?: Record<string, unknown>;
    }) => {
      if (!activeChannel?.id) {
        throw new Error("Create a WhatsApp channel before starting a campaign.");
      }
      if (!selectedTemplate) throw new Error("Please select a template");
      if (selectedContacts.length === 0) {
        throw new Error("No recipients selected");
      }

      if (
        messagingLimit != null &&
        messagingLimit !== Infinity &&
        selectedContacts.length > messagingLimit
      ) {
        throw new Error(
          `Your channel's WhatsApp messaging limit is ${messagingLimit.toLocaleString()} messages per 24 hours. You selected ${selectedContacts.length.toLocaleString()} recipients.`
        );
      }

      const response = await apiRequest("POST", "/api/whatsapp/campaigns", {
        channelId: activeChannel.id,
        name: formData.name,
        description: formData.description || "",
        campaignType: "contacts",
        type: "marketing",
        apiType: "mm_lite",
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name || "Template",
        templateLanguage: selectedTemplate.language || "en",
        status: scheduledTime ? "scheduled" : "active",
        scheduledAt: scheduledTime ? new Date(scheduledTime).toISOString() : null,
        contactGroups: selectedContacts,
        recipientCount: selectedContacts.length,
        variableMapping: formData.variableMapping || {},
        autoRetry,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campaign created",
        description: "Your campaign has been created successfully",
      });
      setLocation("/campaigns");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create campaign",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createCallingMutation = useMutation({
    mutationFn: async () => {
      setShowErrors(true);
      const campaignName = name.trim();
      if (!campaignName) throw new Error("Campaign name is required");
      if (!audience) throw new Error("Select a target audience");
      if (!templateId) throw new Error("Choose a voice agent");
      if (!scheduleType) throw new Error("Select a schedule type");
      if (scheduleType === "scheduled" && !sendTime) throw new Error("Select a send time");

      const response = await apiRequest("POST", "/api/campaigns", {
        name: campaignName,
        type: "Lead Qualification",
        agentId: templateId,
        scheduledFor: scheduleType === "scheduled" ? new Date(sendTime).toISOString() : null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign created" });
      setLocation("/campaigns");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create campaign",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const extractTemplateVariables = (template: any) => {
    const variables: string[] = [];
    const regex = /\{\{(\d+)\}\}/g;
    if (template?.body) {
      let match;
      while ((match = regex.exec(template.body)) !== null) {
        variables.push(match[1]);
      }
    }
    return variables;
  };

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    selectedContacts.length === filteredContacts.length;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <Link href="/campaigns" className="hover:text-slate-600">
          Campaigns
        </Link>
        <span>&gt;</span>
        <span className="text-slate-600">Create Campaign</span>
      </div>

      {channel === "whatsapp" ? (
        <AuthProvider>
          <div className="w-full">
            <CreateCampaignForm
              onSubmit={(formData) => createWhatsAppMutation.mutate(formData)}
              templates={waTemplates}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              variableMapping={variableMapping}
              setVariableMapping={setVariableMapping}
              extractTemplateVariables={extractTemplateVariables}
              scheduledTime={scheduledTime}
              setScheduledTime={setScheduledTime}
              autoRetry={autoRetry}
              setAutoRetry={setAutoRetry}
              isCreating={createWhatsAppMutation.isPending}
              onCancel={() => setLocation("/campaigns")}
              channelId={activeChannel?.id}
              requiresHeaderImage={requiresHeaderImage}
              setRequiresHeaderImage={setRequiresHeaderImage}
              uploadedMediaId={uploadedMediaId}
              setUploadedMediaId={setUploadedMediaId}
              messagingLimit={messagingLimit}
              messagingTier={messagingTier}
            >
              <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-800">
                      Campaign Filter by Group
                    </Label>
                    <Select
                      value={selectedGroup}
                      onValueChange={(value) => {
                        setSelectedGroup(value);
                        setSelectedContacts([]);
                      }}
                    >
                      <SelectTrigger className="h-11 bg-white border-slate-200">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups ({waContacts.length})</SelectItem>
                        {waGroups
                          .filter((group) => group.name)
                          .map((group) => (
                            <SelectItem key={group.id} value={group.name!}>
                              {group.name} ({group.contact_count ?? 0})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-sm font-medium text-slate-800">Select Contacts</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all-contacts"
                          checked={allFilteredSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedContacts(filteredContacts.map((c) => c.id));
                            } else {
                              setSelectedContacts([]);
                            }
                          }}
                        />
                        <Label
                          htmlFor="select-all-contacts"
                          className="font-normal text-sm text-slate-600 cursor-pointer"
                        >
                          Select All ({filteredContacts.length})
                        </Label>
                      </div>
                    </div>
                    <ScrollArea className="h-64 rounded-lg border border-slate-200 bg-white">
                      <div className="p-2">
                        {filteredContacts.length === 0 ? (
                          <div className="text-center text-slate-400 py-10 text-sm">
                            No contacts in this group
                          </div>
                        ) : (
                          filteredContacts.map((contact) => {
                            const checked = selectedContacts.includes(contact.id);
                            return (
                              <label
                                key={contact.id}
                                className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-2 cursor-pointer hover:bg-slate-50 ${
                                  checked ? "bg-blue-50/60" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(isChecked) => {
                                      if (isChecked) {
                                        setSelectedContacts((prev) => [...prev, contact.id]);
                                      } else {
                                        setSelectedContacts((prev) =>
                                          prev.filter((id) => id !== contact.id)
                                        );
                                      }
                                    }}
                                  />
                                  <span className="text-sm text-slate-800 truncate">
                                    {contact.name || "Unnamed"}{" "}
                                    <span className="text-slate-500">
                                      ({contact.phone || "—"})
                                    </span>
                                  </span>
                                </div>
                                {isWhatsAppValidPhone(contact.phone) && (
                                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                                    WhatsApp Valid
                                  </span>
                                )}
                              </label>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </CreateCampaignForm>
          </div>
        </AuthProvider>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden w-full">
          <div className="px-6 md:px-8 pt-6 pb-6">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-name" className="text-sm font-semibold text-slate-800">
                  Campaign Name
                </Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Summer Promotion 2024"
                  className={fieldClass}
                  data-testid="input-campaign-name"
                />
                {showErrors && !name.trim() && (
                  <p className="text-xs text-red-500">Campaign name is required</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-800">Target Audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder="Select audience segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="later">Add contacts later</SelectItem>
                    <SelectItem value="all">All calling contacts</SelectItem>
                  </SelectContent>
                </Select>
                {showErrors && !audience && (
                  <p className="text-xs text-red-500">Select a target audience</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-800">Voice Agent</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder="Choose a voice agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showErrors && !templateId && (
                  <p className="text-xs text-red-500">Choose a voice agent</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-800">Schedule Type</Label>
                <Select value={scheduleType} onValueChange={setScheduleType}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder="Immediate or Scheduled" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
                {showErrors && !scheduleType && (
                  <p className="text-xs text-red-500">Select a schedule type</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-800">Send Time</Label>
                <Popover open={sendTimeOpen} onOpenChange={setSendTimeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`${fieldClass} w-full px-3 text-left text-sm flex items-center gap-2 ${
                        sendDate ? "text-slate-800" : "text-slate-400"
                      }`}
                      data-testid="input-send-time"
                    >
                      <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                      {sendDate ? format(sendDate, "MMM d, yyyy 'at' h:mm a") : "Select date & time"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={sendDate || undefined}
                      onSelect={handleSendDateSelect}
                      disabled={{ before: new Date() }}
                      initialFocus
                    />
                    <div className="flex items-center gap-2 border-t border-slate-100 p-3">
                      <Input
                        type="time"
                        value={sendDate ? format(sendDate, "HH:mm") : "09:00"}
                        onChange={(e) => handleSendClockChange(e.target.value)}
                        className="h-9 bg-white border-slate-200"
                      />
                      {sendTime && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSendTime("");
                            setSendTimeOpen(false);
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {showErrors && scheduleType === "scheduled" && !sendTime && (
                  <p className="text-xs text-red-500">Select a send time</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 mt-6 pt-5 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/campaigns")}
                className="h-10 min-w-[120px] px-5 rounded-md bg-white border-slate-200"
                data-testid="button-cancel-campaign"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => createCallingMutation.mutate()}
                disabled={createCallingMutation.isPending}
                className="h-10 min-w-[140px] px-5 rounded-md bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
                data-testid="button-submit-campaign"
              >
                {createCallingMutation.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
