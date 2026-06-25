export type IsoDateTimeString = string;
export type BetId = string;
export type MatchId = string;
export type MatchGroupId = string;
export type PredictionTraceId = string;
export type RecommendationId = string;

export type BetTimeType = 'pre_match' | 'live' | (string & {});
export type BetRecordStatus = 'pending' | 'settled' | (string & {});
export type BetRecordSource = 'manual' | 'ai_recommendation';

export type OddsFormat = 'HK';

export interface OddsValueFields {
  oddsFormat: OddsFormat;
  oddsValue: number;
  normalizedOddsValue?: number | null;
}

export type MarketType = '1X2' | 'over_under' | 'handicap' | 'corners' | 'custom';
export type LineValue = number;
export type NonStandardLinePolicy = 'warning_only';

export interface LinePresetDefinition {
  presetId: string;
  label: string;
  lineValue: LineValue;
}

export interface LinePresetRegistry {
  registryId: string;
  marketType: MarketType;
  manualLineEntryAllowed: true;
  presets: readonly LinePresetDefinition[];
}

export interface MarketDefinition {
  marketType: MarketType;
  displayName: string;
  manualLineEntryAllowed: boolean;
  linePresetRegistry?: LinePresetRegistry;
  nonStandardLinePolicy?: NonStandardLinePolicy;
  manualEscapeHatch?: true;
}

export interface MarketCatalog {
  catalogId: string;
  markets: readonly MarketDefinition[];
}

export type TraceMetadata = Readonly<Record<string, unknown>>;

export interface BetRecordEnvelope extends OddsValueFields {
  betId: BetId;
  matchGroupId: MatchGroupId;
  createdAt: IsoDateTimeString;
  betTimeType: BetTimeType;
  homeTeamName: string;
  awayTeamName: string;
  marketType: MarketType;
  selectionLabel: string;
  stakePoints: number;
  status: BetRecordStatus;
  matchId?: MatchId | null;
  competitionLabel?: string;
  seasonLabel?: string;
  marketSubtype?: string;
  lineValue?: LineValue | null;
  lineDisplay?: string;
  liveScoreHome?: number;
  liveScoreAway?: number;
  liveMinute?: number;
  settlement?: string;
  profitLossPoints?: number | null;
  notes?: string;
  tags?: readonly string[];
  source?: BetRecordSource;
  trace?: TraceMetadata;
  predictionTraceId?: PredictionTraceId;
  recommendationId?: RecommendationId;
}

export interface MatchBettingGroup {
  matchGroupId: MatchGroupId;
  homeTeamName: string;
  awayTeamName: string;
  bets: readonly BetId[];
  matchId?: MatchId | null;
  kickoffTime?: IsoDateTimeString;
  competitionLabel?: string;
  seasonLabel?: string;
  groupStatus?: string;
}
