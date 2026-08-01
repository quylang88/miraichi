import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseFootballTxt } from './football-txt-parser.js';

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

describe('parseFootballTxt', () => {
  it('parses scheduled and completed club rows with inherited year and time', async () => {
    const result = parseFootballTxt(await fixture('england-premier-league-level1.txt'));

    expect(result.issues).toEqual([]);
    expect(result.competitionHeader).toBe('English Premier League 2026/27');
    expect(result.matches).toHaveLength(4);
    expect(result.matches[3]).toMatchObject({
      lineNumber: 10,
      round: 'Matchday 1',
      localDate: '2026-08-22',
      localTime: '15:00',
      timeWasInherited: true,
      sourceHomeName: 'Nottingham Forest FC',
      sourceAwayName: 'Leeds United FC',
      fullTimeScore: null,
      halfTimeScore: null
    });
    expect(result.matches[2]).toMatchObject({
      fullTimeScore: { home: 2, away: 1 },
      halfTimeScore: { home: 1, away: 0 }
    });
  });

  it('parses national-team rows with offsets, venues, and balanced scoring details', async () => {
    const result = parseFootballTxt(await fixture('world-cup-level1.txt'));

    expect(result.issues).toEqual([]);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toMatchObject({
      localDate: '2026-06-11',
      explicitUtcOffsetMinutes: -360,
      fullTimeScore: { home: 2, away: 0 },
      halfTimeScore: { home: 1, away: 0 },
      venue: 'Mexico City'
    });
    expect(result.matches[1]).toMatchObject({ venue: 'Guadalajara (Zapopan)' });
  });

  it.each([
    [
      'ambiguous numeric date',
      '= Cup 2026\n▪ Round 1\n  11/06/2026\n',
      'ambiguous_date',
      true
    ],
    [
      'first match without a kickoff time',
      '= Cup 2026\n▪ Round 1\n  Sat Aug 22\n    Team Alpha v Team Beta\n',
      'missing_kickoff_time',
      false
    ],
    [
      'negative completed score',
      '= Cup 2026\n▪ Round 1\n  Sat Aug 22\n    12:30  Team Alpha -1-2 Team Beta\n',
      'impossible_score',
      true
    ],
    [
      'unrecognized non-comment content',
      '= Cup 2026\n▪ Round 1\n  unexpected metadata payload\n',
      'unrecognized_line',
      true
    ]
  ] as const)('reports %s with its exact issue code', (_case, text, code, fatal) => {
    const result = parseFootballTxt(text);

    expect(result.issues).toEqual([
      expect.objectContaining({ code, fatal })
    ]);
  });

  it('withholds a row without a time instead of carrying time across date blocks', () => {
    const result = parseFootballTxt(
      '= Cup 2026\n▪ Round 1\n  Fri Aug 21\n    20:00  Team Alpha v Team Beta\n  Sat Aug 22\n    Team Gamma v Team Delta\n'
    );

    expect(result.matches).toHaveLength(1);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'missing_kickoff_time', lineNumber: 6, fatal: false })
    ]);
  });

  it('treats comments, roster metadata, and a directly-following balanced detail block as non-serving metadata', () => {
    const result = parseFootballTxt(
      "= Cup 2026\n#### retained comment\n## another comment\n# source comment\nGroup A | Alpha Beta\n▪ Group A\n  Thu June 11\n    12:30  Team Alpha 2-1 (1-0) Team Beta\n      (Scorer 12')\n"
    );

    expect(result.issues).toEqual([]);
    expect(result.matches).toHaveLength(1);
  });

  it('rejects a stray or unbalanced scoring-detail block', () => {
    const stray = parseFootballTxt('= Cup 2026\n▪ Round 1\n  Thu June 11\n    12:30  Team Alpha v Team Beta\n      (Stray)\n');
    const unindented = parseFootballTxt('= Cup 2026\n▪ Round 1\n  Thu June 11\n    12:30  Team Alpha 2-1 Team Beta\n(Unindented)\n');
    const unbalanced = parseFootballTxt('= Cup 2026\n▪ Round 1\n  Thu June 11\n    12:30  Team Alpha 2-1 Team Beta\n      (Unfinished\n');

    expect(stray.issues).toEqual([expect.objectContaining({ code: 'unrecognized_line', fatal: true })]);
    expect(unindented.issues).toEqual([expect.objectContaining({ code: 'unrecognized_line', fatal: true })]);
    expect(unbalanced.issues).toEqual([expect.objectContaining({ code: 'unrecognized_line', fatal: true })]);
  });

  it('reports fatal structural prerequisites without producing a match', () => {
    const missingHeader = parseFootballTxt('▪ Round 1\n  Thu June 11 2026\n    12:30  Team Alpha v Team Beta\n');
    const missingRound = parseFootballTxt('= Cup 2026\n  Thu June 11\n    12:30  Team Alpha v Team Beta\n');

    expect(missingHeader.matches).toEqual([]);
    expect(missingHeader.issues).toEqual([expect.objectContaining({ code: 'missing_competition_header', fatal: true })]);
    expect(missingRound.matches).toEqual([]);
    expect(missingRound.issues).toEqual([expect.objectContaining({ code: 'missing_round', fatal: true })]);
  });
});
