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
import { useQuery } from "@tanstack/react-query";
export function useDashboardStats(channelId) {
    return useQuery({
        queryKey: ["/api/whatsapp/dashboard/stats", channelId],
        queryFn: async () => {
            if (!channelId) {
                // Return default stats if no channel is selected
                return {
                    totalContacts: 0,
                    todayContacts: 0,
                    weekContacts: 0,
                    lastWeekContacts: 0,
                    totalCampaigns: 0,
                    totalTemplates: 0,
                    messagesSent: 0,
                    messagesDelivered: 0,
                    messagesFailed: 0,
                    messagesRead: 0,
                    totalMessages: 0,
                    todayMessages: 0,
                    thisMonthMessages: 0,
                    lastMonthMessages: 0,
                };
            }
            const response = await fetch(`/api/whatsapp/dashboard/stats?channelId=${channelId}`);
            if (!response.ok) {
                throw new Error("Failed to fetch dashboard stats");
            }
            return response.json();
        },
        enabled: true,
        refetchInterval: 30000, // Refresh every 30 seconds
    });
}
export function useAnalytics(days = 7, channelId) {
    return useQuery({
        queryKey: ["/api/whatsapp/analytics", days, channelId],
        queryFn: async () => {
            if (!channelId) {
                // Return empty data if no channel is selected
                return [];
            }
            const response = await fetch(`/api/whatsapp/analytics?days=${days}&channelId=${channelId}`);
            if (!response.ok) {
                throw new Error("Failed to fetch analytics data");
            }
            return response.json();
        },
        enabled: true,
    });
}
