'use strict';
export const OPENAI_VOICES = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral, versatile voice' },
    { id: 'echo', name: 'Echo', description: 'Warm, engaging voice' },
    { id: 'shimmer', name: 'Shimmer', description: 'Expressive, dynamic voice' },
    { id: 'ash', name: 'Ash', description: 'Calm, measured voice' },
    { id: 'ballad', name: 'Ballad', description: 'Warm, melodic voice' },
    { id: 'coral', name: 'Coral', description: 'Clear, friendly voice' },
    { id: 'sage', name: 'Sage', description: 'Thoughtful, wise voice' },
    { id: 'verse', name: 'Verse', description: 'Poetic, expressive voice' },
    { id: 'cedar', name: 'Cedar', description: 'Deep, grounded voice' },
    { id: 'marin', name: 'Marin', description: 'Bright, cheerful voice' },
];
export const MODEL_TIER_CONFIG = {
    free: {
        models: ['gpt-realtime-mini', 'gpt-4o-mini-realtime-preview'],
        safeFallback: 'gpt-realtime-mini',
        description: 'GPT Realtime Mini - Cost-effective model',
    },
    pro: {
        models: ['gpt-realtime-2', 'gpt-realtime-translate', 'gpt-realtime-whisper', 'gpt-realtime-1.5', 'gpt-realtime', 'gpt-realtime-mini', 'gpt-4o-realtime-preview', 'gpt-4o-mini-realtime-preview'],
        safeFallback: 'gpt-realtime-mini',
        description: 'Full model access including GPT Realtime 2 and 1.5 (recommended)',
    },
};
