import { describe, expect, it } from 'vitest';
import type { CloudMatchSnapshot } from '@miraichi/shared/src/contracts/index.js';
import { liveSnapshotFixture } from '../../../../../tests/fixtures/live-match-snapshot.js';
import type { PostgresQueryClient } from './postgres-query-client.js';
import { postgresJson } from './postgres-parameters.js';
import { createSupabaseCloudPersistenceAdapter } from './supabase-cloud-persistence-adapter.js';

class FakeClient implements PostgresQueryClient {
  readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];
  readonly queuedRows: Array<Record<string, unknown>[]> = [];
  transactions = 0;
  enqueueRows(...rows: Array<Record<string, unknown>[]>): void {
    this.queuedRows.push(...rows);
  }
  async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
    this.calls.push({ text, values });
    return { rows: (this.queuedRows.shift() ?? []) as T[], rowCount: 1 };
  }
  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return operation(this);
  }
}

function enqueueSnapshotStatusRows(client: FakeClient): void {
  client.enqueueRows(
    [{ snapshot_id: 'snapshot-001', generated_at: '2026-07-01T00:00:00.000Z', imported_at: '2026-07-01T00:01:00.000Z', sources: [] }],
    []
  );
}

describe('supabase cloud persistence adapter', () => {
  it('maps NULL adherence as absent and imports an absent value as SQL NULL', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    client.enqueueRows([{settlement_event_id:'s', owner_profile_id:'owner-primary', bet_id:'b', bankroll_account_id:'a', settlement_type:'full_win', plan_adherence:null, calculated_profit_loss_points:'9', ledger_delta_points:'9', effective_at:'2026-09-15T00:00:00.000Z', occurred_at:'2026-09-15T00:00:00.000Z'}]);
    const listed = await adapter.listBetSettlementEvents('owner-primary','b');
    expect(listed[0]).not.toHaveProperty('planAdherence');
    await adapter.importOwnerData('owner-primary', {
      schemaVersion:'miraichi.cloud-backup.v2', exportedAt:'2026-09-15T00:00:00.000Z', ownerProfileId:'owner-primary',
      drafts:[], bets:[], bankrollAccounts:[], bankrollLedgerEntries:[], disciplineConfigs:[],
      settlementEvents:[{settlementEventId:'s',ownerProfileId:'owner-primary',betId:'b',bankrollAccountId:'a',settlementType:'full_win',calculatedProfitLossPoints:9,ledgerDeltaPoints:9,effectiveAt:'2026-09-15T00:00:00.000Z',occurredAt:'2026-09-15T00:00:00.000Z'}]
    });
    const write=client.calls.find((call)=>call.text.includes('insert into miraichi_app.bet_settlement_event'))!;
    expect(write.values[5]).toBeNull();
    client.enqueueRows([], [], [], [], [], [{settlement_event_id:'s',owner_profile_id:'owner-primary',bet_id:'b',bankroll_account_id:'a',settlement_type:'full_win',plan_adherence:null,calculated_profit_loss_points:'9',ledger_delta_points:'9',effective_at:'2026-09-15T00:00:00.000Z',occurred_at:'2026-09-15T00:00:00.000Z'}]);
    const exported=await adapter.exportOwnerData('owner-primary','2026-09-15T00:00:00.000Z');
    expect(exported.schemaVersion).toBe('miraichi.cloud-backup.v2');
    if (exported.schemaVersion !== 'miraichi.cloud-backup.v2') throw new Error('V2 backup required');
    expect(exported.settlementEvents[0]).not.toHaveProperty('planAdherence');
  });
  it('uses parameterized owner-scoped bet queries', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-07-02T00:00:00.000Z' });
    await adapter.listBetRecords('owner-primary');
    expect(client.calls[0]?.text).toContain('$1');
    expect(client.calls[0]?.text).not.toContain('owner-primary');
    expect(client.calls[0]?.values).toEqual(['owner-primary']);
  });

  it('bounds pending bets by exact match ids and owner in PostgreSQL', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await adapter.listPendingBetRecordsByMatchIds('owner-primary', ['match-1', 'match-2'], 50);
    expect(client.calls[0]?.text).toContain("status='pending'");
    expect(client.calls[0]?.text).toContain('match_id=any($2::text[])');
    expect(client.calls[0]?.text).toContain('limit $3');
    expect(client.calls[0]?.values).toEqual(['owner-primary', ['match-1', 'match-2'], 50]);
  });

  it('persists pre-bet plan adherence on drafts and ongoing records', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-09-01T00:00:00.000Z' });
    await adapter.saveBetDraft('owner-primary', { draftId: 'd', matchGroupId: 'm', marketType: '1X2', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, preBetPlanAdherence: 'partly', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' });
    await adapter.createBetRecord({ betId: 'b', ownerProfileId: 'owner-primary', matchGroupId: 'm', homeTeamName: 'A', awayTeamName: 'B', marketType: '1X2', selectionLabel: 'A', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, status: 'pending', preBetPlanAdherence: 'yes', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' });
    const writes = client.calls.filter((call) => call.text.includes('insert into miraichi_app.bet_'));
    expect(writes).toHaveLength(2);
    expect(writes.every((call) => call.text.includes('pre_bet_plan_adherence'))).toBe(true);
    expect(writes[0]?.values).toContain('partly');
    expect(writes[1]?.values).toContain('yes');
  });

  it('round-trips normalized selection and running context through draft and bet writes', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    const timestamps = {
      createdAt: '2026-09-15T10:00:00.000Z',
      updatedAt: '2026-09-15T10:00:00.000Z'
    };
    const draft = {
      draftId: 'running-draft', matchGroupId: 'match-live', homeTeamName: 'A', awayTeamName: 'B',
      marketType: 'running', selectionCode: 'over', selectionLabel: 'Running FT Over 1.25', lineValue: 1.25,
      runningWindow: 'to_full_time', liveScoreHome: 1, liveScoreAway: 0, liveMinute: 58,
      liveContextSource: 'snapshot', liveContextObservedAt: '2026-09-15T09:59:30.000Z',
      oddsFormat: 'HK', oddsValue: 0.92, stakePoints: 10, ...timestamps
    };
    const bet = {
      betId: 'running-bet', ownerProfileId: 'owner-primary', ...draft,
      status: 'pending'
    };

    await adapter.saveBetDraft('owner-primary', draft as never);
    await adapter.createBetRecord(bet as never);

    const writes = client.calls.filter((call) => call.text.includes('insert into miraichi_app.bet_'));
    expect(writes).toHaveLength(2);
    for (const write of writes) {
      for (const column of [
        'selection_code', 'market_period', 'running_window', 'window_start_minute',
        'window_end_minute', 'live_score_home', 'live_score_away', 'live_minute',
        'live_context_source', 'live_context_observed_at'
      ]) expect(write.text).toContain(column);
      expect(write.values).toEqual(expect.arrayContaining([
        'over', 'to_full_time', 1, 0, 58, 'snapshot', '2026-09-15T09:59:30.000Z'
      ]));
      const placeholders = [...write.text.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
      expect(write.values).toHaveLength(Math.max(...placeholders));
    }

    const databaseFields = {
      market_type: 'running', selection_code: 'over', selection_label: 'Running FT Over 1.25',
      line_value: '1.25', market_period: null, running_window: 'to_full_time',
      window_start_minute: null, window_end_minute: null, live_score_home: 1,
      live_score_away: 0, live_minute: 58, live_context_source: 'snapshot',
      live_context_observed_at: '2026-09-15T09:59:30.000Z', odds_format: 'HK',
      odds_value: '0.92', stake_points: '10', created_at: timestamps.createdAt,
      updated_at: timestamps.updatedAt, tags: []
    };
    client.enqueueRows(
      [{ draft_id: 'running-draft', match_group_id: 'match-live', ...databaseFields }],
      [{ bet_id: 'running-bet', owner_profile_id: 'owner-primary', match_group_id: 'match-live',
        home_team_name: 'A', away_team_name: 'B', status: 'pending', ...databaseFields }]
    );

    expect(await adapter.listBetDrafts('owner-primary')).toMatchObject([{
      selectionCode: 'over', runningWindow: 'to_full_time', liveScoreHome: 1,
      liveScoreAway: 0, liveMinute: 58, liveContextSource: 'snapshot',
      liveContextObservedAt: '2026-09-15T09:59:30.000Z'
    }]);
    expect(await adapter.listBetRecords('owner-primary')).toMatchObject([{
      selectionCode: 'over', runningWindow: 'to_full_time', liveScoreHome: 1,
      liveScoreAway: 0, liveMinute: 58, liveContextSource: 'snapshot',
      liveContextObservedAt: '2026-09-15T09:59:30.000Z'
    }]);
  });

  it('round-trips derived Running goal thresholds without inventing a minute on draft and bet',async()=>{
    const client=new FakeClient();const adapter=createSupabaseCloudPersistenceAdapter({client,ownerProfileId:'owner-primary'});
    const now='2026-09-15T00:00:00.000Z';
    await adapter.saveBetDraft('owner-primary',{draftId:'d',matchGroupId:'m',homeTeamName:'A',awayTeamName:'B',marketType:'running',selectionCode:'over',runningGoalThreshold:0.75,lineValue:2.75,runningWindow:'to_full_time',liveScoreHome:1,liveScoreAway:1,liveContextSource:'manual',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,createdAt:now,updatedAt:now});
    await adapter.createBetRecord({betId:'b',ownerProfileId:'owner-primary',matchGroupId:'m',homeTeamName:'A',awayTeamName:'B',marketType:'running',selectionLabel:'Over 2.75 · Running FT · 1-1',selectionCode:'over',runningGoalThreshold:0.75,lineValue:2.75,runningWindow:'to_full_time',liveScoreHome:1,liveScoreAway:1,liveContextSource:'manual',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'pending',createdAt:now,updatedAt:now});
    const writes=client.calls.filter((call)=>call.text.includes('insert into miraichi_app.bet_'));
    expect(writes).toHaveLength(2);
    for(const write of writes){
      expect(write.text).toContain('running_goal_threshold');
      expect(write.values).toContain(0.75);
      const indices=[...write.text.matchAll(/\$(\d+)/g)].map((match)=>Number(match[1]));
      expect(write.values).toHaveLength(Math.max(...indices));
    }
    const base={market_type:'running',selection_code:'over',running_goal_threshold:'0.75',line_value:'2.75',running_window:'to_full_time',live_score_home:1,live_score_away:1,live_minute:null,live_context_source:'manual',selection_label:'Over 2.75 · Running FT · 1-1',odds_format:'HK',odds_value:'0.9',stake_points:'10',created_at:now,updated_at:now,tags:[]};
    client.enqueueRows([{draft_id:'d',match_group_id:'m',...base}],[{bet_id:'b',owner_profile_id:'owner-primary',match_group_id:'m',home_team_name:'A',away_team_name:'B',status:'pending',...base}]);
    const savedDraft=(await adapter.listBetDrafts('owner-primary'))[0];
    const savedBet=(await adapter.listBetRecords('owner-primary'))[0];
    expect(savedDraft).toMatchObject({runningGoalThreshold:0.75});
    expect(savedBet).toMatchObject({runningGoalThreshold:0.75});
    expect(savedBet).not.toHaveProperty('liveMinute');
  });

  it('maps and conditionally marks durable manual settlement review fields',async()=>{
    const client=new FakeClient();const adapter=createSupabaseCloudPersistenceAdapter({client,ownerProfileId:'owner-primary'});
    const row={bet_id:'b',owner_profile_id:'owner-primary',match_group_id:'m',home_team_name:'A',away_team_name:'B',market_type:'1X2',selection_label:'A · FT',odds_format:'HK',odds_value:'0.9',stake_points:'10',status:'pending',settlement_review_status:'manual_required',settlement_review_reason:'missing_detail',settlement_evidence_at:'2026-09-16T01:00:00.000Z',created_at:'2026-09-15T00:00:00.000Z',updated_at:'2026-09-16T01:00:00.000Z',tags:[]};
    client.enqueueRows([row],[row]);
    expect((await adapter.listBetRecords('owner-primary'))[0]).toMatchObject({settlementReviewStatus:'manual_required',settlementReviewReason:'missing_detail',settlementEvidenceAt:'2026-09-16T01:00:00.000Z'});
    expect(await adapter.markBetSettlementManualReview({ownerProfileId:'owner-primary',betId:'b',reason:'missing_detail',evidenceAt:'2026-09-16T01:00:00.000Z',updatedAt:'2026-09-16T01:00:00.000Z'})).toMatchObject({settlementReviewReason:'missing_detail'});
    const update=client.calls.at(-1)!;
    expect(update.text).toContain("status='pending'");
    expect(update.text).toContain('settlement_review_status');
    expect(update.values).toEqual(['owner-primary','b','missing_detail','2026-09-16T01:00:00.000Z','2026-09-16T01:00:00.000Z']);
  });

  it('locks the current bet before checking settlement idempotency',async()=>{
    const client=new FakeClient();const adapter=createSupabaseCloudPersistenceAdapter({client,ownerProfileId:'owner-primary',now:()=> '2026-09-16T01:00:00.000Z'});
    const betRow={bet_id:'b',owner_profile_id:'owner-primary',match_group_id:'m',home_team_name:'A',away_team_name:'B',market_type:'1X2',selection_label:'A · FT',odds_format:'HK',odds_value:'0.9',stake_points:'10',status:'pending',created_at:'2026-09-15T00:00:00.000Z',updated_at:'2026-09-15T00:00:00.000Z',tags:[]};
    const eventRow={settlement_event_id:'auto-settlement:b',owner_profile_id:'owner-primary',bet_id:'b',bankroll_account_id:'a',settlement_type:'full_win',calculated_profit_loss_points:'9',ledger_delta_points:'9',effective_at:'2026-09-16T00:30:00.000Z',occurred_at:'2026-09-16T01:00:00.000Z'};
    const settledRow={...betRow,status:'settled',settlement_type:'full_win',profit_loss_points:'9',settled_at:'2026-09-16T00:30:00.000Z',settlement_review_status:'auto_settled',settlement_evidence_at:'2026-09-16T00:30:00.000Z',updated_at:'2026-09-16T01:00:00.000Z'};
    const ledgerRow={entry_id:'settlement:auto-settlement:b',owner_profile_id:'owner-primary',account_id:'a',entry_type:'bet_settlement',amount_points:'9',bet_id:'b',settlement_event_id:'auto-settlement:b',effective_at:'2026-09-16T00:30:00.000Z',occurred_at:'2026-09-16T01:00:00.000Z',created_at:'2026-09-16T01:00:00.000Z'};
    const accountRow={account_id:'a',owner_profile_id:'owner-primary',label:'Main',opening_balance_points:'100',current_balance_points:'109',archived:false,created_at:'2026-09-15T00:00:00.000Z',updated_at:'2026-09-16T01:00:00.000Z'};
    client.enqueueRows([betRow],[],[eventRow],[settledRow],[ledgerRow],[accountRow]);
    await adapter.applyBetSettlement({record:{betId:'b',ownerProfileId:'owner-primary',matchGroupId:'m',homeTeamName:'A',awayTeamName:'B',marketType:'1X2',selectionLabel:'A · FT',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'settled',settlementType:'full_win',profitLossPoints:9,settledAt:'2026-09-16T00:30:00.000Z',settlementReviewStatus:'auto_settled',settlementEvidenceAt:'2026-09-16T00:30:00.000Z',createdAt:'2026-09-15T00:00:00.000Z',updatedAt:'2026-09-16T01:00:00.000Z'},event:{settlementEventId:'auto-settlement:b',ownerProfileId:'owner-primary',betId:'b',bankrollAccountId:'a',settlementType:'full_win',calculatedProfitLossPoints:9,ledgerDeltaPoints:9,effectiveAt:'2026-09-16T00:30:00.000Z',occurredAt:'2026-09-16T01:00:00.000Z'},ledgerEntry:{entryId:'settlement:auto-settlement:b',ownerProfileId:'owner-primary',accountId:'a',entryType:'bet_settlement',amountPoints:9,betId:'b',settlementEventId:'auto-settlement:b',effectiveAt:'2026-09-16T00:30:00.000Z',occurredAt:'2026-09-16T01:00:00.000Z'}});
    expect(client.calls[0]?.text.toLowerCase()).toContain('for update');
    expect(client.calls[1]?.text).toContain('bet_settlement_event');
    expect(client.calls[3]?.text).toContain('settlement_review_status');
  });

  it('rejects owner mismatch before querying', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await expect(adapter.listBetRecords('other-owner')).rejects.toThrow('Owner profile mismatch');
    expect(client.calls).toHaveLength(0);
  });

  it('reconciles ledger entries inside one transaction', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-07-02T00:00:00.000Z' });
    await adapter.createBankrollLedgerEntry({ entryId: 'entry-1', ownerProfileId: 'owner-primary', accountId: 'account-1', entryType: 'deposit', amountPoints: 100, occurredAt: '2026-07-02T00:00:00.000Z' });
    expect(client.transactions).toBe(1);
    expect(client.calls).toHaveLength(2);
    expect(client.calls.every((call) => call.text.includes('$1'))).toBe(true);
  });

  it('rejects invalid capital signs before starting a database transaction', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await expect(adapter.createBankrollAccount({ accountId: 'zero', ownerProfileId: 'owner-primary', label: 'Main', openingBalancePoints: 0 })).rejects.toThrow('positive');
    await expect(adapter.createBankrollLedgerEntry({ entryId: 'bad', ownerProfileId: 'owner-primary', accountId: 'a', entryType: 'withdrawal', amountPoints: 1, occurredAt: '2026-07-02T00:00:00.000Z' })).rejects.toThrow('sign');
    expect(client.transactions).toBe(0);
    expect(client.calls).toHaveLength(0);
  });

  it('guards withdrawal and transfer updates against negative realized balances', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await adapter.createBankrollLedgerEntry({ entryId: 'withdraw', ownerProfileId: 'owner-primary', accountId: 'a', entryType: 'withdrawal', amountPoints: -10, occurredAt: '2026-07-02T00:00:00.000Z' });
    client.enqueueRows([{}], [{}], [{ account_id: 'a', owner_profile_id: 'owner-primary', label: 'A', opening_balance_points: 10, current_balance_points: 0, archived: false, created_at: '2026-07-02T00:00:00.000Z', updated_at: '2026-07-02T00:00:00.000Z' }], [{ account_id: 'b', owner_profile_id: 'owner-primary', label: 'B', opening_balance_points: 10, current_balance_points: 20, archived: false, created_at: '2026-07-02T00:00:00.000Z', updated_at: '2026-07-02T00:00:00.000Z' }]);
    await adapter.createBankrollTransfer({ transferId: 'transfer', ownerProfileId: 'owner-primary', fromAccountId: 'a', toAccountId: 'b', amountPoints: 10, occurredAt: '2026-07-02T00:00:00.000Z' });
    const balanceUpdates = client.calls.filter((call) => call.text.includes('current_balance_points'));
    expect(balanceUpdates.some((call) => call.text.includes('current_balance_points+$3>=0'))).toBe(true);
    expect(balanceUpdates.some((call) => call.text.includes('current_balance_points>=$3'))).toBe(true);
  });

  it('exports the canonical V2 backup collections', async () => {
    const client = new FakeClient();
    client.enqueueRows([], [], [], [], [], []);
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    const envelope = await adapter.exportOwnerData('owner-primary', '2026-08-21T00:00:00.000Z');
    expect(envelope).toMatchObject({ schemaVersion: 'miraichi.cloud-backup.v2', disciplineConfigs: [], settlementEvents: [] });
    expect(client.calls.some((call) => call.text.includes('discipline_config'))).toBe(true);
    expect(client.calls.some((call) => call.text.includes('bet_settlement_event'))).toBe(true);
  });

  it('imports structured draft and bet context without dropping backup fields', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    const structured = {
      marketType: 'running' as const, selectionCode: 'under' as const,
      selectionLabel: "Under 0.75 · Running 60-75 · 1-1 @ 62'", lineValue: 0.75,
      runningWindow: 'fixed_15' as const, windowStartMinute: 60, windowEndMinute: 75,
      liveScoreHome: 1, liveScoreAway: 1, liveMinute: 62, liveContextSource: 'manual' as const
    };
    await adapter.importOwnerData('owner-primary', {
      schemaVersion: 'miraichi.cloud-backup.v2', exportedAt: '2026-09-15T10:00:00.000Z',
      ownerProfileId: 'owner-primary', bankrollAccounts: [], bankrollLedgerEntries: [],
      disciplineConfigs: [], settlementEvents: [],
      drafts: [{ draftId: 'd', matchGroupId: 'm', oddsFormat: 'HK', oddsValue: 0.8,
        stakePoints: 5, createdAt: '2026-09-15T10:00:00.000Z', updatedAt: '2026-09-15T10:00:00.000Z', ...structured }],
      bets: [{ betId: 'b', ownerProfileId: 'owner-primary', matchGroupId: 'm',
        homeTeamName: 'A', awayTeamName: 'B', oddsFormat: 'HK', oddsValue: 0.8, stakePoints: 5,
        status: 'pending', createdAt: '2026-09-15T10:00:00.000Z', updatedAt: '2026-09-15T10:00:00.000Z', ...structured }]
    });

    const writes = client.calls.filter((call) => call.text.includes('insert into miraichi_app.bet_'));
    expect(client.transactions).toBe(1);
    expect(writes).toHaveLength(2);
    expect(writes.every((write) => write.text.includes('selection_code'))).toBe(true);
    expect(writes.every((write) => write.text.includes('running_window'))).toBe(true);
    expect(writes.every((write) => write.values.includes(62))).toBe(true);
    for (const write of writes) {
      const placeholders = [...write.text.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
      expect(write.values).toHaveLength(Math.max(...placeholders));
    }
  });

  it('imports the derived Running threshold in both SQL backup collections',async()=>{
    const client=new FakeClient();const adapter=createSupabaseCloudPersistenceAdapter({client,ownerProfileId:'owner-primary'});
    const now='2026-09-15T00:00:00.000Z';
    const running={marketType:'running' as const,selectionCode:'over' as const,runningGoalThreshold:0.75 as const,lineValue:2.75,runningWindow:'to_full_time' as const,liveScoreHome:1,liveScoreAway:1,liveContextSource:'manual' as const};
    await adapter.importOwnerData('owner-primary',{schemaVersion:'miraichi.cloud-backup.v2',ownerProfileId:'owner-primary',exportedAt:now,bankrollAccounts:[],bankrollLedgerEntries:[],disciplineConfigs:[],settlementEvents:[],drafts:[{draftId:'d',matchGroupId:'m',homeTeamName:'A',awayTeamName:'B',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,createdAt:now,updatedAt:now,...running}],bets:[{betId:'b',ownerProfileId:'owner-primary',matchGroupId:'m',homeTeamName:'A',awayTeamName:'B',selectionLabel:'Over 2.75 · Running FT · 1-1',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'pending',settlementReviewStatus:'manual_required',settlementReviewReason:'missing_detail',settlementEvidenceAt:now,createdAt:now,updatedAt:now,...running}]});
    const writes=client.calls.filter((call)=>call.text.includes('insert into miraichi_app.bet_'));
    expect(writes).toHaveLength(2);
    for(const write of writes){expect(write.text).toContain('running_goal_threshold');expect(write.values.at(write.text.includes('settlement_review_status')?-4:-1)).toBe(0.75);}
    const betWrite=writes.find((write)=>write.text.includes('settlement_review_status'))!;
    expect(betWrite.values).toEqual(expect.arrayContaining(['manual_required','missing_detail',now]));
  });

  it('upserts discipline config including week_start_day', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-07-02T00:00:00.000Z' });
    client.enqueueRows([{
      owner_profile_id: 'owner-primary',
      daily_stop_loss_points: null,
      weekly_stop_loss_points: 200,
      big_bet_threshold_points: 50,
      time_zone: 'Asia/Tokyo',
      week_start_day: 'sunday',
      cooldown_seconds: 15,
      version: 1,
      updated_at: '2026-07-02T00:00:00.000Z'
    }]);
    const config = {
      ownerProfileId: 'owner-primary',
      dailyStopLossPoints: null,
      weeklyStopLossPoints: 200,
      bigBetThresholdPoints: 50,
      timeZone: 'Asia/Tokyo',
      weekStartDay: 'sunday' as const,
      cooldownSeconds: 15 as const,
      version: 1,
      updatedAt: '2026-07-02T00:00:00.000Z'
    };
    const result = await adapter.upsertDisciplineConfig(config);
    expect(result.weekStartDay).toBe('sunday');
    const call = client.calls.find((c) => c.text.includes('miraichi_app.discipline_config'));
    expect(call?.text).toContain('week_start_day');
    expect(call?.values[5]).toBe('sunday');
  });

  it('does not leak credentials when connectivity fails', async () => {
    const client: PostgresQueryClient = {
      query: async () => { throw new Error('postgresql://secret@db.example'); },
      transaction: async () => { throw new Error('unused'); }
    };
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-07-02T00:00:00.000Z' });
    await expect(adapter.getStatus()).resolves.toEqual({ provider: 'supabase-postgres', mode: 'supabase', state: 'unavailable', checkedAt: '2026-07-02T00:00:00.000Z', message: 'Cloud database is unavailable.' });
  });

  it('serializes JSONB values before sending them to pg', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    const snapshot: CloudMatchSnapshot = {
      snapshotId: 'snapshot-001',
      generatedAt: '2026-07-02T00:00:00.000Z',
      importedAt: '2026-07-02T00:01:00.000Z',
      sources: [{ sourceId: 'manual-snapshot', importedAt: '2026-07-02T00:00:00.000Z' }],
      matches: [{
        id: 'match-001',
        competition: { id: 'fixture-cup', name: 'Fixture Cup', type: 'club', season: '2026' },
        kickoffUtc: '2026-06-11T19:00:00.000Z',
        status: 'scheduled',
        homeTeam: { id: 'team-a', name: 'Team A' },
        awayTeam: { id: 'team-b', name: 'Team B' },
        score: { home: null, away: null },
        sourceRefs: [{ sourceId: 'manual-snapshot', sourceMatchId: 'fixture-001', importedAt: '2026-07-02T00:00:00.000Z' }],
        updatedAt: '2026-07-02T00:00:00.000Z'
      }]
    };

    await adapter.upsertMatchSnapshot('owner-primary', snapshot);

    const snapshotCall = client.calls.find((call) => call.text.includes('miraichi_app.match_snapshot'));
    const matchCall = client.calls.find((call) => call.text.includes('miraichi_app.match_record'));
    expect(snapshotCall?.values[4]).toEqual(postgresJson(snapshot.sources));
    const rows = (matchCall?.values[2] as { readonly value: Array<Record<string, unknown>> }).value;
    expect(matchCall?.text).toContain('$3::jsonb');
    expect(rows[0]?.competition_type).toBe('club');
    expect(rows[0]?.source_refs).toEqual(snapshot.matches[0]!.sourceRefs);
  });

  it('upserts large match snapshots in bounded batches inside one transaction', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    const matches = Array.from({ length: 1_201 }, (_, index) => ({
      id: `match-${index}`,
      competition: { id: 'fixture-cup', name: 'Fixture Cup', type: 'club' as const, season: '2026' },
      kickoffUtc: '2026-06-11T19:00:00.000Z',
      status: 'scheduled' as const,
      homeTeam: { id: `home-${index}`, name: `Home ${index}` },
      awayTeam: { id: `away-${index}`, name: `Away ${index}` },
      score: { home: null, away: null },
      sourceRefs: [],
      updatedAt: '2026-07-02T00:00:00.000Z'
    }));

    await adapter.upsertMatchSnapshot('owner-primary', {
      snapshotId: 'large-snapshot', generatedAt: '2026-07-02T00:00:00.000Z',
      importedAt: '2026-07-02T00:01:00.000Z', sources: [], matches
    });

    const batches = client.calls.filter((call) => call.text.includes('miraichi_app.match_record'));
    expect(client.transactions).toBe(1);
    expect(batches).toHaveLength(3);
    expect(batches.map((call) => (
      call.values[2] as { readonly value: unknown[] }
    ).value.length)).toEqual([500, 500, 201]);
  });

  it('reads the canonical club competition type from persisted match rows', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    client.enqueueRows(
      [{
        id: 'match-001', competition_id: 'fixture-cup', competition_name: 'Fixture Cup', competition_type: 'club', season: '2026',
        kickoff_utc: '2026-06-11T19:00:00.000Z', status: 'scheduled', home_team_id: 'team-a', home_team_name: 'Team A',
        away_team_id: 'team-b', away_team_name: 'Team B', home_score: null, away_score: null, source_refs: [], updated_at: '2026-07-02T00:00:00.000Z'
      }],
      [{ snapshot_id: 'snapshot-001', generated_at: '2026-07-02T00:00:00.000Z', imported_at: '2026-07-02T00:01:00.000Z', sources: [] }],
      [{ id: 'fixture-cup', name: 'Fixture Cup', seasons: ['2026'], match_count: 1 }]
    );

    const result = await adapter.listCloudMatches('owner-primary', {});

    expect(result.matches[0]?.competition.type).toBe('club');
  });

  it('keeps cloud snapshot status fresh through exactly twelve hours and stale after', async () => {
    const boundaryClient = new FakeClient();
    enqueueSnapshotStatusRows(boundaryClient);
    const boundaryAdapter = createSupabaseCloudPersistenceAdapter({
      client: boundaryClient,
      ownerProfileId: 'owner-primary',
      now: () => '2026-07-01T12:00:00.000Z'
    });
    const afterClient = new FakeClient();
    enqueueSnapshotStatusRows(afterClient);
    const afterAdapter = createSupabaseCloudPersistenceAdapter({
      client: afterClient,
      ownerProfileId: 'owner-primary',
      now: () => '2026-07-01T12:00:00.001Z'
    });

    expect((await boundaryAdapter.getCloudMatchSnapshotStatus('owner-primary')).freshness).toBe('fresh');
    expect((await afterAdapter.getCloudMatchSnapshotStatus('owner-primary')).freshness).toBe('stale');
  });

  it('uses one conditional owner-scoped write to acquire a live refresh lease', async () => {
    const client = new FakeClient();
    client.enqueueRows([{ owner_profile_id: 'owner-primary' }], []);
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    expect(await adapter.acquireLiveRefreshLease('owner-primary', {
      leaseId: 'lease-1', reason: 'visible', acquiredAt: '2026-09-02T12:00:00.000Z', expiresAt: '2026-09-02T12:02:00.000Z'
    })).toBe(true);
    expect(await adapter.acquireLiveRefreshLease('owner-primary', {
      leaseId: 'lease-2', reason: 'hourly', acquiredAt: '2026-09-02T12:01:00.000Z', expiresAt: '2026-09-02T12:03:00.000Z'
    })).toBe(false);
    const acquireSql = client.calls[0]?.text.toLowerCase() ?? '';
    expect(acquireSql).toContain('on conflict (owner_profile_id) do update');
    expect(acquireSql).toContain('lease_expires_at <= excluded.last_attempt_at');
    expect(client.calls[0]?.values).toEqual([
      'owner-primary', 'lease-1', 'visible', '2026-09-02T12:00:00.000Z', '2026-09-02T12:02:00.000Z'
    ]);
  });

  it('maps live JSONB and completes a successful refresh in one transaction', async () => {
    const client = new FakeClient();
    client.enqueueRows(
      [{ owner_profile_id: 'owner-primary', status: 'succeeded', reason: 'visible', last_attempt_at: '2026-09-02T12:00:00.000Z', last_success_at: '2026-09-02T12:00:05.000Z', last_completed_at: '2026-09-02T12:00:05.000Z', last_error_code: null, lease_id: null, lease_acquired_at: null, lease_expires_at: null }],
      [],
      [{ overlay_json: liveSnapshotFixture }]
    );
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await adapter.finishLiveRefresh('owner-primary', {
      leaseId: 'lease-1', outcome: 'succeeded', completedAt: '2026-09-02T12:00:05.000Z', snapshot: liveSnapshotFixture
    });
    expect(client.transactions).toBe(1);
    expect(client.calls.some((call) => call.text.includes('live_match_snapshot'))).toBe(true);
    expect(await adapter.getLiveMatchSnapshot('owner-primary')).toEqual(liveSnapshotFixture);
  });

  it('sanitizes a failed refresh and never writes the last-good live snapshot table', async () => {
    const client = new FakeClient();
    client.enqueueRows([{ owner_profile_id: 'owner-primary', status: 'failed' }]);
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await adapter.finishLiveRefresh('owner-primary', {
      leaseId: 'lease-1', outcome: 'failed', completedAt: '2026-09-02T12:00:05.000Z', errorCode: 'database password leaked' as never
    });
    expect(client.calls[0]?.values).toContain('internal_error');
    expect(client.calls[0]?.text).toContain('lease_expires_at > $4');
    expect(client.calls.every((call) => !call.text.includes('live_match_snapshot'))).toBe(true);
  });
});
