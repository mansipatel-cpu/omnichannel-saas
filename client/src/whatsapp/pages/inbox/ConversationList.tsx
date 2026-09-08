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
import { Input } from "@wa/components/ui/input";
import { ScrollArea } from "@wa/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@wa/components/ui/tabs";
import { Loading } from "@wa/components/ui/loading";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@wa/lib/utils";
import ConversationListItem from "./ConversationListItem";
import { normalizeTime } from "./utils";
import type { ConversationWithContact } from "./types";
import type { Conversation } from "@shared/whatsapp-schema";
import { useTranslation } from "@wa/lib/i18n";
import { bucketFor, SECTION_ORDER, type BucketKey } from "./bucket";

interface ConversationListProps {
  conversations: ConversationWithContact[];
  conversationsLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterTab: string;
  onFilterTabChange: (tab: string) => void;
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: ConversationWithContact) => void;
  user?: any;
  pinnedIds?: Set<string>;
  pinOrder?: Record<string, number>;
  onTogglePin?: (conversationId: string, currentlyPinned: boolean) => void;
}

const COLLAPSE_KEY_BASE = "inbox.sectionCollapsed";

function collapseKey(userId: string | undefined, bucket: BucketKey): string {
  return `${COLLAPSE_KEY_BASE}.${userId || "anon"}.${bucket}`;
}

function loadCollapsed(userId: string | undefined): Record<BucketKey, boolean> {
  if (typeof window === "undefined") {
    return { pinned: false, awaiting: false, unread: false, all: false };
  }
  const result: Record<BucketKey, boolean> = {
    pinned: false,
    awaiting: false,
    unread: false,
    all: false,
  };
  for (const k of SECTION_ORDER) {
    try {
      const raw = window.localStorage.getItem(collapseKey(userId, k));
      result[k] = raw === "1";
    } catch {
      // ignore
    }
  }
  return result;
}

const ConversationList = ({
  conversations,
  conversationsLoading,
  searchQuery,
  onSearchChange,
  filterTab,
  onFilterTabChange,
  selectedConversation,
  onSelectConversation,
  user,
  pinnedIds,
  pinOrder,
  onTogglePin,
}: ConversationListProps) => {
  const { t } = useTranslation();
  const pinSet = pinnedIds ?? new Set<string>();

  const userId: string | undefined = user?.id;
  const [collapsed, setCollapsed] = useState<Record<BucketKey, boolean>>(() =>
    loadCollapsed(userId)
  );

  // Re-load collapsed state when the user changes (e.g. switch accounts).
  useEffect(() => {
    setCollapsed(loadCollapsed(userId));
  }, [userId]);

  const toggleSection = (key: BucketKey) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(
          collapseKey(userId, key),
          next[key] ? "1" : "0"
        );
      } catch {
        // ignore
      }
      return next;
    });
  };

  const sections = useMemo(() => {
    const groups: Record<BucketKey, ConversationWithContact[]> = {
      pinned: [],
      awaiting: [],
      unread: [],
      all: [],
    };
    for (const conv of conversations) {
      groups[bucketFor(conv, pinSet)].push(conv);
    }
    for (const key of SECTION_ORDER) {
      if (key === "pinned" && pinOrder) {
        groups[key].sort((a, b) => {
          const ai = pinOrder[a.id] ?? Number.MAX_SAFE_INTEGER;
          const bi = pinOrder[b.id] ?? Number.MAX_SAFE_INTEGER;
          if (ai !== bi) return ai - bi;
          return (
            normalizeTime((b as any).lastMessageAt) -
            normalizeTime((a as any).lastMessageAt)
          );
        });
      } else {
        groups[key].sort(
          (a, b) =>
            normalizeTime((b as any).lastMessageAt) -
            normalizeTime((a as any).lastMessageAt)
        );
      }
    }
    return groups;
  }, [conversations, pinSet, pinOrder]);

  const sectionTitles: Record<BucketKey, string> = {
    pinned: t("inbox.sections.pinned"),
    awaiting: t("inbox.sections.awaitingReply"),
    unread: t("inbox.sections.unread"),
    all: t("inbox.sections.all"),
  };

  return (
    <div
      className={cn(
        "bg-white border-r border-slate-200 flex flex-col",
        selectedConversation
          ? "hidden md:flex md:w-[320px] lg:w-[360px]"
          : "w-full md:w-[320px] lg:w-[360px]"
      )}
    >
      <div className="p-4 border-b border-slate-100">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 pl-9 bg-white border-slate-200 text-sm rounded-md"
          />
        </div>

        <Tabs value={filterTab} onValueChange={onFilterTabChange}>
          <div className="overflow-x-auto -mx-1 px-1 [&::-webkit-scrollbar]:h-[2px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <TabsList className="inline-flex w-auto h-9 gap-1 bg-[#F4F6F8] p-1 rounded-md">
              <TabsTrigger value="all" className="text-xs whitespace-nowrap px-3 h-full rounded-md data-[state=active]:bg-white data-[state=active]:text-[#007BFF] data-[state=active]:shadow-sm">All</TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs whitespace-nowrap px-3 h-full rounded-md data-[state=active]:bg-white data-[state=active]:text-[#007BFF] data-[state=active]:shadow-sm">WhatsApp</TabsTrigger>
              <TabsTrigger value="chatbot" className="text-xs whitespace-nowrap px-3 h-full rounded-md data-[state=active]:bg-white data-[state=active]:text-[#007BFF] data-[state=active]:shadow-sm">Widget</TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs whitespace-nowrap px-3 h-full rounded-md data-[state=active]:bg-white data-[state=active]:text-[#007BFF] data-[state=active]:shadow-sm">Assigned</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs whitespace-nowrap px-3 h-full rounded-md data-[state=active]:bg-white data-[state=active]:text-[#007BFF] data-[state=active]:shadow-sm">Unread</TabsTrigger>
              <TabsTrigger value="open" className="text-xs whitespace-nowrap px-3 h-full rounded-md data-[state=active]:bg-white data-[state=active]:text-[#007BFF] data-[state=active]:shadow-sm">Open</TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs whitespace-nowrap px-3 h-full rounded-md data-[state=active]:bg-white data-[state=active]:text-[#007BFF] data-[state=active]:shadow-sm">Resolved</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        {conversationsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loading />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400">
            No conversations found
          </div>
        ) : (
          SECTION_ORDER.map((key) => {
            const items = sections[key];
            if (items.length === 0) return null;
            const isCollapsed = collapsed[key];
            return (
              <div key={key} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  aria-expanded={!isCollapsed}
                  className="w-full sticky top-0 z-10 bg-[#F8F9FB] px-4 py-2 flex items-center justify-between text-left hover:bg-slate-100 transition"
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {sectionTitles[key]}
                    <span className="ml-1 text-slate-400 normal-case font-medium">
                      ({items.length})
                    </span>
                  </span>
                </button>
                {!isCollapsed &&
                  items.map((conversation) => (
                    <ConversationListItem
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={selectedConversation?.id === conversation.id}
                      onClick={() => onSelectConversation(conversation)}
                      user={user}
                      isPinned={pinSet.has(conversation.id)}
                      onTogglePin={onTogglePin}
                    />
                  ))}
              </div>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
};

export default ConversationList;
