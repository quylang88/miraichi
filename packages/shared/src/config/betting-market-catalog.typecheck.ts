import type { MarketType } from '../contracts/betting-domain-contracts.js';
import type {
  v1LinePresetRegistries,
  v1MarketCatalog
} from './betting-market-catalog.js';

type Assert<T extends true> = T;
type Extends<T, U> = [T] extends [U] ? true : false;
type Equals<T, U> = Extends<T, U> extends true ? Extends<U, T> : false;

type CatalogMarket = (typeof v1MarketCatalog)['markets'][number];
type ConfiguredMarketType = CatalogMarket['marketType'];
type LinePresetMarketType = (typeof v1LinePresetRegistries)[number]['marketType'];
type LineMarket = Extract<CatalogMarket, { marketType: 'over_under' | 'handicap' | 'corners' }>;
type CustomMarket = Extract<CatalogMarket, { marketType: 'custom' }>;

type _MarketCatalogMatchesV1Baseline = Assert<Equals<ConfiguredMarketType, MarketType>>;
type _ManualLineEntryRemainsAllowed = Assert<Extends<CatalogMarket['manualLineEntryAllowed'], true>>;
type _LinePresetsExistOnlyForLineMarkets = Assert<
  Equals<LinePresetMarketType, 'over_under' | 'handicap' | 'corners'>
>;
type _LinePresetRegistriesAllowManualEntry = Assert<
  Extends<(typeof v1LinePresetRegistries)[number]['manualLineEntryAllowed'], true>
>;
type _LineMarketsUseWarningOnlyPolicy = Assert<
  Extends<LineMarket['nonStandardLinePolicy'], 'warning_only'>
>;
type _CustomMarketRemainsManualEscapeHatch = Assert<
  Extends<CustomMarket['manualEscapeHatch'], true>
>;
type _CustomMarketHasNoPresetRegistry = Assert<
  Extends<'linePresetRegistry' extends keyof CustomMarket ? true : false, false>
>;
