import { registerRoutes as registerWhatsAppRoutes } from "./index";
import { initializeSocket } from "../../websocket/whatsappSocket";
/**
 * Mount the WhatsApp (WhatsWay) API under /api/whatsapp and attach
 * inbox realtime (Socket.IO + /ws/whatsapp) onto the shared HTTP server.
 */
export async function registerWhatsAppModule(app, httpServer) {
    await registerWhatsAppRoutes(app, httpServer);
    initializeSocket(httpServer);
    console.log("✅ WhatsApp module mounted at /api/whatsapp");
}
