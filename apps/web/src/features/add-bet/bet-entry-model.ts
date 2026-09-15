import {
  CREATABLE_MARKET_TYPES,
  MARKET_PERIODS,
  parseQuarterLineInput,
  structuredBetMarketCatalog,
  validateStructuredBetSelection,
  type CreatableMarketType,
  type MarketPeriod,
  type SelectionCode,
  type StructuredBetSelection
} from '@miraichi/shared';

export interface BetEntryState {
  readonly marketType: CreatableMarketType | '';
  readonly marketPeriod: MarketPeriod | '';
  readonly selectionCode: SelectionCode | '';
  readonly lineValue: number | null;
  readonly manualLineActive: boolean;
  readonly manualLineInput: string;
}

export function createBetEntryState(): BetEntryState {
  return {
    marketType: '', marketPeriod: '', selectionCode: '', lineValue: null,
    manualLineActive: false, manualLineInput: ''
  };
}

export function selectBetMarket(state: BetEntryState, marketType: CreatableMarketType): BetEntryState {
  if (!CREATABLE_MARKET_TYPES.includes(marketType)) return createBetEntryState();
  if (state.marketType === marketType) return state;
  return { ...createBetEntryState(), marketType };
}

export function selectBetPeriod(state: BetEntryState, marketPeriod: MarketPeriod): BetEntryState {
  if (!state.marketType || state.marketType === 'running' || !MARKET_PERIODS.includes(marketPeriod)) return state;
  if (state.marketPeriod === marketPeriod) return state;
  return { ...state, marketPeriod, selectionCode: '', lineValue: null, manualLineActive: false, manualLineInput: '' };
}

export function getSelectionCodes(state: BetEntryState): readonly SelectionCode[] {
  if (!state.marketType || (state.marketType !== 'running' && !state.marketPeriod)) return [];
  const market = structuredBetMarketCatalog.markets.find((item) => item.marketType === state.marketType);
  return market ? [...market.selections] : [];
}

export function selectBetSelection(state: BetEntryState, selectionCode: SelectionCode): BetEntryState {
  if (!getSelectionCodes(state).includes(selectionCode)) return state;
  return { ...state, selectionCode };
}

export function getLinePresets(state: BetEntryState): readonly number[] {
  if (!state.marketType || !state.marketPeriod || state.marketType === '1X2') return [];
  if (state.marketType === 'over_under') {
    return state.marketPeriod === 'first_half'
      ? structuredBetMarketCatalog.linePresets.halfTimeAndRunning
      : structuredBetMarketCatalog.linePresets.goalsFullTime;
  }
  if (state.marketType === 'handicap') return structuredBetMarketCatalog.linePresets.handicap;
  if (state.marketType === 'corners') return structuredBetMarketCatalog.linePresets.corners;
  return structuredBetMarketCatalog.linePresets.halfTimeAndRunning;
}

export function selectBetLinePreset(state: BetEntryState, lineValue: number): BetEntryState {
  if (!getLinePresets(state).includes(lineValue)) return state;
  return { ...state, lineValue, manualLineActive: false, manualLineInput: '' };
}

export function setManualBetLine(state: BetEntryState, input: string): BetEntryState {
  return {
    ...state,
    lineValue: parseQuarterLineInput(input),
    manualLineActive: true,
    manualLineInput: input
  };
}

export function enableManualBetLine(state: BetEntryState): BetEntryState {
  return { ...state, lineValue: null, manualLineActive: true, manualLineInput: '' };
}

export function toStructuredBetSelection(state: BetEntryState): StructuredBetSelection | null {
  if (!state.marketType || state.marketType === 'running' || !state.marketPeriod || !state.selectionCode) return null;
  const selection = {
    marketType: state.marketType,
    marketPeriod: state.marketPeriod,
    selectionCode: state.selectionCode,
    ...(state.marketType === '1X2' ? {} : { lineValue: state.lineValue })
  } as StructuredBetSelection;
  return validateStructuredBetSelection(selection).ok ? selection : null;
}

export function restoreBetEntryState(input: {
  readonly marketType?: string;
  readonly marketPeriod?: MarketPeriod;
  readonly selectionCode?: SelectionCode;
  readonly lineValue?: number | null;
}): BetEntryState {
  if (!CREATABLE_MARKET_TYPES.includes(input.marketType as CreatableMarketType)) return createBetEntryState();
  let state = selectBetMarket(createBetEntryState(), input.marketType as CreatableMarketType);
  if (input.marketType === 'running') return state;
  if (input.marketPeriod && MARKET_PERIODS.includes(input.marketPeriod)) state = selectBetPeriod(state, input.marketPeriod);
  if (input.selectionCode && getSelectionCodes(state).includes(input.selectionCode)) state = selectBetSelection(state, input.selectionCode);
  if (input.lineValue != null) state = setManualBetLine(state, String(input.lineValue));
  return state;
}
