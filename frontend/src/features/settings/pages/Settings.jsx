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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2, User, Building, Shield, Calendar, Clock, Globe } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/shared/lib/queryClient";
import { useToast } from "@/shared/hooks/use-toast";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { COMMON_TIMEZONES, getDetectedTimezone, timezoneExistsInList, formatTimeInTimezone, } from "@/shared/lib/timezones";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/shared/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/shared/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/shared/components/ui/select";
function TimezoneCurrentTime({ timezone }) {
    const { t } = useTranslation();
    const [currentTime, setCurrentTime] = useState(() => new Date());
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);
    return (<div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
      <Clock className="h-4 w-4 text-slate-500"/>
      <span className="text-sm text-slate-600">
        {t("settings.currentTimeIn", { timezone })} {formatTimeInTimezone(currentTime, timezone)}
      </span>
    </div>);
}
export default function Settings() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [deletePassword, setDeletePassword] = useState("");
    const [timezone, setTimezone] = useState("");
    const detectedTimezone = useMemo(() => getDetectedTimezone(), []);
    const { data: user, isLoading } = useQuery({
        queryKey: ["/api/auth/me"],
    });
    useEffect(() => {
        if (!user)
            return;
        setTimezone(user.timezone || "");
        if (user.firstName || user.lastName) {
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            return;
        }
        const parts = (user.name || "").split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
    }, [user]);
    const timezoneGroups = useMemo(() => {
        if (!timezone || timezoneExistsInList(timezone))
            return COMMON_TIMEZONES;
        return [{ region: "Current", zones: [{ value: timezone, label: timezone }] }, ...COMMON_TIMEZONES];
    }, [timezone]);
    const updateProfileMutation = useMutation({
        mutationFn: async (data) => {
            const res = await apiRequest("PATCH", "/api/auth/me", data);
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to update profile");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: t("settings.profileUpdated"),
                description: t("settings.profileUpdatedDescription"),
            });
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        },
        onError: (error) => {
            toast({
                title: t("settings.updateFailed"),
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const updateTimezoneMutation = useMutation({
        mutationFn: async (nextTimezone) => {
            const res = await apiRequest("PATCH", "/api/auth/me", { timezone: nextTimezone });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to save timezone");
            }
            return res.json();
        },
        onSuccess: (data) => {
            const stored = AuthStorage.getUser();
            if (stored && data?.user) {
                AuthStorage.setUser({ ...stored, timezone: data.user.timezone });
            }
            toast({
                title: t("settings.timezone.saved"),
                description: t("settings.timezone.savedDesc"),
            });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        },
        onError: (error) => {
            toast({
                title: t("settings.timezone.saveFailed"),
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const changePasswordMutation = useMutation({
        mutationFn: async (data) => {
            const res = await apiRequest("POST", "/api/auth/change-password", data);
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to change password");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: t("settings.passwordChanged"),
                description: t("settings.passwordChangedDescription"),
            });
            setIsPasswordModalOpen(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        },
        onError: (error) => {
            toast({
                title: t("settings.passwordChangeFailed"),
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const deleteAccountMutation = useMutation({
        mutationFn: async (password) => {
            const res = await apiRequest("POST", "/api/auth/delete-account", { password });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to delete account");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: t("settings.accountDeleted"),
                description: t("settings.accountDeletedDescription"),
            });
            AuthStorage.clearAuth();
            window.location.href = "/";
        },
        onError: (error) => {
            toast({
                title: t("settings.deleteAccountFailed"),
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const resetEdit = () => {
        if (user?.firstName || user?.lastName) {
            setFirstName(user?.firstName || "");
            setLastName(user?.lastName || "");
        }
        else {
            const parts = (user?.name || "").split(" ");
            setFirstName(parts[0] || "");
            setLastName(parts.slice(1).join(" ") || "");
        }
        setIsEditing(false);
    };
    const handleSave = () => {
        const fullName = `${firstName} ${lastName}`.trim();
        if (!fullName)
            return;
        updateProfileMutation.mutate({ name: fullName });
    };
    const handleSaveTimezone = () => {
        if (!timezone) {
            toast({
                title: t("settings.timezone.required"),
                description: t("settings.timezone.requiredDesc"),
                variant: "destructive",
            });
            return;
        }
        updateTimezoneMutation.mutate(timezone);
    };
    const handleUseDetectedTimezone = () => {
        if (!detectedTimezone)
            return;
        setTimezone(detectedTimezone);
        toast({
            title: t("settings.timezone.detected"),
            description: detectedTimezone,
        });
    };
    const handleChangePassword = () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast({
                title: t("settings.currentPasswordRequired"),
                variant: "destructive",
            });
            return;
        }
        if (newPassword.length < 8) {
            toast({
                title: t("settings.passwordTooShort"),
                variant: "destructive",
            });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({
                title: t("settings.passwordsDoNotMatch"),
                variant: "destructive",
            });
            return;
        }
        changePasswordMutation.mutate({ currentPassword, newPassword });
    };
    if (isLoading) {
        return (<div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin"/>
      </div>);
    }
    const username = user?.username || user?.email?.split("@")[0] || "";
    const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleString() : "N/A";
    return (<div className="space-y-6">
      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center text-[17px] font-semibold">
            <User className="w-5 h-5 mr-2"/>
            Account Information
          </CardTitle>
          <CardDescription>Manage your account details and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!isEditing} data-testid="input-first-name"/>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!isEditing} data-testid="input-last-name"/>
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center">
                <Building className="w-4 h-4 mr-2"/>
                Username
              </Label>
              <Input id="username" value={username} disabled data-testid="input-username"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center">
                <Building className="w-4 h-4 mr-2"/>
                Email
              </Label>
              <Input id="email" value={user?.email || ""} disabled data-testid="input-email"/>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center">
                <Shield className="w-4 h-4 mr-2"/>
                Role
              </Label>
              <Input value={user?.role || ""} disabled className="bg-slate-50" data-testid="input-role"/>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-slate-500 flex items-center">
              <Calendar className="w-4 h-4 mr-2"/>
              Member since {memberSince}
            </div>
            <div className="space-x-2">
              {isEditing ? (<>
                  <Button variant="outline" onClick={resetEdit} disabled={updateProfileMutation.isPending}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updateProfileMutation.isPending || !firstName.trim()} data-testid="button-save-profile">
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </>) : (<Button onClick={() => setIsEditing(true)} data-testid="button-edit-account">
                  Edit Account
                </Button>)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center text-[17px] font-semibold">
            <Clock className="w-5 h-5 mr-2"/>
            Timezone Settings
          </CardTitle>
          <CardDescription>{t("settings.timezoneDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {timezone ? <TimezoneCurrentTime timezone={timezone}/> : null}

          <div className="space-y-2">
            <Label htmlFor="profile-timezone-select">{t("settings.timezone.label")}</Label>
            <Select value={timezone || undefined} onValueChange={setTimezone}>
              <SelectTrigger id="profile-timezone-select" className="w-full" data-testid="select-profile-timezone">
                <SelectValue placeholder={t("settings.timezone.placeholder")}/>
              </SelectTrigger>
              <SelectContent>
                {timezoneGroups.map((group) => (<div key={group.region}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                      {group.region}
                    </div>
                    {group.zones.map((tz) => (<SelectItem key={tz.value} value={tz.value} data-testid={`timezone-option-${tz.value.replace(/\//g, "-")}`}>
                        {tz.label}
                      </SelectItem>))}
                  </div>))}
              </SelectContent>
            </Select>
          </div>

          {detectedTimezone && (<Button type="button" variant="outline" size="sm" onClick={handleUseDetectedTimezone} data-testid="button-detect-profile-timezone">
              <Globe className="h-4 w-4 mr-2"/>
              {t("settings.timezone.useDetected")}: {detectedTimezone}
            </Button>)}

          <div className="flex justify-end pt-2 border-t">
            <Button onClick={handleSaveTimezone} disabled={!timezone || timezone === (user?.timezone || "") || updateTimezoneMutation.isPending} data-testid="button-save-timezone">
              {updateTimezoneMutation.isPending ? (<>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                  Saving...
                </>) : ("Save Timezone")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-[17px] font-semibold">Security</CardTitle>
          <CardDescription>Manage your security preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Change Password</h4>
              <p className="text-sm text-slate-500">Update your account password</p>
            </div>
            <Button variant="outline" onClick={() => setIsPasswordModalOpen(true)} data-testid="button-change-password">
              Change
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-[17px] font-semibold text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Delete Account</h4>
              <p className="text-sm text-slate-500">Permanently delete your account and all data</p>
            </div>
            <AlertDialog onOpenChange={(open) => {
            if (!open)
                setDeletePassword("");
        }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-delete-account">
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes your account and all data. Enter your password to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input type="password" placeholder="Your password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} data-testid="input-delete-password"/>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteAccountMutation.mutate(deletePassword)} disabled={deleteAccountMutation.isPending || !deletePassword}>
                    {deleteAccountMutation.isPending ? "Deleting..." : "Yes, delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" type="password" className="mt-3" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} data-testid="input-current-password"/>
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" className="mt-3" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="input-new-password"/>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" className="mt-3" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} data-testid="input-confirm-password"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)} disabled={changePasswordMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={changePasswordMutation.isPending} data-testid="button-update-password">
              {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
