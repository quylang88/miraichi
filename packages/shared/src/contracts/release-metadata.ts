export type ReleaseRuntimeEnvironment = 'local' | 'staging' | 'production';

export interface ReleaseMetadata {
  readonly environment: ReleaseRuntimeEnvironment;
  readonly gitSha: string;
  readonly artifactVersion: string;
  readonly compatibilityVersion: string;
}

const GIT_SHA = /^[a-f0-9]{40}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function required(env: Readonly<Record<string, unknown>>, name: string, label: string): string {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Release ${label} is required`);
  return value.trim();
}

export function readReleaseMetadata(env: Readonly<Record<string, unknown>>): ReleaseMetadata {
  const environment = required(env, 'MIRAICHI_RELEASE_ENVIRONMENT', 'environment');
  if (!['local', 'staging', 'production'].includes(environment)) {
    throw new Error('Release environment must be local, staging, or production');
  }
  const gitSha = required(env, 'MIRAICHI_RELEASE_SHA', 'SHA');
  if (!GIT_SHA.test(gitSha)) throw new Error('Release SHA must be a lowercase 40-character Git SHA');
  const artifactVersion = required(env, 'MIRAICHI_RELEASE_ARTIFACT', 'artifact version');
  if (!VERSION.test(artifactVersion)) throw new Error('Release artifact version is invalid');
  const compatibilityVersion = required(env, 'MIRAICHI_SCHEMA_COMPAT_VERSION', 'compatibility version');
  if (!VERSION.test(compatibilityVersion)) throw new Error('Release compatibility version is invalid');
  return {
    environment: environment as ReleaseRuntimeEnvironment,
    gitSha,
    artifactVersion,
    compatibilityVersion
  };
}
