export type LiveDataMode = 'disabled' | 'sportscore-widget' | 'fotmob-daily';
export function readLiveDataMode(env: NodeJS.ProcessEnv): LiveDataMode {
  const mode = env.LIVE_DATA_MODE?.trim();
  if (mode) {
    if (mode === 'disabled' || mode === 'sportscore-widget' || mode === 'fotmob-daily') return mode;
    throw new Error('LIVE_DATA_MODE must be disabled, sportscore-widget or fotmob-daily');
  }
  const legacy = env.SPORTSCORE_LIVE_MODE?.trim() || 'disabled';
  if (legacy !== 'disabled' && legacy !== 'widget') throw new Error('SPORTSCORE_LIVE_MODE must be disabled or widget');
  return legacy === 'widget' ? 'sportscore-widget' : 'disabled';
}
