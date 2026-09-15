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

export const structuredBetMarketCatalog = Object.freeze({
  catalogId: 'v2-structured-betting-market-catalog',
  markets: Object.freeze([
    { marketType: '1X2', periods: ['full_time', 'first_half'], selections: ['home', 'draw', 'away'] },
    { marketType: 'over_under', periods: ['full_time', 'first_half'], selections: ['over', 'under'] },
    { marketType: 'handicap', periods: ['full_time', 'first_half'], selections: ['home', 'away'] },
    { marketType: 'corners', periods: ['full_time', 'first_half'], selections: ['over', 'under'] },
    { marketType: 'running', windows: ['to_half_time', 'to_full_time', 'fixed_15'], selections: ['over', 'under'] }
  ] as const),
  linePresets: Object.freeze({
    goalsFullTime: Object.freeze([1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5]),
    halfTimeAndRunning: Object.freeze([0.5, 0.75, 1, 1.25, 1.5]),
    handicap: Object.freeze([-1.5, -1.25, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]),
    corners: Object.freeze([7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11]),
    cornersFirstHalf: Object.freeze([2.5, 3.5, 4.5, 5.5, 6.5])
  }),
  runningWindows: Object.freeze([
    { startMinute: 0, endMinute: 15 },
    { startMinute: 15, endMinute: 30 },
    { startMinute: 30, endMinute: 45 },
    { startMinute: 45, endMinute: 60 },
    { startMinute: 60, endMinute: 75 },
    { startMinute: 75, endMinute: 90 }
  ] as const)
});
