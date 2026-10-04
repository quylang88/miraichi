declare global {
  interface Window {
    MIRAICHI_ENV?: {
      API_URL?: string;
    };
  }
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.MIRAICHI_ENV?.API_URL) {
    return window.MIRAICHI_ENV.API_URL.replace(/\/+$/, '');
  }
  return '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
