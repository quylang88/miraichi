import { buildApiUrl } from './config/client-env.js';

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
    unavailable: 'The secure session service is unavailable. Try again shortly.'
  },
  vi: {
    eyebrow: 'Không gian riêng của chủ tài khoản',
    title: 'Đăng nhập Miraichi',
    description: 'Nhập mật khẩu chủ tài khoản. Không có đăng ký công khai.',
    password: 'Mật khẩu',
    submit: 'Đăng nhập',
    invalid: 'Sai mật khẩu.',
    unavailable: 'Dịch vụ phiên bảo mật đang không khả dụng. Hãy thử lại sau.'
  }
});

function resolveOwnerLocale(): OwnerLocale {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.languages?.some((language) => language.toLowerCase().startsWith('vi')) ? 'vi' : 'en';
}

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
  try {
    const response = await fetcher(buildApiUrl('/api/v1/auth/session'), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return 'unavailable';
    const payload = await response.json() as { authenticated?: unknown };
    if (payload.authenticated !== true) return 'login';
    await loadShell();
    return 'authenticated';
  } catch {
    return 'unavailable';
  }
}

export async function startOwnerAuthBootstrap(
  root: HTMLElement,
  fetcher: FetchLike = fetch,
  loadShell: () => Promise<unknown> = () => import('./shell-entry.js')
): Promise<void> {
  const locale = resolveOwnerLocale();
  const showLogin = (state: OwnerLoginState) => {
    document.documentElement.lang = locale;
    root.innerHTML = renderOwnerLogin(locale, state);
  };

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
      await loadShell();
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

  const state = await bootstrapAuthenticatedShell(fetcher, loadShell);
  if (state === 'login') showLogin('idle');
  if (state === 'unavailable') showLogin('unavailable');
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('app-root');
  if (!root) throw new Error('Missing app-root element for Miraichi owner authentication.');
  void startOwnerAuthBootstrap(root);
}
