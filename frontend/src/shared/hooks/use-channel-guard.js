import { useState } from "react";
import { useLocation } from "wouter";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { useToast } from "@/shared/hooks/use-toast";
async function fetchJsonOrNull(url) {
    try {
        const headers = {};
        const authHeader = AuthStorage.getAuthHeader();
        if (authHeader)
            headers.Authorization = authHeader;
        const response = await fetch(url, { credentials: "include", headers });
        if (!response.ok)
            return null;
        return await response.json();
    }
    catch {
        return null;
    }
}
async function hasWhatsAppChannel() {
    const activeChannel = await fetchJsonOrNull("/api/whatsapp/channels/active");
    return Boolean(activeChannel?.id);
}
function useGuardedNavigation() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [isChecking, setIsChecking] = useState(false);
    const guardedNavigate = async (check, target, message) => {
        if (isChecking)
            return false;
        setIsChecking(true);
        try {
            if (!(await check())) {
                toast({ ...message, variant: "destructive" });
                return false;
            }
            setLocation(target);
            return true;
        }
        finally {
            setIsChecking(false);
        }
    };
    return { guardedNavigate, isChecking };
}
const NO_WHATSAPP_CHANNEL = { title: "No WhatsApp channel" };
export function useCreateCampaign() {
    const [, setLocation] = useLocation();
    const { guardedNavigate, isChecking } = useGuardedNavigation();
    const startCreateCampaign = (channel) => {
        if (channel === "calling") {
            setLocation("/campaigns/new?channel=calling");
            return Promise.resolve(true);
        }
        return guardedNavigate(hasWhatsAppChannel, "/campaigns/new", {
            ...NO_WHATSAPP_CHANNEL,
            description: "Create a WhatsApp channel before starting a campaign.",
        });
    };
    return { startCreateCampaign, isChecking };
}
export function useCreateTemplate() {
    const [, setLocation] = useLocation();
    const { guardedNavigate, isChecking } = useGuardedNavigation();
    const startCreateTemplate = (type = "whatsapp") => {
        if (type === "agentlab") {
            setLocation("~/templates/agentlab/new");
            return Promise.resolve(true);
        }
        return guardedNavigate(hasWhatsAppChannel, "~/templates/new", {
            ...NO_WHATSAPP_CHANNEL,
            description: "Create a WhatsApp channel before creating a template.",
        });
    };
    return { startCreateTemplate, isChecking };
}
