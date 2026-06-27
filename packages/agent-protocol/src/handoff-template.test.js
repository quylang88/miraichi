import { describe, expect, it } from 'vitest';
import { createHandoffPacket, validateHandoff } from './handoff-template.js';

describe('agent handoff protocol', () => {
  it('creates schema-valid handoff packets with timestamps', () => {
    const packet = createHandoffPacket({
      fromAgent: 'Planner Agent',
      toAgent: 'QA Agent',
      taskId: 'task-001',
      payload: { nextAction: 'verify tests' }
    });

    expect(packet).toMatchObject({
      fromAgent: 'Planner Agent',
      toAgent: 'QA Agent',
      taskId: 'task-001',
      payload: { nextAction: 'verify tests' }
    });
    expect(new Date(packet.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('rejects packets missing required schema keys', () => {
    expect(() => validateHandoff({ fromAgent: 'Planner Agent' })).toThrow(
      /Missing required schema key/
    );
  });
});
