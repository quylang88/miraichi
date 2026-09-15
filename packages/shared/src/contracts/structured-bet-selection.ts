export const CREATABLE_MARKET_TYPES = Object.freeze([
  '1X2', 'over_under', 'handicap', 'corners', 'running'
] as const);
export const SELECTION_CODES = Object.freeze(['home', 'draw', 'away', 'over', 'under'] as const);
export const MARKET_PERIODS = Object.freeze(['full_time', 'first_half'] as const);
export const RUNNING_WINDOWS = Object.freeze(['to_half_time', 'to_full_time', 'fixed_15'] as const);
export const LIVE_CONTEXT_SOURCES = Object.freeze(['snapshot', 'manual'] as const);

export type CreatableMarketType = typeof CREATABLE_MARKET_TYPES[number];
export type SelectionCode = typeof SELECTION_CODES[number];
export type MarketPeriod = typeof MARKET_PERIODS[number];
export type RunningWindow = typeof RUNNING_WINDOWS[number];
export type LiveContextSource = typeof LIVE_CONTEXT_SOURCES[number];
export type RunningGoalThreshold = 0.5 | 0.75;

export interface StructuredBetSelection {
  readonly marketType: CreatableMarketType;
  readonly selectionCode?: SelectionCode;
  readonly marketPeriod?: MarketPeriod;
  readonly lineValue?: number | null;
  readonly runningWindow?: RunningWindow;
  readonly runningGoalThreshold?: RunningGoalThreshold;
  readonly windowStartMinute?: number;
  readonly windowEndMinute?: number;
  readonly liveScoreHome?: number;
  readonly liveScoreAway?: number;
  readonly liveMinute?: number;
  readonly liveContextSource?: LiveContextSource;
  readonly liveContextObservedAt?: string;
}

export type StructuredBetSelectionValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

const STRUCTURED_DECLARATION_FIELDS = [
  'selectionCode', 'marketPeriod', 'runningWindow', 'windowStartMinute', 'windowEndMinute',
  'liveScoreHome', 'liveScoreAway', 'liveMinute', 'liveContextSource', 'liveContextObservedAt',
  'runningGoalThreshold'
] as const;

export function declaresStructuredBetSelection(input: unknown): boolean {
  return isRecord(input) && (
    input.marketType === 'running'
    || STRUCTURED_DECLARATION_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(input, field))
  );
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const FIXED_WINDOWS = new Map([[0, 15], [15, 30], [30, 45], [45, 60], [60, 75], [75, 90]]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuarterStep(value: number): boolean {
  return Math.abs(value * 4 - Math.round(value * 4)) < 1e-8;
}

function validateLine(value: unknown, minimum: number, maximum: number, errors: string[]): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push('lineValue is required');
    return;
  }
  if (!isQuarterStep(value)) errors.push('lineValue must use a quarter-step');
  if (value < minimum || value > maximum) errors.push(`lineValue is outside the ${minimum} to ${maximum} range`);
}

function validatePeriod(value: unknown, errors: string[]): void {
  if (!MARKET_PERIODS.includes(value as MarketPeriod)) errors.push('marketPeriod is invalid');
}

function validateNoLine(value: Record<string, unknown>, errors: string[]): void {
  if (value.lineValue !== undefined && value.lineValue !== null) errors.push('lineValue is not allowed');
}

function validateNoRunningFields(value: Record<string, unknown>, errors: string[]): void {
  const runningFields = [
    'runningWindow', 'runningGoalThreshold', 'windowStartMinute', 'windowEndMinute', 'liveScoreHome', 'liveScoreAway',
    'liveMinute', 'liveContextSource', 'liveContextObservedAt'
  ];
  if (runningFields.some((field) => value[field] !== undefined)) {
    errors.push('running fields are not allowed for this market');
  }
}

function validateRunning(value: Record<string, unknown>, errors: string[]): void {
  if (value.selectionCode !== undefined && value.selectionCode !== 'over') errors.push('selectionCode must be over for running');
  if (!RUNNING_WINDOWS.includes(value.runningWindow as RunningWindow)) errors.push('runningWindow is invalid');
  if (!Number.isSafeInteger(value.liveScoreHome) || Number(value.liveScoreHome) < 0
    || !Number.isSafeInteger(value.liveScoreAway) || Number(value.liveScoreAway) < 0) {
    errors.push('running requires non-negative integer score for both teams');
    return;
  }
  const minute = value.liveMinute;
  if (minute !== undefined && (!Number.isInteger(minute) || Number(minute) < 0 || Number(minute) >= 90)) {
    errors.push('liveMinute must be an integer before full-time');
  }
  const derived = deriveRunningOver(value as unknown as StructuredBetSelection);
  if (!derived) errors.push('runningGoalThreshold must be 0.5 or 0.75 (fixed_15 forces 0.5)');
  else if (value.lineValue !== undefined && value.lineValue !== null && value.lineValue !== derived.lineValue) {
    errors.push('lineValue contradicts the running score and goal threshold');
  }
  if (!LIVE_CONTEXT_SOURCES.includes(value.liveContextSource as LiveContextSource)) {
    errors.push('liveContextSource is invalid');
  }
  if (value.liveContextSource === 'snapshot'
    && (typeof value.liveContextObservedAt !== 'string' || !ISO.test(value.liveContextObservedAt))) {
    errors.push('liveContextObservedAt is required for snapshot context');
  }
  if (value.liveContextSource === 'manual' && value.liveContextObservedAt !== undefined) {
    errors.push('manual context must not include liveContextObservedAt');
  }
  if (value.marketPeriod !== undefined) errors.push('marketPeriod is not allowed for running');

  if (value.runningWindow === 'to_half_time' && minute !== undefined && Number(minute) >= 45) {
    errors.push('running half-time selection is closed');
  }
  if (value.runningWindow === 'fixed_15') {
    const start = value.windowStartMinute;
    const end = value.windowEndMinute;
    if (!Number.isInteger(start) || !Number.isInteger(end) || FIXED_WINDOWS.get(Number(start)) !== end) {
      errors.push('fixed running window must be a supported 15-minute block');
    } else if (minute !== undefined && Number(minute) >= Number(end)) {
      errors.push('fixed running window has already ended');
    }
  } else if (value.windowStartMinute !== undefined || value.windowEndMinute !== undefined) {
    errors.push('window minutes are only allowed for fixed_15');
  }
}

export function deriveRunningOver(selection: StructuredBetSelection):
  { readonly selectionCode: 'over'; readonly runningGoalThreshold: RunningGoalThreshold; readonly lineValue: number } | null {
  if (selection.marketType !== 'running') return null;
  const threshold = selection.runningWindow === 'fixed_15' ? 0.5 : selection.runningGoalThreshold;
  if (threshold !== 0.5 && threshold !== 0.75) return null;
  if (selection.runningWindow === 'fixed_15' && selection.runningGoalThreshold !== undefined && selection.runningGoalThreshold !== 0.5) return null;
  if (!Number.isSafeInteger(selection.liveScoreHome) || !Number.isSafeInteger(selection.liveScoreAway)) return null;
  const lineValue = selection.runningWindow === 'fixed_15'
    ? 0.5 : Number(selection.liveScoreHome) + Number(selection.liveScoreAway) + threshold;
  if (!Number.isFinite(lineValue) || !isQuarterStep(lineValue)) return null;
  return { selectionCode: 'over', runningGoalThreshold: threshold, lineValue };
}

export function validateStructuredBetSelection(input: unknown): StructuredBetSelectionValidationResult {
  if (!isRecord(input)) return { ok: false, errors: ['selection must be an object'] };
  const errors: string[] = [];
  if (!CREATABLE_MARKET_TYPES.includes(input.marketType as CreatableMarketType)) {
    return { ok: false, errors: ['marketType is invalid'] };
  }

  switch (input.marketType) {
    case '1X2':
      validatePeriod(input.marketPeriod, errors);
      if (!['home', 'draw', 'away'].includes(String(input.selectionCode))) errors.push('selectionCode is invalid for 1X2');
      validateNoLine(input, errors);
      validateNoRunningFields(input, errors);
      break;
    case 'over_under':
      validatePeriod(input.marketPeriod, errors);
      if (!['over', 'under'].includes(String(input.selectionCode))) errors.push('selectionCode is invalid for over_under');
      validateLine(input.lineValue, 0.25, 20, errors);
      validateNoRunningFields(input, errors);
      break;
    case 'handicap':
      validatePeriod(input.marketPeriod, errors);
      if (!['home', 'away'].includes(String(input.selectionCode))) errors.push('selectionCode is invalid for handicap');
      validateLine(input.lineValue, -10, 10, errors);
      validateNoRunningFields(input, errors);
      break;
    case 'corners':
      validatePeriod(input.marketPeriod, errors);
      if (!['over', 'under'].includes(String(input.selectionCode))) errors.push('selectionCode is invalid for corners');
      validateLine(input.lineValue, 0.25, 40, errors);
      validateNoRunningFields(input, errors);
      break;
    case 'running':
      validateRunning(input, errors);
      break;
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function parseQuarterLineInput(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && isQuarterStep(parsed) ? parsed : null;
}

function lineText(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, '').replace(/\.$/, '');
}

function periodText(period: MarketPeriod): string {
  return period === 'full_time' ? 'FT' : 'HT';
}

export function formatStructuredSelectionLabel(
  selection: StructuredBetSelection,
  teams: { readonly homeTeamName: string; readonly awayTeamName: string }
): string {
  const side = selection.marketType === 'running' ? 'Over' : selection.selectionCode === 'home'
    ? teams.homeTeamName
    : selection.selectionCode === 'away'
      ? teams.awayTeamName
      : selection.selectionCode === 'draw'
        ? 'Draw'
        : selection.selectionCode === 'over' ? 'Over' : 'Under';
  if (selection.marketType === '1X2') return `${side} · ${periodText(selection.marketPeriod!)}`;
  if (selection.marketType === 'handicap') {
    const line = selection.lineValue!;
    return `${side} ${line > 0 ? '+' : ''}${lineText(line)} · ${periodText(selection.marketPeriod!)}`;
  }
  if (selection.marketType === 'over_under') {
    return `${side} ${lineText(selection.lineValue!)} · ${periodText(selection.marketPeriod!)}`;
  }
  if (selection.marketType === 'corners') {
    return `${side} ${lineText(selection.lineValue!)} corners · ${periodText(selection.marketPeriod!)}`;
  }
  const window = selection.runningWindow === 'to_half_time'
    ? 'HT'
    : selection.runningWindow === 'to_full_time'
      ? 'FT'
      : `${selection.windowStartMinute}-${selection.windowEndMinute}`;
  const lineValue = deriveRunningOver(selection)?.lineValue ?? selection.lineValue!;
  const minute = selection.liveMinute === undefined ? '' : ` @ ${selection.liveMinute}'`;
  return `${side} ${lineText(lineValue)} · Running ${window} · ${selection.liveScoreHome}-${selection.liveScoreAway}${minute}`;
}
