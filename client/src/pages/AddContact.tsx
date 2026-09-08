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
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AuthStorage } from "@/lib/auth-storage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppHeader } from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Mail,
  Phone,
  MessageCircle,
  CheckCircle2,
  UserPlus,
} from "lucide-react";

const COUNTRY_CODES = [
  { code: "+1", label: "+1 (US/CA)", min: 10, max: 10 },
  { code: "+44", label: "+44 (UK)", min: 10, max: 10 },
  { code: "+91", label: "+91 (IN)", min: 10, max: 10 },
  { code: "+61", label: "+61 (AU)", min: 9, max: 9 },
  { code: "+49", label: "+49 (DE)", min: 10, max: 11 },
  { code: "+33", label: "+33 (FR)", min: 9, max: 9 },
  { code: "+971", label: "+971 (AE)", min: 8, max: 9 },
  { code: "+65", label: "+65 (SG)", min: 8, max: 8 },
  { code: "+81", label: "+81 (JP)", min: 10, max: 10 },
  { code: "+55", label: "+55 (BR)", min: 10, max: 11 },
];

function countryRule(code: string) {
  return COUNTRY_CODES.find((item) => item.code === code) || { code, label: code, min: 7, max: 15 };
}

interface WaChannel {
  id: string;
}

function authFetch(url: string) {
  const headers: Record<string, string> = {};
  const authHeader = AuthStorage.getAuthHeader();
  if (authHeader) headers.Authorization = authHeader;
  return fetch(url, { credentials: "include", headers });
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function sanitizePhoneInput(value: string, maxDigits: number) {
  let digits = 0;
  let next = "";
  for (const char of value) {
    if (/\d/.test(char)) {
      if (digits >= maxDigits) continue;
      digits += 1;
      next += char;
    } else if (/[\s()-]/.test(char)) {
      next += char;
    }
  }
  return next;
}

function phoneError(code: string, number: string, required = true) {
  const digits = digitsOnly(number);
  const rule = countryRule(code);
  if (!digits) return required ? "Phone number is required" : "";
  if (digits.length < rule.min) {
    return `Enter ${rule.min === rule.max ? rule.min : `${rule.min}–${rule.max}`} digits for ${rule.label}`;
  }
  if (digits.length > rule.max) {
    return `Use no more than ${rule.max} digits for ${rule.label}`;
  }
  return "";
}

function combinePhone(code: string, number: string) {
  return `${code}${digitsOnly(number)}`;
}

export default function AddContact() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setPageMeta } = useAppHeader();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [callingCode, setCallingCode] = useState("+1");
  const [callingNumber, setCallingNumber] = useState("");
  const [sameAsPrimary, setSameAsPrimary] = useState(false);
  const [waCode, setWaCode] = useState("+44");
  const [waNumber, setWaNumber] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: "Add New Contact",
      subtitle: "Add the contact list",
    });
    return () => setPageMeta(null);
  }, [setPageMeta]);

  useEffect(() => {
    if (!sameAsPrimary) return;
    setWaCode(callingCode);
    setWaNumber(callingNumber);
  }, [sameAsPrimary, callingCode, callingNumber]);

  useEffect(() => {
    setCallingNumber((current) => sanitizePhoneInput(current, countryRule(callingCode).max));
  }, [callingCode]);

  useEffect(() => {
    if (sameAsPrimary) return;
    setWaNumber((current) => sanitizePhoneInput(current, countryRule(waCode).max));
  }, [waCode, sameAsPrimary]);

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

  const callingError = phoneError(callingCode, callingNumber);
  const waError = phoneError(
    sameAsPrimary ? callingCode : waCode,
    sameAsPrimary ? callingNumber : waNumber
  );
  const waValid = !waError;

  const createMutation = useMutation({
    mutationFn: async () => {
      setShowErrors(true);
      const fullName = name.trim();
      const corporateEmail = email.trim();
      if (!fullName) throw new Error("Full name is required");
      if (!corporateEmail) throw new Error("Corporate email address is required");
      if (callingError) throw new Error(callingError);
      if (waError) throw new Error(waError);
      if (!activeChannel?.id) {
        throw new Error("Create a WhatsApp channel before adding contacts.");
      }

      const phone = combinePhone(
        sameAsPrimary ? callingCode : waCode,
        sameAsPrimary ? callingNumber : waNumber
      );

      const response = await apiRequest("POST", "/api/whatsapp/contacts", {
        name: fullName,
        email: corporateEmail,
        phone,
        channelId: activeChannel.id,
        source: "manual",
        groups: [],
        tags: sameAsPrimary ? ["calling"] : ["calling", "whatsapp-dedicated"],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      toast({ title: "Contact added" });
      setLocation("/contacts");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add contact",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <Link href="/dashboard" className="hover:text-slate-600">Dashboard</Link>
        <span>&gt;</span>
        <Link href="/contacts" className="hover:text-slate-600">Contact</Link>
        <span>&gt;</span>
        <span className="text-slate-600">Add Contact</span>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 bg-slate-50 border-b border-slate-100">
          <div className="h-10 w-10 rounded-full bg-blue-50 text-[#007BFF] flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">User Information</p>
            <p className="text-xs text-slate-500">Enter user identity and contact channels</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="add-contact-name">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="add-contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="James Thornton"
                className="h-11 pl-9 bg-white border-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-contact-email">
              Corporate Email Address <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="add-contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="james.thornton@enterprise.com"
                className="h-11 pl-9 bg-white border-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Primary / Calling Phone Number <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={callingCode} onValueChange={setCallingCode}>
                <SelectTrigger className="h-11 w-full sm:w-[160px] bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={callingNumber}
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={countryRule(callingCode).max + 6}
                  onChange={(e) => setCallingNumber(sanitizePhoneInput(e.target.value, countryRule(callingCode).max))}
                  placeholder="(555) 201-4832"
                  className={`h-11 pl-9 bg-white ${showErrors && callingError ? "border-red-400 focus-visible:ring-red-400" : "border-slate-200"}`}
                />
              </div>
            </div>
            {showErrors && callingError ? (
              <p className="text-xs text-red-500">{callingError}</p>
            ) : (
              <p className="text-xs text-slate-400">
                Enter {countryRule(callingCode).min === countryRule(callingCode).max
                  ? countryRule(callingCode).min
                  : `${countryRule(callingCode).min}–${countryRule(callingCode).max}`} digits for {countryRule(callingCode).label}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">WhatsApp Messaging Channel</p>
                  <p className="text-xs text-slate-500">Configure delivery for bot notifications and campaigns</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <Checkbox
                  checked={sameAsPrimary}
                  onCheckedChange={(checked) => setSameAsPrimary(checked === true)}
                />
                Same as Primary Phone
              </label>
            </div>

            <div className="space-y-1.5">
              <Label>Dedicated WhatsApp Number</Label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select
                  value={sameAsPrimary ? callingCode : waCode}
                  onValueChange={setWaCode}
                  disabled={sameAsPrimary}
                >
                  <SelectTrigger className="h-11 w-full sm:w-[160px] bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={sameAsPrimary ? callingNumber : waNumber}
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={countryRule(sameAsPrimary ? callingCode : waCode).max + 6}
                    onChange={(e) => setWaNumber(sanitizePhoneInput(e.target.value, countryRule(sameAsPrimary ? callingCode : waCode).max))}
                    placeholder="7911 842109"
                    disabled={sameAsPrimary}
                    className={`h-11 pl-9 pr-10 bg-white ${showErrors && waError ? "border-red-400 focus-visible:ring-red-400" : "border-slate-200"}`}
                  />
                  {waValid && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                  )}
                </div>
              </div>
              {showErrors && waError ? (
                <p className="text-xs text-red-500">{waError}</p>
              ) : (
                <p className="text-xs text-slate-400">
                  Enter {countryRule(sameAsPrimary ? callingCode : waCode).min === countryRule(sameAsPrimary ? callingCode : waCode).max
                    ? countryRule(sameAsPrimary ? callingCode : waCode).min
                    : `${countryRule(sameAsPrimary ? callingCode : waCode).min}–${countryRule(sameAsPrimary ? callingCode : waCode).max}`} digits for {countryRule(sameAsPrimary ? callingCode : waCode).label}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              className="h-10 bg-white border-slate-200"
              onClick={() => setLocation("/contacts")}
            >
              Cancel
            </Button>
            <Button
              className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-submit-add-contact"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {createMutation.isPending ? "Adding..." : "Add Contact"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
