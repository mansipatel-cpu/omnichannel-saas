'use strict';
import { WebSocketServer } from 'ws';
import { ElevenLabsBridgeService } from '../services/elevenlabs-bridge.service';
/**
 * Setup Plivo-ElevenLabs WebSocket stream handler on the HTTP server
 */
export function setupPlivoElevenLabsStream(httpServer) {
    const wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (request, socket, head) => {
        const pathname = request.url?.split('?')[0] || '';
        if (pathname.startsWith('/api/plivo-elevenlabs/stream/')) {
            const callUuid = pathname.split('/api/plivo-elevenlabs/stream/')[1];
            if (!callUuid) {
                console.error(`[Plivo-ElevenLabs Stream] Invalid stream URL: ${pathname}`);
                socket.destroy();
                return;
            }
            console.log(`✅ [Plivo-ElevenLabs Stream] Handling WebSocket upgrade for call: ${callUuid}`);
            wss.handleUpgrade(request, socket, head, async (ws) => {
                console.log(`✅ [Plivo-ElevenLabs Stream] WebSocket connected for call: ${callUuid}`);
                handleStreamConnection(ws, callUuid);
            });
        }
    });
    console.log('✅ Plivo-ElevenLabs WebSocket stream endpoint registered');
}
/**
 * Handle Plivo stream WebSocket connection
 */
function handleStreamConnection(ws, callUuid) {
    let streamSid = null;
    let isConnected = false;
    let sessionMissing = false;
    let audioDropped = 0;
    let sessionEnded = false;
    ws.on('message', async (data) => {
        try {
            const rawData = typeof data === 'string' ? data : data.toString('utf8');
            const message = JSON.parse(rawData);
            switch (message.event) {
                case 'connected':
                    console.log(`[Plivo-ElevenLabs Stream] Connected event for ${callUuid}`);
                    break;
                case 'start':
                    streamSid = message.start?.streamSid || message.streamSid || null;
                    console.log(`[Plivo-ElevenLabs Stream] Stream started: ${streamSid}`);
                    if (message.start?.mediaFormat) {
                        console.log(`[Plivo-ElevenLabs Stream] Media format: ${JSON.stringify(message.start.mediaFormat)}`);
                    }
                    if (!ElevenLabsBridgeService.hasSession(callUuid)) {
                        console.error(`[Plivo-ElevenLabs Stream] ERROR: No session found for ${callUuid}. Audio will be dropped.`);
                        console.error(`[Plivo-ElevenLabs Stream] Session must be created by /incoming webhook or outbound call service before stream connects.`);
                        sessionMissing = true;
                    }
                    else {
                        ElevenLabsBridgeService.setPlivoWebSocket(callUuid, ws, streamSid || '');
                        isConnected = true;
                    }
                    break;
                case 'media':
                    if (sessionMissing) {
                        audioDropped++;
                        if (audioDropped === 1 || audioDropped % 100 === 0) {
                            console.warn(`[Plivo-ElevenLabs Stream] Dropping audio (${audioDropped} chunks) - no session for ${callUuid}`);
                        }
                        return;
                    }
                    if (message.media?.payload && isConnected) {
                        await ElevenLabsBridgeService.handlePlivoAudio(callUuid, message.media.payload);
                    }
                    break;
                case 'stop':
                    console.log(`[Plivo-ElevenLabs Stream] Stream stopped: ${message.stop?.reason}`);
                    if (audioDropped > 0) {
                        console.warn(`[Plivo-ElevenLabs Stream] Total audio chunks dropped: ${audioDropped}`);
                    }
                    isConnected = false;
                    break;
                default:
                    break;
            }
        }
        catch (error) {
            console.error(`[Plivo-ElevenLabs Stream] Error processing message:`, error.message);
        }
    });
    ws.on('close', async (code, reason) => {
        console.log(`[Plivo-ElevenLabs Stream] WebSocket closed for ${callUuid}: ${code}`);
        isConnected = false;
        if (!sessionMissing && !sessionEnded) {
            sessionEnded = true;
            try {
                const result = await ElevenLabsBridgeService.endSession(callUuid);
                console.log(`[Plivo-ElevenLabs Stream] Session ended: duration=${result.duration}s, transcript parts=${result.transcript.length}`);
            }
            catch (err) {
                console.error(`[Plivo-ElevenLabs Stream] Error ending session:`, err.message);
            }
        }
    });
    ws.on('error', (error) => {
        console.error(`[Plivo-ElevenLabs Stream] WebSocket error for ${callUuid}:`, error);
        isConnected = false;
    });
}
