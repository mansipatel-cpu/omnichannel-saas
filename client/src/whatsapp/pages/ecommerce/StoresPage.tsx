 import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@wa/components/layout/header";
import {
  Store,
  RefreshCw,
  Trash2,
  Plus,
  ExternalLink,
  CheckCircle2,
  XCircle,
  PackageSearch,
  Loader2,
  Layers,
  AlertTriangle,
  ShoppingBag,
  Zap,
  Copy,
  Check,
  Download,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wa/components/ui/card";
import { Button } from "@wa/components/ui/button";
import { apiRequest } from "@wa/lib/queryClient";
import { useChannelContext } from "@wa/contexts/channel-context";

interface EcommerceStore {
  id: string;
  shopDomain?: string;
  storeUrl?: string;
  storeName?: string;
  isActive: boolean;
  lastSyncedAt?: string | null;
  consumerSecret?: string;
}

function formatRelativeTime(dateString?: string | null) {
  if (!dateString) return "Never synced";
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const CopyField = ({ label, value, secret }: { label: string; value: string; secret?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const displayValue = secret && !revealed ? "•".repeat(Math.min(value.length, 28)) : value;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 p-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-mono text-sm truncate mt-0.5">{displayValue || "—"}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {secret && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRevealed((v) => !v)} title={revealed ? "Hide" : "Reveal"}>
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleCopy} disabled={!value} title="Copy to clipboard">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
};

const SetupStep = ({
  index,
  title,
  description,
  isOpen,
  isDone,
  onToggleOpen,
  onToggleDone,
  children,
}: {
  index: number;
  title: string;
  description: string;
  isOpen: boolean;
  isDone: boolean;
  onToggleOpen: () => void;
  onToggleDone: () => void;
  children: React.ReactNode;
}) => (
  <div className={`rounded-xl border overflow-hidden transition-colors ${isOpen ? "border-primary/40 bg-primary/[0.02]" : "border-border"}`}>
    <button onClick={onToggleOpen} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
        className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold border-2 transition-all ${
          isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 text-muted-foreground hover:border-primary"
        }`}
        title={isDone ? "Mark as not done" : "Mark as done"}
      >
        {isDone ? <Check className="w-3.5 h-3.5" /> : index}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>{title}</p>
        {!isOpen && <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>}
      </div>

      <ArrowRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
    </button>

    {isOpen && <div className="px-4 pb-4 pl-[3.75rem]">{children}</div>}
  </div>
);

const PLATFORM_META = {
  shopify: { label: "Shopify", tagline: "Full customer profile analytics & sync loops.", accent: "#95BF47", icon: ShoppingBag },
  woocommerce: { label: "WooCommerce", tagline: "Automated plugin hooks mapping suite.", accent: "#7F54B3", icon: Store },
} as const;

export default function StoresPage() {
  const [shop, setShop] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { selectedChannel } = useChannelContext();
  const [platform, setPlatform] = useState<"shopify" | "woocommerce">("shopify");

  const [wooForm, setWooForm] = useState({ storeUrl: "", consumerKey: "", consumerSecret: "" });

  const meta = PLATFORM_META[platform];
  const PlatformIcon = meta.icon;

  // 🔧 FIX: fetch BOTH platforms unconditionally. A channel can only ever
  // have ONE store total (Shopify OR WooCommerce, never both), so the
  // summary cards must reflect that combined reality regardless of which
  // tab is open — otherwise switching tabs made the numbers look different
  // for no real reason.
  const { data: shopifyData, isLoading: isShopifyLoading } = useQuery({
    queryKey: ["/api/whatsapp/ecommerce/shopify/stores", selectedChannel?.id],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/ecommerce/shopify/stores?channelId=${selectedChannel?.id}`);
      return res.json();
    },
    enabled: !!selectedChannel?.id,
  });

  const { data: wooData, isLoading: isWooLoading } = useQuery({
    queryKey: ["/api/whatsapp/ecommerce/woocommerce/stores", selectedChannel?.id],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/ecommerce/woocommerce/stores?channelId=${selectedChannel?.id}`);
      return res.json();
    },
    enabled: !!selectedChannel?.id,
  });

  const isLoading = isShopifyLoading || isWooLoading;

  const shopifyStores: EcommerceStore[] = shopifyData?.data ?? [];
  const wooStores: EcommerceStore[] = wooData?.data ?? [];
  const allStores: EcommerceStore[] = [...shopifyStores, ...wooStores];

  // Combined totals — drive ONLY the 3 summary cards, identical no matter
  // which tab is selected.
  const activeCount = allStores.filter((s) => s.isActive).length;
  const needsAttentionCount = allStores.length - activeCount;

  // Platform-specific list — drives the Connect UI / Connected Channels /
  // setup wizard below, same as before. Each platform can independently
  // have its own store (up to 2 total: one Shopify + one WooCommerce) —
  // so there's no "already connected elsewhere" blocking here, only the
  // combined summary cards above are shared across both.
  const endpoint = platform === "shopify" ? "/api/whatsapp/ecommerce/shopify/stores" : "/api/whatsapp/ecommerce/woocommerce/stores";
  const stores = platform === "shopify" ? shopifyStores : wooStores;
  const hasStore = stores.length > 0; // store connected on THIS platform

  const primaryStore: EcommerceStore | undefined = stores[0];
  const [isConnecting, setIsConnecting] = useState(false);

  // WooCommerce setup wizard state
  const [openStep, setOpenStep] = useState<number | null>(1);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const totalSteps = 5;

  const toggleStepDone = (step: number) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const connectStore = async () => {
    if (platform === "shopify") {
      const cleaned = shop.trim().replace(/^https?:\/\//, "").split("/")[0];
      if (!cleaned) {
        setError("Enter your store URL to continue");
        return;
      }
      setError("");
      window.location.href = `/api/whatsapp/ecommerce/shopify/install?shop=${encodeURIComponent(cleaned)}&channelId=${selectedChannel?.id}`;
      return;
    }

    try {
      setIsConnecting(true);
      await apiRequest("POST", "/api/whatsapp/ecommerce/woocommerce/connect", { channelId: selectedChannel?.id, ...wooForm });
      queryClient.invalidateQueries({ queryKey: [endpoint, selectedChannel?.id] });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/whatsapp/ecommerce/${platform}/stores/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [endpoint] }),
  });

  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const disconnectStore = (id: string) => {
    const confirmed = window.confirm("Disconnect this store? Customer and order sync will stop immediately.");
    if (!confirmed) return;
    setDisconnectingId(id);
    disconnectMutation.mutate(id, { onSettled: () => setDisconnectingId(null) });
  };

  const syncCustomersMutation = useMutation({
    mutationFn: async (storeId: string) => apiRequest("POST", `/api/whatsapp/ecommerce/${platform}/stores/${storeId}/sync-customers`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [endpoint] }),
  });

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const syncCustomers = (storeId: string) => {
    setSyncingId(storeId);
    syncCustomersMutation.mutate(storeId, { onSettled: () => setSyncingId(null) });
  };

  // 🔧 FIX: wire up the actual plugin download instead of a dead button.
  // The zip is served from a backend route (server/assets/whatsway-woo-connector.zip)
  // with a Content-Disposition header, so a plain navigation triggers the
  // browser's native "Save As" — no blob/fetch handling needed.
  const downloadPlugin = () => {
    window.location.href = "/api/whatsapp/ecommerce/woocommerce/plugin/download";
  };



 

const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
const platformKeys = Object.keys(PLATFORM_META) as Array<keyof typeof PLATFORM_META>;

useLayoutEffect(() => {
  const el = tabRefs.current[platform];
  if (el) setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
}, [platform, shopifyStores.length, wooStores.length]);

const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + dir + platformKeys.length) % platformKeys.length;
    const nextKey = platformKeys[nextIndex];
    setPlatform(nextKey);
    tabRefs.current[nextKey]?.focus();
  }
};

// storeCounts for badges
const storeCounts: Record<string, number> = {
  shopify: shopifyStores.length,
  woocommerce: wooStores.length,
};

  return (
    <div className="flex-1 dots-bg min-h-screen">
      <Header title="Stores" subtitle="Manage connected ecommerce platforms" />

      <main className="p-4 sm:p-6 space-y-6">
        {/* Platform switcher */}
   <div className="flex justify-end">
  <div
    role="tablist"
    aria-label="Ecommerce platform"
    className="relative inline-flex w-full sm:w-auto p-1 rounded-xl border bg-muted/40 gap-1"
  >
    {/* sliding active-tab background */}
    <div
      className="absolute top-1 bottom-1 rounded-lg bg-card transition-all duration-300 ease-out"
      style={{
        left: indicatorStyle.left,
        width: indicatorStyle.width,
        boxShadow: `0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px ${PLATFORM_META[platform].accent}22`,
      }}
    />

    {platformKeys.map((key, index) => {
      const p = PLATFORM_META[key];
      const Icon = p.icon;
      const selected = platform === key;
      const count = storeCounts[key];

      return (
        <button
          key={key}
          ref={(el) => (tabRefs.current[key] = el)}
          role="tab"
          aria-selected={selected}
          tabIndex={selected ? 0 : -1}
          onClick={() => setPlatform(key)}
          onKeyDown={(e) => handleTabKeyDown(e, index)}
          className={`relative z-10 flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon
            size={15}
            style={{ color: selected ? p.accent : undefined }}
            className={`transition-all duration-200 ${selected ? "scale-110" : "scale-100"}`}
          />
          <span>{p.label}</span>

          {/* connected-store count badge */}
          {count > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold transition-colors duration-200 ${
                selected ? "text-white" : "bg-muted-foreground/15 text-muted-foreground"
              }`}
              style={selected ? { backgroundColor: p.accent } : undefined}
            >
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
</div>

        {/* Summary Cards — combined across both platforms */}
        <div className="grid sm:grid-cols-3 gap-5">
          <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center justify-between transition-shadow hover:shadow-md">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Connected Stores</p>
              <p className="text-4xl font-bold mt-1.5 text-foreground tabular-nums tracking-tight">
                {isLoading ? <span className="inline-block h-9 w-10 rounded-md bg-muted animate-pulse align-middle" /> : allStores.length}
              </p>
            </div>
            <div className="p-3 bg-secondary/50 text-muted-foreground rounded-xl">
              <Layers size={20} />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500 transition-shadow hover:shadow-md">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Active Connections</p>
              <p className="text-4xl font-bold mt-1.5 text-emerald-600 dark:text-emerald-500 tabular-nums tracking-tight">
                {isLoading ? <span className="inline-block h-9 w-10 rounded-md bg-muted animate-pulse align-middle" /> : activeCount}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-amber-500 transition-shadow hover:shadow-md">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Needs Attention</p>
              <p className={`text-4xl font-bold mt-1.5 tabular-nums tracking-tight ${needsAttentionCount > 0 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"}`}>
                {isLoading ? <span className="inline-block h-9 w-10 rounded-md bg-muted animate-pulse align-middle" /> : needsAttentionCount}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${needsAttentionCount > 0 ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" : "bg-secondary/50 text-muted-foreground"}`}>
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>

        {/* Hero: connection state */}
        {!hasStore ? (
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${meta.accent}14`, borderColor: `${meta.accent}33` }}
              >
                <PlatformIcon className="w-5 h-5" style={{ color: meta.accent }} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground leading-tight">Connect {meta.label} Store</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {platform === "shopify"
                    ? "Link a Shopify store to automate customer, order, and inventory synchronization."
                    : "Connect your WooCommerce store using your Store URL, Consumer Key, and Consumer Secret."}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <div className="flex-1 w-full">
                {platform === "shopify" ? (
                  <>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-sm font-medium">https://</span>
                      <input
                        type="text"
                        placeholder="my-store.myshopify.com"
                        value={shop}
                        onChange={(e) => {
                          setShop(e.target.value);
                          if (error) setError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") connectStore();
                        }}
                        className={`w-full rounded-lg pl-16 pr-4 py-2.5 text-sm bg-background border outline-none transition-all focus:ring-2 focus:ring-primary/20 ${
                          error ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
                        }`}
                      />
                    </div>
                    {error && <p className="text-xs font-medium text-destructive mt-1.5 ml-1">{error}</p>}
                  </>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Store URL (https://yourstore.com)"
                      value={wooForm.storeUrl}
                      onChange={(e) => setWooForm({ ...wooForm, storeUrl: e.target.value })}
                      className="w-full rounded-lg border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Consumer Key"
                        value={wooForm.consumerKey}
                        onChange={(e) => setWooForm({ ...wooForm, consumerKey: e.target.value })}
                        className="w-full rounded-lg border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                      />
                      <input
                        type="password"
                        placeholder="Consumer Secret"
                        value={wooForm.consumerSecret}
                        onChange={(e) => setWooForm({ ...wooForm, consumerSecret: e.target.value })}
                        className="w-full rounded-lg border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={connectStore}
                disabled={isConnecting}
                className="w-full sm:w-auto bg-primary text-primary-foreground hover:opacity-90 px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium text-sm disabled:opacity-60 shrink-0"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Connecting…
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Connect Store
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative bg-card border rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-[0.08]" style={{ backgroundColor: meta.accent }} />

            <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div
                  className="w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${meta.accent}14`, borderColor: `${meta.accent}33` }}
                >
                  <PlatformIcon className="w-6 h-6" style={{ color: meta.accent }} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <h2 className="font-bold text-foreground truncate">{meta.label} store connected</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {primaryStore?.storeName || primaryStore?.shopDomain || primaryStore?.storeUrl}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 border rounded-lg px-3 py-2 shrink-0">
                <Zap size={13} className="text-primary" />
                <span>{formatRelativeTime(primaryStore?.lastSyncedAt)}</span>
              </div>
            </div>

            <p className="relative text-xs text-muted-foreground mt-4 pl-[4.5rem]">To connect a different store, disconnect the existing one first.</p>
          </div>
        )}

        {/* Connected Channels list */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/30">
            <h2 className="font-bold text-foreground">Connected Store</h2>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border">
              {[0, 1].map((i) => (
                <div key={i} className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-muted animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                  <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : stores.length ? (
            <div className="divide-y divide-border">
              {stores.map((store: EcommerceStore) => {
                const isActive = store.isActive;
                const isSyncing = syncingId === store.id;
                const isDisconnecting = disconnectingId === store.id;

                return (
                  <div key={store.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors group">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${meta.accent}14`, borderColor: `${meta.accent}33` }}
                      >
                        <PlatformIcon className="w-5 h-5" style={{ color: meta.accent }} />
                      </div>

                      <div className="min-w-0">
                        <a
                          href={platform === "shopify" ? `https://${store.shopDomain}` : store.storeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 text-base truncate max-w-full"
                        >
                          <span className="truncate">{platform === "shopify" ? store.shopDomain : store.storeName || store.storeUrl}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60 transition-opacity opacity-0 group-hover:opacity-100 shrink-0" />
                        </a>

                        <div className="flex items-center gap-2.5 mt-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full font-semibold border ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }`}
                          >
                            {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span className="capitalize">{isActive ? "Active" : "Inactive"}</span>
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">• {formatRelativeTime(store.lastSyncedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => syncCustomers(store.id)}
                        disabled={isSyncing}
                        className="border rounded-lg px-3.5 py-2 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2 text-sm font-medium shadow-sm"
                        title="Sync operations"
                      >
                        <RefreshCw size={15} className={isSyncing ? "animate-spin text-primary" : "text-muted-foreground"} />
                        <span>{isSyncing ? "Syncing…" : "Sync Now"}</span>
                      </button>

                      <button
                        onClick={() => disconnectStore(store.id)}
                        disabled={isDisconnecting}
                        className="border rounded-lg px-3.5 py-2 text-destructive border-border hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        title="Disconnect access"
                      >
                        {isDisconnecting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center text-center gap-3">
              <div className="p-4 bg-muted rounded-full text-muted-foreground/60">
                <PackageSearch className="w-8 h-8" />
              </div>
              <p className="font-semibold text-foreground text-lg">No stores configured</p>
              <p className="text-sm text-muted-foreground max-w-sm -mt-1.5">Connect your {meta.label} store to start syncing customers and orders.</p>
            </div>
          )}
        </div>

        {/* WooCommerce plugin setup — sequential steps, so numbering carries real meaning */}
        {platform === "woocommerce" && hasStore && (
          <Card className="border-l-4" style={{ borderLeftColor: meta.accent }}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Complete WooCommerce Setup</CardTitle>
                  <CardDescription className="mt-1">
                    Your WooCommerce store connected successfully. Finish the plugin install below to start syncing.
                  </CardDescription>
                </div>
                <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5 tabular-nums">{doneSteps.size}/{totalSteps} done</span>
              </div>

              <div className="h-1.5 rounded-full bg-muted mt-3 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${(doneSteps.size / totalSteps) * 100}%` }} />
              </div>
            </CardHeader>

            <CardContent className="space-y-2.5">
              <SetupStep
                index={1}
                title="Download the connector plugin"
                description="Get the official WhatsWay WooCommerce Connector plugin."
                isOpen={openStep === 1}
                isDone={doneSteps.has(1)}
                onToggleOpen={() => setOpenStep(openStep === 1 ? null : 1)}
                onToggleDone={() => toggleStepDone(1)}
              >
                <p className="text-sm text-muted-foreground mb-3">Get the official WhatsWay WooCommerce Connector plugin for WordPress.</p>
                <Button className="gap-2" onClick={downloadPlugin}>
                  <Download className="w-4 h-4" />
                  Download Plugin
                </Button>
              </SetupStep>

              <SetupStep
                index={2}
                title="Install the plugin in WordPress"
                description="Upload and activate it from your WordPress admin panel."
                isOpen={openStep === 2}
                isDone={doneSteps.has(2)}
                onToggleOpen={() => setOpenStep(openStep === 2 ? null : 2)}
                onToggleDone={() => toggleStepDone(2)}
              >
                <ol className="list-decimal pl-4 space-y-1 text-sm text-muted-foreground marker:text-foreground marker:font-semibold">
                  <li>Log in to your WordPress admin panel.</li>
                  <li>Go to Plugins → Add New.</li>
                  <li>Click Upload Plugin and select the downloaded file.</li>
                  <li>Click Install Now, then Activate.</li>
                </ol>
              </SetupStep>

              <SetupStep
                index={3}
                title="Configure the plugin"
                description="Paste your backend URL, Store ID, Channel ID and secret."
                isOpen={openStep === 3}
                isDone={doneSteps.has(3)}
                onToggleOpen={() => setOpenStep(openStep === 3 ? null : 3)}
                onToggleDone={() => toggleStepDone(3)}
              >
                <p className="text-sm text-muted-foreground mb-3">
                  Open <strong className="text-foreground">Settings → WhatsWay Connector</strong> and paste in the values below.
                </p>
                <div className="space-y-2.5">
                  <CopyField label="Backend URL" value={typeof window !== "undefined" ? window.location.origin : ""} />
                  <CopyField label="Store ID" value={primaryStore?.id ?? ""} />
                  <CopyField label="Channel ID" value={selectedChannel?.id ?? ""} />
                  <CopyField label="Consumer Secret" value={primaryStore?.consumerSecret ?? ""} secret />
                </div>
              </SetupStep>

              <SetupStep
                index={4}
                title="Sync your customers"
                description="Use Sync Now on your store above to import customers."
                isOpen={openStep === 4}
                isDone={doneSteps.has(4)}
                onToggleOpen={() => setOpenStep(openStep === 4 ? null : 4)}
                onToggleDone={() => toggleStepDone(4)}
              >
                <p className="text-sm text-muted-foreground">
                  Use the <strong className="text-foreground">Sync Now</strong> button on your store above to import existing WooCommerce customers.
                </p>
              </SetupStep>

              <SetupStep
                index={5}
                title="Verify the integration"
                description="Run a test checkout and confirm everything fired."
                isOpen={openStep === 5}
                isDone={doneSteps.has(5)}
                onToggleOpen={() => setOpenStep(openStep === 5 ? null : 5)}
                onToggleDone={() => toggleStepDone(5)}
              >
                <ul className="space-y-1.5 text-sm">
                  {["Create a test checkout", "Confirm the customer synced", "Confirm abandoned cart tracking fired", "Confirm WhatsApp automation sent"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-muted-foreground">
                      <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </SetupStep>
            </CardContent>
          </Card>
        )}

        {/* Integrations directory */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3 px-1">Supported Integrations</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {(Object.keys(PLATFORM_META) as Array<keyof typeof PLATFORM_META>).map((key) => {
              const p = PLATFORM_META[key];
              const Icon = p.icon;
              return (
                <div key={key} className="border rounded-xl p-5 bg-card shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.accent}14`, borderColor: `${p.accent}33` }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: p.accent }} />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">{p.label}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.tagline}</p>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 font-semibold mt-4 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full inline-block animate-pulse" /> Available
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}