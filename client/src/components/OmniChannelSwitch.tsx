import { Link, useLocation } from "wouter";
import { Phone, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type OmniSection = "dashboard" | "analytics";

const ROUTES: Record<OmniSection, { voice: string; whatsapp: string }> = {
  dashboard: {
    voice: "/dashboard",
    whatsapp: "/whatsapp/dashboard",
  },
  analytics: {
    voice: "/analytics?channel=calling",
    whatsapp: "/analytics?channel=whatsapp",
  },
};

export function isOmniEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith("/whatsapp");
}

function useAppPath() {
  const [location] = useLocation();
  if (location.startsWith("/whatsapp") || location.startsWith("/app")) return location;
  return `/whatsapp${location.startsWith("/") ? location : `/${location}`}`;
}

const switchClass =
  "inline-flex items-center rounded-lg border bg-muted/60 p-1";
const tabClass =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors";

export function ChannelToggle({
  value,
  onChange,
  voiceLabel = "Voice",
  whatsappLabel = "WhatsApp",
  testId = "channel-toggle",
}: {
  value: "voice" | "whatsapp";
  onChange: (value: "voice" | "whatsapp") => void;
  voiceLabel?: string;
  whatsappLabel?: string;
  testId?: string;
}) {
  return (
    <div className={switchClass} data-testid={testId}>
      <button
        type="button"
        onClick={() => onChange("voice")}
        className={cn(
          tabClass,
          value === "voice"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        data-testid={`${testId}-voice`}
      >
        <Phone className="h-3.5 w-3.5" />
        {voiceLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange("whatsapp")}
        className={cn(
          tabClass,
          value === "whatsapp"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        data-testid={`${testId}-whatsapp`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {whatsappLabel}
      </button>
    </div>
  );
}

export function OmniChannelSwitch({ section }: { section: OmniSection }) {
  const path = useAppPath();
  const routes = ROUTES[section];
  const channelParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("channel")
      : null;

  const activeIsWhatsApp =
    section === "analytics"
      ? (channelParam || "whatsapp") !== "calling"
      : path.startsWith("/whatsapp");

  return (
    <div className={switchClass} data-testid={`omni-channel-switch-${section}`}>
      <Link
        href={`~${routes.voice}`}
        className={cn(
          tabClass,
          !activeIsWhatsApp
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Phone className="h-3.5 w-3.5" />
        Voice
      </Link>
      <Link
        href={`~${routes.whatsapp}`}
        className={cn(
          tabClass,
          activeIsWhatsApp
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        WhatsApp
      </Link>
    </div>
  );
}
