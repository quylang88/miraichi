/**
 * Mock Competition Registry.
 * Competition-agnostic. No business logic.
 */

export const COMPETITION_REGISTRY = {
  "comp_international_cup_2026": {
    id: "comp_international_cup_2026",
    name: "Alpha Tournament 2026",
    sport: "football",
    status: "active"
  },
  "comp_domestic_league_2026": {
    id: "comp_domestic_league_2026",
    name: "Beta League 2026",
    sport: "football",
    status: "active"
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates configuration profiles or keys.
 * Rejects payloads containing hardcoded "World Cup" strings or invalid config keys.
 *
 * @param {unknown} config
 * @returns {boolean}
 */
export function validateConfig(config: unknown): boolean {
  if (!isRecord(config)) return true;

  const serialized = JSON.stringify(config);

  // Rule Check: Hardcoded tournament names (World Cup, Premier League, etc.) are forbidden
  if (/world\s*cup/i.test(serialized) || /premier\s*league/i.test(serialized)) {
    throw new Error("[Config Violation] Hardcoded competition names like 'World Cup' or 'Premier League' are strictly forbidden.");
  }

  // Rule Check: Validate configuration keys
  const allowedKeys = [
    'competitionId',
    'seasonId',
    'matchId',
    'teamId',
    'port',
    'host',
    'env',
    'name',
    'sport',
    'status'
  ];

  for (const key of Object.keys(config)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`[Config Error] Invalid configuration key: '${key}'`);
    }
  }

  return true;
}
