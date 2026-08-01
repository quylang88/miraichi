import { describe, expect, it } from 'vitest';
import { toOpenFootballKickoffUtc } from './openfootball-time.js';

describe('OpenFootball kickoff conversion', () => {
  it('converts a London local time to UTC using the source timezone', () => {
    expect(toOpenFootballKickoffUtc({
      localDate: '2026-08-21',
      localTime: '20:00',
      explicitUtcOffsetMinutes: null
    }, 'Europe/London')).toBe('2026-08-21T19:00:00Z');
  });

  it('uses an explicit source offset instead of the entry timezone', () => {
    expect(toOpenFootballKickoffUtc({
      localDate: '2026-07-04',
      localTime: '20:00',
      explicitUtcOffsetMinutes: -360
    }, 'Europe/London')).toBe('2026-07-05T02:00:00Z');
  });

  it.each([
    ['nonexistent', { localDate: '2026-03-08', localTime: '02:30', explicitUtcOffsetMinutes: null }],
    ['ambiguous', { localDate: '2026-11-01', localTime: '01:30', explicitUtcOffsetMinutes: null }]
  ])('rejects %s America/New_York local times', (_kind, match) => {
    expect(() => toOpenFootballKickoffUtc(match, 'America/New_York')).toThrow();
  });
});
