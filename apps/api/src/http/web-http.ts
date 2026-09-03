export interface WebResponseOptions {
  status?: number;
  headers?: HeadersInit;
  cookies?: readonly string[];
}

function createResponseHeaders(options: WebResponseOptions): Headers {
  const headers = new Headers(options.headers);
  for (const cookie of options.cookies ?? []) headers.append('Set-Cookie', cookie);
  return headers;
}

export function jsonResponse(payload: unknown, options: WebResponseOptions = {}): Response {
  const headers = createResponseHeaders(options);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers
  });
}

export function emptyResponse(status = 204, headers?: HeadersInit): Response {
  return new Response(null, { status, headers });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  options: Omit<WebResponseOptions, 'status'> = {}
): Response {
  return jsonResponse({ error: { code, message } }, { ...options, status });
}
