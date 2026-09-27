export type ReleaseEnvironment = 'staging' | 'production';
export type ReleaseEdgeRegion = 'eu-central-1' | 'ap-southeast-1';

export interface ReleaseTarget {
  readonly environment: ReleaseEnvironment;
  readonly branch: 'staging' | 'main';
  readonly edgeRegion: ReleaseEdgeRegion;
  readonly cloudflareEnvironment: ReleaseEnvironment;
  readonly requiresOwnerBackup: boolean;
}

export interface ReleaseTargetBindings {
  readonly branch: string;
  readonly edgeRegion: string;
  readonly cloudflareEnvironment: string;
  readonly publicOrigin: string;
  readonly edgeFunctionUrl: string;
}

const RELEASE_TARGETS: Readonly<Record<ReleaseEnvironment, ReleaseTarget>> = Object.freeze({
  staging: Object.freeze({
    environment: 'staging',
    branch: 'staging',
    edgeRegion: 'eu-central-1',
    cloudflareEnvironment: 'staging',
    requiresOwnerBackup: false
  }),
  production: Object.freeze({
    environment: 'production',
    branch: 'main',
    edgeRegion: 'ap-southeast-1',
    cloudflareEnvironment: 'production',
    requiresOwnerBackup: true
  })
});

export function getReleaseTarget(environment: string): ReleaseTarget {
  if (environment !== 'staging' && environment !== 'production') {
    throw new Error(`Unknown release environment: ${environment || '<empty>'}`);
  }
  return RELEASE_TARGETS[environment];
}

function isLocalUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return true;
  }
  return parsed.protocol !== 'https:'
    || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
}

export function assertReleaseTargetBindings(
  target: ReleaseTarget,
  bindings: ReleaseTargetBindings
): void {
  const mismatched = bindings.branch !== target.branch
    || bindings.edgeRegion !== target.edgeRegion
    || bindings.cloudflareEnvironment !== target.cloudflareEnvironment;
  const localProductionUrl = target.environment === 'production'
    && (isLocalUrl(bindings.publicOrigin) || isLocalUrl(bindings.edgeFunctionUrl));
  if (mismatched || localProductionUrl) {
    const label = target.environment === 'production' ? 'Production' : 'Staging';
    throw new Error(`${label} release bindings do not match the approved target`);
  }
}
