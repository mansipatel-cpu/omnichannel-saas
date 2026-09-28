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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient, apiRequest } from "@/shared/lib/queryClient";
import { Phone, Check, Trash2, CreditCard, Link as LinkIcon, Smartphone, Video, Play } from "lucide-react";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { useDemoMode } from "@/shared/components/DemoModeBanner";
import { DataPagination, usePagination } from "@/shared/components/ui/data-pagination";
import { useToast } from "@/shared/hooks/use-toast";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/shared/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/shared/components/ui/alert-dialog";
const DEFAULT_MONTHLY_CREDITS = 50;
function normalizeContactPhone(phone) {
    let cleaned = phone.replace(/[\s\-().]/g, "");
    if (cleaned.startsWith("00"))
        cleaned = `+${cleaned.slice(2)}`;
    if (!cleaned.startsWith("+") && cleaned.length >= 10)
        cleaned = `+${cleaned}`;
    return cleaned;
}
function inferCountryFromPhone(phone) {
    if (phone.startsWith("+91"))
        return "IN";
    if (phone.startsWith("+44"))
        return "UK";
    if (phone.startsWith("+61"))
        return "AU";
    if (phone.startsWith("+49"))
        return "DE";
    if (phone.startsWith("+33"))
        return "FR";
    if (phone.startsWith("+971"))
        return "AE";
    if (phone.startsWith("+65"))
        return "SG";
    if (phone.startsWith("+81"))
        return "JP";
    if (phone.startsWith("+55"))
        return "BR";
    if (phone.startsWith("+1"))
        return "US";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))
        return "US";
    return "—";
}
export default function PhoneNumbers() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { isDemoMode } = useDemoMode();
    const [isVideoOpen, setIsVideoOpen] = useState(false);
    const [, setLocation] = useLocation();
    const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
    const [contactToRelease, setContactToRelease] = useState(null);
    const { data: publicSettings } = useQuery({
        queryKey: ["/api/settings/public"],
    });
    const MONTHLY_CREDITS = publicSettings?.phone_number_monthly_credits || DEFAULT_MONTHLY_CREDITS;
    const { data: voiceContacts = [], isLoading: voiceContactsLoading } = useQuery({
        queryKey: ["/api/contacts/deduplicated"],
    });
    const { data: waContacts = [], isLoading: waContactsLoading } = useQuery({
        queryKey: ["/api/whatsapp/contacts-all"],
        queryFn: async () => {
            try {
                const headers = {};
                const authHeader = AuthStorage.getAuthHeader();
                if (authHeader)
                    headers.Authorization = authHeader;
                const response = await fetch("/api/whatsapp/contacts-all", { credentials: "include", headers });
                if (!response.ok)
                    return [];
                const result = await response.json();
                return Array.isArray(result) ? result : result?.data || [];
            }
            catch {
                return [];
            }
        },
    });
    const contactNumbers = useMemo(() => {
        const map = new Map();
        for (const contact of voiceContacts) {
            const phone = normalizeContactPhone(contact.phone || "");
            if (!phone)
                continue;
            map.set(phone, {
                id: contact.id,
                phone,
                country: inferCountryFromPhone(phone),
                voiceId: contact.id,
                voiceSource: contact.source,
            });
        }
        for (const contact of waContacts) {
            const phone = normalizeContactPhone(contact.phone || "");
            if (!phone)
                continue;
            const existing = map.get(phone);
            if (existing) {
                existing.waId = contact.id;
                continue;
            }
            map.set(phone, {
                id: contact.id,
                phone,
                country: inferCountryFromPhone(phone),
                waId: contact.id,
            });
        }
        return Array.from(map.values());
    }, [voiceContacts, waContacts]);
    const contactNumbersLoading = voiceContactsLoading || waContactsLoading;
    const contactReleaseMutation = useMutation({
        mutationFn: async (contact) => {
            const tasks = [];
            if (contact.waId) {
                tasks.push(apiRequest("DELETE", `/api/whatsapp/contacts/${contact.waId}`));
            }
            if (contact.voiceId && contact.voiceSource === "campaign") {
                tasks.push(apiRequest("DELETE", `/api/contacts/${contact.voiceId}`));
            }
            if (tasks.length === 0) {
                throw new Error("This number cannot be released from Contacts.");
            }
            await Promise.all(tasks);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts-all"] });
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/contacts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
            setReleaseDialogOpen(false);
            setContactToRelease(null);
            toast({ title: t("phoneNumbers.toast.releaseSuccess") });
        },
        onError: (error) => {
            toast({
                title: t("phoneNumbers.toast.releaseFailed"),
                description: error.message || t("common.tryAgain"),
                variant: "destructive",
            });
        },
    });
    const handleReleaseNumber = () => {
        if (isDemoMode) {
            toast({
                title: "Demo Mode Active",
                description: "Releasing phone numbers is disabled in demo mode.",
                variant: "destructive",
            });
            return;
        }
        if (contactToRelease) {
            contactReleaseMutation.mutate(contactToRelease);
        }
    };
    const formatPhoneNumber = (phone) => {
        const cleaned = phone.replace(/\D/g, "");
        if (cleaned.length === 11 && cleaned.startsWith("1")) {
            return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
        }
        return phone;
    };
    const formatNationalNumber = (phone) => {
        const cleaned = phone.replace(/\D/g, "");
        if (cleaned.length === 11 && cleaned.startsWith("1")) {
            return `(${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
        }
        if (cleaned.length === 10) {
            return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
        }
        return phone;
    };
    const pillButton = "h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 inline-flex items-center gap-1.5 hover:bg-slate-50";
    const releaseButton = "w-full h-10 rounded-full bg-[#FF4D6A] hover:bg-[#F43F5E] text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60";
    const totalNumbers = contactNumbers.length;
    const { currentPage, totalPages, totalItems, itemsPerPage, paginatedItems: paginatedContactNumbers, handlePageChange, handleItemsPerPageChange, } = usePagination(contactNumbers, 9);
    return (<div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#2F6BFF]">
              <Smartphone className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-slate-900 leading-tight">{t("phoneNumbers.title")}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {t("phoneNumbers.subtitle", { defaultValue: "Manage your dedicated phone numbers for inbound and outbound calls" })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDemoMode && (<button type="button" onClick={() => setIsVideoOpen(true)} className={pillButton} data-testid="button-watch-demo-phonenumbers">
                <Video className="h-4 w-4"/>
                Watch Demo Video
              </button>)}
            <button type="button" onClick={() => setLocation("/incoming-connections")} className={pillButton} data-testid="button-manage-connections">
              <LinkIcon className="h-4 w-4"/>
              {t("phoneNumbers.manageConnections")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {[
            { icon: Phone, value: totalNumbers, label: t("phoneNumbers.stats.totalNumbers"), testId: "text-total-numbers" },
            { icon: Check, value: totalNumbers, label: t("common.active") },
            { icon: CreditCard, value: MONTHLY_CREDITS, label: t("phoneNumbers.stats.creditsPerMonth") },
        ].map((stat) => {
            const Icon = stat.icon;
            return (<div key={stat.label} className="rounded-xl bg-white border border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <Icon className="h-4 w-4 text-slate-400"/>
                  <span className="text-lg font-semibold" data-testid={stat.testId}>{stat.value}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
              </div>);
        })}
        </div>
      </div>

      {contactNumbersLoading ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (<div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
              <div className="h-6 bg-slate-100 rounded w-3/4 mb-4"/>
              <div className="h-4 bg-slate-100 rounded w-full mb-2"/>
              <div className="h-4 bg-slate-100 rounded w-2/3"/>
            </div>))}
        </div>) : contactNumbers.length === 0 ? (<div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Phone className="h-12 w-12 mx-auto mb-4 text-slate-300"/>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No contact numbers</h3>
          <p className="text-slate-500 mb-4">
            Phone numbers added from Contacts will appear here.
          </p>
          <button type="button" onClick={() => setLocation("/contacts")} className={pillButton}>
            Go to Contacts
          </button>
        </div>) : (<div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedContactNumbers.map((number) => (<div key={number.id} className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={`card-phone-${number.id}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold text-slate-900 font-mono break-all" data-testid="text-phone-number">
                      {formatPhoneNumber(number.phone)}
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">{formatNationalNumber(number.phone)}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-900 text-white">
                    {t("common.active")}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>{t("phoneNumbers.labels.country")}:</span>
                    <span className="font-medium text-slate-900">{number.country}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{t("phoneNumbers.labels.monthlyCost")}:</span>
                    <span className="font-medium text-slate-900">{MONTHLY_CREDITS} {t("phoneNumbers.labels.credits")}</span>
                  </div>
                  <p className="pt-2 text-sm text-slate-400" data-testid={`connection-status-not-connected-${number.id}`}>
                    {t("phoneNumbers.status.notConnected")}
                  </p>
                </div>

                <div className="pt-4 mt-2">
                  <button type="button" className={releaseButton} onClick={() => {
                    setContactToRelease(number);
                    setReleaseDialogOpen(true);
                }} data-testid={`button-release-${number.id}`}>
                    <Trash2 className="h-4 w-4"/>
                    {t("phoneNumbers.actions.release")}
                  </button>
                </div>
              </div>))}
          </div>

          {totalPages > 1 && (<DataPagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={handlePageChange} onItemsPerPageChange={handleItemsPerPageChange} itemsPerPageOptions={[9, 18, 27, 54]} data-testid="pagination-phone-numbers"/>)}
        </div>)}

      <AlertDialog open={releaseDialogOpen} onOpenChange={(open) => {
            setReleaseDialogOpen(open);
            if (!open)
                setContactToRelease(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("phoneNumbers.dialog.releaseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("phoneNumbers.dialog.releaseDescription", {
            number: contactToRelease ? formatPhoneNumber(contactToRelease.phone) : "",
        })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={contactReleaseMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReleaseNumber} disabled={contactReleaseMutation.isPending} className="bg-destructive hover:bg-destructive/90" data-testid="button-confirm-release">
              {contactReleaseMutation.isPending ? t("phoneNumbers.actions.releasing") : t("phoneNumbers.actions.releaseNumber")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isDemoMode && (<Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent className="sm:max-w-[850px] p-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <DialogHeader className="p-4 pb-2 text-left">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-emerald-400 fill-emerald-400"/>
                Phone Numbers Demonstration Video
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Watch a overview demonstration on purchasing and assigning virtual phone numbers.
              </DialogDescription>
            </DialogHeader>
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
              {isVideoOpen && (<iframe src="https://drive.google.com/file/d/1k1Y-jsFg_cKym-Plw7CVRcxM-V-_9wY5/preview" className="w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title="Phone Numbers Demo Video"/>)}
            </div>
          </DialogContent>
        </Dialog>)}
    </div>);
}
