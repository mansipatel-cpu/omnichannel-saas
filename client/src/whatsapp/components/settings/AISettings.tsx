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

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { Loading } from "@wa/components/ui/loading";
import { apiRequest } from "@wa/lib/queryClient";
import AITrainingPanel from "@wa/pages/widget-builder/AITrainingPanel";
import { useChannelContext } from "@wa/contexts/channel-context";

const defaultConfig = {
  aiTone: "friendly",
  aiMaxResponseLength: 200,
  aiFallbackMessage: "I'm sorry, I don't have the information you're looking for.",
  systemPrompt:
    "You are a helpful customer support assistant.\nGuidelines:\n- Be friendly and professional\n- Keep responses concise\n- If you don't know something, admit it\n- Direct users to human support for complex issues\n- Use the customer's name when provided",
  trainFromKB: false,
  escalationRules: {
    enabled: true,
    maxAttempts: 3,
    triggerPhrases: ["speak to agent", "talk to human", "real person"] as string[],
    escalationMessage: "Let me connect you with a team member who can help you better.",
  },
};

async function readJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function ensureSiteForChannel(channelId: string, channelName: string) {
  const res = await apiRequest("GET", `/api/whatsapp/active-site?channelId=${channelId}`);
  const existing = await readJsonSafe(res);
  if (existing?.id) return existing;

  const createRes = await apiRequest("POST", "/api/whatsapp/sites/create_or_update", {
    channelId,
    name: `${channelName} AI Site`,
    domain: "ai-settings.local",
    widgetEnabled: true,
    widgetConfig: {},
    aiTrainingConfig: { trainFromKB: false, trainFromDocuments: true },
  });
  const created = await readJsonSafe(createRes);
  if (!createRes.ok || !created?.id) {
    throw new Error(created?.message || "Failed to create AI site configuration");
  }
  return created;
}

export default function AISettings(): JSX.Element {
  const { selectedChannel, setSelectedChannel } = useChannelContext();

  const { data: activeChannel, isLoading: isLoadingChannel } = useQuery({
    queryKey: ["/api/whatsapp/channels/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/whatsapp/channels/active");
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !selectedChannel?.id,
  });

  useEffect(() => {
    if (!selectedChannel?.id && activeChannel?.id) {
      setSelectedChannel(activeChannel);
    }
  }, [activeChannel, selectedChannel?.id, setSelectedChannel]);

  const channelId = selectedChannel?.id || activeChannel?.id;
  const channelName = selectedChannel?.name || activeChannel?.name || "WhatsApp Channel";

  const {
    data: activeSite,
    isLoading: isLoadingSite,
    isFetched: isSiteFetched,
    error: siteError,
    refetch: refetchSite,
  } = useQuery({
    queryKey: ["/api/whatsapp/active-site", channelId, "ensure"],
    queryFn: () => ensureSiteForChannel(channelId!, channelName),
    enabled: !!channelId,
    retry: 1,
  });

  const [trainingConfig, setTrainingConfig] = useState(defaultConfig);

  useEffect(() => {
    if (activeSite) {
      const stored = activeSite.widgetConfig || activeSite.aiTrainingConfig || {};
      setTrainingConfig({
        aiTone: stored.aiTone || defaultConfig.aiTone,
        aiMaxResponseLength: stored.aiMaxResponseLength || defaultConfig.aiMaxResponseLength,
        aiFallbackMessage: stored.aiFallbackMessage || defaultConfig.aiFallbackMessage,
        systemPrompt: stored.systemPrompt || defaultConfig.systemPrompt,
        trainFromKB: stored.trainFromKB ?? defaultConfig.trainFromKB,
        escalationRules: {
          ...defaultConfig.escalationRules,
          ...(stored.escalationRules || {}),
        },
      });
    }
  }, [activeSite]);

  const handleTrainingConfigUpdate = (key: string, value: any) => {
    setTrainingConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoadingChannel || (!!channelId && isLoadingSite && !isSiteFetched)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <Loading />
        <p className="text-slate-500 text-sm">Loading AI settings...</p>
      </div>
    );
  }

  if (!channelId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-2">
        <Lightbulb className="w-8 h-8 mx-auto text-[#007BFF]" />
        <p className="text-sm font-medium text-slate-800">No WhatsApp channel found</p>
        <p className="text-slate-500 text-sm">
          Connect or activate a WhatsApp channel first, then configure AI training here.
        </p>
      </div>
    );
  }

  if (siteError || !activeSite?.id) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <Lightbulb className="w-8 h-8 mx-auto text-[#007BFF]" />
        <p className="text-sm font-medium text-slate-800">Could not prepare AI training</p>
        <p className="text-slate-500 text-sm">
          {(siteError as Error)?.message || "Failed to create site configuration for this channel."}
        </p>
        <button type="button" className="text-sm text-[#007BFF] underline" onClick={() => refetchSite()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-[#007BFF]" />
          AI Training & Knowledge Base
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Train your AI assistant with custom data, Q&A pairs, and configure behavior. This training
          data is shared across the chat widget and team inbox.
        </p>
      </div>

      <AITrainingPanel
        config={trainingConfig as any}
        updateConfig={handleTrainingConfigUpdate}
        siteId={activeSite.id}
        channelId={channelId}
      />
    </div>
  );
}
