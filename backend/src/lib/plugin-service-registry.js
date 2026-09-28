/**
 * Global Plugin Service Registry
 *
 * This registry allows plugins to register their services when they load,
 * making them accessible to other parts of the application.
 *
 * Note: SipBatchCallingService was removed as Fonoster support was discontinued.
 * ElevenLabs SIP uses the batch calling API directly and doesn't need this registry.
 */
// Global registry instance
const registry = {};
/**
 * Check if any plugin services are registered
 */
export function hasRegisteredServices() {
    return Object.keys(registry).length > 0;
}
