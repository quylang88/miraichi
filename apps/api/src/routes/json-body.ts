export type JsonObject = Record<string, unknown>;

export type JsonBodyErrorCode =
  | 'unsupported_media_type'
  | 'request_body_too_large'
  | 'invalid_json_body'
  | 'json_object_required';

export class JsonBodyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: JsonBodyErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'JsonBodyError';
  }
}

interface LegacyBodyRequest extends AsyncIterable<unknown> {
  headers?: Record<string, string | readonly string[] | undefined>;
}

const DEFAULT_MAX_JSON_BYTES = 64 * 1024;

function contentTypeOf(request: Request | LegacyBodyRequest): string | undefined {
  if (request instanceof Request) return request.headers.get('content-type') ?? undefined;
  const value = request.headers?.['content-type'];
  return Array.isArray(value) ? value[0] : value;
}

function assertJsonContentType(request: Request | LegacyBodyRequest): void {
  const contentType = contentTypeOf(request)?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType && contentType !== 'application/json' && !contentType.endsWith('+json')) {
    throw new JsonBodyError(415, 'unsupported_media_type', 'Request body must use JSON content type');
  }
}

function assertWithinLimit(size: number, maxBytes: number): void {
  if (size > maxBytes) {
    throw new JsonBodyError(413, 'request_body_too_large', 'JSON request body is too large');
  }
}

async function readWebBody(request: Request, maxBytes: number): Promise<string> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength)) assertWithinLimit(contentLength, maxBytes);
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    assertWithinLimit(size, maxBytes);
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

async function readLegacyBody(request: LegacyBodyRequest, maxBytes: number): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let size = 0;
  let body = '';
  for await (const chunk of request) {
    const bytes = chunk instanceof Uint8Array ? chunk : encoder.encode(String(chunk));
    size += bytes.byteLength;
    assertWithinLimit(size, maxBytes);
    body += decoder.decode(bytes, { stream: true });
  }
  return body + decoder.decode();
}

export async function readJsonObjectRequest(
  request: Request | LegacyBodyRequest,
  options: { maxBytes?: number } = {}
): Promise<JsonObject> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('maxBytes must be a positive safe integer');
  }
  assertJsonContentType(request);
  const rawBody = request instanceof Request
    ? await readWebBody(request, maxBytes)
    : await readLegacyBody(request, maxBytes);
  try {
    return parseJsonObjectBody(rawBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'JSON request body must be an object') {
      throw new JsonBodyError(400, 'json_object_required', message);
    }
    throw new JsonBodyError(400, 'invalid_json_body', 'Invalid JSON request body');
  }
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
