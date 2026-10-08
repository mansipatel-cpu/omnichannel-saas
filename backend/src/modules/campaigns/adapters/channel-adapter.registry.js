import { VoiceChannelAdapter } from "./voice-channel.adapter";
import { WhatsAppChannelAdapter } from "./whatsapp-channel.adapter";

export class ChannelAdapterRegistry {
    constructor(adapters = {
        whatsapp: new WhatsAppChannelAdapter(),
        voice: new VoiceChannelAdapter(),
    }) {
        this.adapters = new Map(Object.entries(adapters));
    }

    get(channelType) {
        const adapter = this.adapters.get(channelType);
        if (!adapter)
            throw new Error(`Unsupported campaign channel: ${channelType}`);
        return adapter;
    }
}

export const channelAdapterRegistry = new ChannelAdapterRegistry();
