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
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/shared/lib/queryClient";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { History, RotateCcw, ChevronDown, ChevronRight, FileText, Clock, AlertCircle, } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from "@/shared/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, } from "@/shared/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/shared/components/ui/alert-dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/hooks/use-toast";
export default function AgentVersionHistory({ agentId, agentName }) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [expandedVersions, setExpandedVersions] = useState(new Set());
    const [rollbackVersion, setRollbackVersion] = useState(null);
    const { data: versions = [], isLoading } = useQuery({
        queryKey: ["/api/agents", agentId, "versions"],
        queryFn: async () => {
            const authHeader = AuthStorage.getAuthHeader();
            const headers = {};
            if (authHeader) {
                headers["Authorization"] = authHeader;
            }
            const response = await fetch(`/api/agents/${agentId}/versions`, {
                headers,
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || "Failed to load versions");
            }
            return response.json();
        },
        enabled: isOpen,
    });
    const rollbackMutation = useMutation({
        mutationFn: async (versionNumber) => {
            return apiRequest("POST", `/api/agents/${agentId}/versions/${versionNumber}/rollback`);
        },
        onSuccess: () => {
            toast({
                title: t("agentVersions.rollbackSuccess", "Version Restored"),
                description: t("agentVersions.rollbackSuccessDesc", "Agent has been reverted to the selected version."),
            });
            queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "versions"] });
            setRollbackVersion(null);
        },
        onError: (error) => {
            toast({
                title: t("agentVersions.rollbackError", "Rollback Failed"),
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const toggleExpand = (versionNumber) => {
        const newExpanded = new Set(expandedVersions);
        if (newExpanded.has(versionNumber)) {
            newExpanded.delete(versionNumber);
        }
        else {
            newExpanded.add(versionNumber);
        }
        setExpandedVersions(newExpanded);
    };
    const formatFieldName = (field) => {
        return field
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
    };
    const renderSnapshotValue = (key, value) => {
        if (value === null || value === undefined) {
            return <span className="text-muted-foreground italic">Not set</span>;
        }
        if (typeof value === "boolean") {
            return value ? (<Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">Yes</Badge>) : (<Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">No</Badge>);
        }
        if (Array.isArray(value)) {
            return value.length > 0 ? value.join(", ") : <span className="text-muted-foreground italic">None</span>;
        }
        if (key === "systemPrompt" || key === "firstMessage") {
            const text = String(value);
            return text.length > 100 ? `${text.substring(0, 100)}...` : text;
        }
        return String(value);
    };
    return (<>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700" data-testid="button-version-history">
            <History className="h-4 w-4"/>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden rounded-xl border border-slate-200 shadow-xl sm:max-w-lg">
          <DialogHeader className="space-y-1 px-6 pt-6 pb-4 text-left">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold text-slate-900">
              <History className="h-5 w-5 text-slate-800 shrink-0"/>
              {t("agentVersions.historyTitle", "Version History")}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 pl-7">
              {t("agentVersions.historyDesc", "View and restore previous versions of {{agentName}}", { agentName })}
            </DialogDescription>
          </DialogHeader>

          <div className="border-t border-slate-100"/>

          <ScrollArea className="max-h-[50vh]">
            <div className="px-6 py-8 min-h-[240px] flex flex-col justify-center">
              {isLoading ? (<div className="space-y-4">
                  {[1, 2, 3].map((i) => (<div key={i} className="space-y-2">
                      <Skeleton className="h-6 w-40"/>
                      <Skeleton className="h-4 w-full"/>
                      <Skeleton className="h-4 w-3/4"/>
                    </div>))}
                </div>) : versions.length === 0 ? (<div className="flex flex-col items-center justify-center text-center px-4">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                    <History className="h-9 w-9 text-slate-400" strokeWidth={1.5}/>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {t("agentVersions.noVersions", "No Version History")}
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                    {t("agentVersions.noVersionsDesc", "Version history will appear here when you make changes to this agent.")}
                  </p>
                </div>) : (<div className="space-y-3">
                  {versions.map((version, index) => (<Collapsible key={version.id} open={expandedVersions.has(version.versionNumber)} onOpenChange={() => toggleExpand(version.versionNumber)}>
                      <div className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50/80 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <CollapsibleTrigger asChild>
                            <button className="flex items-start gap-3 text-left flex-1" data-testid={`version-${version.versionNumber}`}>
                              <div className="mt-0.5">
                                {expandedVersions.has(version.versionNumber) ? (<ChevronDown className="h-4 w-4 text-muted-foreground"/>) : (<ChevronRight className="h-4 w-4 text-muted-foreground"/>)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="secondary">v{version.versionNumber}</Badge>
                                  {index === 0 && (<Badge variant="default" className="bg-[#2F6BFF]">
                                      {t("agentVersions.latest", "Latest")}
                                    </Badge>)}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3"/>
                                    {format(new Date(version.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                  </span>
                                </div>
                                {version.changesSummary && (<p className="text-sm mt-2">{version.changesSummary}</p>)}
                                {version.changedFields && version.changedFields.length > 0 && (<div className="flex gap-1 flex-wrap mt-2">
                                    {version.changedFields.map((field) => (<Badge key={field} variant="outline" className="text-xs">
                                        {formatFieldName(field)}
                                      </Badge>))}
                                  </div>)}
                              </div>
                            </button>
                          </CollapsibleTrigger>

                          {index > 0 && (<Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={(e) => {
                        e.stopPropagation();
                        setRollbackVersion(version);
                    }} data-testid={`button-rollback-${version.versionNumber}`}>
                              <RotateCcw className="h-3 w-3"/>
                              {t("agentVersions.restore", "Restore")}
                            </Button>)}
                        </div>

                        <CollapsibleContent className="mt-4">
                          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                              <FileText className="h-4 w-4"/>
                              {t("agentVersions.snapshot", "Configuration Snapshot")}
                            </h4>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              {Object.entries(version.snapshot).map(([key, value]) => {
                    if (key === "config" || key === "type")
                        return null;
                    return (<div key={key} className="flex flex-col">
                                    <span className="text-muted-foreground text-xs">
                                      {formatFieldName(key)}
                                    </span>
                                    <span className="truncate">
                                      {renderSnapshotValue(key, value)}
                                    </span>
                                  </div>);
                })}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>))}
                </div>)}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4 sm:justify-end">
            <Button onClick={() => setIsOpen(false)} className="bg-[#2F6BFF] hover:bg-[#2558d9] text-white border-transparent px-5" data-testid="button-version-history-done">
              {t("common.done", "Done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rollbackVersion} onOpenChange={(open) => !open && setRollbackVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500"/>
              {t("agentVersions.confirmRollback", "Restore Previous Version?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("agentVersions.confirmRollbackDesc", "This will restore the agent to version {{version}}. Your current configuration will be saved as a new version before the restore.", { version: rollbackVersion?.versionNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-rollback">
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => rollbackVersion && rollbackMutation.mutate(rollbackVersion.versionNumber)} disabled={rollbackMutation.isPending} className="bg-primary text-primary-foreground" data-testid="button-confirm-rollback">
              {rollbackMutation.isPending
            ? t("agentVersions.restoring", "Restoring...")
            : t("agentVersions.confirmRestore", "Yes, Restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);
}
