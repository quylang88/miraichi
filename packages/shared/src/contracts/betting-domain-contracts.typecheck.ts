import type {
  BetRecordEnvelope,
  BetRecordSource,
  LinePresetRegistry,
  MarketDefinition,
  MarketType,
  MatchBettingGroup,
  OddsFormat,
  OddsValueFields
} from './betting-domain-contracts.js';

type Assert<T extends true> = T;
type Extends<T, U> = T extends U ? true : false;

type _BetRecordCoreFields = Assert<
  Extends<
    Pick<
      BetRecordEnvelope,
      | 'betId'
      | 'matchGroupId'
      | 'createdAt'
      | 'betTimeType'
      | 'homeTeamName'
      | 'awayTeamName'
      | 'marketType'
      | 'selectionLabel'
      | 'oddsFormat'
      | 'oddsValue'
      | 'stakePoints'
      | 'status'
    >,
    {
      betId: string;
      matchGroupId: string;
      createdAt: string;
      betTimeType: string;
      homeTeamName: string;
      awayTeamName: string;
      marketType: MarketType | string;
      selectionLabel: string;
      oddsFormat: OddsFormat;
      oddsValue: number;
      stakePoints: number;
      status: string;
    }
  >
>;

type _ProfitLossIsNullableShape = Assert<
  Extends<BetRecordEnvelope['profitLossPoints'], number | null | undefined>
>;

type _MatchGroupUsesMatchGroupId = Assert<
  Extends<
    Pick<MatchBettingGroup, 'matchGroupId' | 'homeTeamName' | 'awayTeamName' | 'bets'>,
    { matchGroupId: string; homeTeamName: string; awayTeamName: string; bets: readonly string[] }
  >
>;

type _MarketBaseline = Assert<
  Extends<'1X2' | 'over_under' | 'handicap' | 'corners' | 'custom', MarketType>
>;

type _MarketDefinitionUsesWarningOnlyPolicy = Assert<
  Extends<MarketDefinition['nonStandardLinePolicy'], 'warning_only' | undefined>
>;

type _ManualLineEntryAlwaysAllowedShape = Assert<
  Extends<LinePresetRegistry['manualLineEntryAllowed'], true>
>;

type _HkOnlyOdds = Assert<Extends<OddsFormat, 'HK'>>;

type _SourceBoundary = Assert<Extends<BetRecordSource, 'manual'>>;

type _OddsValueAllowsNullableNormalizedFutureField = Assert<
  Extends<OddsValueFields['normalizedOddsValue'], number | null | undefined>
>;
