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
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AuthStorage } from "@/lib/auth-storage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, MessageCircle, PhoneOutgoing } from "lucide-react";

type ChannelType = "whatsapp" | "calling";

interface WaChannel {
  id: string;
}

interface WaTemplate {
  id: string;
  name?: string;
  language?: string;
}

interface WaGroup {
  id: string;
  name?: string;
}

interface WaContact {
  id: string;
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

export default function CreateCampaign() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setPageMeta } = useAppHeader();

  const [channel, setChannel] = useState<ChannelType>("whatsapp");
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [scheduleType, setScheduleType] = useState("");
  const [sendTime, setSendTime] = useState("");
  const [sendTimeOpen, setSendTimeOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: "Create Campaign",
      subtitle: "Set up a new campaign for WhatsApp or calling.",
    });
    return () => setPageMeta(null);
  }, [setPageMeta]);

  useEffect(() => {
    setAudience("");
    setTemplateId("");
    setShowErrors(false);
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

  const { data: waTemplates = [] } = useQuery<WaTemplate[]>({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: async () => {
      try {
        const response = await authFetch("/api/whatsapp/templates?limit=100");
        if (!response.ok) return [];
        return asArray<WaTemplate>(await response.json());
      } catch {
        return [];
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
        return asArray<WaGroup>(await response.json());
      } catch {
        return [];
      }
    },
  });

  const { data: waContacts = [] } = useQuery<WaContact[]>({
    queryKey: ["/api/whatsapp/contacts-all", activeChannel?.id],
    enabled: Boolean(activeChannel?.id),
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
  });

  const selectedTemplate = useMemo(
    () => waTemplates.find((item) => item.id === templateId),
    [waTemplates, templateId]
  );
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

  const createMutation = useMutation({
    mutationFn: async () => {
      setShowErrors(true);
      const campaignName = name.trim();
      if (!campaignName) throw new Error("Campaign name is required");
      if (!audience) throw new Error("Select a target audience");
      if (!templateId) {
        throw new Error(channel === "whatsapp" ? "Choose a message template" : "Choose a voice agent");
      }
      if (!scheduleType) throw new Error("Select a schedule type");
      if (scheduleType === "scheduled" && !sendTime) throw new Error("Select a send time");

      if (channel === "whatsapp") {
        if (!activeChannel?.id) {
          throw new Error("Create a WhatsApp channel before starting a campaign.");
        }
        if (!selectedTemplate) throw new Error("Choose a message template");

        const groupName = audience.startsWith("group:") ? audience.slice(6) : "";
        const contactIds = waContacts
          .filter((contact) => {
            if (audience === "all") return true;
            return (contact.groups || []).includes(groupName);
          })
          .map((contact) => contact.id);

        if (contactIds.length === 0) {
          throw new Error("No contacts in this audience. Add contacts first.");
        }

        const response = await apiRequest("POST", "/api/whatsapp/campaigns", {
          channelId: activeChannel.id,
          name: campaignName,
          campaignType: "contacts",
          type: "marketing",
          apiType: "mm_lite",
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name || "Template",
          templateLanguage: selectedTemplate.language || "en",
          status: scheduleType === "scheduled" ? "scheduled" : "active",
          scheduledAt: scheduleType === "scheduled" ? new Date(sendTime).toISOString() : null,
          contactGroups: contactIds,
          recipientCount: contactIds.length,
          autoRetry: false,
        });
        return response.json();
      }

      const response = await apiRequest("POST", "/api/campaigns", {
        name: campaignName,
        type: "Lead Qualification",
        agentId: templateId,
        scheduledFor: scheduleType === "scheduled" ? new Date(sendTime).toISOString() : null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/campaigns"] });
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

  return (
    <div className="pb-8">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-8 pt-6 pb-6">
          <h2 className="text-lg font-semibold text-slate-900">Create Campaign</h2>
          <p className="text-sm text-slate-500 mt-1 mb-3">Set up a new campaign for your users.</p>

          <div className="border-b border-slate-200 pb-4 mb-6">
            <div className="inline-flex rounded-md bg-[#F4F6F8] p-1">
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`h-10 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${
                  channel === "whatsapp" ? "bg-[#007BFF] text-white shadow-sm" : "text-slate-600"
                }`}
                data-testid="tab-whatsapp-campaign"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Campaign
              </button>
              <button
                type="button"
                onClick={() => setChannel("calling")}
                className={`h-10 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${
                  channel === "calling" ? "bg-[#007BFF] text-white shadow-sm" : "text-slate-600"
                }`}
                data-testid="tab-calling-campaign"
              >
                <PhoneOutgoing className="h-4 w-4" />
                Calling Campaign
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name" className="text-sm font-semibold text-slate-800">Campaign Name</Label>
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
                  {channel === "whatsapp" ? (
                    <>
                      <SelectItem value="all">All WhatsApp contacts</SelectItem>
                      {waGroups.filter((group) => group.name).map((group) => (
                        <SelectItem key={group.id} value={`group:${group.name}`}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    <>
                      <SelectItem value="later">Add contacts later</SelectItem>
                      <SelectItem value="all">All calling contacts</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {showErrors && !audience && (
                <p className="text-xs text-red-500">Select a target audience</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-800">Message Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {channel === "whatsapp"
                    ? waTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name || template.id}
                        </SelectItem>
                      ))
                    : agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
              {showErrors && !templateId && (
                <p className="text-xs text-red-500">
                  {channel === "whatsapp" ? "Choose a message template" : "Choose a voice agent"}
                </p>
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

          <div className="border-t border-slate-200 mt-6 pt-5 flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/campaigns")}
              className="h-10 min-w-[160px] px-5 rounded-md bg-white border-slate-200"
              data-testid="button-cancel-campaign"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="h-10 min-w-[160px] px-5 rounded-md bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
              data-testid="button-submit-campaign"
            >
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
