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

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@wa/components/ui/button";
import { Input } from "@wa/components/ui/input";
import { Label } from "@wa/components/ui/label";
import { Textarea } from "@wa/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wa/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@wa/components/ui/dialog";
import { useToast } from "@wa/hooks/use-toast";
import {
  Camera,
  Upload,
  Loader2,
  Building2,
  Globe,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
  User,
  AlignLeft,
} from "lucide-react";
import { apiRequest, apiRequestFormData } from "@wa/lib/queryClient";

const BUSINESS_VERTICALS = [
  { value: "AUTOMOTIVE", label: "Automotive" },
  { value: "BEAUTY", label: "Beauty, Spa and Salon" },
  { value: "CLOTHING", label: "Clothing and Apparel" },
  { value: "EDU", label: "Education" },
  { value: "ENTERTAIN", label: "Entertainment" },
  { value: "EVENT_PLAN", label: "Event Planning" },
  { value: "FINANCE", label: "Finance and Banking" },
  { value: "GROCERY", label: "Grocery and Supermarket" },
  { value: "GOVT", label: "Government" },
  { value: "HOTEL", label: "Hotel and Lodging" },
  { value: "HEALTH", label: "Health and Medical" },
  { value: "NONPROFIT", label: "Non-profit" },
  { value: "PROF_SERVICES", label: "Professional Services" },
  { value: "RETAIL", label: "Retail" },
  { value: "TRAVEL", label: "Travel and Transportation" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "NOT_A_BIZ", label: "Not a Business" },
  { value: "OTHER", label: "Other" },
];

interface BusinessProfileEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
  channelName?: string;
  verifiedName?: string;
  onOpenDisplayName?: () => void;
}

const inputClass =
  "h-10 rounded-md border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#007BFF] focus-visible:ring-offset-0 focus-visible:border-[#007BFF]";

export function BusinessProfileEditor({
  open,
  onOpenChange,
  channelId,
  channelName,
  verifiedName,
  onOpenDisplayName,
}: BusinessProfileEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    about: "",
    address: "",
    description: "",
    email: "",
    websites: [] as string[],
    vertical: "",
  });
  const [websiteInput, setWebsiteInput] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: [`/api/whatsapp/channels/${channelId}/profile`],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/channels/${channelId}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!channelId && open,
  });

  const { data: displayNameData } = useQuery({
    queryKey: ["/api/whatsapp/channels", channelId, "display-name"],
    queryFn: async () => {
      if (!channelId) return null;
      const res = await apiRequest("GET", `/api/whatsapp/channels/${channelId}/display-name`);
      return await res.json();
    },
    enabled: !!channelId && open,
    refetchOnWindowFocus: false,
  });

  const currentVerifiedName = displayNameData?.verified_name || verifiedName;

  useEffect(() => {
    if (profile) {
      setFormData({
        about: profile.about || "",
        address: profile.address || "",
        description: profile.description || "",
        email: profile.email || "",
        websites: profile.websites || [],
        vertical: profile.vertical || "",
      });
      if (profile.profile_picture_url) {
        setPhotoPreview(profile.profile_picture_url);
      }
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/whatsapp/channels/${channelId}/profile`, data);
      return res.json();
    },
    onSuccess: () => {
      setPermissionError(false);
      toast({ title: "Profile updated", description: "Your WhatsApp Business Profile has been updated." });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/channels/${channelId}/profile`] });
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to update profile";
      if (msg.toLowerCase().includes("permission") || msg.includes("whatsapp_business_management")) {
        setPermissionError(true);
      }
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    },
  });

  const handlePhotoUpload = async (file: File) => {
    if (!channelId) return;

    setUploadingPhoto(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append("photo", file);

      const res = await apiRequestFormData("POST", `/api/whatsapp/channels/${channelId}/profile/photo`, formDataObj);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setPhotoPreview(URL.createObjectURL(file));
      setPermissionError(false);
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/channels/${channelId}/profile`] });
      toast({ title: "Photo uploaded", description: "Your profile photo has been updated." });
    } catch (err: any) {
      const msg = err.message || "Upload failed";
      if (msg.toLowerCase().includes("permission") || msg.includes("whatsapp_business_management")) {
        setPermissionError(true);
      }
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = () => {
    const data: any = {};
    if (formData.about.trim()) data.about = formData.about.trim();
    if (formData.description.trim()) data.description = formData.description.trim();
    if (formData.address.trim()) data.address = formData.address.trim();
    if (formData.email.trim()) data.email = formData.email.trim();
    if (formData.vertical) data.vertical = formData.vertical;
    const validWebsites = formData.websites.filter((w) => w.trim());
    if (validWebsites.length > 0) data.websites = validWebsites;

    if (Object.keys(data).length === 0) {
      toast({ title: "Nothing to save", description: "Please fill in at least one field.", variant: "destructive" });
      return;
    }
    updateMutation.mutate(data);
  };

  const addWebsite = () => {
    const url = websiteInput.trim();
    if (url && formData.websites.length < 2) {
      setFormData((prev) => ({ ...prev, websites: [...prev.websites, url] }));
      setWebsiteInput("");
    }
  };

  const updateWebsite = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      websites: prev.websites.map((w, i) => (i === index ? value : w)),
    }));
  };

  const removeWebsite = (index: number) => {
    setFormData((prev) => ({ ...prev, websites: prev.websites.filter((_, i) => i !== index) }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-xl border-slate-200">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1.5 text-left border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <FileText className="h-5 w-5 text-[#007BFF]" />
            Business Profile
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Edit the WhatsApp Business Profile for {channelName || "this channel"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          {permissionError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700 space-y-1">
                  <p className="font-medium">Permission Required</p>
                  <p>
                    Your access token is missing the <strong>whatsapp_business_management</strong> permission needed to
                    update the Business Profile.
                  </p>
                  <p>
                    To fix this: Go to your Meta Business Manager → System Users → Generate a new token with both{" "}
                    <strong>whatsapp_business_messaging</strong> and <strong>whatsapp_business_management</strong>{" "}
                    permissions, then update the channel&apos;s access token.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Display Name
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={currentVerifiedName || "Not available"}
                    readOnly
                    className={`${inputClass} bg-slate-50 text-slate-600 cursor-not-allowed`}
                  />
                  {onOpenDisplayName && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 shrink-0 text-[#007BFF] border-blue-200 hover:bg-blue-50 shadow-none"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenDisplayName();
                      }}
                    >
                      Change
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  To change your display name, click <strong className="text-slate-600">Change</strong> to submit a
                  request for Meta review.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-[72px] h-[72px] rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-[#007BFF] text-white rounded-full flex items-center justify-center hover:bg-[#0069d9] transition-colors border-2 border-white"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                    }}
                  />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-slate-800">Profile Photo</p>
                  <p className="text-slate-400 text-xs mt-0.5">JPEG or PNG, max 5MB</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="about" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  About
                </Label>
                <Input
                  id="about"
                  value={formData.about}
                  onChange={(e) => setFormData((prev) => ({ ...prev, about: e.target.value }))}
                  placeholder="Brief description of your business"
                  maxLength={139}
                  className={inputClass}
                />
                <p className="text-xs text-slate-400">{formData.about.length}/139 characters</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <AlignLeft className="w-3.5 h-3.5 text-slate-500" />
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of your business"
                  maxLength={512}
                  rows={3}
                  className="min-h-[88px] rounded-md border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#007BFF] focus-visible:ring-offset-0 focus-visible:border-[#007BFF]"
                />
                <p className="text-xs text-slate-400">{formData.description.length}/512 characters</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  Address
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Your business address"
                  maxLength={256}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@yourbusiness.com"
                  maxLength={128}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  Websites (max 2)
                </Label>
                {formData.websites.map((url, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={url}
                      onChange={(e) => updateWebsite(index, e.target.value)}
                      className={`flex-1 ${inputClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeWebsite(index)}
                      className="text-sm text-red-500 hover:text-red-600 shrink-0 px-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {formData.websites.length < 2 && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={websiteInput}
                      onChange={(e) => setWebsiteInput(e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className={`flex-1 ${inputClass}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addWebsite();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addWebsite}
                      disabled={!websiteInput.trim()}
                      className="h-10 border-slate-200 shadow-none"
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vertical" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Industry
                </Label>
                <Select
                  value={formData.vertical}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, vertical: val }))}
                >
                  <SelectTrigger className={`h-10 ${inputClass}`}>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_VERTICALS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 gap-2 sm:gap-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 bg-white border-slate-200 text-slate-700 shadow-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending || isLoading}
            className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent shadow-none"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Save Profile
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
