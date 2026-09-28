import { SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { Zap } from "lucide-react";
import { AppHeaderProvider, AppPageHeader } from "@/shared/components/AppPageHeader";
import { DemoModeBanner } from "@/shared/components/DemoModeBanner";
import { useBranding } from "@/shared/components/BrandingProvider";

export function AppShell({
  sidebar,
  children,
  showDemoBanner = false,
  contentClassName = "w-full px-4 md:px-8 lg:px-10 py-6 md:py-8",
}) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  const { branding, currentLogo } = useBranding();
  return (
    <SidebarProvider style={style}>
      <AppHeaderProvider>
        {showDemoBanner ? (
          <div className="flex flex-col h-screen w-full">
            <DemoModeBanner />
            <div className="flex flex-1 overflow-hidden">
              {sidebar}
              <AppShellMain branding={branding} currentLogo={currentLogo} contentClassName={contentClassName}>
                {children}
              </AppShellMain>
            </div>
          </div>
        ) : (
          <div className="flex h-screen w-full">
            {sidebar}
            <AppShellMain branding={branding} currentLogo={currentLogo} contentClassName={contentClassName}>
              {children}
            </AppShellMain>
          </div>
        )}
      </AppHeaderProvider>
    </SidebarProvider>
  );
}

function AppShellMain({ branding, currentLogo, contentClassName, children }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <header className="flex md:hidden items-center justify-between h-14 px-4 border-b bg-background/95">
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-mobile-menu"/>
          {currentLogo ? (
            <img src={currentLogo} alt={branding.app_name} className="h-7 w-auto max-w-[120px] object-contain"/>
          ) : (
            <Zap className="h-6 w-6 text-primary"/>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-auto bg-[#F8F9FB]">
        <div className={contentClassName}>
          <AppPageHeader />
          {children}
        </div>
      </main>
    </div>
  );
}
