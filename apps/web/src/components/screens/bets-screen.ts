import type { BetSettlementEvent, CloudBetRecord } from '@miraichi/shared';
import type { ProductionNavigationTabId } from '../../config/navigation-tabs.js';
import type { BankrollViewState } from '../../services/bankroll-service.js';
import type { BetRecordsViewState } from '../../services/bet-record-service.js';
import { formatDateTime, type SupportedLocale, type TranslateFunction } from '../../services/i18n-service.js';
import { escapeHtml } from '../html.js';
import { renderSkeletonBetRows, screenClass, screenHeader } from './screen-shared.js';

export type BetRecordFilter = 'ongoing' | 'drafts' | 'settled';

export function renderSettlementTimeline(
  events: readonly BetSettlementEvent[],
  translate: TranslateFunction,
  locale: SupportedLocale,
  timeZone: string
): string {
  return events.map((item) => `<div class="ledger-row"><div><div class="ledger-title">${escapeHtml(translate(`settlement.${item.settlementType}`, item.settlementType))}</div><div class="ledger-meta">${escapeHtml(formatDateTime(item.occurredAt, locale, timeZone))}</div></div><span class="ledger-state">${item.ledgerDeltaPoints > 0 ? '+' : ''}${item.ledgerDeltaPoints} pts</span></div>`).join('');
}

function betCard(record: CloudBetRecord, bankroll: BankrollViewState, translate: TranslateFunction, settled: boolean): string {
  const psychology = [
    record.preBetEmotion ? translate(`emotion.${record.preBetEmotion}`) : '',
    record.preBetMotivation ? translate(`motivation.${record.preBetMotivation}`) : ''
  ].filter(Boolean).join(' · ');
  const warnings = (record.disciplineSnapshot?.triggeredRules ?? []).map((rule) => translate(`rule.${rule}`, rule));
  const pnl = record.profitLossPoints ?? record.manualResultPoints;
  return `<article class="bet-row bet-card" data-bet-id="${escapeHtml(record.betId)}">
    <div class="row-split"><div><div class="row-title">${escapeHtml(record.selectionLabel)}</div><div class="row-meta">${escapeHtml(record.homeTeamName)} vs ${escapeHtml(record.awayTeamName)} · ${escapeHtml(record.marketType)}</div></div>${pnl == null ? '' : `<span class="ledger-state ${pnl < 0 ? 'negative' : 'positive'}">${pnl > 0 ? '+' : ''}${pnl} pts</span>`}</div>
    <div class="bet-facts"><span>${record.stakePoints} pts @ ${record.oddsValue}</span>${psychology ? `<span>${escapeHtml(psychology)}</span>` : ''}</div>
    ${warnings.length ? `<div class="discipline-warning">${escapeHtml(translate('bets.warnings'))}: ${escapeHtml(warnings.join(', '))}</div>` : ''}
    <div class="action-row">${settled
      ? `<button class="text-button" type="button" data-open-settled-detail="${escapeHtml(record.betId)}">${escapeHtml(translate('bets.correct'))}</button>`
      : `<button class="primary-button add-inline" type="button" data-open-settlement="${escapeHtml(record.betId)}">${escapeHtml(translate('bets.settle'))}</button>`}</div>
  </article>`;
}

function records(state: BetRecordsViewState, filter: BetRecordFilter, bankroll: BankrollViewState, translate: TranslateFunction): string {
  if (state.status === 'loading') return `<div data-bet-records-state="loading" aria-label="${escapeHtml(translate('common.loading'))}">${renderSkeletonBetRows(3)}</div>`;
  if (state.status === 'unavailable') return `<section class="note-card warning" data-bet-records-state="unavailable"><div class="note-title">${escapeHtml(translate('common.unavailable'))}</div><p class="note-copy">${escapeHtml(translate('error.request_failed'))}</p></section>`;
  if (state.status === 'empty') return `<section class="note-card" data-bet-records-state="empty"><div class="note-title">${escapeHtml(translate(`bets.empty${filter === 'ongoing' ? 'Ongoing' : filter === 'drafts' ? 'Drafts' : 'Settled'}`))}</div></section>`;
  if (filter === 'drafts') {
    return `<div data-bet-records-state="ready" data-visible-bet-filter="drafts">${state.drafts.map((draft) => `<article class="bet-row"><div class="row-title">${escapeHtml(translate(`market.${draft.marketType}`, draft.marketType))}</div><div class="row-meta">${escapeHtml(draft.matchGroupId)} · ${draft.stakePoints} pts @ ${draft.oddsValue}</div><div class="action-row"><button class="secondary-button" type="button" data-edit-draft="${escapeHtml(draft.draftId)}">${escapeHtml(translate('bets.editDraft'))}</button><button class="text-button" type="button" data-delete-draft-confirm="${escapeHtml(draft.draftId)}">${escapeHtml(translate('bets.confirmDelete'))}</button></div></article>`).join('') || `<p class="empty-state">${escapeHtml(translate('bets.emptyDrafts'))}</p>`}</div>`;
  }
  const selected = filter === 'ongoing' ? state.pending : state.settled;
  const emptyKey = filter === 'ongoing' ? 'bets.emptyOngoing' : 'bets.emptySettled';
  return `<div data-bet-records-state="ready" data-visible-bet-filter="${filter}">${selected.map((record) => betCard(record, bankroll, translate, filter === 'settled')).join('') || `<p class="empty-state">${escapeHtml(translate(emptyKey))}</p>`}</div>`;
}

export function renderBetsScreen(input: {
  readonly activeTabId: ProductionNavigationTabId;
  readonly translate: TranslateFunction;
  readonly state: BetRecordsViewState;
  readonly filter: BetRecordFilter;
  readonly bankroll: BankrollViewState;
}): string {
  const { activeTabId, translate, state, filter, bankroll } = input;
  const segment = (value: BetRecordFilter, key: string) => `<button class="${filter === value ? 'active' : ''}" type="button" role="tab" aria-selected="${filter === value}" data-bet-filter="${value}">${escapeHtml(translate(key))}</button>`;
  return `<section class="${screenClass('bets', activeTabId)}" id="screen-bets" data-shell-tab-panel="bets" aria-labelledby="bets-title">
    ${screenHeader(translate('bets.eyebrow'), translate('bets.title'), 'bets-title', `<button class="primary-button add-inline" type="button" data-open-manual-add>${escapeHtml(translate('bets.add'))}</button>`)}
    <div class="segmented three" role="tablist" aria-label="${escapeHtml(translate('bets.title'))}">${segment('ongoing', 'bets.ongoing')}${segment('drafts', 'bets.drafts')}${segment('settled', 'bets.settled')}</div>
    <div class="stack">${records(state, filter, bankroll, translate)}</div>
  </section>`;
}
