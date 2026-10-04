const POSTGRES_JSON_PARAMETER = Symbol('miraichi.postgres-json-parameter');

export interface PostgresJsonParameter {
  readonly [POSTGRES_JSON_PARAMETER]: true;
  readonly value: unknown;
}

export function postgresJson(value: unknown): PostgresJsonParameter {
  return Object.freeze({ [POSTGRES_JSON_PARAMETER]: true as const, value });
}

function isPostgresJsonParameter(value: unknown): value is PostgresJsonParameter {
  return typeof value === 'object'
    && value !== null
    && POSTGRES_JSON_PARAMETER in value
    && (value as PostgresJsonParameter)[POSTGRES_JSON_PARAMETER] === true;
}

export function normalizeNodePostgresParameters(values: readonly unknown[]): unknown[] {
  return values.map((value) => (
    isPostgresJsonParameter(value) ? JSON.stringify(value.value) : value
  ));
}

export function normalizePostgresJsParameters(
  values: readonly unknown[],
  encodeJson: (value: unknown) => unknown
): unknown[] {
  return values.map((value) => (
    isPostgresJsonParameter(value) ? encodeJson(value.value) : value
  ));
}
