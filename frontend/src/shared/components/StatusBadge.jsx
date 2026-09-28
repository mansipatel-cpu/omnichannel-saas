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
import { Badge } from "@/shared/components/ui/badge";
import { Circle, Clock, CheckCircle2, XCircle, AlertTriangle, Phone, PhoneOff } from "lucide-react";
const statusConfig = {
    pending: {
        icon: Clock,
        variant: "secondary",
        label: "Pending",
    },
    in_progress: {
        icon: Phone,
        variant: "default",
        label: "In Progress",
    },
    calling: {
        icon: Phone,
        variant: "default",
        label: "Calling",
    },
    completed: {
        icon: CheckCircle2,
        variant: "secondary",
        label: "Completed",
    },
    failed: {
        icon: XCircle,
        variant: "destructive",
        label: "Failed",
    },
    credit_failed: {
        icon: AlertTriangle,
        variant: "destructive",
        label: "Not Billed - Low Credits",
    },
    scheduled: {
        icon: Clock,
        variant: "secondary",
        label: "Scheduled",
    },
    warm: {
        icon: Circle,
        variant: "secondary",
        label: "Warm Lead",
        color: "text-warning",
    },
    cold: {
        icon: Circle,
        variant: "secondary",
        label: "Cold Lead",
        color: "text-info",
    },
    hot: {
        icon: Circle,
        variant: "secondary",
        label: "Hot Lead",
        color: "text-destructive",
    },
    draft: {
        icon: Circle,
        variant: "outline",
        label: "Draft",
    },
    running: {
        icon: Phone,
        variant: "default",
        label: "Running",
    },
    paused: {
        icon: PhoneOff,
        variant: "secondary",
        label: "Paused",
    },
};
export function StatusBadge({ status, label }) {
    const config = statusConfig[status] || {
        icon: Circle,
        variant: "outline",
        label: status,
    };
    const Icon = config.icon;
    const displayLabel = label || config.label;
    const iconColor = "color" in config ? config.color : "";
    return (<Badge variant={config.variant} className="gap-1.5" data-testid={`badge-status-${status}`}>
      <Icon className={`h-3 w-3 ${iconColor}`}/>
      {displayLabel}
    </Badge>);
}
