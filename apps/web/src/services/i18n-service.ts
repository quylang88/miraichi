import enCatalog from '../locales/en.json' with { type: 'json' };
import viCatalog from '../locales/vi.json' with { type: 'json' };

export type SupportedLocale = 'en' | 'vi';
export type TranslationKey = keyof typeof enCatalog;
export type TranslationParameters = Readonly<Record<string, string | number>>;
export type TranslateFunction = (
  key: string,
  fallbackOrParameters?: string | TranslationParameters,
  parameters?: TranslationParameters
) => string;

const SUPPORTED_LOCALES = Object.freeze(['en', 'vi'] as const);
const CATALOGS: Readonly<Record<SupportedLocale, Readonly<Record<TranslationKey, string>>>> = Object.freeze({
  en: enCatalog,
  vi: viCatalog
});

export interface ResolveLocaleInput {
  readonly storedLocale?: string;
  readonly navigatorLanguages?: readonly string[];
}

export function resolveLocale({ storedLocale, navigatorLanguages = [] }: ResolveLocaleInput = {}): SupportedLocale {
  if (SUPPORTED_LOCALES.includes(storedLocale as SupportedLocale)) return storedLocale as SupportedLocale;
  return navigatorLanguages.some((language) => language.toLowerCase().startsWith('vi')) ? 'vi' : 'en';
}

function interpolate(message: string, parameters: TranslationParameters): string {
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) => {
    const value = parameters[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function createTranslator(locale: SupportedLocale): TranslateFunction {
  const catalog = CATALOGS[locale];
  return (key, fallbackOrParameters, parameters = {}) => {
    const fallback = typeof fallbackOrParameters === 'string' ? fallbackOrParameters : undefined;
    const replacements = typeof fallbackOrParameters === 'object' ? fallbackOrParameters : parameters;
    return interpolate(catalog[key as TranslationKey] ?? fallback ?? key, replacements);
  };
}

const defaultEnglishTranslator = createTranslator('en');

export function t(key: string, fallbackOrParameters?: string | TranslationParameters, parameters?: TranslationParameters): string {
  return defaultEnglishTranslator(key, fallbackOrParameters, parameters);
}

export function getCatalogKeys(locale: SupportedLocale): readonly string[] {
  return Object.keys(CATALOGS[locale]).sort();
}

export function formatNumber(value: number, locale: SupportedLocale, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', options).format(value);
}

export function formatDateTime(
  value: string | number | Date,
  locale: SupportedLocale,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
    ...options
  }).format(new Date(value));
}
