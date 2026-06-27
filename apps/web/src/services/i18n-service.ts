export type SupportedLocale = 'en' | 'vi';

const SUPPORTED_LOCALES = Object.freeze(['en', 'vi'] as const);

export interface ResolveLocaleInput {
  readonly storedLocale?: string;
  readonly navigatorLanguages?: readonly string[];
}

export type TranslateFunction = (key: string, fallback?: string) => string;

export function resolveLocale({
  storedLocale,
  navigatorLanguages = []
}: ResolveLocaleInput = {}): SupportedLocale {
  if (SUPPORTED_LOCALES.includes(storedLocale as SupportedLocale)) {
    return storedLocale as SupportedLocale;
  }

  const detectedLocale = navigatorLanguages.find((language) => {
    return typeof language === 'string' && language.toLowerCase().startsWith('vi');
  });

  return detectedLocale ? 'vi' : 'en';
}

export function t(_key: string, fallback = ''): string {
  return fallback;
}
