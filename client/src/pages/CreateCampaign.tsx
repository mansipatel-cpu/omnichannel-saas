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
import { AuthStorage } from "@/lib/auth-storage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
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
import { CreateCampaignForm } from "@wa/components/campaigns/CreateCampaignForm";
import { AuthProvider } from "@wa/contexts/auth-context";
import { CreateCallingCampaignForm } from "@/components/CreateCallingCampaignForm";

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

  // Calling form is handled by CreateCallingCampaignForm

  useEffect(() => {
    setChannel(readChannelFromUrl());
  }, [location]);

  useEffect(() => {
    setPageMeta({
      title: "Create Campaign",
      subtitle:
        channel === "whatsapp"
          ? "Configure audience, messaging template, scheduling, and channel delivery rules."
          : "Fill in the details below to set up and launch your outbound voice campaign.",
    });
    return () => setPageMeta(null);
  }, [setPageMeta, channel]);

  useEffect(() => {
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
        <CreateCallingCampaignForm />
      )}
    </div>
  );
}
