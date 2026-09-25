import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@wa/components/layout/header";
import { useChannelContext } from "@wa/contexts/channel-context";
import {
  Search,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  PackageSearch,
  Loader2,
  ShoppingBag,
  Store,
} from "lucide-react";

interface CodVerification {
  id: string;
  platform: "shopify" | "woocommerce";
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalPrice: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  respondedAt: string | null;
}

interface CodResponse {
  data: CodVerification[];
  stats: { total: number; pending: number; confirmed: number; cancelled: number };
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString();
}

const STATUS_META: Record<
  CodVerification["status"],
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: {
    label: "Awaiting reply",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
  },
};

const PLATFORM_META = {
  shopify: {
    label: "Shopify",
    icon: ShoppingBag,
    className: "bg-[#95BF47]/10 text-[#5E8E3E] border-[#95BF47]/25 dark:text-[#95BF47] dark:bg-[#95BF47]/15",
  },
  woocommerce: {
    label: "WooCommerce",
    icon: Store,
    className: "bg-[#7F54B3]/10 text-[#7F54B3] border-[#7F54B3]/25 dark:text-[#A280D1] dark:bg-[#7F54B3]/15",
  },
} as const;

export default function CodOrdersPage() {
  const { selectedChannel } = useChannelContext();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<CodResponse>({
    queryKey: ["/api/whatsapp/ecommerce/cod/verifications", selectedChannel?.id, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        channelId: selectedChannel?.id || "",
        search,
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`/api/whatsapp/ecommerce/cod/verifications?${params}`);
      return res.json();
    },
    enabled: !!selectedChannel?.id,
  });

  const rows = data?.data ?? [];
  const stats = data?.stats ?? { total: 0, pending: 0, confirmed: 0, cancelled: 0 };

  return (
    <div className="flex-1 dots-bg min-h-screen">
      <Header title="COD Orders" subtitle="Verify Cash on Delivery orders over WhatsApp" />

      <main className="p-4 sm:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid sm:grid-cols-4 gap-5">
          <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Total COD Orders
              </p>
              <p className="text-3xl font-bold mt-1.5 text-foreground tabular-nums">
                {isLoading ? "…" : stats.total}
              </p>
            </div>
            <div className="p-3 bg-secondary/50 text-muted-foreground rounded-xl">
              <Layers size={20} />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Awaiting Reply
              </p>
              <p className="text-3xl font-bold mt-1.5 text-amber-600 dark:text-amber-500 tabular-nums">
                {isLoading ? "…" : stats.pending}
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 rounded-xl">
              <Clock size={20} />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Confirmed
              </p>
              <p className="text-3xl font-bold mt-1.5 text-emerald-600 dark:text-emerald-500 tabular-nums">
                {isLoading ? "…" : stats.confirmed}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center justify-between border-l-4 border-l-destructive">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Cancelled
              </p>
              <p className="text-3xl font-bold mt-1.5 text-destructive tabular-nums">
                {isLoading ? "…" : stats.cancelled}
              </p>
            </div>
            <div className="p-3 bg-destructive/10 text-destructive rounded-xl">
              <XCircle size={20} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer, phone, or order number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border bg-card pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading COD orders…</p>
            </div>
          ) : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Customer
                    </th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Order
                    </th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Platform
                    </th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Sent
                    </th>
                    <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      Responded
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const status = STATUS_META[row.status];
                    const StatusIcon = status.icon;
                    const platform = PLATFORM_META[row.platform];
                    const PlatformIcon = platform.icon;

                    return (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground">{row.customerName || "—"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{row.customerPhone}</p>
                        </td>
                        {/* <td className="px-5 py-4">
                          <span className="font-medium text-foreground">{row.orderNumber}</span>
                        </td> */}

                        <td className="px-5 py-4">
  <span className="font-medium text-foreground">
    {row.orderNumber?.startsWith("#")
      ? row.orderNumber
      : `#${row.orderNumber}`}
  </span>
</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-semibold border ${platform.className}`}
                          >
                            <PlatformIcon className="w-3 h-3" />
                            {platform.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-medium text-foreground">{row.totalPrice}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full font-semibold border ${status.className}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {formatDateTime(row.respondedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center text-center gap-3">
              <div className="p-4 bg-muted rounded-full text-muted-foreground/60">
                <PackageSearch className="w-8 h-8" />
              </div>
              <p className="font-semibold text-foreground text-lg">No COD orders yet</p>
              <p className="text-sm text-muted-foreground max-w-sm -mt-1.5">
                COD orders will show up here once a customer places a Cash on Delivery order.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {rows.length > 0 && (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={rows.length < limit}
              className="border rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-all"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}