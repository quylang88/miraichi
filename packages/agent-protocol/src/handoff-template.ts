/**
 * Agent Protocol Handoff Templates and Schema Validation.
 * Enforces structured schema validation for agent coordination.
 */

export const HANDOFF_SCHEMA = {
  fromAgent: 'string',
  toAgent: 'string',
  taskId: 'string',
  payload: 'object',
  timestamp: 'string'
};

/**
 * Creates a schema-validated handoff packet.
 *
 * @param {object} params
 * @param {string} params.fromAgent
 * @param {string} params.toAgent
 * @param {string} params.taskId
 * @param {object} params.payload
 * @returns {object} The validated handoff packet.
 */
export function createHandoffPacket({ fromAgent, toAgent, taskId, payload }: {fromAgent: string, toAgent: string, taskId: string, payload: unknown}) {
  const packet = {
    fromAgent,
    toAgent,
    taskId,
    payload,
    timestamp: new Date().toISOString()
  };
  
  validateHandoff(packet);
  return packet;
}

/**
 * Validates a handoff packet against the protocol schema.
 * Throws an error if the packet is invalid.
 *
 * @param {object} packet
 * @returns {boolean}
 */
export function validateHandoff(packetInput: unknown) {
  if (!packetInput || typeof packetInput !== 'object') {
    throw new Error('[Agent Protocol] Invalid handoff packet: payload must be an object.');
  }
  const packet = packetInput as Record<string, unknown>;
  
  for (const [key, type] of Object.entries(HANDOFF_SCHEMA)) {
    if (!(key in packet)) {
      throw new Error(`[Agent Protocol] Validation Error: Missing required schema key '${key}'`);
    }
    const actualType = typeof packet[key];
    if (actualType !== type) {
      throw new Error(`[Agent Protocol] Validation Error: Schema key '${key}' must be of type '${type}' (got '${actualType}')`);
    }
  }
  
  return true;
}
