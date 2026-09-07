import type { Express } from "express";
import type { Server } from "http";
import { registerRoutes as registerWhatsAppRoutes } from "./routes/index";
import { initializeSocket } from "./socket";

/**
 * Mount the WhatsApp (WhatsWay) API under /api/whatsapp and attach
 * inbox realtime (Socket.IO + /ws/whatsapp) onto the shared HTTP server.
 */
export async function registerWhatsAppModule(app: Express, httpServer: Server): Promise<void> {
  await registerWhatsAppRoutes(app, httpServer);
  initializeSocket(httpServer);
  console.log("✅ WhatsApp module mounted at /api/whatsapp");
}
