// import { useState } from "react";
// import { useQuery } from "@tanstack/react-query";
// import { ShoppingCart, Eye, Search, Clock, CheckCircle2, XCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
// import Header from "@wa/components/layout/header";
// interface CartLineItem {
//   title?: string;
//   name?: string;
//   quantity?: number;
//   price?: string | number;
//   [key: string]: unknown;
// }
// interface CartReminder {
//   id: string;
//   cartId: string;
//   automationId: string;
//   reminderId: string;
//   templateNodeId: string;
//   scheduledAt: string;
//   sentAt: string | null;
//   status: string;
//   error: string | null;
//   createdAt: string;
//   updatedAt: string;
// }
// interface AbandonedCart {
//   id: string;
//   storeId: string;
//   channelId: string;
//   checkoutToken: string;
//   cartToken: string;
//   email: string;
//   phone: string;
//   customerName: string;
//   recoveryUrl: string | null;
//   currency: string;
//   subtotalPrice: string | null;
//   totalPrice: string;
//   productData: CartLineItem[] | null;
//   platform: string;
//   status: string;
//   completedAt: string | null;
//   lastReminderSentAt: string | null;
//   createdAt: string;
//   updatedAt: string;
//   reminders?: CartReminder[];
// }
// function timeAgo(dateString: string) {
//   const date = new Date(dateString);
//   const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
//   if (seconds < 0) return date.toLocaleString();
//   if (seconds < 60) return "just now";
//   const minutes = Math.floor(seconds / 60);
//   if (minutes < 60) return `${minutes}m ago`;
//   const hours = Math.floor(minutes / 60);
//   if (hours < 24) return `${hours}h ago`;
//   const days = Math.floor(hours / 24);
//   if (days < 7) return `${days}d ago`;
//   return date.toLocaleDateString();
// }
// function StatusBadge({ status }: { status: string }) {
//   const styles: Record<string, string> = {
//     pending:   "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
//     active:    "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
//     reminded:  "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
//     completed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
//     recovered: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
//     expired:   "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
//     failed:    "bg-red-50 text-red-700 ring-1 ring-red-200",
//     sent:      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
//     scheduled: "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
//   };
//   const style = styles[status?.toLowerCase()] ?? "bg-gray-100 text-gray-500 ring-1 ring-gray-200";
//   return (
//     <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style}`}>
//       {status}
//     </span>
//   );
// }
// function ReminderStatusIcon({ status }: { status: string }) {
//   const s = status?.toLowerCase();
//   if (s === "sent")                        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
//   if (s === "failed")                      return <XCircle className="h-4 w-4 text-red-600" />;
//   if (s === "scheduled" || s === "pending") return <Clock className="h-4 w-4 text-amber-600" />;
//   return <Loader2 className="h-4 w-4 text-muted-foreground" />;
// }
// function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
//   return (
//     <div className="rounded-xl border bg-card p-4 shadow-sm">
//       <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
//       <div className={`mt-2 text-2xl font-semibold leading-none ${accent ?? "text-foreground"}`}>{value}</div>
//     </div>
//   );
// }
// export default function AbandonedCartsPage() {
//   const [search, setSearch]           = useState("");
//   const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
//   const [page, setPage] = useState(1);
//   const limit = 20;
//   const { data, isLoading } = useQuery({
//   queryKey: ["abandoned-carts", page],
//   queryFn: async () => {
//     const response = await fetch(
//       `/api/whatsapp/ecommerce/shopify/abandoned-carts?page=${page}&limit=${limit}`,
//       {
//         credentials: "include",
//       }
//     );
//     return await response.json();
//   },
// });
//  const query = search.toLowerCase();
// const carts =
//   data?.data?.filter(
//     (cart: AbandonedCart) =>
//       cart.customerName?.toLowerCase().includes(query) ||
//       cart.email?.toLowerCase().includes(query) ||
//       cart.phone?.toLowerCase().includes(query)
//   ) ?? [];
// const pagination = data?.pagination;
//   const total = pagination?.total ?? 0;
// const active = carts.filter(
//   (c) => c.status === "pending" || c.status === "reminded"
// ).length;
// const completed = carts.filter(
//   (c) => c.status === "completed" || c.status === "recovered"
// ).length;
//   return (
//     <div className="flex-1 dots-bg min-h-screen">
//       <Header title="Abandoned Carts" subtitle="Recover lost sales from checkouts" />
//       <main className="p-4 sm:p-6 space-y-4">
//         {/* Stat cards */}
//         <div className="grid gap-3 md:grid-cols-3">
//           <StatCard label="Total Carts" value={total} />
//           <StatCard label="Active"      value={active}    accent="text-amber-600" />
//           <StatCard label="Recovered"   value={completed} accent="text-emerald-600" />
//         </div>
//         {/* Search */}
//         <div className="relative">
//           <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
//           <input
//             className="w-full rounded-lg border bg-background px-9 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
//             placeholder="Search by customer, email, or phone…"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />
//         </div>
//         {/* Table */}
//         <div className="overflow-hidden rounded-xl border bg-card">
//           <table className="w-full text-sm">
//             <thead className="bg-muted/40 border-b border-border">
//               <tr>
//                 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
//                 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
//                 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
//                 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Reminders</th>
//                 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Abandoned</th>
//                 <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-border">
//               {isLoading ? (
//                 Array.from({ length: 4 }).map((_, i) => (
//                   <tr key={i}>
//                     <td className="px-4 py-3" colSpan={6}>
//                       <div className="h-4 w-full animate-pulse rounded bg-muted" />
//                     </td>
//                   </tr>
//                 ))
//               ) : carts.length === 0 ? (
//                 <tr>
//                   <td colSpan={6} className="px-4 py-14 text-center">
//                     <div className="flex flex-col items-center gap-2 text-muted-foreground">
//                       <ShoppingCart className="h-8 w-8 opacity-30" />
//                       <p className="font-medium text-foreground">No abandoned carts</p>
//                       <p className="text-sm">
//                         {search
//                           ? "No carts match your search."
//                           : "Carts will appear here once a checkout is abandoned."}
//                       </p>
//                     </div>
//                   </td>
//                 </tr>
//               ) : (
//                 carts.map((cart) => {
//                   const sentCount      = cart.reminders?.filter((r) => r.status === "sent").length ?? 0;
//                   const totalReminders = cart.reminders?.length ?? 0;
//                   return (
//                     <tr key={cart.id} className="transition-colors hover:bg-muted/30">
//                       <td className="px-4 py-3">
//                         <div className="font-medium text-foreground">
//                           {cart.customerName || cart.email || cart.phone || "Unknown customer"}
//                         </div>
//                         {cart.customerName && cart.email && (
//                           <div className="mt-0.5 text-xs text-muted-foreground">{cart.email}</div>
//                         )}
//                         {cart.phone && (
//                           <div className="mt-0.5 text-xs text-muted-foreground">{cart.phone}</div>
//                         )}
//                       </td>
//                       <td className="px-4 py-3 font-medium text-foreground">
//                         {cart.currency} {cart.totalPrice}
//                       </td>
//                       <td className="px-4 py-3">
//                         <StatusBadge status={cart.status} />
//                       </td>
//                       <td className="px-4 py-3 text-sm text-muted-foreground">
//                         {totalReminders > 0 ? `${sentCount}/${totalReminders} sent` : "—"}
//                       </td>
//                       <td className="px-4 py-3 text-sm text-muted-foreground" title={new Date(cart.createdAt).toLocaleString()}>
//                         {timeAgo(cart.createdAt)}
//                       </td>
//                       <td className="px-4 py-3 text-right">
//                         <button
//                           onClick={() => setSelectedCart(cart)}
//                           className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
//                         >
//                           <Eye className="h-3.5 w-3.5" />
//                           View details
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })
//               )}
//             </tbody>
//           </table>
//        {/* Pagination */}
// <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
//   <p className="text-sm text-muted-foreground">
//     {total > 0 ? (
//       <>
//         Showing{" "}
//         <span className="font-medium text-foreground">
//           {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
//         </span>{" "}
//         of <span className="font-medium text-foreground">{total}</span>
//       </>
//     ) : (
//       "No results"
//     )}
//   </p>
//   <div className="flex items-center gap-1">
//     <button
//       disabled={page === 1}
//       onClick={() => setPage((p) => p - 1)}
//       className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
//     >
//       <ChevronLeft className="h-3.5 w-3.5" />
//       Prev
//     </button>
//     <div className="flex items-center gap-1 px-2">
//       {(() => {
//         const totalPages = pagination?.totalPages || 1;
//         const current = pagination?.page || page;
//         // build a compact page list: first, last, current ±1, with ellipses
//         const pages: (number | "...")[] = [];
//         for (let i = 1; i <= totalPages; i++) {
//           if (
//             i === 1 ||
//             i === totalPages ||
//             (i >= current - 1 && i <= current + 1)
//           ) {
//             pages.push(i);
//           } else if (pages[pages.length - 1] !== "...") {
//             pages.push("...");
//           }
//         }
//         return pages.map((p, idx) =>
//           p === "..." ? (
//             <span key={`ellipsis-${idx}`} className="px-1.5 text-sm text-muted-foreground">
//               …
//             </span>
//           ) : (
//             <button
//               key={p}
//               onClick={() => setPage(p)}
//               className={`h-7 min-w-[1.75rem] rounded-md px-2 text-sm font-medium transition-colors ${
//                 p === current
//                   ? "bg-primary text-primary-foreground"
//                   : "text-muted-foreground hover:bg-muted hover:text-foreground"
//               }`}
//             >
//               {p}
//             </button>
//           )
//         );
//       })()}
//     </div>
//     <button
//       disabled={page >= (pagination?.totalPages || 1)}
//       onClick={() => setPage((p) => p + 1)}
//       className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
//     >
//       Next
//       <ChevronRight className="h-3.5 w-3.5" />
//     </button>
//   </div>
// </div>
//         </div>
//         {/* Detail modal */}
//         {selectedCart && (
//           <div
//             className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
//             onClick={() => setSelectedCart(null)}
//           >
//             <div
//               className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card shadow-xl"
//               onClick={(e) => e.stopPropagation()}
//             >
//               {/* Modal header */}
//               <div className="sticky top-0 flex items-start justify-between border-b bg-card px-6 py-4">
//                 <div>
//                   <h2 className="text-base font-semibold text-foreground">
//                     {selectedCart.customerName || selectedCart.email || "Cart details"}
//                   </h2>
//                   <p className="mt-0.5 text-xs text-muted-foreground">ID: {selectedCart.id}</p>
//                 </div>
//                 <button
//                   onClick={() => setSelectedCart(null)}
//                   className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
//                   aria-label="Close"
//                 >
//                   ✕
//                 </button>
//               </div>
//               <div className="space-y-5 px-6 py-5">
//                 {/* Amount + status */}
//                 <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
//                   <div>
//                     <div className="text-xs text-muted-foreground">Cart total</div>
//                     <div className="mt-1 text-2xl font-semibold text-foreground">
//                       {selectedCart.currency} {selectedCart.totalPrice}
//                     </div>
//                     {selectedCart.subtotalPrice && (
//                       <div className="mt-0.5 text-xs text-muted-foreground">
//                         Subtotal: {selectedCart.currency} {selectedCart.subtotalPrice}
//                       </div>
//                     )}
//                   </div>
//                   <StatusBadge status={selectedCart.status} />
//                 </div>
//                 {/* Customer */}
//                 <div>
//                   <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//                     Customer
//                   </h3>
//                   <dl className="divide-y divide-border rounded-xl border text-sm">
//                     {[
//                       { label: "Name",  value: selectedCart.customerName || "Not provided" },
//                       { label: "Email", value: selectedCart.email || "—" },
//                       { label: "Phone", value: selectedCart.phone || "—" },
//                     ].map(({ label, value }) => (
//                       <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
//                         <dt className="text-muted-foreground">{label}</dt>
//                         <dd className="text-right font-medium text-foreground">{value}</dd>
//                       </div>
//                     ))}
//                   </dl>
//                 </div>
//                 {/* Items */}
//                 {Array.isArray(selectedCart.productData) && selectedCart.productData.length > 0 && (
//                   <div>
//                     <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//                       Items ({selectedCart.productData.length})
//                     </h3>
//                     <div className="divide-y divide-border rounded-xl border text-sm">
//                       {selectedCart.productData.map((item, i) => (
//                         <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
//                           <div className="min-w-0">
//                             <div className="truncate font-medium text-foreground">{item.title ?? item.name ?? "Item"}</div>
//                             {item.quantity != null && (
//                               <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
//                             )}
//                           </div>
//                           {item.price != null && (
//                             <div className="shrink-0 font-medium text-foreground">
//                               {selectedCart.currency} {item.price}
//                             </div>
//                           )}
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//                 {/* Reminders */}
//                 {Array.isArray(selectedCart.reminders) && selectedCart.reminders.length > 0 && (
//                   <div>
//                     <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//                       Reminders ({selectedCart.reminders.length})
//                     </h3>
//                     <div className="space-y-2">
//                       {selectedCart.reminders
//                         .slice()
//                         .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
//                         .map((reminder, idx) => (
//                           <div key={reminder.id} className="rounded-xl border p-4 text-sm">
//                             <div className="flex items-center justify-between gap-3">
//                               <div className="flex items-center gap-2 font-medium text-foreground">
//                                 <ReminderStatusIcon status={reminder.status} />
//                                 Reminder {idx + 1}
//                               </div>
//                               <StatusBadge status={reminder.status} />
//                             </div>
//                             <dl className="mt-3 divide-y divide-border text-xs">
//                               {[
//                                 { label: "Scheduled at", value: new Date(reminder.scheduledAt).toLocaleString() },
//                                 { label: "Sent at",      value: reminder.sentAt ? new Date(reminder.sentAt).toLocaleString() : "Not sent yet" },
//                               ].map(({ label, value }) => (
//                                 <div key={label} className="flex justify-between gap-4 py-1.5">
//                                   <dt className="text-muted-foreground">{label}</dt>
//                                   <dd className="text-right font-medium text-foreground">{value}</dd>
//                                 </div>
//                               ))}
//                               <div className="flex justify-between gap-4 py-1.5">
//                                 <dt className="shrink-0 text-muted-foreground">Template node</dt>
//                                 <dd className="truncate text-right font-mono text-[11px] text-foreground">
//                                   {reminder.templateNodeId}
//                                 </dd>
//                               </div>
//                               {reminder.error && (
//                                 <div className="flex justify-between gap-4 py-1.5">
//                                   <dt className="text-muted-foreground">Error</dt>
//                                   <dd className="text-right font-medium text-red-600">{reminder.error}</dd>
//                                 </div>
//                               )}
//                             </dl>
//                           </div>
//                         ))}
//                     </div>
//                   </div>
//                 )}
//                 {/* Checkout info */}
//                 <div>
//                   <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//                     Checkout info
//                   </h3>
//                   <dl className="divide-y divide-border rounded-xl border text-sm">
//                     {[
//                       { label: "Platform",       value: selectedCart.platform,      mono: false },
//                       { label: "Checkout token", value: selectedCart.checkoutToken, mono: true  },
//                       { label: "Cart token",     value: selectedCart.cartToken,     mono: true  },
//                       { label: "Store ID",       value: selectedCart.storeId,       mono: true  },
//                       { label: "Channel ID",     value: selectedCart.channelId,     mono: true  },
//                     ].map(({ label, value, mono }) => (
//                       <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
//                         <dt className="shrink-0 text-muted-foreground">{label}</dt>
//                         <dd className={`truncate text-right font-medium capitalize text-foreground ${mono ? "font-mono text-xs" : ""}`}>
//                           {value}
//                         </dd>
//                       </div>
//                     ))}
//                   </dl>
//                 </div>
//                 {/* Timeline */}
//                 <div>
//                   <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
//                     Timeline
//                   </h3>
//                   <dl className="divide-y divide-border rounded-xl border text-sm">
//                     {[
//                       {
//                         label: "Abandoned at",
//                         value: new Date(selectedCart.createdAt).toLocaleString(),
//                       },
//                       {
//                         label: "Last updated",
//                         value: new Date(selectedCart.updatedAt).toLocaleString(),
//                       },
//                       {
//                         label: "Last reminder sent",
//                         value: (() => {
//                           const sentTimes = (selectedCart.reminders ?? [])
//                             .map((r) => r.sentAt)
//                             .filter((t): t is string => !!t)
//                             .sort();
//                           const lastSent = sentTimes[sentTimes.length - 1];
//                           return lastSent ? new Date(lastSent).toLocaleString() : "Not sent yet";
//                         })(),
//                       },
//                       {
//                         label: "Completed at",
//                         value: selectedCart.completedAt
//                           ? new Date(selectedCart.completedAt).toLocaleString()
//                           : "Not completed",
//                       },
//                     ].map(({ label, value }) => (
//                       <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
//                         <dt className="text-muted-foreground">{label}</dt>
//                         <dd className="text-right font-medium text-foreground">{value}</dd>
//                       </div>
//                     ))}
//                   </dl>
//                 </div>
//               </div>
//               {/* Modal footer */}
//               <div className="sticky bottom-0 border-t bg-card px-6 py-4">
//                 {selectedCart.recoveryUrl ? (
//                   <a
//                     href={selectedCart.recoveryUrl}
//                     target="_blank"
//                     rel="noreferrer"
//                     className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
//                   >
//                     Open recovery link
//                   </a>
//                 ) : (
//                   <p className="text-center text-xs text-muted-foreground">
//                     No recovery link generated for this cart yet.
//                   </p>
//                 )}
//               </div>
//             </div>
//           </div>
//         )}
//       </main>
//     </div>
//   );
// }
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Eye, Search, Clock, CheckCircle2, XCircle, Loader2, ChevronLeft, ChevronRight, ShoppingBag, Store } from "lucide-react";
import Header from "@wa/components/layout/header";
import { useChannelContext } from "@wa/contexts/channel-context";
function timeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 0)
        return date.toLocaleString();
    if (seconds < 60)
        return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7)
        return `${days}d ago`;
    return date.toLocaleDateString();
}
function StatusBadge({ status }) {
    const styles = {
        pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
        active: "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
        reminded: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
        completed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        recovered: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        expired: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
        failed: "bg-red-50 text-red-700 ring-1 ring-red-200",
        sent: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        scheduled: "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
    };
    const style = styles[status?.toLowerCase()] ?? "bg-gray-100 text-gray-500 ring-1 ring-gray-200";
    return (<span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style}`}>
      {status}
    </span>);
}
const PLATFORM_META = {
    shopify: {
        label: "Shopify",
        icon: ShoppingBag,
        className: "bg-[#95BF47]/10 text-[#5E8E3E] ring-1 ring-[#95BF47]/25 dark:text-[#95BF47]",
    },
    woocommerce: {
        label: "WooCommerce",
        icon: Store,
        className: "bg-[#7F54B3]/10 text-[#7F54B3] ring-1 ring-[#7F54B3]/25 dark:text-[#A280D1]",
    },
};
function PlatformBadge({ platform }) {
    const meta = PLATFORM_META[platform?.toLowerCase()] ?? {
        label: platform || "Unknown",
        icon: ShoppingCart,
        className: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
    };
    const Icon = meta.icon;
    return (<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
      <Icon className="h-3 w-3"/>
      {meta.label}
    </span>);
}
function ReminderStatusIcon({ status }) {
    const s = status?.toLowerCase();
    if (s === "sent")
        return <CheckCircle2 className="h-4 w-4 text-emerald-600"/>;
    if (s === "failed")
        return <XCircle className="h-4 w-4 text-red-600"/>;
    if (s === "scheduled" || s === "pending")
        return <Clock className="h-4 w-4 text-amber-600"/>;
    return <Loader2 className="h-4 w-4 text-muted-foreground"/>;
}
function StatCard({ label, value, accent }) {
    return (<div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold leading-none ${accent ?? "text-foreground"}`}>{value}</div>
    </div>);
}
export default function AbandonedCartsPage() {
    const { selectedChannel } = useChannelContext();
    const [search, setSearch] = useState("");
    const [selectedCart, setSelectedCart] = useState(null);
    const [page, setPage] = useState(1);
    const limit = 20;
    const { data, isLoading } = useQuery({
        queryKey: ["abandoned-carts", selectedChannel?.id, page],
        queryFn: async () => {
            const response = await fetch(`/api/whatsapp/ecommerce/shopify/abandoned-carts?channelId=${selectedChannel?.id}&page=${page}&limit=${limit}`, {
                credentials: "include",
            });
            return await response.json();
        },
        enabled: !!selectedChannel?.id,
    });
    const query = search.toLowerCase();
    const carts = data?.data?.filter((cart) => cart.customerName?.toLowerCase().includes(query) ||
        cart.email?.toLowerCase().includes(query) ||
        cart.phone?.toLowerCase().includes(query)) ?? [];
    const pagination = data?.pagination;
    const total = pagination?.total ?? 0;
    const active = carts.filter((c) => c.status === "pending" || c.status === "reminded").length;
    const completed = carts.filter((c) => c.status === "completed" || c.status === "recovered").length;
    return (<div className="flex-1 dots-bg min-h-screen">
      <Header title="Abandoned Carts" subtitle="Recover lost sales from checkouts"/>

      <main className="p-4 sm:p-6 space-y-4">

        {/* Stat cards */}
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard label="Total Carts" value={total}/>
          <StatCard label="Active" value={active} accent="text-amber-600"/>
          <StatCard label="Recovered" value={completed} accent="text-emerald-600"/>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <input className="w-full rounded-lg border bg-background px-9 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground" placeholder="Search by customer, email, or phone…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Reminders</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Abandoned</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {isLoading ? (Array.from({ length: 4 }).map((_, i) => (<tr key={i}>
                    <td className="px-4 py-3" colSpan={7}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted"/>
                    </td>
                  </tr>))) : carts.length === 0 ? (<tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 opacity-30"/>
                      <p className="font-medium text-foreground">No abandoned carts</p>
                      <p className="text-sm">
                        {search
                ? "No carts match your search."
                : "Carts will appear here once a checkout is abandoned."}
                      </p>
                    </div>
                  </td>
                </tr>) : (carts.map((cart) => {
            const sentCount = cart.reminders?.filter((r) => r.status === "sent").length ?? 0;
            const totalReminders = cart.reminders?.length ?? 0;
            return (<tr key={cart.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {cart.customerName || cart.email || cart.phone || "Unknown customer"}
                        </div>
                        {cart.customerName && cart.email && (<div className="mt-0.5 text-xs text-muted-foreground">{cart.email}</div>)}
                        {cart.phone && (<div className="mt-0.5 text-xs text-muted-foreground">{cart.phone}</div>)}
                      </td>

                      <td className="px-4 py-3">
                        <PlatformBadge platform={cart.platform}/>
                      </td>

                      <td className="px-4 py-3 font-medium text-foreground">
                        {cart.currency} {cart.totalPrice}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={cart.status}/>
                      </td>

                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {totalReminders > 0 ? `${sentCount}/${totalReminders} sent` : "—"}
                      </td>

                      <td className="px-4 py-3 text-sm text-muted-foreground" title={new Date(cart.createdAt).toLocaleString()}>
                        {timeAgo(cart.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setSelectedCart(cart)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <Eye className="h-3.5 w-3.5"/>
                          View details
                        </button>
                      </td>
                    </tr>);
        }))}
            </tbody>
          </table>


       {/* Pagination */}
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
  <p className="text-sm text-muted-foreground">
    {total > 0 ? (<>
        Showing{" "}
        <span className="font-medium text-foreground">
          {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
        </span>{" "}
        of <span className="font-medium text-foreground">{total}</span>
      </>) : ("No results")}
  </p>

  <div className="flex items-center gap-1">
    <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
      <ChevronLeft className="h-3.5 w-3.5"/>
      Prev
    </button>

    <div className="flex items-center gap-1 px-2">
      {(() => {
            const totalPages = pagination?.totalPages || 1;
            const current = pagination?.page || page;
            const pages = [];
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 ||
                    i === totalPages ||
                    (i >= current - 1 && i <= current + 1)) {
                    pages.push(i);
                }
                else if (pages[pages.length - 1] !== "...") {
                    pages.push("...");
                }
            }
            return pages.map((p, idx) => p === "..." ? (<span key={`ellipsis-${idx}`} className="px-1.5 text-sm text-muted-foreground">
              …
            </span>) : (<button key={p} onClick={() => setPage(p)} className={`h-7 min-w-[1.75rem] rounded-md px-2 text-sm font-medium transition-colors ${p === current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              {p}
            </button>));
        })()}
    </div>

    <button disabled={page >= (pagination?.totalPages || 1)} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
      Next
      <ChevronRight className="h-3.5 w-3.5"/>
    </button>
  </div>
    </div>
        </div>

        {/* Detail modal */}
        {selectedCart && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setSelectedCart(null)}>
            <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
              {/* Modal header */}
              <div className="sticky top-0 flex items-start justify-between border-b bg-card px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {selectedCart.customerName || selectedCart.email || "Cart details"}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">ID: {selectedCart.id}</p>
                </div>
                <button onClick={() => setSelectedCart(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="space-y-5 px-6 py-5">
                {/* Amount + status */}
                <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Cart total</div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">
                      {selectedCart.currency} {selectedCart.totalPrice}
                    </div>
                    {selectedCart.subtotalPrice && (<div className="mt-0.5 text-xs text-muted-foreground">
                        Subtotal: {selectedCart.currency} {selectedCart.subtotalPrice}
                      </div>)}
                  </div>
                  <StatusBadge status={selectedCart.status}/>
                </div>

                {/* Customer */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer
                  </h3>
                  <dl className="divide-y divide-border rounded-xl border text-sm">
                    {[
                { label: "Name", value: selectedCart.customerName || "Not provided" },
                { label: "Email", value: selectedCart.email || "—" },
                { label: "Phone", value: selectedCart.phone || "—" },
            ].map(({ label, value }) => (<div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-right font-medium text-foreground">{value}</dd>
                      </div>))}
                  </dl>
                </div>

                {/* Items */}
                {Array.isArray(selectedCart.productData) && selectedCart.productData.length > 0 && (<div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Items ({selectedCart.productData.length})
                    </h3>
                    <div className="divide-y divide-border rounded-xl border text-sm">
                      {selectedCart.productData.map((item, i) => (<div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{item.title ?? item.name ?? "Item"}</div>
                            {item.quantity != null && (<div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>)}
                          </div>
                          {item.price != null && (<div className="shrink-0 font-medium text-foreground">
                              {selectedCart.currency} {item.price}
                            </div>)}
                        </div>))}
                    </div>
                  </div>)}

                {/* Reminders */}
                {Array.isArray(selectedCart.reminders) && selectedCart.reminders.length > 0 && (<div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Reminders ({selectedCart.reminders.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedCart.reminders
                    .slice()
                    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                    .map((reminder, idx) => (<div key={reminder.id} className="rounded-xl border p-4 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 font-medium text-foreground">
                                <ReminderStatusIcon status={reminder.status}/>
                                Reminder {idx + 1}
                              </div>
                              <StatusBadge status={reminder.status}/>
                            </div>
                            <dl className="mt-3 divide-y divide-border text-xs">
                              {[
                        { label: "Scheduled at", value: new Date(reminder.scheduledAt).toLocaleString() },
                        { label: "Sent at", value: reminder.sentAt ? new Date(reminder.sentAt).toLocaleString() : "Not sent yet" },
                    ].map(({ label, value }) => (<div key={label} className="flex justify-between gap-4 py-1.5">
                                  <dt className="text-muted-foreground">{label}</dt>
                                  <dd className="text-right font-medium text-foreground">{value}</dd>
                                </div>))}
                              <div className="flex justify-between gap-4 py-1.5">
                                <dt className="shrink-0 text-muted-foreground">Template node</dt>
                                <dd className="truncate text-right font-mono text-[11px] text-foreground">
                                  {reminder.templateNodeId}
                                </dd>
                              </div>
                              {reminder.error && (<div className="flex justify-between gap-4 py-1.5">
                                  <dt className="text-muted-foreground">Error</dt>
                                  <dd className="text-right font-medium text-red-600">{reminder.error}</dd>
                                </div>)}
                            </dl>
                          </div>))}
                    </div>
                  </div>)}

                {/* Checkout info */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Checkout info
                  </h3>
                  <dl className="divide-y divide-border rounded-xl border text-sm">
                    {[
                { label: "Platform", value: selectedCart.platform, mono: false },
                { label: "Checkout token", value: selectedCart.checkoutToken, mono: true },
                { label: "Cart token", value: selectedCart.cartToken, mono: true },
                { label: "Store ID", value: selectedCart.storeId, mono: true },
                { label: "Channel ID", value: selectedCart.channelId, mono: true },
            ].map(({ label, value, mono }) => (<div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                        <dt className="shrink-0 text-muted-foreground">{label}</dt>
                        <dd className={`truncate text-right font-medium capitalize text-foreground ${mono ? "font-mono text-xs" : ""}`}>
                          {value}
                        </dd>
                      </div>))}
                  </dl>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Timeline
                  </h3>
                  <dl className="divide-y divide-border rounded-xl border text-sm">
                    {[
                {
                    label: "Abandoned at",
                    value: new Date(selectedCart.createdAt).toLocaleString(),
                },
                {
                    label: "Last updated",
                    value: new Date(selectedCart.updatedAt).toLocaleString(),
                },
                {
                    label: "Last reminder sent",
                    value: (() => {
                        const sentTimes = (selectedCart.reminders ?? [])
                            .map((r) => r.sentAt)
                            .filter((t) => !!t)
                            .sort();
                        const lastSent = sentTimes[sentTimes.length - 1];
                        return lastSent ? new Date(lastSent).toLocaleString() : "Not sent yet";
                    })(),
                },
                {
                    label: "Completed at",
                    value: selectedCart.completedAt
                        ? new Date(selectedCart.completedAt).toLocaleString()
                        : "Not completed",
                },
            ].map(({ label, value }) => (<div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-right font-medium text-foreground">{value}</dd>
                      </div>))}
                  </dl>
                </div>
              </div>

              {/* Modal footer */}
              <div className="sticky bottom-0 border-t bg-card px-6 py-4">
                {selectedCart.recoveryUrl ? (<a href={selectedCart.recoveryUrl} target="_blank" rel="noreferrer" className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                    Open recovery link
                  </a>) : (<p className="text-center text-xs text-muted-foreground">
                    No recovery link generated for this cart yet.
                  </p>)}
              </div>
            </div>
          </div>)}

      </main>
    </div>);
}
