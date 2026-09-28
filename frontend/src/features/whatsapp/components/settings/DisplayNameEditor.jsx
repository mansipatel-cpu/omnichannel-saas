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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@wa/components/ui/button";
import { Input } from "@wa/components/ui/input";
import { Label } from "@wa/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@wa/components/ui/dialog";
import { useToast } from "@wa/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { apiRequest } from "@wa/lib/queryClient";
import { useSocket } from "@wa/contexts/socket-context";
function getNameStatusBadge(status) {
    if (!status)
        return null;
    switch (status) {
        case "APPROVED":
            return (<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-3 h-3"/>
          Approved
        </span>);
        case "AVAILABLE_WITHOUT_REVIEW":
            return (<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-3 h-3"/>
          Available
        </span>);
        case "PENDING_REVIEW":
            return (<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3"/>
          Pending Review
        </span>);
        case "DECLINED":
            return (<span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
          <XCircle className="w-3 h-3"/>
          Declined
        </span>);
        case "EXPIRED":
            return (<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
          <AlertTriangle className="w-3 h-3"/>
          Expired
        </span>);
        case "NONE":
            return (<span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 border border-slate-200">
          None
        </span>);
        default:
            return (<span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
          {status}
        </span>);
    }
}
export function DisplayNameEditor({ open, onOpenChange, channelId, channelName }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { socket } = useSocket();
    const [newDisplayName, setNewDisplayName] = useState("");
    const { data: displayNameData, isLoading, refetch, isFetching } = useQuery({
        queryKey: ["/api/whatsapp/channels", channelId, "display-name"],
        queryFn: async () => {
            if (!channelId)
                return null;
            const res = await apiRequest("GET", `/api/whatsapp/channels/${channelId}/display-name`);
            return await res.json();
        },
        enabled: !!channelId && open,
        refetchOnWindowFocus: false,
    });
    useEffect(() => {
        if (!open)
            setNewDisplayName("");
    }, [open]);
    useEffect(() => {
        if (!socket || !channelId)
            return;
        const handleDisplayNameUpdate = (data) => {
            if (data.channelId === channelId) {
                queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels", channelId, "display-name"] });
                queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
                toast({
                    title: "Display Name Updated",
                    description: `Name status changed to: ${data.name_status}${data.verified_name ? ` (${data.verified_name})` : ""}`,
                });
            }
        };
        socket.on("display_name_update", handleDisplayNameUpdate);
        return () => {
            socket.off("display_name_update", handleDisplayNameUpdate);
        };
    }, [socket, channelId, queryClient, toast]);
    const updateMutation = useMutation({
        mutationFn: async (displayName) => {
            const res = await apiRequest("POST", `/api/whatsapp/channels/${channelId}/display-name`, {
                display_name: displayName,
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to update display name");
            }
            return await res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Request Submitted",
                description: data.message || "Display name change request sent to Meta for review.",
            });
            setNewDisplayName("");
            refetch();
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
        },
        onError: (error) => {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const handleSubmit = () => {
        const trimmed = newDisplayName.trim();
        if (!trimmed)
            return;
        if (trimmed.length < 3 || trimmed.length > 512) {
            toast({
                title: "Invalid Name",
                description: "Display name must be between 3 and 512 characters.",
                variant: "destructive",
            });
            return;
        }
        updateMutation.mutate(trimmed);
    };
    const isPending = displayNameData?.name_status === "PENDING_REVIEW" || displayNameData?.new_name_status === "PENDING_REVIEW";
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 rounded-xl border-slate-200 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1.5 text-left">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#007BFF] text-lg font-bold leading-none">
              T
            </span>
            Display Name
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 pl-12">
            Manage the WhatsApp display name for {channelName || "this channel"}. Changes require Meta review (usually
            24-48 hours).
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-5">
          {isLoading ? (<div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400"/>
            </div>) : (<div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-slate-500">Current Display Name</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}/>
                  </Button>
                </div>

                <p className="text-lg font-semibold text-slate-900 leading-snug">
                  {displayNameData?.verified_name || (<span className="text-slate-400 italic font-normal">Not set</span>)}
                </p>

                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Status:</span>
                    {getNameStatusBadge(displayNameData?.name_status)}
                  </div>
                  {displayNameData?.new_name_status && displayNameData.new_name_status !== "NONE" && (<div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500">New Name:</span>
                      {getNameStatusBadge(displayNameData.new_name_status)}
                    </div>)}
                </div>

                {displayNameData?.display_phone_number && (<p className="text-sm text-slate-500">Phone: {displayNameData.display_phone_number}</p>)}
              </div>

              {isPending && (<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0"/>
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Name change pending review</p>
                    <p className="text-xs mt-0.5 text-amber-700">
                      Meta is reviewing your display name change. This usually takes 24-48 hours. The status will update
                      automatically once Meta completes the review.
                    </p>
                  </div>
                </div>)}

              <div className="space-y-2">
                <Label htmlFor="new-display-name" className="text-sm font-semibold text-slate-800">
                  Request New Display Name
                </Label>
                <Input id="new-display-name" placeholder="Enter new display name..." value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} maxLength={512} disabled={updateMutation.isPending || isPending} className="h-10 rounded-md border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#007BFF] focus-visible:ring-offset-0 focus-visible:border-[#007BFF]"/>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Must match your business branding and legal documents. No emojis or special characters. 3-512
                  characters. Up to 10 changes per 30 days.
                </p>
              </div>
            </div>)}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 border-slate-200 text-slate-700 hover:bg-slate-50 shadow-none">
            Close
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!newDisplayName.trim() || updateMutation.isPending || isLoading || isPending} className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white shadow-none">
            {updateMutation.isPending ? (<>
                <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                Submitting...
              </>) : ("Submit for Review")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
