import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OmniChannelSwitch, type OmniSection } from "@/components/OmniChannelSwitch";

const THEMES = {
  brand: {
    wrap: "from-brand/5 via-brand/3 to-brand/5 dark:from-brand/10 dark:via-brand/5 dark:to-brand/10 border-brand/20",
    icon: "from-brand to-brand/90 shadow-brand/25",
  },
  orange: {
    wrap: "from-orange-50 via-orange-100/50 to-amber-50 dark:from-orange-950/40 dark:via-orange-900/30 dark:to-amber-950/40 border-orange-100 dark:border-orange-900/50",
    icon: "from-orange-500 to-amber-600 shadow-orange-500/25",
  },
  purple: {
    wrap: "from-purple-50 via-violet-100/50 to-fuchsia-50 dark:from-purple-950/40 dark:via-violet-900/30 dark:to-fuchsia-950/40 border-purple-100 dark:border-purple-900/50",
    icon: "from-purple-500 to-violet-600 shadow-purple-500/25",
  },
  sky: {
    wrap: "from-sky-50 via-cyan-50 to-emerald-50 dark:from-sky-950/40 dark:via-cyan-900/30 dark:to-emerald-950/40 border-sky-100 dark:border-sky-900/50",
    icon: "from-sky-500 to-emerald-600 shadow-sky-500/25",
  },
};

export function OmniPageHero({
  section,
  title,
  description,
  icon: Icon,
  theme = "brand",
  actions,
  children,
  titleTestId,
}: {
  section?: OmniSection;
  title: string;
  description?: string;
  icon: LucideIcon;
  theme?: keyof typeof THEMES;
  actions?: ReactNode;
  children?: ReactNode;
  titleTestId?: string;
}) {
  const palette = THEMES[theme];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br border p-6 md:p-8",
        palette.wrap,
      )}
    >
      <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-700/20 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0",
              palette.icon,
            )}
          >
            <Icon className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1
              className="text-2xl md:text-3xl font-bold text-foreground"
              data-testid={titleTestId}
            >
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground mt-0.5">{description}</p>
            )}
            {section && (
              <div className="mt-3">
                <OmniChannelSwitch section={section} />
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
