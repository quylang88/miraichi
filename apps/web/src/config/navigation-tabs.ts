export const PRODUCTION_NAVIGATION_TAB_IDS = Object.freeze([
  'today',
  'matches',
  'bets',
  'bankroll'
] as const);

export type ProductionNavigationTabId = typeof PRODUCTION_NAVIGATION_TAB_IDS[number];

export interface NavigationTab {
  readonly id: ProductionNavigationTabId;
  readonly labelKey: string;
  readonly fallbackLabel: string;
  readonly iconLabel: string;
  readonly descriptionKey: string;
  readonly fallbackDescription: string;
}

export const navigationTabs = Object.freeze([
  {
    id: 'today',
    labelKey: 'nav.today',
    fallbackLabel: 'Today',
    iconLabel: 'T',
    descriptionKey: 'today.description',
    fallbackDescription: 'Daily command center'
  },
  {
    id: 'matches',
    labelKey: 'nav.matches',
    fallbackLabel: 'Matches',
    iconLabel: 'M',
    descriptionKey: 'matches.description',
    fallbackDescription: 'Generic match research'
  },
  {
    id: 'bets',
    labelKey: 'nav.bets',
    fallbackLabel: 'Bets',
    iconLabel: 'B',
    descriptionKey: 'bets.description',
    fallbackDescription: 'Manual bet journal'
  },
  {
    id: 'bankroll',
    labelKey: 'nav.bankroll',
    fallbackLabel: 'Bankroll',
    iconLabel: 'K',
    descriptionKey: 'bankroll.description',
    fallbackDescription: 'Points and risk notes'
  }
] satisfies readonly NavigationTab[]);

export function getNavigationTabById(tabId: string | null | undefined): NavigationTab | null {
  return navigationTabs.find((tab) => tab.id === tabId) ?? null;
}

export function getSafeNavigationTabId(tabId: string | null | undefined): ProductionNavigationTabId {
  return getNavigationTabById(tabId)?.id ?? 'today';
}
