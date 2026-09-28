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
/**
 * ElevenLabsFlowCompiler - Translates visual flow nodes into ElevenLabs workflow format
 *
 * ElevenLabs workflow format uses:
 * - nodes: Object keyed by node ID
 * - edges: Object keyed by edge ID
 * - Node types: start, override_agent, end, phone_number, standalone_agent, tool
 * - Edge forward_condition types: unconditional, llm, result, expression
 */
export class ElevenLabsFlowCompiler {
    nodes;
    edges;
    compiledNodes = {};
    compiledEdges = {};
    edgeIdCounter = 0;
    entryNodeId = null;
    constructor(nodes, edges) {
        this.nodes = nodes;
        this.edges = edges;
    }
    compile() {
        const startNode = this.findStartNode();
        this.entryNodeId = startNode?.id || null;
        let firstMessage;
        if (startNode) {
            const nodeType = this.getNodeType(startNode);
            const config = (startNode.data?.config || {});
            if (nodeType === 'message' && config.message) {
                const message = config.message;
                firstMessage = message;
                const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
                console.log(`📝 Extracted first_message from entry node: "${preview}"`);
            }
        }
        // Detect appointment nodes for webhook tool registration
        const hasAppointmentNodes = this.nodes.some(node => {
            const nodeType = this.getNodeType(node);
            return nodeType === 'appointment';
        });
        if (hasAppointmentNodes) {
            console.log(`📅 Flow contains appointment nodes - will register webhook tool`);
        }
        const startNodeId = 'start_node';
        this.compiledNodes[startNodeId] = {
            type: 'start',
            position: { x: 0, y: 0 },
            edge_order: []
        };
        this.nodes.forEach(node => {
            const compiledNode = this.compileNode(node);
            if (compiledNode) {
                this.compiledNodes[node.id] = compiledNode;
            }
        });
        this.processEdges();
        if (startNode) {
            const entryEdgeId = 'start_to_entry';
            this.compiledEdges[entryEdgeId] = {
                source: startNodeId,
                target: startNode.id,
                forward_condition: { type: 'unconditional' }
            };
            this.compiledNodes[startNodeId].edge_order.push(entryEdgeId);
        }
        return {
            workflow: {
                nodes: this.compiledNodes,
                edges: this.compiledEdges
            },
            firstMessage,
            hasAppointmentNodes
        };
    }
    findStartNode() {
        const explicitStart = this.nodes.find(n => {
            const nodeType = this.getNodeType(n);
            return nodeType === 'start' || nodeType === 'trigger';
        });
        if (explicitStart)
            return explicitStart;
        const nodesWithIncoming = new Set(this.edges.map(e => e.target));
        for (const node of this.nodes) {
            if (!nodesWithIncoming.has(node.id) && this.getNodeType(node) !== 'condition') {
                return node;
            }
        }
        return this.nodes.find(n => this.getNodeType(n) !== 'condition');
    }
    getNodeType(node) {
        const data = node.data || {};
        const config = data.config || {};
        return config.type || node.type || 'unknown';
    }
    generateEdgeId(source, target) {
        this.edgeIdCounter++;
        return `edge_${source}_to_${target}_${this.edgeIdCounter}`;
    }
    compileNode(node) {
        const nodeType = this.getNodeType(node);
        const config = (node.data?.config || {});
        const position = node.position || { x: 0, y: 0 };
        switch (nodeType) {
            case 'start':
            case 'trigger':
                return null;
            case 'message':
                const isEntryNode = node.id === this.entryNodeId;
                const messageText = config.message || 'Hello';
                return {
                    type: 'override_agent',
                    position,
                    edge_order: [],
                    label: config.label || 'Message',
                    additional_prompt: isEntryNode
                        ? `CRITICAL: Your first message was already configured. After speaking it, wait for the user's response before proceeding.`
                        : `CRITICAL INSTRUCTION - SAY THIS EXACT MESSAGE VERBATIM:
---
${messageText}
---
Do NOT paraphrase, summarize, add to, or modify this message in ANY way. Say it EXACTLY as written above, word for word.`,
                    additional_tool_ids: [],
                    additional_knowledge_base: [],
                    conversation_config: {}
                };
            case 'question':
                const questionText = config.question || 'How can I help you?';
                return {
                    type: 'override_agent',
                    position,
                    edge_order: [],
                    label: config.label || 'Question',
                    additional_prompt: `CRITICAL INSTRUCTION - ASK THIS EXACT QUESTION VERBATIM:
---
${questionText}
---
Do NOT rephrase or modify this question. Ask it EXACTLY as written above.
After asking, listen carefully to their response and remember it for variable: ${config.variableName || 'response'}`,
                    additional_tool_ids: [],
                    additional_knowledge_base: [],
                    conversation_config: {}
                };
            case 'transfer':
                return {
                    type: 'phone_number',
                    position,
                    edge_order: [],
                    transfer_destination: {
                        type: 'phone',
                        phone_number: config.phoneNumber || config.transferNumber || ''
                    },
                    transfer_type: config.transferType || 'conference'
                };
            case 'end':
                return {
                    type: 'end',
                    position,
                    edge_order: []
                };
            case 'delay':
                return {
                    type: 'override_agent',
                    position,
                    edge_order: [],
                    label: config.label || 'Delay',
                    additional_prompt: `Pause briefly. You can say "${config.message || 'One moment please...'}" while pausing.`,
                    additional_tool_ids: [],
                    additional_knowledge_base: [],
                    conversation_config: {}
                };
            case 'appointment':
                const apptServiceName = config.serviceName || config.service || 'appointment';
                const apptDuration = config.duration || 30;
                const apptIntroMessage = config.message || config.confirmMessage || 'I can help you schedule an appointment. What date and time works best for you?';
                return {
                    type: 'override_agent',
                    position,
                    edge_order: [],
                    label: config.label || 'Appointment',
                    additional_prompt: `Say exactly: "${apptIntroMessage}"

APPOINTMENT BOOKING INSTRUCTIONS:
1. After the caller responds, collect the following information:
   - Their name (if not already known)
   - Preferred date for the appointment
   - Preferred time for the appointment
   - Phone number (use the caller's number if available)
   - Email address (optional)

2. Once you have collected the date, time, and caller name, IMMEDIATELY use the book_appointment tool to save the appointment.
   - Pass the caller's name as contactName
   - Pass the caller's phone number as contactPhone
   - Pass the date as appointmentDate (format: YYYY-MM-DD)
   - Pass the time as appointmentTime (format: HH:MM)
   - Pass ${apptDuration} as duration
   - Pass "${apptServiceName}" as serviceName
   - Pass any notes as notes

3. After successfully booking, confirm the appointment details to the caller.
4. If booking fails, apologize and offer to try again. If it fails a second time, let the caller know someone will follow up with them and proceed to the next step.

Then stop speaking and wait for response.`,
                    additional_tool_ids: [],
                    additional_knowledge_base: [],
                    conversation_config: {}
                };
            case 'form':
                return {
                    type: 'override_agent',
                    position,
                    edge_order: [],
                    label: config.label || 'Form',
                    additional_prompt: `Collect information from the user.
Say: "${config.message || 'I need to collect some information from you.'}"`,
                    additional_tool_ids: [],
                    additional_knowledge_base: [],
                    conversation_config: {}
                };
            case 'webhook':
                const toolId = config.name || `webhook_${node.id}`;
                return {
                    type: 'tool',
                    position,
                    edge_order: [],
                    tools: [{ tool_id: toolId }]
                };
            case 'condition':
                return null;
            default:
                return {
                    type: 'override_agent',
                    position,
                    edge_order: [],
                    label: config.label || nodeType || 'Node',
                    additional_prompt: config.message || 'Continue the conversation naturally.',
                    additional_tool_ids: [],
                    additional_knowledge_base: [],
                    conversation_config: {}
                };
        }
    }
    processEdges() {
        const edgesToConditions = new Map();
        const conditionNodeIds = new Set(this.nodes
            .filter(n => this.getNodeType(n) === 'condition')
            .map(n => n.id));
        this.edges.forEach(edge => {
            if (conditionNodeIds.has(edge.target)) {
                edgesToConditions.set(edge.target, edge);
            }
            else if (conditionNodeIds.has(edge.source)) {
                this.processConditionEdge(edge, edgesToConditions);
            }
            else {
                this.addEdge(edge.source, edge.target, { type: 'unconditional' });
            }
        });
    }
    processConditionEdge(edge, edgesToConditions) {
        const conditionNode = this.nodes.find(n => n.id === edge.source);
        if (!conditionNode)
            return;
        const incomingEdge = edgesToConditions.get(conditionNode.id);
        if (!incomingEdge)
            return;
        const config = (conditionNode.data?.config || {});
        const conditions = config.conditions || [];
        let conditionText = '';
        if (conditions.length > 0) {
            const matchingCondition = conditions.find((c) => c.targetNodeId === edge.target);
            if (matchingCondition) {
                conditionText = this.buildConditionText(matchingCondition, config);
            }
            else {
                const handleCondition = conditions.find((c) => c.id === edge.sourceHandle || c.label === edge.sourceHandle);
                if (handleCondition) {
                    conditionText = this.buildConditionText(handleCondition, config);
                }
            }
        }
        if (!conditionText && edge.sourceHandle) {
            if (edge.sourceHandle === 'true' || edge.sourceHandle === 'yes') {
                conditionText = 'The user indicates agreement, affirmation, or "yes"';
            }
            else if (edge.sourceHandle === 'false' || edge.sourceHandle === 'no') {
                conditionText = 'The user indicates disagreement, refusal, or "no"';
            }
            else {
                conditionText = `The user response matches "${edge.sourceHandle}"`;
            }
        }
        const forwardCondition = conditionText
            ? { type: 'llm', condition: conditionText }
            : { type: 'unconditional' };
        this.addEdge(incomingEdge.source, edge.target, forwardCondition);
    }
    buildConditionText(condition, nodeConfig) {
        const conditionType = condition.type || 'keyword';
        const value = condition.value || condition.label || '';
        if (conditionType === 'yes_no') {
            if (value.toLowerCase() === 'yes') {
                return 'The user indicates agreement, affirmation, or "yes"';
            }
            else if (value.toLowerCase() === 'no') {
                return 'The user indicates disagreement, refusal, or "no"';
            }
        }
        if (conditionType === 'sentiment') {
            if (value.toLowerCase() === 'positive' || value.toLowerCase() === 'interested') {
                return 'The user response has a positive sentiment or shows interest';
            }
            else if (value.toLowerCase() === 'negative' || value.toLowerCase() === 'not_interested') {
                return 'The user response has a negative sentiment or shows disinterest';
            }
            else if (value.toLowerCase() === 'neutral') {
                return 'The user response has a neutral sentiment';
            }
        }
        if (value) {
            return `The user response contains or matches "${value}"`;
        }
        return '';
    }
    addEdge(source, target, forwardCondition) {
        if (!this.compiledNodes[source])
            return;
        const edgeId = this.generateEdgeId(source, target);
        this.compiledEdges[edgeId] = {
            source,
            target,
            forward_condition: forwardCondition
        };
        const sourceNode = this.compiledNodes[source];
        if (sourceNode && 'edge_order' in sourceNode) {
            sourceNode.edge_order.push(edgeId);
        }
    }
    validate() {
        const errors = [];
        const nodeCount = Object.keys(this.compiledNodes).length;
        if (nodeCount <= 1) {
            errors.push('Workflow must have at least one node besides start');
        }
        if (!this.compiledNodes['start_node']) {
            errors.push('Workflow must have a start node');
        }
        Object.entries(this.compiledEdges).forEach(([edgeId, edge]) => {
            if (!this.compiledNodes[edge.target]) {
                errors.push(`Edge ${edgeId} targets non-existent node ${edge.target}`);
            }
        });
        return {
            valid: errors.length === 0,
            errors
        };
    }
}
