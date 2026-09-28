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
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient, apiRequest } from "@/shared/lib/queryClient";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";
import { Globe, Clock, Loader2 } from "lucide-react";
import { COMMON_TIMEZONES, getDetectedTimezone } from "@/shared/lib/timezones";
export function TimezoneEnforcementModal({ open, onOpenChange, onSuccess }) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [selectedTimezone, setSelectedTimezone] = useState("");
    const detectedTimezone = useMemo(() => getDetectedTimezone(), []);
    const saveTimezoneMutation = useMutation({
        mutationFn: async (timezone) => {
            const res = await apiRequest("PATCH", "/api/auth/me", { timezone });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            toast({
                title: t("settings.timezone.saved", "Timezone saved"),
                description: t("settings.timezone.savedDesc", "Your timezone has been saved successfully."),
            });
            onSuccess();
            onOpenChange(false);
        },
        onError: (error) => {
            toast({
                title: t("settings.timezone.saveFailed", "Failed to save timezone"),
                description: error.message || t("common.tryAgain", "Please try again."),
                variant: "destructive",
            });
        },
    });
    const handleSave = () => {
        if (!selectedTimezone) {
            toast({
                title: t("settings.timezone.required", "Timezone required"),
                description: t("settings.timezone.requiredDesc", "Please select your timezone to continue."),
                variant: "destructive",
            });
            return;
        }
        saveTimezoneMutation.mutate(selectedTimezone);
    };
    const handleDetectTimezone = () => {
        if (detectedTimezone) {
            setSelectedTimezone(detectedTimezone);
            toast({
                title: t("settings.timezone.detected", "Timezone detected"),
                description: detectedTimezone,
            });
        }
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-timezone-enforcement">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-timezone-modal-title">
            <Globe className="h-5 w-5 text-primary"/>
            {t("settings.timezone.setupTitle", "Set Your Timezone")}
          </DialogTitle>
          <DialogDescription data-testid="text-timezone-modal-description">
            {t("settings.timezone.setupDescription", "Your timezone is required to ensure calls are scheduled at the correct local time for your contacts. This helps avoid calling contacts at inconvenient hours.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground"/>
            <span className="text-sm text-muted-foreground">
              {t("settings.timezone.currentTime", "Current time")}: {new Date().toLocaleTimeString()}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone-select">
              {t("settings.timezone.label", "Timezone")}
            </Label>
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger id="timezone-select" className="w-full" data-testid="select-timezone">
                <SelectValue placeholder={t("settings.timezone.placeholder", "Select your timezone")}/>
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((group) => (<div key={group.region}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                      {group.region}
                    </div>
                    {group.zones.map((tz) => (<SelectItem key={tz.value} value={tz.value} data-testid={`timezone-option-${tz.value.replace(/\//g, '-')}`}>
                        {tz.label}
                      </SelectItem>))}
                  </div>))}
              </SelectContent>
            </Select>
          </div>

          {detectedTimezone && (<Button type="button" variant="outline" size="sm" onClick={handleDetectTimezone} className="w-full" data-testid="button-detect-timezone">
              <Globe className="h-4 w-4 mr-2"/>
              {t("settings.timezone.useDetected", "Use detected timezone")}: {detectedTimezone}
            </Button>)}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={!selectedTimezone || saveTimezoneMutation.isPending} className="w-full sm:w-auto" data-testid="button-save-timezone">
            {saveTimezoneMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}
            {t("settings.timezone.continue", "Continue to Create Campaign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
