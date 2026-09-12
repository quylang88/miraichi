import { buildApiUrl } from './config/client-env.js';
import { renderAppShell } from './components/app-shell.js';
import { getSafeNavigationTabId } from './config/navigation-tabs.js';
import { createSettingsService } from './services/settings-service.js';
import { createTranslator } from './services/i18n-service.js';

export type OwnerBootstrapState = 'authenticated' | 'login' | 'unavailable';
export type OwnerLoginState = 'idle' | 'invalid' | 'unavailable';
type OwnerLocale = 'en' | 'vi';
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const COPY = Object.freeze({
  en: {
    eyebrow: 'Private owner workspace',
    title: 'Sign in to Miraichi',
    description: 'Enter the owner password. Public registration is disabled.',
    password: 'Password',
    submit: 'Sign in',
    invalid: 'Incorrect password.',
    unavailable: 'Cannot connect. Check your connection and try again.',
    retry: 'Try again'
  },
  vi: {
    eyebrow: 'Không gian riêng của chủ tài khoản',
    title: 'Đăng nhập Miraichi',
    description: 'Nhập mật khẩu chủ tài khoản. Không có đăng ký công khai.',
    password: 'Mật khẩu',
    submit: 'Đăng nhập',
    invalid: 'Sai mật khẩu.',
    unavailable: 'Chưa thể kết nối. Kiểm tra mạng rồi thử lại.',
    retry: 'Thử lại'
  }
});

export function renderOwnerLogin(locale: OwnerLocale, state: OwnerLoginState = 'idle'): string {
  const copy = COPY[locale];
  const feedback = state === 'invalid' ? copy.invalid : state === 'unavailable' ? copy.unavailable : '';
  return `<main class="owner-auth-page" data-owner-auth-state="${state}">
    <section class="owner-auth-card" aria-labelledby="owner-auth-title">
      <div class="owner-auth-mark" aria-hidden="true">M</div>
      <p class="owner-auth-eyebrow">${copy.eyebrow}</p>
      <h1 id="owner-auth-title">${copy.title}</h1>
      <p class="owner-auth-description">${copy.description}</p>
      <form class="owner-auth-form" data-owner-login-form>
        <label for="owner-password">${copy.password}</label>
        <input id="owner-password" name="password" type="password" minlength="12" maxlength="512" autocomplete="current-password" required autofocus>
        <button type="submit">${copy.submit}</button>
        <p class="owner-auth-feedback" aria-live="polite">${feedback}</p>
      </form>
    </section>
  </main>`;
}

export async function bootstrapAuthenticatedShell(
  fetcher: FetchLike,
  loadShell: () => Promise<unknown>
): Promise<OwnerBootstrapState> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(buildApiUrl('/api/v1/auth/session'), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) return 'unavailable';
    const payload = await response.json() as { authenticated?: unknown };
    if (payload.authenticated !== true) return 'login';
    clearTimeout(timeout);
    await loadShell();
    return 'authenticated';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timeout);
  }
}

export async function startOwnerAuthBootstrap(
  root: HTMLElement,
  fetcher: FetchLike = fetch,
  loadShell: () => Promise<unknown> = () => import('./shell-entry.js')
): Promise<void> {
  const settings = createSettingsService().getSettings();
  const locale = settings.locale;
  const copy = COPY[locale];
  const selectPendingTab = (value: string | null) => {
    const tab = getSafeNavigationTabId(value || 'today');
    const main = root.querySelector<HTMLElement>('#main-scroll');
    if (main) main.dataset.activeTab = tab;
    root.querySelectorAll<HTMLElement>('[data-shell-tab-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.shellTabPanel === tab);
    });
    root.querySelectorAll<HTMLElement>('.bottom-nav [data-tab-target]').forEach(button => {
      const active = button.dataset.tabTarget === tab;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url);
  };
  const showPendingShell = () => {
    root.dataset.ownerSession = 'pending';
    document.documentElement.lang = locale;
    const tab = getSafeNavigationTabId(new URLSearchParams(window.location.search).get('tab') || 'today');
    root.innerHTML = renderAppShell({ activeTabId: tab, locale, timezone: settings.timezone, translate: createTranslator(locale) });
    root.querySelector<HTMLElement>('#main-scroll')?.setAttribute('inert', '');
  };
  const loadAuthenticatedShell = async () => {
    await loadShell();
    root.dataset.ownerSession = 'authenticated';
  };
  const showLogin = (state: OwnerLoginState) => {
    root.dataset.ownerSession = 'login';
    document.documentElement.lang = locale;
    root.innerHTML = renderOwnerLogin(locale, state);
  };
  const checkSession = async () => {
    showPendingShell();
    const state = await bootstrapAuthenticatedShell(fetcher, loadAuthenticatedShell);
    if (state === 'login') showLogin('idle');
    if (state === 'unavailable') {
      root.dataset.ownerSession = 'unavailable';
      root.querySelector('.app-shell')?.insertAdjacentHTML('afterbegin',
        `<div class="startup-connection" role="status"><span>${copy.unavailable}</span><button type="button" class="primary-button" data-owner-retry>${copy.retry}</button></div>`);
    }
  };

  root.addEventListener('click', event => {
    if (root.dataset.ownerSession === 'authenticated') return;
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest<HTMLElement>('.bottom-nav [data-tab-target]');
    if (tab) selectPendingTab(tab.dataset.tabTarget ?? null);
    if (target?.closest('[data-owner-retry]')) void checkSession();
  });

  root.addEventListener('submit', (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form?.matches('[data-owner-login-form]')) return;
    event.preventDefault();
    const password = String(new FormData(form).get('password') ?? '');
    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (button) button.disabled = true;
    void fetcher(buildApiUrl('/api/v1/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password })
    }).then(async (response) => {
      if (!response.ok) {
        showLogin(response.status === 401 ? 'invalid' : 'unavailable');
        return;
      }
      await loadAuthenticatedShell();
    }).catch(() => showLogin('unavailable'));
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-owner-logout]')) return;
    void fetcher(buildApiUrl('/api/v1/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    }).finally(() => window.location.reload());
  });

  await checkSession();
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('app-root');
  if (!root) throw new Error('Missing app-root element for Miraichi owner authentication.');
  void startOwnerAuthBootstrap(root);
}
