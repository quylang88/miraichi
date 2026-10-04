export type SportScoreJsonObject = Record<string, unknown>;

export interface SportScoreFixturesResponse extends SportScoreJsonObject {
  matches: SportScoreJsonObject[];
}

export type SportScoreMatchResponse = SportScoreJsonObject;

export class SportScoreResponseContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SportScoreResponseContractError';
  }
}

function isObject(value: unknown): value is SportScoreJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSportScoreFixturesResponse(value: unknown): SportScoreFixturesResponse {
  if (!isObject(value)) {
    throw new SportScoreResponseContractError('SportScore fixtures response must be an object.');
  }

  if (!Array.isArray(value.matches) || value.matches.some((match) => !isObject(match))) {
    throw new SportScoreResponseContractError(
      'SportScore fixtures response must contain an array of match objects.'
    );
  }

  return value as SportScoreFixturesResponse;
}

export function parseSportScoreMatchResponse(value: unknown): SportScoreMatchResponse {
  if (!isObject(value)) {
    throw new SportScoreResponseContractError('SportScore match response must be an object.');
  }

  if ('match' in value && !isObject(value.match)) {
    throw new SportScoreResponseContractError(
      'SportScore match response field "match" must be an object when present.'
    );
  }

  return value;
}
