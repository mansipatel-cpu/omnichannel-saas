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
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@wa/components/layout/header";
import { EmptyState } from "@wa/components/ui/empty-state";
import { MessageCircle } from "lucide-react";
import { api } from "@wa/lib/api";
import { apiRequest, apiRequestFormData } from "@wa/lib/queryClient";
import { queryKeys } from "@wa/lib/query-keys";
import { useToast } from "@wa/hooks/use-toast";
import { useAuth } from "@wa/contexts/auth-context";
import { useSocket } from "@wa/contexts/socket-context";
import { useTranslation } from "@wa/lib/i18n";
import { normalizeTime } from "./utils";
import ConversationList from "./ConversationList";
import MessageThread from "./MessageThread";
import { createDemoConversation, createDemoGreetingMessage, createLocalInboundReply, createLocalOutboundMessage, isDemoConversationId, isServerDemoConversation, } from "./demoConversation";
export default function Inbox() {
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messageText, setMessageText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTab, setFilterTab] = useState("all");
    const [olderMessages, setOlderMessages] = useState([]);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { t } = useTranslation();
    // Use the shared global socket from SocketProvider instead of opening a
    // second connection here. A single socket prevents duplicate event handlers
    // and cuts the server connection count in half.
    const { socket } = useSocket();
    const [isTyping, setIsTyping] = useState(false);
    const [typingUser, setTypingUser] = useState("");
    const typingTimeoutRef = useRef(null);
    const selectedConversationRef = useRef(selectedConversation);
    const activeChannelRef = useRef(null);
    const templateRefetchTimersRef = useRef([]);
    // new functionality added for image upload
    const [selectedMediaFile, setSelectedMediaFile] = useState(null);
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
    const [showMediaPreview, setShowMediaPreview] = useState(false);
    const [sendingMedia, setSendingMedia] = useState(false);
    const [mediaCaption, setMediaCaption] = useState("");
    const [demoMessages, setDemoMessages] = useState(() => [
        createDemoGreetingMessage(),
    ]);
    const [demoPreview, setDemoPreview] = useState({
        lastMessageText: createDemoGreetingMessage().content,
        lastMessageAt: new Date().toISOString(),
    });
    const { data: activeChannel } = useQuery({
        queryKey: queryKeys.channels.active(),
        queryFn: async () => {
            const response = await apiRequest("GET", "/api/whatsapp/channels/active");
            if (response.status === 404)
                return null;
            if (!response.ok)
                throw new Error(`channels/active ${response.status}`);
            return await response.json();
        },
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
        staleTime: 30 * 1000,
    });
    const { data: serverConversations = [], isLoading: conversationsLoading } = useQuery({
        queryKey: queryKeys.conversations.list(activeChannel?.id),
        queryFn: async () => {
            const response = await api.getConversations(activeChannel?.id);
            if (!response.ok) {
                throw new Error(`Failed to load conversations: ${response.status}`);
            }
            return await response.json();
        },
        enabled: !!activeChannel,
        refetchOnWindowFocus: true,
        staleTime: 0,
        retry: 1,
        retryDelay: 2000,
        throwOnError: false,
    });
    const conversations = useMemo(() => {
        const real = serverConversations.filter((conv) => !isServerDemoConversation(conv));
        const demo = {
            ...createDemoConversation(activeChannel?.id),
            lastMessageText: demoPreview.lastMessageText,
            lastMessageAt: demoPreview.lastMessageAt,
            lastIncomingMessageAt: demoPreview.lastMessageAt,
        };
        return [demo, ...real];
    }, [serverConversations, activeChannel?.id, demoPreview]);
    const { data: pinsResponse } = useQuery({
        queryKey: queryKeys.conversations.pins(activeChannel?.id),
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/whatsapp/conversations/pins${activeChannel?.id ? `?channelId=${activeChannel.id}` : ""}`);
            if (!response.ok)
                return { pins: [] };
            return await response.json();
        },
        enabled: !!activeChannel,
        staleTime: 30 * 1000,
    });
    const pinnedIds = new Set((pinsResponse?.pins || []).map((p) => p.conversationId));
    // Order pinned conversations by pin createdAt (newest pin first), so the
    // pinned section is stable regardless of message activity.
    const pinOrder = {};
    (pinsResponse?.pins || []).forEach((p, idx) => {
        pinOrder[p.conversationId] = idx;
    });
    const togglePinMutation = useMutation({
        mutationFn: async (vars) => {
            const method = vars.currentlyPinned ? "DELETE" : "POST";
            const response = await apiRequest(method, `/api/whatsapp/conversations/${vars.conversationId}/pin`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const err = new Error(data?.error || "Pin request failed");
                err.code = data?.error;
                err.cap = data?.cap;
                throw err;
            }
            return data;
        },
        onMutate: async (vars) => {
            const key = queryKeys.conversations.pins(activeChannel?.id);
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData(key);
            queryClient.setQueryData(key, (old) => {
                const list = Array.isArray(old?.pins) ? old.pins : [];
                if (vars.currentlyPinned) {
                    return {
                        ...(old || {}),
                        pins: list.filter((p) => p.conversationId !== vars.conversationId),
                    };
                }
                return {
                    ...(old || {}),
                    pins: [
                        ...list,
                        {
                            conversationId: vars.conversationId,
                            channelId: activeChannel?.id,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                };
            });
            return { previous };
        },
        onError: (err, _vars, ctx) => {
            const key = queryKeys.conversations.pins(activeChannel?.id);
            if (ctx?.previous !== undefined) {
                queryClient.setQueryData(key, ctx.previous);
            }
            if (err?.code === "PIN_CAP_REACHED") {
                toast({
                    title: t("inbox.pin.capReachedTitle"),
                    description: t("inbox.pin.capReachedDesc", {
                        cap: String(err?.cap ?? 20),
                    }),
                    variant: "destructive",
                });
            }
            else {
                toast({
                    title: t("common.error"),
                    description: err?.message || "Failed to update pin",
                    variant: "destructive",
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.pins(activeChannel?.id),
            });
        },
    });
    const handleTogglePin = (conversationId, currentlyPinned) => {
        if (isDemoConversationId(conversationId))
            return;
        togglePinMutation.mutate({ conversationId, currentlyPinned });
    };
    const { data: messagesPage, isLoading: messagesLoading } = useQuery({
        queryKey: queryKeys.conversations.messages(selectedConversation?.id),
        queryFn: async () => {
            if (!selectedConversation?.id)
                return { messages: [], hasMore: false };
            const response = await api.getMessages(selectedConversation.id);
            if (!response.ok) {
                throw new Error(`Failed to load messages: ${response.status}`);
            }
            const data = await response.json();
            const hasMore = response.headers.get("x-has-more") === "true";
            return { messages: data, hasMore };
        },
        enabled: !!selectedConversation?.id && !isDemoConversationId(selectedConversation?.id),
        staleTime: 30000,
        retry: 1,
        retryDelay: 2000,
        throwOnError: false,
    });
    const freshMessages = messagesPage?.messages ?? [];
    const messages = (() => {
        if (isDemoConversationId(selectedConversation?.id)) {
            return demoMessages;
        }
        const seen = new Set();
        const merged = [];
        for (const m of [...olderMessages, ...freshMessages]) {
            if (!seen.has(m.id)) {
                seen.add(m.id);
                merged.push(m);
            }
        }
        return merged;
    })();
    function normalizeTimeLocal(value) {
        if (!value)
            return 0;
        if (value instanceof Date) {
            return value.getTime();
        }
        if (typeof value === "number") {
            return value < 1e12 ? value * 1000 : value;
        }
        const parsed = Date.parse(value);
        return isNaN(parsed) ? 0 : parsed;
    }
    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);
    useEffect(() => {
        activeChannelRef.current = activeChannel;
    }, [activeChannel]);
    useEffect(() => {
        setOlderMessages([]);
        setHasMoreMessages(false);
    }, [selectedConversation?.id]);
    useEffect(() => {
        if (messagesPage) {
            setHasMoreMessages(messagesPage.hasMore);
        }
    }, [messagesPage]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    const loadOlderMessages = async () => {
        if (!selectedConversation?.id || loadingOlderMessages)
            return;
        const oldestMessage = messages[0];
        if (!oldestMessage?.createdAt)
            return;
        setLoadingOlderMessages(true);
        try {
            const beforeTs = typeof oldestMessage.createdAt === "string"
                ? oldestMessage.createdAt
                : oldestMessage.createdAt.toISOString();
            const response = await api.getMessages(selectedConversation.id, `${beforeTs}__${oldestMessage.id}`);
            if (response.ok) {
                const olderData = await response.json();
                const moreAvailable = response.headers.get("x-has-more") === "true";
                setOlderMessages(prev => {
                    const seenIds = new Set(prev.map(m => m.id));
                    const fresh = olderData.filter(m => !seenIds.has(m.id));
                    return [...fresh, ...prev];
                });
                setHasMoreMessages(moreAvailable);
            }
        }
        finally {
            setLoadingOlderMessages(false);
        }
    };
    useEffect(() => {
        if (!socket)
            return;
        const socketInstance = socket;
        // Join the active channel room so that server-emitted events for this
        // channel reach us. Re-runs whenever the active channel changes.
        if (activeChannel?.id) {
            const channelRoom = `channel:${activeChannel.id}`;
            console.log("🔗 Joining channel room:", channelRoom);
            socketInstance.emit("join-room", { room: channelRoom });
        }
        socketInstance.on("conversation_created", (data) => {
            console.log("🔥 conversation_created event received", data);
            const channelId = activeChannelRef.current?.id;
            if (data?.conversation && channelId) {
                queryClient.setQueryData(queryKeys.conversations.list(channelId), (old) => {
                    const list = Array.isArray(old) ? old : [];
                    const exists = list.some((c) => c.id === data.conversation.id);
                    if (exists)
                        return list;
                    return [data.conversation, ...list];
                });
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
        });
        socketInstance.on("message_sent", (data) => {
            console.log("📩 message_sent event received:", data);
            queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.all()
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.messages(data.conversationId)
            });
        });
        socketInstance.on("new-message", (data) => {
            console.log("🔥 Incoming message (raw):", data);
            const conversationId = data.conversationId;
            const channelId = activeChannelRef.current?.id;
            const lastMessageText = typeof data?.message?.content === "string"
                ? data.message.content
                : typeof data?.content === "string"
                    ? data.content
                    : "[Media]";
            const lastMessageAt = typeof data?.createdAt === "number"
                ? data.createdAt
                : typeof data?.createdAt === "string"
                    ? Date.parse(data.createdAt)
                    : Date.now();
            if (channelId) {
                queryClient.setQueryData(queryKeys.conversations.list(channelId), (old) => {
                    if (!Array.isArray(old))
                        return [];
                    return old
                        .map((conv) => conv.id === conversationId
                        ? {
                            ...conv,
                            lastMessageText,
                            lastMessageAt,
                            // Keep lastIncomingMessageAt in sync so the section
                            // grouping (Awaiting Reply vs Unread) updates instantly.
                            lastIncomingMessageAt: lastMessageAt,
                            unreadCount: selectedConversationRef.current?.id === conversationId
                                ? 0
                                : (conv.unreadCount || 0) + 1,
                        }
                        : conv)
                        .sort((a, b) => normalizeTime(b.lastMessageAt) -
                        normalizeTime(a.lastMessageAt));
                });
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
            if (selectedConversationRef.current?.id === conversationId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.conversations.messages(conversationId),
                });
            }
        });
        socketInstance.on("conversation_updated", (data) => {
            console.log("🔔 Conversation updated:", data.conversationId);
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
        });
        socketInstance.on("new_message", (data) => {
            console.log("New message received:", data);
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
            if (selectedConversationRef.current &&
                data.conversationId === selectedConversationRef.current.id) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.conversations.messages(selectedConversationRef.current.id),
                });
            }
        });
        socketInstance.on("user_typing", (data) => {
            if (selectedConversationRef.current?.id === data.conversationId) {
                setIsTyping(true);
                setTypingUser("Visitor");
            }
        });
        socketInstance.on("user_stopped_typing", (data) => {
            if (selectedConversationRef.current?.id === data.conversationId) {
                setIsTyping(false);
                setTypingUser("");
            }
        });
        socketInstance.on("new_conversation_assigned", (data) => {
            if (data.agentId === user?.id) {
                queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
                toast({
                    title: t("inbox.toasts.newAssigned"),
                    description: t("inbox.toasts.newAssignedDesc"),
                });
            }
        });
        socketInstance.on("conversation_transferred", (data) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
            if (selectedConversationRef.current?.id === data.conversationId) {
                toast({
                    title: t("inbox.toasts.transferred"),
                    description: t("inbox.toasts.transferredTo", {
                        agent: data.agent?.name || "another agent",
                    }),
                });
            }
        });
        socketInstance.on("messages_read", (data) => {
            if (selectedConversationRef.current?.id === data.conversationId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.conversations.messages(selectedConversationRef.current?.id),
                });
            }
        });
        socketInstance.on("message_reaction", (data) => {
            console.log("📍 Reaction received:", data);
            const currentConv = selectedConversationRef.current;
            if (currentConv && data.conversationId === currentConv.id) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.conversations.messages(currentConv.id),
                });
            }
        });
        socketInstance.on("message_edited", (data) => {
            console.log("✏️ Message edited:", data);
            const currentConv = selectedConversationRef.current;
            if (currentConv && data.conversationId === currentConv.id) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.conversations.messages(currentConv.id),
                });
            }
        });
        socketInstance.on("message_status_update", (data) => {
            const { conversationId, whatsappMessageId, status, errorDetails, } = data;
            console.log("📬 message_status_update received:", { conversationId, whatsappMessageId, status, hasError: !!errorDetails });
            const currentConv = selectedConversationRef.current;
            if (currentConv?.id === conversationId) {
                queryClient.setQueryData(queryKeys.conversations.messages(conversationId), (old) => {
                    if (!Array.isArray(old))
                        return old;
                    return old.map((msg) => msg.whatsappMessageId === whatsappMessageId
                        ? {
                            ...msg,
                            status,
                            errorDetails: errorDetails || msg.errorDetails,
                        }
                        : msg);
                });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.conversations.messages(conversationId),
                });
            }
            if (status === "failed" && errorDetails) {
                const errorMsg = errorDetails.title || errorDetails.message || "Message delivery failed";
                const isBilling = errorMsg.toLowerCase().includes("payment") || errorMsg.toLowerCase().includes("billing") || errorMsg.toLowerCase().includes("eligibility");
                toast({
                    title: isBilling ? "Meta Billing Issue" : "Message Failed",
                    description: isBilling
                        ? "Message failed due to a payment issue. Please check your payment method in Meta Business Manager (business.facebook.com) → Billing & Payments."
                        : errorMsg,
                    variant: "destructive",
                    duration: 10000,
                });
            }
        });
        socketInstance.on("conversation_status_changed", (data) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
            if (selectedConversationRef.current?.id === data.conversationId) {
                toast({
                    title: t("inbox.toasts.statusChanged"),
                    description: t("inbox.toasts.statusChangedTo", {
                        status: String(data.status),
                    }),
                });
            }
        });
        return () => {
            // Detach our listeners but keep the shared socket connected for other
            // consumers. Also leave the channel room we joined above.
            if (activeChannel?.id) {
                socketInstance.emit("leave-room", {
                    room: `channel:${activeChannel.id}`,
                });
            }
            socketInstance.off("conversation_created");
            socketInstance.off("message_sent");
            socketInstance.off("new-message");
            socketInstance.off("conversation_updated");
            socketInstance.off("new_message");
            socketInstance.off("user_typing");
            socketInstance.off("user_stopped_typing");
            socketInstance.off("new_conversation_assigned");
            socketInstance.off("conversation_transferred");
            socketInstance.off("messages_read");
            socketInstance.off("message_reaction");
            socketInstance.off("message_edited");
            socketInstance.off("message_status_update");
            socketInstance.off("conversation_status_changed");
        };
    }, [socket, activeChannel?.id]);
    // Clean up any pending timers on unmount so they don't fire against a
    // torn-down query cache.
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            templateRefetchTimersRef.current.forEach((t) => clearTimeout(t));
            templateRefetchTimersRef.current = [];
        };
    }, []);
    useEffect(() => {
        if (!selectedConversation || !socket)
            return;
        if (isDemoConversationId(selectedConversation.id))
            return;
        const room = `conversation:${selectedConversation.id}`;
        console.log("🔗 Joining conversation room:", room);
        socket.emit("join-room", { room });
        return () => {
            console.log("🚪 Leaving conversation room:", room);
            socket.emit("leave-room", { room });
        };
    }, [selectedConversation?.id, socket]);
    const sendMessageMutation = useMutation({
        mutationFn: async (data) => {
            const response = await apiRequest("POST", `/api/whatsapp/conversations/${data.conversationId}/messages`, {
                content: data.content,
                fromUser: true,
                fromType: "agent",
                agentId: user?.id,
                agentName: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                    user?.username,
            });
            return response.json();
        },
        onSuccess: (data) => {
            // Message is already persisted + broadcast by the HTTP createMessage
            // endpoint. Do not also emit agent_send_message — that would create a duplicate.
            queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.messages(selectedConversation?.id),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
            setMessageText("");
            if (socket && selectedConversation) {
                socket.emit("agent_stopped_typing", {
                    conversationId: selectedConversation.id,
                });
            }
            if (data?.status === "failed" || data?.success === false) {
                const errorMsg = data?.errorDetails?.message || data?.error || "Message delivery failed";
                const isBilling = errorMsg.toLowerCase().includes("payment") || errorMsg.toLowerCase().includes("billing") || errorMsg.toLowerCase().includes("eligibility");
                toast({
                    title: isBilling
                        ? t("inbox.toasts.metaBillingIssue")
                        : t("inbox.toasts.messageFailed"),
                    description: isBilling ? t("inbox.toasts.metaBillingDesc") : errorMsg,
                    variant: "destructive",
                    duration: 10000,
                });
            }
        },
        onError: (error) => {
            toast({
                title: t("common.error"),
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const handleTyping = (e) => {
        setMessageText(e.target.value);
        if (!socket || !selectedConversation)
            return;
        socket.emit("agent_typing", {
            conversationId: selectedConversation.id,
            agentName: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                user?.username,
        });
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("agent_stopped_typing", {
                conversationId: selectedConversation.id,
            });
        }, 2000);
    };
    const updateStatusMutation = useMutation({
        mutationFn: async (data) => {
            const response = await apiRequest("PATCH", `/api/whatsapp/conversations/${data.conversationId}/status`, { status: data.status });
            return response.json();
        },
        onSuccess: (data, variables) => {
            if (socket) {
                socket.emit("conversation_status_changed", {
                    conversationId: variables.conversationId,
                    status: variables.status,
                });
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
            toast({
                title: t("common.success"),
                description: t("inbox.toasts.statusUpdated"),
            });
        },
        onError: (error) => {
            toast({
                title: t("common.error"),
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const sendTemplateMutation = useMutation({
        mutationFn: async (data) => {
            const response = await apiRequest("POST", "/api/whatsapp/messages/send", {
                to: data.phoneNumber,
                templateName: data.templateName,
                channelId: selectedConversation?.channelId,
                headerType: data.headerType
                    ? data.headerType.toUpperCase()
                    : undefined,
                parameters: data.parameters || [],
                mediaId: data.mediaId,
                buttonParameters: data.buttonParameters,
                expirationTimeMs: data.expirationTimeMs,
                ...(data.carouselCardMediaIds
                    ? { carouselCardMediaIds: data.carouselCardMediaIds }
                    : {}),
            });
            return response.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.messages(selectedConversation?.id),
            });
            if (data?.success === false || data?.message?.status === "failed") {
                const msg = data?.error || data?.message?.errorDetails?.message || "Template delivery failed";
                const isBilling = msg.toLowerCase().includes("payment") || msg.toLowerCase().includes("billing") || msg.toLowerCase().includes("eligibility");
                const isRateLimit = msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("throttl");
                const isNotRegistered = msg.toLowerCase().includes("not registered") || msg.toLowerCase().includes("not a valid whatsapp");
                let title = t("inbox.toasts.templateSendFailed");
                let description = msg;
                if (isBilling) {
                    title = t("inbox.toasts.metaBillingIssue");
                    description = t("inbox.toasts.metaBillingLongDesc");
                }
                else if (isRateLimit) {
                    title = t("inbox.toasts.rateLimitReached");
                    description = t("inbox.toasts.rateLimitDesc");
                }
                else if (isNotRegistered) {
                    title = t("inbox.toasts.invalidRecipient");
                    description = t("inbox.toasts.invalidRecipientDesc");
                }
                toast({
                    title,
                    description,
                    variant: "destructive",
                    duration: 10000,
                });
            }
            else {
                toast({
                    title: t("inbox.toasts.templateSubmitted"),
                    description: t("inbox.toasts.templateSubmittedDesc"),
                });
                const convId = selectedConversation?.id;
                templateRefetchTimersRef.current.forEach(t => clearTimeout(t));
                templateRefetchTimersRef.current = [];
                const t1 = setTimeout(() => {
                    console.log("⏰ Delayed refetch: checking for message status updates");
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.conversations.messages(convId),
                    });
                }, 10000);
                const t2 = setTimeout(() => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.conversations.messages(convId),
                    });
                }, 20000);
                templateRefetchTimersRef.current = [t1, t2];
            }
        },
        onError: (error) => {
            const msg = error.message || "Failed to send template";
            const isBilling = msg.toLowerCase().includes("payment") || msg.toLowerCase().includes("billing") || msg.toLowerCase().includes("eligibility");
            const isRateLimit = msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("throttl");
            const isNotRegistered = msg.toLowerCase().includes("not registered") || msg.toLowerCase().includes("not a valid whatsapp");
            let title = t("inbox.toasts.templateSendFailed");
            let description = msg;
            if (isBilling) {
                title = t("inbox.toasts.metaBillingIssue");
                description = t("inbox.toasts.metaBillingLongDesc");
            }
            else if (isRateLimit) {
                title = t("inbox.toasts.rateLimitReached");
                description = t("inbox.toasts.rateLimitDesc");
            }
            else if (isNotRegistered) {
                title = t("inbox.toasts.invalidRecipient");
                description = t("inbox.toasts.invalidRecipientDesc");
            }
            toast({
                title,
                description,
                variant: "destructive",
                duration: 10000,
            });
        },
    });
    const handleSendMessage = () => {
        if (!messageText.trim() || !selectedConversation)
            return;
        if (isDemoConversationId(selectedConversation.id)) {
            const content = messageText.trim();
            const outbound = createLocalOutboundMessage(content);
            setDemoMessages((prev) => [...prev, outbound]);
            setDemoPreview({
                lastMessageText: content,
                lastMessageAt: outbound.createdAt,
            });
            setMessageText("");
            window.setTimeout(() => {
                const reply = createLocalInboundReply();
                setDemoMessages((prev) => [...prev, reply]);
                setDemoPreview({
                    lastMessageText: reply.content,
                    lastMessageAt: reply.createdAt,
                });
            }, 900);
            return;
        }
        sendMessageMutation.mutate({
            conversationId: selectedConversation.id,
            content: messageText.trim(),
        });
    };
    const handleSelectTemplate = (template, variables, mediaId, headerType, buttonParameters, expirationTimeMs, carouselCardMediaIds) => {
        if (!selectedConversation)
            return;
        if (!activeChannel?.id) {
            toast({
                title: "No WhatsApp channel",
                description: "Create a WhatsApp channel before sending a template.",
                variant: "destructive",
            });
            return;
        }
        sendTemplateMutation.mutate({
            conversationId: selectedConversation.id,
            templateName: template.name,
            phoneNumber: selectedConversation.contactPhone || "",
            parameters: variables,
            mediaId: mediaId,
            headerType: headerType,
            buttonParameters,
            expirationTimeMs,
            ...(carouselCardMediaIds && Object.keys(carouselCardMediaIds).length > 0
                ? { carouselCardMediaIds }
                : {}),
        });
    };
    const handleFileAttachment = () => {
        fileInputRef.current?.click();
    };
    // const handleFileChange = async (
    //   event: React.ChangeEvent<HTMLInputElement>
    // ) => {
    //   const file = event.target.files?.[0];
    //   if (!file || !selectedConversation) return;
    //   const formData = new FormData();
    //   formData.append("media", file);
    //   formData.append("fromUser", "true");
    //   formData.append("conversationId", selectedConversation.id);
    //   formData.append("caption", messageText || "");
    //   try {
    //     await apiRequestFormData(
    //       "POST",
    //       `/api/whatsapp/conversations/${selectedConversation.id}/messages`,
    //       formData
    //     );
    //     toast({
    //       title: t("common.success"),
    //       description: t("inbox.toasts.mediaSent"),
    //     });
    //     queryClient.invalidateQueries({
    //       queryKey: queryKeys.conversations.messages(selectedConversation.id),
    //     });
    //     setMessageText("");
    //   } catch (error: any) {
    //     toast({
    //       title: t("common.error"),
    //       description: error.message,
    //       variant: "destructive",
    //     });
    //   }
    //   event.target.value = "";
    // };
    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setSelectedMediaFile(file);
        setMediaPreviewUrl(URL.createObjectURL(file));
        setShowMediaPreview(true);
        event.target.value = "";
    };
    const handleSendMediaMessage = async () => {
        if (!selectedMediaFile || !selectedConversation)
            return;
        setSendingMedia(true);
        const formData = new FormData();
        formData.append("media", selectedMediaFile);
        formData.append("fromUser", "true");
        formData.append("conversationId", selectedConversation.id);
        formData.append("caption", mediaCaption || "");
        try {
            await apiRequestFormData("POST", `/api/whatsapp/conversations/${selectedConversation.id}/messages`, formData);
            toast({
                title: t("common.success"),
                description: t("inbox.toasts.mediaSent"),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.messages(selectedConversation.id),
            });
            setMediaCaption("");
            setSelectedMediaFile(null);
            setMediaPreviewUrl("");
            setShowMediaPreview(false);
        }
        catch (error) {
            toast({
                title: t("common.error"),
                description: error.message,
                variant: "destructive",
            });
        }
    };
    useEffect(() => {
        return () => {
            if (mediaPreviewUrl) {
                URL.revokeObjectURL(mediaPreviewUrl);
            }
        };
    }, [mediaPreviewUrl]);
    const updateConversationStatus = (status) => {
        if (!selectedConversation)
            return;
        updateStatusMutation.mutate({
            conversationId: selectedConversation.id,
            status: status,
        });
    };
    const handleViewContact = () => {
        if (!selectedConversation?.contactId)
            return;
        window.location.href = `/contacts?id=${encodeURIComponent(selectedConversation.contactId)}`;
    };
    const handleBlockContact = async () => {
        if (!selectedConversation || !selectedConversation.contactId)
            return;
        try {
            await apiRequest("PATCH", `/api/whatsapp/contacts/${selectedConversation.contactId}`, { status: "blocked" });
            toast({
                title: t("inbox.toasts.contactBlocked"),
                description: t("inbox.toasts.contactBlockedDesc"),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
        }
        catch (error) {
            toast({
                title: t("common.error"),
                description: t("inbox.toasts.contactBlockFailed"),
                variant: "destructive",
            });
        }
    };
    const handleDeleteChat = async () => {
        if (!selectedConversation)
            return;
        const confirmed = window.confirm(t("inbox.toasts.deleteConfirm"));
        if (!confirmed)
            return;
        try {
            await apiRequest("DELETE", `/api/whatsapp/conversations/${selectedConversation.id}`);
            toast({
                title: t("inbox.toasts.chatDeleted"),
                description: t("inbox.toasts.chatDeletedDesc"),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
            setSelectedConversation(null);
        }
        catch (error) {
            toast({
                title: t("common.error"),
                description: t("inbox.toasts.chatDeleteFailed"),
                variant: "destructive",
            });
        }
    };
    const filteredConversations = conversations.filter((conv) => {
        const matchesSearch = conv.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            conv.contactPhone?.includes(searchQuery) ||
            conv.contactName?.toLowerCase().includes(searchQuery.toLowerCase());
        switch (filterTab) {
            case "unread":
                return matchesSearch && (conv.unreadCount || 0) > 0;
            case "open":
                return matchesSearch && conv.status === "open";
            case "resolved":
                return matchesSearch && conv.status === "resolved";
            case "whatsapp":
                return matchesSearch && conv.type === "whatsapp";
            case "chatbot":
                return matchesSearch && conv.type === "chatbot";
            case "assigned":
                return (matchesSearch &&
                    conv.status === "assigned" &&
                    (user?.role === "admin" || conv.assignedTo === user?.id));
            default:
                return matchesSearch;
        }
    });
    function normalizeTimeFormat(value) {
        if (!value)
            return 0;
        if (value instanceof Date)
            return value.getTime();
        if (typeof value === "number") {
            return value < 1e12 ? value * 1000 : value;
        }
        const parsed = Date.parse(value);
        return isNaN(parsed) ? 0 : parsed;
    }
    const is24HourWindowExpired = selectedConversation?.type === "whatsapp" &&
        !isDemoConversationId(selectedConversation?.id) &&
        normalizeTime(selectedConversation?.lastIncomingMessageAt || selectedConversation?.lastMessageAt) > 0
        ? Date.now() -
            normalizeTime(selectedConversation?.lastIncomingMessageAt || selectedConversation?.lastMessageAt) >
            24 * 60 * 60 * 1000
        : false;
    if (!activeChannel) {
        return (<div>
        <Header title={t("inbox.title")}/>
        <div className="flex flex-col gap-4 h-[calc(100dvh-11.5rem)] min-h-[560px]">
          <div className="flex items-center gap-2 text-[13px] text-slate-400 shrink-0">
            <Link href="~/dashboard" className="hover:text-slate-600">Home</Link>
            <span>&gt;</span>
            <span>Messages</span>
            <span>&gt;</span>
            <span className="text-slate-600">Team Inbox</span>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
            <EmptyState icon={MessageCircle} title="No Active Channel" description="Create a WhatsApp channel before using Team Inbox."/>
          </div>
        </div>
      </div>);
    }
    return (<div>
      <Header title={t("inbox.title")}/>
      <div className="flex flex-col gap-4 h-[calc(100dvh-11.5rem)] min-h-[560px]">
        <div className="flex items-center gap-2 text-[13px] text-slate-400 shrink-0">
          <Link href="~/dashboard" className="hover:text-slate-600">Home</Link>
          <span>&gt;</span>
          <span>Messages</span>
          <span>&gt;</span>
          <span className="text-slate-600">Team Inbox</span>
        </div>
        <div className="flex-1 flex overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
        <ConversationList conversations={filteredConversations} conversationsLoading={conversationsLoading} searchQuery={searchQuery} onSearchChange={setSearchQuery} filterTab={filterTab} onFilterTabChange={setFilterTab} selectedConversation={selectedConversation} onSelectConversation={setSelectedConversation} user={user} pinnedIds={pinnedIds} pinOrder={pinOrder} onTogglePin={handleTogglePin}/>

        {selectedConversation ? (<MessageThread selectedConversation={selectedConversation} messages={messages} messagesLoading={messagesLoading} isTyping={isTyping} typingUser={typingUser} user={user} messageText={messageText} onTyping={handleTyping} onSendMessage={handleSendMessage} onFileAttachment={handleFileAttachment} onFileChange={handleFileChange} onSelectTemplate={handleSelectTemplate} is24HourWindowExpired={is24HourWindowExpired} activeChannelId={activeChannel?.id} sendMessagePending={sendMessageMutation.isPending} fileInputRef={fileInputRef} messagesEndRef={messagesEndRef} onBack={() => setSelectedConversation(null)} onUpdateStatus={updateConversationStatus} onViewContact={handleViewContact} onBlockContact={handleBlockContact} onDeleteChat={handleDeleteChat} hasMoreMessages={hasMoreMessages} onLoadMoreMessages={loadOlderMessages} loadingMoreMessages={loadingOlderMessages} isPinned={pinnedIds.has(selectedConversation.id)} onTogglePin={handleTogglePin}/>) : (<div className="hidden md:flex flex-1 items-center justify-center bg-[#F8F9FB]">
              <div className="text-center px-6">
                <div className="h-16 w-16 rounded-2xl bg-blue-50 text-[#007BFF] flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8"/>
                </div>
                <h3 className="text-[15px] font-semibold text-slate-900 mb-1">
                  Select a conversation
                </h3>
                <p className="text-sm text-slate-500">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>)}
        </div>
      </div>


      {showMediaPreview && (<div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
    <div className="bg-white rounded-xl p-4 w-[500px] max-w-[95vw]">
      
      <img src={mediaPreviewUrl} alt="preview" className="w-full h-[350px] object-contain rounded-xl bg-gray-100"/>

      {/* <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Add a caption..."
              className="w-full border rounded-lg p-3 mt-4"
            /> */}


      <textarea value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} placeholder="Add a caption..." rows={3} className="w-full border border-slate-200 rounded-xl p-3 mt-4 resize-none focus:outline-none focus:ring-2 focus:ring-[#007BFF]"/>

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={() => {
                setShowMediaPreview(false);
                setSelectedMediaFile(null);
                setMediaPreviewUrl("");
            }} className="px-4 py-2 border rounded-lg">
          Cancel
        </button>

       <button onClick={handleSendMediaMessage} disabled={sendingMedia} className="px-5 py-2 bg-[#007BFF] hover:bg-[#0069d9] text-white rounded-xl disabled:opacity-50 border-transparent">
  {sendingMedia ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  </div>)}
    </div>);
}
