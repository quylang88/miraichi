import type { SupportedLocale } from './i18n-service.js';

const SETTINGS_STORAGE_KEY = 'miraichi:shell-settings:v1';

export interface ShellSettings {
  readonly locale: SupportedLocale;
  readonly theme: 'dark';
  readonly displayDensity: 'standard' | 'compact';
  readonly timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh';
}

type ShellSettingKey = keyof ShellSettings;

const DEFAULT_SETTINGS: ShellSettings = Object.freeze({
  locale: 'en',
  theme: 'dark',
  displayDensity: 'standard',
  timezone: 'local'
});

const ALLOWED_SETTING_VALUES: Record<ShellSettingKey, ReadonlySet<string>> = Object.freeze({
  locale: new Set(['en', 'vi']),
  theme: new Set(['dark']),
  displayDensity: new Set(['standard', 'compact']),
  timezone: new Set(['local', 'UTC', 'Asia/Ho_Chi_Minh'])
});

function getBrowserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }

  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
}

function getBrowserStorage(): Storage | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage;
}

function isStoredSettings(value: unknown): value is Partial<Record<ShellSettingKey, string>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredSettings(storage: Storage | null): Partial<Record<ShellSettingKey, string>> {
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return isStoredSettings(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeSettings(
  rawSettings: Partial<Record<ShellSettingKey, string>>,
  _navigatorLanguages: readonly string[]
): ShellSettings {
  return {
    ...DEFAULT_SETTINGS,
    locale: rawSettings.locale === 'vi' ? 'vi' : DEFAULT_SETTINGS.locale,
    theme: rawSettings.theme === 'dark' ? rawSettings.theme : DEFAULT_SETTINGS.theme,
    displayDensity: rawSettings.displayDensity === 'compact' ? 'compact' : DEFAULT_SETTINGS.displayDensity,
    timezone: (rawSettings.timezone === 'UTC' || rawSettings.timezone === 'Asia/Ho_Chi_Minh' || rawSettings.timezone === 'local')
      ? rawSettings.timezone
      : DEFAULT_SETTINGS.timezone
  };
}

export function createSettingsService({
  storage = getBrowserStorage(),
  navigatorLanguages = getBrowserLanguages()
}: {
  readonly storage?: Storage | null;
  readonly navigatorLanguages?: readonly string[];
} = {}) {
  let settings = normalizeSettings(parseStoredSettings(storage), navigatorLanguages);

  function persist(): void {
    if (!storage) {
      return;
    }

    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }

  return {
    getSettings(): ShellSettings {
      return { ...settings };
    },

    setSetting(key: string, value: unknown): ShellSettings {
      if (!Object.hasOwn(ALLOWED_SETTING_VALUES, key)) {
        throw new Error(`Unsupported shell setting key: ${key}`);
      }

      const settingKey = key as ShellSettingKey;
      if (typeof value !== 'string' || !ALLOWED_SETTING_VALUES[settingKey].has(value)) {
        throw new Error(`Unsupported value "${String(value)}" for shell setting key: ${key}`);
      }

      settings = {
        ...settings,
        [settingKey]: value
      } as ShellSettings;
      persist();
      return { ...settings };
    },

    resetSettings(): ShellSettings {
      settings = normalizeSettings({}, navigatorLanguages);
      persist();
      return { ...settings };
    }
  };
}
