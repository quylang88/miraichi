import type {
  LinePresetRegistry,
  MarketCatalog
} from '../contracts/betting-domain-contracts.js';

export const v1OverUnderLinePresetRegistry = {
  registryId: 'v1-over-under-line-presets',
  marketType: 'over_under',
  manualLineEntryAllowed: true,
  presets: [
    { presetId: 'over-under-0-5', label: '0.5', lineValue: 0.5 },
    { presetId: 'over-under-1-5', label: '1.5', lineValue: 1.5 },
    { presetId: 'over-under-2-5', label: '2.5', lineValue: 2.5 },
    { presetId: 'over-under-3-5', label: '3.5', lineValue: 3.5 }
  ]
} as const satisfies LinePresetRegistry;

export const v1HandicapLinePresetRegistry = {
  registryId: 'v1-handicap-line-presets',
  marketType: 'handicap',
  manualLineEntryAllowed: true,
  presets: [
    { presetId: 'handicap-minus-1', label: '-1', lineValue: -1 },
    { presetId: 'handicap-minus-0-5', label: '-0.5', lineValue: -0.5 },
    { presetId: 'handicap-0', label: '0', lineValue: 0 },
    { presetId: 'handicap-plus-0-5', label: '+0.5', lineValue: 0.5 },
    { presetId: 'handicap-plus-1', label: '+1', lineValue: 1 }
  ]
} as const satisfies LinePresetRegistry;

export const v1CornersLinePresetRegistry = {
  registryId: 'v1-corners-line-presets',
  marketType: 'corners',
  manualLineEntryAllowed: true,
  presets: [
    { presetId: 'corners-7-5', label: '7.5', lineValue: 7.5 },
    { presetId: 'corners-8-5', label: '8.5', lineValue: 8.5 },
    { presetId: 'corners-9-5', label: '9.5', lineValue: 9.5 },
    { presetId: 'corners-10-5', label: '10.5', lineValue: 10.5 }
  ]
} as const satisfies LinePresetRegistry;

export const v1LinePresetRegistries = [
  v1OverUnderLinePresetRegistry,
  v1HandicapLinePresetRegistry,
  v1CornersLinePresetRegistry
] as const satisfies readonly LinePresetRegistry[];

export const v1MarketCatalog = {
  catalogId: 'v1-generic-betting-market-catalog',
  markets: [
    {
      marketType: '1X2',
      displayName: '1X2',
      manualLineEntryAllowed: true
    },
    {
      marketType: 'over_under',
      displayName: 'Over/Under',
      manualLineEntryAllowed: true,
      linePresetRegistry: v1OverUnderLinePresetRegistry,
      nonStandardLinePolicy: 'warning_only'
    },
    {
      marketType: 'handicap',
      displayName: 'Handicap',
      manualLineEntryAllowed: true,
      linePresetRegistry: v1HandicapLinePresetRegistry,
      nonStandardLinePolicy: 'warning_only'
    },
    {
      marketType: 'corners',
      displayName: 'Corners',
      manualLineEntryAllowed: true,
      linePresetRegistry: v1CornersLinePresetRegistry,
      nonStandardLinePolicy: 'warning_only'
    },
    {
      marketType: 'custom',
      displayName: 'Custom Market',
      manualLineEntryAllowed: true,
      manualEscapeHatch: true
    }
  ]
} as const satisfies MarketCatalog;
