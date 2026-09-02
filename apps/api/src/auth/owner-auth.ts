import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

const PASSWORD_PREFIX = 'scrypt-v1';
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const MIN_SESSION_SECRET_LENGTH = 32;
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const OWNER_SESSION_COOKIE = '__Host-miraichi_owner';

export interface OwnerAuthConfig {
  readonly mode: 'disabled' | 'password';
  readonly sessionTtlSeconds: number;
  readonly passwordHash?: string;
  readonly sessionSecret?: string;
}

interface ParsedPasswordHash {
  readonly salt: Buffer;
  readonly expectedKey: Buffer;
}

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: 64 * 1024 * 1024
    }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function parsePasswordHash(value: string): ParsedPasswordHash | null {
  const parts = value.split('$');
  if (parts.length !== 6) return null;
  const [prefix, n, r, p, saltValue, keyValue] = parts;
  if (prefix !== PASSWORD_PREFIX || n !== String(SCRYPT_N) || r !== String(SCRYPT_R) || p !== String(SCRYPT_P)) {
    return null;
  }

  try {
    const salt = Buffer.from(saltValue!, 'base64url');
    const expectedKey = Buffer.from(keyValue!, 'base64url');
    if (salt.byteLength !== 16 || expectedKey.byteLength !== SCRYPT_KEY_LENGTH) return null;
    return { salt, expectedKey };
  } catch {
    return null;
  }
}

function parseSessionTtl(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_SESSION_TTL_SECONDS;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < 300 || seconds > MAX_SESSION_TTL_SECONDS) {
    throw new Error(`MIRAICHI_SESSION_TTL_SECONDS must be an integer from 300 to ${MAX_SESSION_TTL_SECONDS}`);
  }
  return seconds;
}

export function readOwnerAuthConfig(env: NodeJS.ProcessEnv = process.env): OwnerAuthConfig {
  const appEnv = env.APP_ENV?.trim() || 'local';
  const isLocalOrTest = appEnv === 'local' || appEnv === 'test';
  const rawMode = env.MIRAICHI_OWNER_AUTH_MODE?.trim() || (isLocalOrTest ? 'disabled' : 'password');
  if (rawMode !== 'disabled' && rawMode !== 'password') {
    throw new Error('MIRAICHI_OWNER_AUTH_MODE must be disabled or password');
  }
  if (!isLocalOrTest && rawMode === 'disabled') {
    throw new Error('Owner authentication cannot be disabled outside local/test');
  }

  const sessionTtlSeconds = parseSessionTtl(env.MIRAICHI_SESSION_TTL_SECONDS);
  if (rawMode === 'disabled') return { mode: 'disabled', sessionTtlSeconds };

  const passwordHash = env.MIRAICHI_OWNER_PASSWORD_HASH?.trim();
  if (!passwordHash || !parsePasswordHash(passwordHash)) {
    throw new Error('MIRAICHI_OWNER_PASSWORD_HASH must contain a supported scrypt-v1 hash');
  }
  const sessionSecret = env.MIRAICHI_SESSION_SECRET?.trim();
  if (!sessionSecret || Buffer.byteLength(sessionSecret, 'utf8') < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`MIRAICHI_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} bytes`);
  }

  return { mode: 'password', passwordHash, sessionSecret, sessionTtlSeconds };
}

export async function createOwnerPasswordHash(password: string): Promise<string> {
  if (password.length < 12) throw new Error('Owner password must be at least 12 characters');
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return [PASSWORD_PREFIX, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyOwnerPassword(password: string, passwordHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(passwordHash);
  if (!parsed) return false;
  const actualKey = await scrypt(password, parsed.salt);
  return timingSafeEqual(actualKey, parsed.expectedKey);
}

function sessionSignature(versionAndPayload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(versionAndPayload).digest();
}

export function createOwnerSessionToken(secret: string, issuedAtMs: number, ttlSeconds: number): string {
  const issuedAt = Math.floor(issuedAtMs / 1_000);
  const payload = Buffer.from(JSON.stringify({ sub: 'owner', iat: issuedAt, exp: issuedAt + ttlSeconds })).toString('base64url');
  const versionAndPayload = `v1.${payload}`;
  const signature = sessionSignature(versionAndPayload, secret).toString('base64url');
  return `${versionAndPayload}.${signature}`;
}

export function verifyOwnerSessionToken(token: string, secret: string, nowMs = Date.now()): boolean {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const versionAndPayload = `${parts[0]}.${parts[1]}`;

  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(parts[2]!, 'base64url');
  } catch {
    return false;
  }
  const expectedSignature = sessionSignature(versionAndPayload, secret);
  if (suppliedSignature.byteLength !== expectedSignature.byteLength || !timingSafeEqual(suppliedSignature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
    const nowSeconds = Math.floor(nowMs / 1_000);
    return payload.sub === 'owner'
      && typeof payload.iat === 'number'
      && typeof payload.exp === 'number'
      && Number.isSafeInteger(payload.iat)
      && Number.isSafeInteger(payload.exp)
      && payload.iat <= nowSeconds + 60
      && payload.exp > nowSeconds;
  } catch {
    return false;
  }
}

export function serializeOwnerSessionCookie(token: string, ttlSeconds: number): string {
  return `${OWNER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttlSeconds}`;
}

export function serializeExpiredOwnerSessionCookie(): string {
  return `${OWNER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
