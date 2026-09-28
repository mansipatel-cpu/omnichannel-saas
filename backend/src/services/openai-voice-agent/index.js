'use strict';
/**
 * ============================================================
 * Shared OpenAI Voice Agent Service
 *
 * Common module for both Plivo and Twilio-OpenAI engines
 * Following OpenAI's official Voice Agents documentation
 * ============================================================
 */
export * from './types';
export { ConversationStatesCompiler } from './conversation-states-compiler';
export { FunctionToolBuilder } from './function-tool-builder';
export { hydrateCompiledFlow, hydrateCompiledTools, substituteContactVariables, } from './hydrator';
import { ConversationStatesCompiler } from './conversation-states-compiler';
import { FunctionToolBuilder } from './function-tool-builder';
/**
 * Main entry point for compiling flows to OpenAI Voice Agent format
 */
export class OpenAIVoiceAgentCompiler {
    /**
     * Compile a complete flow to OpenAI Voice Agent format
     * Returns system prompt with Conversation States JSON and function tools
     */
    static compileFlow(nodes, edges, config) {
        // Compile nodes to conversation states
        const compiled = ConversationStatesCompiler.compile(nodes, edges, config);
        // Build system prompt with embedded states JSON
        const systemPrompt = ConversationStatesCompiler.buildSystemPrompt(compiled);
        // Build function tools
        const tools = FunctionToolBuilder.buildTools(nodes, config);
        return {
            systemPrompt,
            firstMessage: compiled.firstMessage,
            tools,
            conversationStates: compiled.states,
        };
    }
    /**
     * Build tools for a natural agent (no flow)
     */
    static buildNaturalAgentTools(config) {
        return FunctionToolBuilder.buildTools([], config);
    }
}
