import {
  CREATABLE_MARKET_TYPES,
  MARKET_PERIODS,
  parseQuarterLineInput,
  structuredBetMarketCatalog,
  validateStructuredBetSelection,
  type CreatableMarketType,
  type MarketPeriod,
  type LiveContextSource,
  type RunningWindow,
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
  readonly runningWindow: RunningWindow | '';
  readonly windowStartMinute: number | null;
  readonly windowEndMinute: number | null;
  readonly liveScoreHome: number | null;
  readonly liveScoreAway: number | null;
  readonly liveMinute: number | null;
  readonly liveContextSource: LiveContextSource | '';
  readonly liveContextObservedAt: string;
}

export function createBetEntryState(): BetEntryState {
  return {
    marketType: '', marketPeriod: '', selectionCode: '', lineValue: null,
    manualLineActive: false, manualLineInput: '', runningWindow: '',
    windowStartMinute: null, windowEndMinute: null,
    liveScoreHome: null, liveScoreAway: null, liveMinute: null,
    liveContextSource: '', liveContextObservedAt: ''
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
  if (state.marketType === 'running') return structuredBetMarketCatalog.linePresets.halfTimeAndRunning;
  if (!state.marketType || !state.marketPeriod || state.marketType === '1X2') return [];
  if (state.marketType === 'over_under') {
    return state.marketPeriod === 'first_half'
      ? structuredBetMarketCatalog.linePresets.halfTimeAndRunning
      : structuredBetMarketCatalog.linePresets.goalsFullTime;
  }
  if (state.marketType === 'handicap') return structuredBetMarketCatalog.linePresets.handicap;
  if (state.marketType === 'corners') return state.marketPeriod === 'first_half'
    ? structuredBetMarketCatalog.linePresets.cornersFirstHalf
    : structuredBetMarketCatalog.linePresets.corners;
  return structuredBetMarketCatalog.linePresets.halfTimeAndRunning;
}

export function selectRunningWindow(
  state: BetEntryState,
  runningWindow: RunningWindow,
  fixedWindow?: { readonly startMinute: number; readonly endMinute: number }
): BetEntryState {
  if (state.marketType !== 'running') return state;
  if (runningWindow === 'fixed_15') {
    const valid = structuredBetMarketCatalog.runningWindows.some((window) =>
      window.startMinute === fixedWindow?.startMinute && window.endMinute === fixedWindow.endMinute);
    if (!valid) return state;
    return {
      ...state, runningWindow,
      windowStartMinute: fixedWindow!.startMinute, windowEndMinute: fixedWindow!.endMinute,
      selectionCode: '', lineValue: null, manualLineActive: false, manualLineInput: ''
    };
  }
  return {
    ...state, runningWindow, windowStartMinute: null, windowEndMinute: null,
    selectionCode: '', lineValue: null, manualLineActive: false, manualLineInput: ''
  };
}

export function setRunningContext(state: BetEntryState, context: {
  readonly liveScoreHome: number;
  readonly liveScoreAway: number;
  readonly liveMinute: number;
  readonly liveContextSource: LiveContextSource;
  readonly liveContextObservedAt?: string;
}): BetEntryState {
  if (state.marketType !== 'running') return state;
  return {
    ...state,
    liveScoreHome: context.liveScoreHome,
    liveScoreAway: context.liveScoreAway,
    liveMinute: context.liveMinute,
    liveContextSource: context.liveContextSource,
    liveContextObservedAt: context.liveContextSource === 'snapshot' ? context.liveContextObservedAt ?? '' : ''
  };
}

export function clearRunningContext(state: BetEntryState, source: LiveContextSource = 'manual'): BetEntryState {
  if (state.marketType !== 'running') return state;
  return {
    ...state,
    runningWindow: '', windowStartMinute: null, windowEndMinute: null,
    selectionCode: '', lineValue: null, manualLineActive: false, manualLineInput: '',
    liveScoreHome: null, liveScoreAway: null, liveMinute: null,
    liveContextSource: source, liveContextObservedAt: ''
  };
}

export function setManualRunningContext(state: BetEntryState, context: {
  readonly liveScoreHome: number | null;
  readonly liveScoreAway: number | null;
  readonly liveMinute: number | null;
}): BetEntryState {
  if (state.marketType !== 'running') return state;
  return {
    ...state, ...context,
    liveContextSource: 'manual', liveContextObservedAt: ''
  };
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
  if (!state.marketType || !state.selectionCode) return null;
  if (state.marketType === 'running') {
    if (!state.runningWindow || state.liveScoreHome === null || state.liveScoreAway === null
      || state.liveMinute === null || !state.liveContextSource) return null;
    const selection: StructuredBetSelection = {
      marketType: 'running', runningWindow: state.runningWindow,
      ...(state.runningWindow === 'fixed_15'
        ? { windowStartMinute: state.windowStartMinute!, windowEndMinute: state.windowEndMinute! }
        : {}),
      selectionCode: state.selectionCode, lineValue: state.lineValue,
      liveScoreHome: state.liveScoreHome, liveScoreAway: state.liveScoreAway,
      liveMinute: state.liveMinute, liveContextSource: state.liveContextSource,
      ...(state.liveContextSource === 'snapshot' ? { liveContextObservedAt: state.liveContextObservedAt } : {})
    };
    return validateStructuredBetSelection(selection).ok ? selection : null;
  }
  if (!state.marketPeriod) return null;
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
  readonly runningWindow?: RunningWindow;
  readonly windowStartMinute?: number;
  readonly windowEndMinute?: number;
  readonly liveScoreHome?: number;
  readonly liveScoreAway?: number;
  readonly liveMinute?: number;
  readonly liveContextSource?: LiveContextSource;
  readonly liveContextObservedAt?: string;
}): BetEntryState {
  if (!CREATABLE_MARKET_TYPES.includes(input.marketType as CreatableMarketType)) return createBetEntryState();
  let state = selectBetMarket(createBetEntryState(), input.marketType as CreatableMarketType);
  if (input.marketType === 'running') {
    if (input.runningWindow) state = selectRunningWindow(state, input.runningWindow, {
      startMinute: input.windowStartMinute ?? -1, endMinute: input.windowEndMinute ?? -1
    });
    if (input.liveScoreHome != null && input.liveScoreAway != null && input.liveMinute != null && input.liveContextSource) {
      state = setRunningContext(state, {
        liveScoreHome: input.liveScoreHome, liveScoreAway: input.liveScoreAway,
        liveMinute: input.liveMinute, liveContextSource: input.liveContextSource,
        ...(input.liveContextObservedAt ? { liveContextObservedAt: input.liveContextObservedAt } : {})
      });
    }
    if (input.selectionCode && getSelectionCodes(state).includes(input.selectionCode)) state = selectBetSelection(state, input.selectionCode);
    if (input.lineValue != null) state = setManualBetLine(state, String(input.lineValue));
    return state;
  }
  if (input.marketPeriod && MARKET_PERIODS.includes(input.marketPeriod)) state = selectBetPeriod(state, input.marketPeriod);
  if (input.selectionCode && getSelectionCodes(state).includes(input.selectionCode)) state = selectBetSelection(state, input.selectionCode);
  if (input.lineValue != null) state = setManualBetLine(state, String(input.lineValue));
  return state;
}
