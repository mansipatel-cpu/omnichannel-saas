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

import { apiRequest } from "./queryClient";

export const api = {
  // Dashboard
  getDashboardStats: (channelId?: string) => apiRequest("GET", `/api/whatsapp/dashboard/stats${channelId ? `?channelId=${channelId}` : ""}`),
  getAnalytics: (days?: number, channelId?: string) => {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    if (channelId) params.append('channelId', channelId);
    return apiRequest("GET", `/api/whatsapp/analytics${params.toString() ? `?${params.toString()}` : ""}`);
  },

  getContacts: (
  search: string | undefined,
  channelId: string | undefined,
  page: number,
  limit: number,
  groupFilter: string | undefined,
  statusFilter: string | undefined,
  createdBy: string        // ✅ required now
) => {
  const params = new URLSearchParams();

  if (search?.trim()) params.append("search", search.trim());
  if (channelId) params.append("channelId", channelId);
  if (page) params.append("page", page.toString());
  if (limit) params.append("limit", limit.toString());
  if (groupFilter) params.append("group", groupFilter);
  if (statusFilter) params.append("status", statusFilter);

  // ✅ ALWAYS send createdBy
  params.append("createdBy", createdBy);

  const queryString = params.toString();

  return apiRequest(
    "GET",
    `/api/whatsapp/contacts${queryString ? `?${queryString}` : ""}`
  );
},


getAllContacts: (
  search?: string,
  page?: number,
  limit?: number,
  groupFilter?: string,
  statusFilter?: string,
) => {
  const params = new URLSearchParams();

  if (search?.trim()) params.append("search", search.trim());
  if (page) params.append("page", String(page));
  if (limit) params.append("limit", String(limit));
  if (groupFilter) params.append("group", groupFilter);
  if (statusFilter) params.append("status", statusFilter);

  // 🟦 SUPERADMIN → DO NOT SEND createdBy or channelId (ever)

  const query = params.toString();

  return apiRequest(
    "GET",
    `/api/whatsapp/contacts${query ? `?${query}` : ""}`
  );
},


  getContact: (id: string) => apiRequest("GET", `/api/whatsapp/contacts/${id}`),
  createContact: (data: any, channelId?: string) => apiRequest("POST", `/api/whatsapp/contacts${channelId ? `?channelId=${channelId}` : ""}`, data),
  updateContact: (id: string, data: any) => apiRequest("PUT", `/api/whatsapp/contacts/${id}`, data),
  deleteContact: (id: string) => apiRequest("DELETE", `/api/whatsapp/contacts/${id}`),

  // Campaigns
  getCampaigns: (channelId?: string) => apiRequest("GET", `/api/whatsapp/campaigns${channelId ? `?channelId=${channelId}` : ""}`),
  getCampaign: (id: string) => apiRequest("GET", `/api/whatsapp/campaigns/${id}`),
  createCampaign: (data: any, channelId?: string) => apiRequest("POST", `/api/whatsapp/campaigns${channelId ? `?channelId=${channelId}` : ""}`, data),
  updateCampaign: (id: string, data: any) => apiRequest("PUT", `/api/whatsapp/campaigns/${id}`, data),
  deleteCampaign: (id: string) => apiRequest("DELETE", `/api/whatsapp/campaigns/${id}`),

  // Templates
  getTemplates: (channelId?: string) => apiRequest("GET", `/api/whatsapp/templates${channelId ? `?channelId=${channelId}` : ""}`),
  getTemplate: (id: string) => apiRequest("GET", `/api/whatsapp/templates/${id}`),
  createTemplate: (data: any) => apiRequest("POST", "/api/whatsapp/templates", data),
  updateTemplate: (id: string, data: any) => apiRequest("PUT", `/api/whatsapp/templates/${id}`, data),
  deleteTemplate: (id: string) => apiRequest("DELETE", `/api/whatsapp/templates/${id}`),

  // Conversations
  getConversations: (channelId?: string) => apiRequest("GET", `/api/whatsapp/conversations${channelId ? `?channelId=${channelId}` : ""}`),
  getConversation: (id: string) => apiRequest("GET", `/api/whatsapp/conversations/${id}`),
  createConversation: (data: any) => apiRequest("POST", "/api/whatsapp/conversations", data),
  updateConversation: (id: string, data: any) => apiRequest("PUT", `/api/whatsapp/conversations/${id}`, data),

  // Messages
  getMessages: (conversationId: string, before?: string) => apiRequest("GET", `/api/whatsapp/conversations/${conversationId}/messages?limit=100${before ? `&before=${encodeURIComponent(before)}` : ""}`),
  createMessage: (conversationId: string, data: any) => apiRequest("POST", `/api/whatsapp/conversations/${conversationId}/messages`, data),

  // Automations
  getAutomations: (channelId?: string) => apiRequest("GET", `/api/whatsapp/automations${channelId ? `?channelId=${channelId}` : ""}`),
  getAutomation: (id: string) => apiRequest("GET", `/api/whatsapp/automations/${id}`),
  createAutomation: (data: any, channelId?: string) => apiRequest("POST", `/api/whatsapp/automations${channelId ? `?channelId=${channelId}` : ""}`, data),
  updateAutomation: (id: string, data: any) => apiRequest("PUT", `/api/whatsapp/automations/${id}`, data),
  deleteAutomation: (id: string) => apiRequest("DELETE", `/api/whatsapp/automations/${id}`),

  // ====================== CHATBOT CRUD ======================
  createChatbot: (data: unknown) => apiRequest("POST", "/api/whatsapp/chatbots", data),
  getAllChatbots: () => apiRequest("GET", "/api/whatsapp/chatbots"),
  getChatbot: (id: any) => apiRequest("GET", `/api/whatsapp/chatbots/${id}`),
  updateChatbot: (id: any, data: unknown) => apiRequest("PUT", `/api/whatsapp/chatbots/${id}`, data),
  deleteChatbot: (id: any) => apiRequest("DELETE", `/api/whatsapp/chatbots/${id}`),

  // ====================== TRAINING DATA ======================
  addTrainingData: (data: unknown) => apiRequest("POST", "/api/whatsapp/training-data", data),
  getTrainingData: (chatbotId: any) => apiRequest("GET", `/api/whatsapp/training-data/${chatbotId}`),
  deleteTrainingData: (id: any) => apiRequest("DELETE", `/api/whatsapp/training-data/${id}`),

  // ====================== CONVERSATIONS ======================
  sendMessage: (data: unknown) => apiRequest("POST", "/api/whatsapp/messages", data),
  getConversationMessages: (conversationId: any) =>
    apiRequest("GET", `/api/whatsapp/conversations/${conversationId}/messages`),

};
