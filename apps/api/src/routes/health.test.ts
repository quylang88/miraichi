import { describe, expect, it } from 'vitest';
import { handleHealth } from './health.js';

function createMockResponse() {
  return {
    statusCode: undefined as number | undefined,
    headers: undefined as Record<string, string> | undefined,
    body: undefined as string | undefined,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

describe('api health route', () => {
  it('returns an ok health payload', () => {
    const response = createMockResponse();

    handleHealth({}, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(response.body || '{}')).toMatchObject({
      status: 'ok',
      service: 'api-mediation-gateway'
    });
  });
});
