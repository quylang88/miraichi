import { describe, expect, it } from 'vitest';
import type { AddBetDraft } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { ADD_BET_BACKUP_SCHEMA_VERSION } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { createMemoryAddBetDraftAdapter } from './add-bet-draft-memory-adapter.js';
import {
  exportAddBetDraftBackup,
  importAddBetDraftBackup,
  parseAddBetDraftBackup
} from './add-bet-draft-backup.js';

function createDraft(overrides: Partial<AddBetDraft> = {}): AddBetDraft {
  return {
    draftId: 'draft-001',
    matchGroupId: 'match-group-001',
    marketType: 'custom',
    customMarketLabel: 'Player shots',
    oddsFormat: 'HK',
    oddsValue: 0.88,
    stakePoints: 6,
    createdAt: '2026-06-27T12:00:00.000Z',
    updatedAt: '2026-06-27T12:01:00.000Z',
    ...overrides
  };
}

describe('add bet draft backup helpers', () => {
  it('exports versioned JSON for selected match groups', async () => {
    const adapter = createMemoryAddBetDraftAdapter([
      createDraft({ draftId: 'draft-a', matchGroupId: 'match-group-001' }),
      createDraft({ draftId: 'draft-b', matchGroupId: 'match-group-002' })
    ]);

    const backupJson = await exportAddBetDraftBackup({
      adapter,
      matchGroupIds: ['match-group-001', 'match-group-002'],
      exportedAt: '2026-06-27T12:30:00.000Z'
    });
    const parsed = JSON.parse(backupJson);

    expect(parsed).toMatchObject({
      schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-06-27T12:30:00.000Z',
      sourceApp: 'miraichi',
      records: []
    });
    expect(parsed.drafts.map((draft: AddBetDraft) => draft.draftId)).toEqual(['draft-a', 'draft-b']);
  });

  it('parses valid backup JSON and rejects malformed JSON', () => {
    const backup = parseAddBetDraftBackup(
      JSON.stringify({
        schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-06-27T12:30:00.000Z',
        sourceApp: 'miraichi',
        records: [],
        drafts: [createDraft()]
      })
    );

    expect(backup.ok).toBe(true);
    expect(backup.envelope?.drafts?.[0]?.draftId).toBe('draft-001');

    expect(parseAddBetDraftBackup('{bad-json')).toEqual({
      ok: false,
      errorCode: 'malformed_backup'
    });
  });

  it('rejects unsupported schema versions and missing envelope fields', () => {
    expect(
      parseAddBetDraftBackup(
        JSON.stringify({
          schemaVersion: 'old-version',
          exportedAt: '2026-06-27T12:30:00.000Z',
          sourceApp: 'miraichi',
          records: []
        })
      )
    ).toEqual({
      ok: false,
      errorCode: 'unsupported_schema'
    });

    expect(parseAddBetDraftBackup(JSON.stringify({ schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION }))).toEqual({
      ok: false,
      errorCode: 'malformed_backup'
    });
  });

  it('imports backup drafts through the adapter after schema validation', async () => {
    const adapter = createMemoryAddBetDraftAdapter();
    const draft = createDraft();

    const result = await importAddBetDraftBackup({
      adapter,
      rawBackupJson: JSON.stringify({
        schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-06-27T12:30:00.000Z',
        sourceApp: 'miraichi',
        records: [],
        drafts: [draft]
      })
    });

    expect(result).toEqual({ ok: true });
    expect(await adapter.loadDraft('draft-001')).toEqual(draft);
  });

  it('rejects draft import conflicts without overwriting or partially importing', async () => {
    const existingDraft = createDraft({ draftId: 'draft-existing', oddsValue: 0.77 });
    const adapter = createMemoryAddBetDraftAdapter([existingDraft]);

    const result = await importAddBetDraftBackup({
      adapter,
      rawBackupJson: JSON.stringify({
        schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-06-27T12:30:00.000Z',
        sourceApp: 'miraichi',
        records: [],
        drafts: [
          createDraft({ draftId: 'draft-existing', oddsValue: 0.88 }),
          createDraft({ draftId: 'draft-new' })
        ]
      })
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'partial_import_conflict'
    });
    expect(await adapter.loadDraft('draft-existing')).toEqual(existingDraft);
    expect(await adapter.loadDraft('draft-new')).toBeNull();
  });
});
