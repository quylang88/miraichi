import { Temporal } from '@js-temporal/polyfill';

export interface OpenFootballKickoffInput {
  localDate: string;
  localTime: string | null;
  explicitUtcOffsetMinutes: number | null;
}

function localParts(match: OpenFootballKickoffInput): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  if (match.localTime === null) {
    throw new RangeError('OpenFootball match is missing a local kickoff time');
  }
  const date = match.localDate.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  const time = match.localTime.match(/^(\d{2}):(\d{2})$/u);
  if (date === null || time === null) {
    throw new RangeError('OpenFootball match has an invalid local date or time');
  }

  const parts = {
    year: Number(date[1]),
    month: Number(date[2]),
    day: Number(date[3]),
    hour: Number(time[1]),
    minute: Number(time[2])
  };
  Temporal.PlainDateTime.from(parts, { overflow: 'reject' });
  return parts;
}

export function toOpenFootballKickoffUtc(
  match: OpenFootballKickoffInput,
  sourceTimezone: string
): string {
  const parts = localParts(match);

  if (match.explicitUtcOffsetMinutes !== null) {
    const utcMilliseconds = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    ) - match.explicitUtcOffsetMinutes * 60_000;
    return new Date(utcMilliseconds).toISOString().replace('.000Z', 'Z');
  }

  return Temporal.ZonedDateTime.from({ ...parts, timeZone: sourceTimezone }, {
    disambiguation: 'reject'
  }).toInstant().toString();
}
