export class ChannelAdapter {
    async validateConfiguration() {
        throw new Error("validateConfiguration must be implemented");
    }

    async prepareRecipient() {
        throw new Error("prepareRecipient must be implemented");
    }

    async dispatch() {
        throw new Error("dispatch must be implemented");
    }

    async cancel() {
        throw new Error("cancel must be implemented");
    }

    async retry() {
        throw new Error("retry must be implemented");
    }

    async processWebhook() {
        throw new Error("processWebhook must be implemented");
    }

    normalizeStatus() {
        throw new Error("normalizeStatus must be implemented");
    }
}
