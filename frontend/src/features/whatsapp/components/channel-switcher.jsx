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
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@wa/components/ui/select";
import { Button } from "@wa/components/ui/button";
import { Plus, Phone, Check, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { useToast } from "@wa/hooks/use-toast";
import { apiRequest } from "@wa/lib/queryClient";
import { useChannelContext } from "@wa/contexts/channel-context";
import { useAuth } from "@wa/contexts/auth-context";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, } from "@wa/components/ui/dialog";
import { Label } from "@wa/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from "@wa/components/ui/tooltip";
export function ChannelSwitcher() {
    const [selectedChannelId, setSelectedChannelId] = useState(null);
    const [page, setPage] = useState(1);
    const limit = 100;
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { setSelectedChannel } = useChannelContext();
    const { user } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [showHealthWarning, setShowHealthWarning] = useState(false);
    const [healthError, setHealthError] = useState("");
    const [healthWarningChannel, setHealthWarningChannel] = useState("");
    const [channelHealthMap, setChannelHealthMap] = useState({});
    const [checkingHealthForId, setCheckingHealthForId] = useState(null);
    const healthCheckCounter = useRef(0);
    const userIdNew = user?.role === "team" ? user?.createdBy : user?.id;
    const { data: response, isLoading } = useQuery({
        queryKey: ["/api/whatsapp/channels", page],
        queryFn: async () => {
            const res = await apiRequest("POST", "/api/whatsapp/channels/userid", {
                userId: userIdNew,
                page,
                limit,
            });
            return res.json();
        },
        placeholderData: (prev) => prev,
    });
    const channels = Array.isArray(response?.data)
        ? response.data
        : [];
    const totalPages = response?.totalPages || 1;
    const { data: activeChannel, isLoading: isActiveChannelLoading } = useQuery({
        queryKey: ["/api/whatsapp/channels/active"],
        queryFn: async () => {
            const response = await apiRequest("GET", "/api/whatsapp/channels/active");
            if (!response.ok)
                return null;
            return await response.json();
        },
    });
    const checkChannelHealth = useCallback(async (channelId, channelName, showModal) => {
        const requestId = ++healthCheckCounter.current;
        try {
            setCheckingHealthForId(channelId);
            const res = await apiRequest("POST", `/api/whatsapp/channels/${channelId}/health`);
            const data = await res.json();
            if (healthCheckCounter.current !== requestId)
                return;
            setChannelHealthMap(prev => ({ ...prev, [channelId]: data.status }));
            if (data.status === "error") {
                const errorMsg = data.error || "Access token is expired or invalid. Please reconnect this channel.";
                const safeName = channelName || "Unknown Channel";
                if (showModal) {
                    setHealthError(errorMsg);
                    setHealthWarningChannel(safeName);
                    setShowHealthWarning(true);
                }
                toast({
                    title: "Channel Connection Issue",
                    description: `${safeName}: Token expired or invalid. Please reconnect.`,
                    variant: "destructive",
                    duration: 8000,
                });
            }
        }
        catch (err) {
            if (healthCheckCounter.current !== requestId)
                return;
            setChannelHealthMap(prev => ({ ...prev, [channelId]: "error" }));
        }
        finally {
            if (healthCheckCounter.current === requestId) {
                setCheckingHealthForId(null);
            }
        }
    }, [toast]);
    useEffect(() => {
        if (channels.length > 0) {
            const initialHealthMap = {};
            channels.forEach(ch => {
                if (ch.healthStatus) {
                    initialHealthMap[ch.id] = ch.healthStatus;
                }
            });
            setChannelHealthMap(prev => ({ ...initialHealthMap, ...prev }));
        }
    }, [channels]);
    useEffect(() => {
        if (activeChannel) {
            setSelectedChannelId(activeChannel.id);
            setSelectedChannel(activeChannel);
            const name = activeChannel.name || activeChannel.phoneNumber || "Unknown";
            checkChannelHealth(activeChannel.id, name, false);
        }
        else if (!isActiveChannelLoading && channels.length === 0) {
            setShowModal(true);
        }
        else if (!isActiveChannelLoading && channels.length > 0) {
            handleChannelChange(channels[0].id);
        }
    }, [activeChannel, isActiveChannelLoading, setSelectedChannel, checkChannelHealth]);
    useEffect(() => {
        const channel = channels.find((c) => c.id === selectedChannelId);
        if (channel) {
            setSelectedChannel(channel);
        }
    }, [selectedChannelId, channels, setSelectedChannel]);
    const updateChannelMutation = useMutation({
        mutationFn: async ({ id, isActive }) => {
            if (isActive) {
                await Promise.all(channels.map(async (channel) => {
                    await apiRequest("PUT", `/api/whatsapp/channels/${channel.id}`, {
                        isActive: false,
                    });
                }));
            }
            const res = await apiRequest("PUT", `/api/whatsapp/channels/${id}`, { isActive });
            if (!res.ok)
                throw new Error("Failed to update channel");
            return res.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey[0];
                    return typeof key === "string" && key.startsWith("/api/whatsapp/");
                },
            });
            toast({
                title: "Channel switched",
                description: "Active channel has been updated. All data refreshed.",
            });
        },
    });
    const handleChannelChange = (channelId) => {
        setSelectedChannelId(channelId);
        updateChannelMutation.mutate({ id: channelId, isActive: true });
        const channel = channels.find(c => c.id === channelId);
        if (channel) {
            checkChannelHealth(channelId, channel.name || channel.phoneNumber || channelId, true);
        }
    };
    const getHealthDot = (channelId) => {
        const status = channelHealthMap[channelId];
        if (status === "healthy") {
            return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Connected"/>;
        }
        else if (status === "warning") {
            return <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0 animate-pulse" title="Warning"/>;
        }
        else if (status === "error") {
            return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" title="Token expired or invalid"/>;
        }
        return <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" title="Unknown"/>;
    };
    if (isLoading || isActiveChannelLoading) {
        return <div className="w-full h-9 bg-gray-100 animate-pulse rounded"/>;
    }
    return (<div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={selectedChannelId || ""} onValueChange={handleChannelChange}>
          <SelectTrigger className="flex-1 min-w-0">
            <SelectValue placeholder="Select channel">
              {selectedChannelId &&
            channels.find((c) => c.id === selectedChannelId) ? (<div className="flex items-center gap-2">
                  {getHealthDot(selectedChannelId)}
                  <Phone className="w-3.5 h-3.5 flex-shrink-0 text-green-600"/>
                  <span className="truncate text-sm">
                    {channels.find((c) => c.id === selectedChannelId)?.name}
                  </span>
                  {checkingHealthForId === selectedChannelId && (<Loader2 className="w-3 h-3 animate-spin text-gray-400"/>)}
                </div>) : ("Select channel")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => (<SelectItem key={channel.id} value={channel.id}>
                <div className="flex items-center gap-2">
                  {getHealthDot(channel.id)}
                  <Phone className="w-3.5 h-3.5 text-green-600"/>
                  <span>{channel.name}</span>
                  {channelHealthMap[channel.id] === "error" && (<AlertTriangle className="w-3 h-3 text-red-500 ml-1"/>)}
                  {channel.id === selectedChannelId && (<Check className="w-3 h-3 text-green-600 ml-auto"/>)}
                </div>
              </SelectItem>))}
          </SelectContent>
        </Select>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" onClick={() => setLocation("~/settings")} className="h-9 w-9 flex-shrink-0 border-dashed border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700">
                <Plus className="w-4 h-4"/>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Add new WhatsApp channel</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {totalPages > 1 && (<div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
            Previous
          </Button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
            Next
          </Button>
        </div>)}

      {showModal && (<Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>No Channel Selected</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Label>Please select a channel to continue</Label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Close
              </Button>
              <Button onClick={() => {
                if (channels.length > 0) {
                    handleChannelChange(channels[0].id);
                }
                setShowModal(false);
            }}>Okay</Button>
            </div>
          </DialogContent>
        </Dialog>)}

      {showHealthWarning && (<Dialog open={showHealthWarning} onOpenChange={setShowHealthWarning}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-full">
                  <ShieldAlert className="w-6 h-6 text-red-600"/>
                </div>
                <DialogTitle className="text-red-700">Channel Connection Issue</DialogTitle>
              </div>
              <DialogDescription className="text-gray-600">
                There's a problem with the connection for channel <strong className="text-gray-900">{healthWarningChannel}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium">Error Details:</p>
                <p className="text-sm text-red-700 mt-1">{healthError}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>What to do:</strong> Go to Settings and reconnect this channel to refresh the access token.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowHealthWarning(false)}>
                Dismiss
              </Button>
              <Button variant="destructive" onClick={() => {
                setShowHealthWarning(false);
                setLocation("~/settings");
            }}>
                Go to Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>)}
    </div>);
}
