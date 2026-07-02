export type JsonObject = Record<string, unknown>;

export async function readJsonObjectRequest(req: import('http').IncomingMessage): Promise<JsonObject> {
  let rawBody = '';
  for await (const chunk of req) rawBody += String(chunk);
  return parseJsonObjectBody(rawBody);
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJsonObjectBody(rawBody: string): JsonObject {
  if (!rawBody.trim()) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON request body');
  }

  if (!isJsonObject(parsed)) {
    throw new Error('JSON request body must be an object');
  }

  return parsed;
}

export function readStringField(payload: JsonObject, key: string, fallback: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : fallback;
}

export function readNestedStringField(
  payload: JsonObject,
  parentKey: string,
  childKey: string,
  fallback: string
): string {
  const parent = payload[parentKey];
  if (!isJsonObject(parent)) {
    return fallback;
  }

  const value = parent[childKey];
  return typeof value === 'string' ? value : fallback;
}
