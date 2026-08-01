export interface ParsedOpenFootballMatch {
  lineNumber: number;
  competitionHeader: string;
  round: string;
  localDate: string;
  localTime: string | null;
  timeWasInherited: boolean;
  explicitUtcOffsetMinutes: number | null;
  sourceHomeName: string;
  sourceAwayName: string;
  fullTimeScore: { home: number; away: number } | null;
  halfTimeScore: { home: number; away: number } | null;
  venue?: string;
}

export interface FootballTxtParseIssue {
  code:
    | 'missing_competition_header'
    | 'missing_round'
    | 'ambiguous_date'
    | 'missing_kickoff_time'
    | 'impossible_score'
    | 'unrecognized_line';
  lineNumber: number;
  line: string;
  fatal: boolean;
}

export interface FootballTxtParseResult {
  competitionHeader: string | null;
  matches: ParsedOpenFootballMatch[];
  issues: FootballTxtParseIssue[];
}

type Score = { home: number; away: number };

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
};

function headerYear(header: string): number | null {
  const years = header.match(/\b\d{4}\b/g) ?? [];
  return years.length === 1 ? Number(years[0]) : null;
}

function dateFromLine(line: string, fallbackYear: number | null): string | 'ambiguous' | null {
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(line)) {
    return 'ambiguous';
  }

  const match = line.match(/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.?\s+)?([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (match === null) {
    return null;
  }

  const month = MONTHS[match[1]!.toLowerCase()];
  const day = Number(match[2]);
  const year = match[3] === undefined ? fallbackYear : Number(match[3]);
  if (month === undefined || year === null || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
    return 'ambiguous';
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parenthesisBalance(value: string): number {
  let balance = 0;
  for (const character of value) {
    if (character === '(') {
      balance += 1;
    } else if (character === ')') {
      balance -= 1;
    }
  }
  return balance;
}

function parseScore(value: string): Score | null {
  const match = value.match(/^(-?\d+)-(-?\d+)$/);
  if (match === null) {
    return null;
  }
  const score = { home: Number(match[1]), away: Number(match[2]) };
  return score.home < 0 || score.away < 0 ? null : score;
}

function matchContent(content: string): boolean {
  return /(?:^|\s)-?\d+-\d+(?:\s|$)/.test(content) || /\s(?:v|-)\s/.test(content);
}

function offsetMinutes(sign: string, hours: string, minutes: string | undefined): number | null {
  const hourValue = Number(hours);
  const minuteValue = minutes === undefined ? 0 : Number(minutes);
  if (hourValue > 23 || minuteValue > 59) {
    return null;
  }
  const value = hourValue * 60 + minuteValue;
  return sign === '-' ? -value : value;
}

export function parseFootballTxt(text: string): FootballTxtParseResult {
  const matches: ParsedOpenFootballMatch[] = [];
  const issues: FootballTxtParseIssue[] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let competitionHeader: string | null = null;
  let competitionYear: number | null = null;
  let round: string | null = null;
  let localDate: string | null = null;
  let dateYear: number | null = null;
  let lastTime: string | null = null;
  let headerIssueAdded = false;
  let roundIssueAdded = false;
  let previousWasCompleted = false;
  let openScoringDetail: { lineNumber: number; line: string; balance: number } | null = null;

  const addIssue = (issue: FootballTxtParseIssue): void => {
    issues.push(issue);
  };
  const addHeaderIssue = (lineNumber: number, line: string): void => {
    if (!headerIssueAdded) {
      headerIssueAdded = true;
      addIssue({ code: 'missing_competition_header', lineNumber, line, fatal: true });
    }
  };
  const addRoundIssue = (lineNumber: number, line: string): void => {
    if (!roundIssueAdded) {
      roundIssueAdded = true;
      addIssue({ code: 'missing_round', lineNumber, line, fatal: true });
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (openScoringDetail !== null) {
      if (!/^\s+/.test(line)) {
        addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
        openScoringDetail = null;
        previousWasCompleted = false;
        continue;
      }
      openScoringDetail.balance += parenthesisBalance(trimmed);
      if (openScoringDetail.balance < 0) {
        addIssue({ code: 'unrecognized_line', lineNumber: openScoringDetail.lineNumber, line: openScoringDetail.line, fatal: true });
        openScoringDetail = null;
      } else if (openScoringDetail.balance === 0) {
        openScoringDetail = null;
      }
      previousWasCompleted = false;
      continue;
    }

    if (trimmed === '') {
      previousWasCompleted = false;
      continue;
    }
    if (/^#/.test(trimmed) || /^Group\s+[^|]+\|/.test(trimmed)) {
      previousWasCompleted = false;
      continue;
    }

    const header = trimmed.match(/^=\s+(.+)$/);
    if (header !== null) {
      if (competitionHeader !== null) {
        addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
      } else {
        competitionHeader = header[1]!.trim();
        competitionYear = headerYear(competitionHeader);
        if (competitionYear === null) {
          addHeaderIssue(lineNumber, line);
        }
      }
      previousWasCompleted = false;
      continue;
    }

    const roundHeader = trimmed.match(/^▪\s+(.+)$/);
    if (roundHeader !== null) {
      round = roundHeader[1]!.trim();
      previousWasCompleted = false;
      continue;
    }

    const parsedDate = dateFromLine(trimmed, dateYear ?? competitionYear);
    if (parsedDate === 'ambiguous') {
      addIssue({ code: 'ambiguous_date', lineNumber, line, fatal: true });
      localDate = null;
      lastTime = null;
      previousWasCompleted = false;
      continue;
    }
    if (parsedDate !== null) {
      localDate = parsedDate;
      dateYear = Number(parsedDate.slice(0, 4));
      lastTime = null;
      previousWasCompleted = false;
      continue;
    }

    if (previousWasCompleted && /^\s+/.test(line) && trimmed.startsWith('(')) {
      const balance = parenthesisBalance(trimmed);
      if (balance < 0) {
        addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
      } else if (balance > 0) {
        openScoringDetail = { lineNumber, line, balance };
      }
      previousWasCompleted = false;
      continue;
    }

    const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})(?:\s+UTC([+-])(\d{1,2})(?::?(\d{2}))?)?\s+(.+)$/i);
    const content = timeMatch === null ? trimmed : timeMatch[5]!;
    if (!matchContent(content)) {
      addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
      previousWasCompleted = false;
      continue;
    }

    if (competitionHeader === null || competitionYear === null) {
      addHeaderIssue(lineNumber, line);
      previousWasCompleted = false;
      continue;
    }
    if (round === null) {
      addRoundIssue(lineNumber, line);
      previousWasCompleted = false;
      continue;
    }
    if (localDate === null) {
      addIssue({ code: 'ambiguous_date', lineNumber, line, fatal: true });
      previousWasCompleted = false;
      continue;
    }

    const explicitTime = timeMatch?.[1] ?? null;
    const localTime = explicitTime ?? lastTime;
    if (localTime === null) {
      addIssue({ code: 'missing_kickoff_time', lineNumber, line, fatal: false });
      previousWasCompleted = false;
      continue;
    }
    if (explicitTime !== null) {
      const [hour, minute] = explicitTime.split(':').map(Number);
      if (hour! > 23 || minute! > 59) {
        addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
        previousWasCompleted = false;
        continue;
      }
      lastTime = explicitTime;
    }

    let explicitUtcOffsetMinutes: number | null = null;
    if (timeMatch?.[2] !== undefined) {
      explicitUtcOffsetMinutes = offsetMinutes(timeMatch[2], timeMatch[3]!, timeMatch[4]);
      if (explicitUtcOffsetMinutes === null) {
        addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
        previousWasCompleted = false;
        continue;
      }
    }

    const venueIndex = content.search(/\s@\s/);
    const matchText = venueIndex === -1 ? content : content.slice(0, venueIndex).trim();
    const venue = venueIndex === -1 ? undefined : content.slice(venueIndex + 3).trim();
    if (venue !== undefined && venue === '') {
      addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
      previousWasCompleted = false;
      continue;
    }

    const tokens = matchText.split(/\s+/);
    const scoreIndexes = tokens.flatMap((token, tokenIndex) => /^-?\d+-\d+$/.test(token) ? [tokenIndex] : []);
    let sourceHomeName: string;
    let sourceAwayName: string;
    let fullTimeScore: Score | null = null;
    let halfTimeScore: Score | null = null;

    if (scoreIndexes.length > 0) {
      if (scoreIndexes.length !== 1) {
        addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
        previousWasCompleted = false;
        continue;
      }
      const scoreIndex = scoreIndexes[0]!;
      const score = parseScore(tokens[scoreIndex]!);
      if (score === null) {
        addIssue({ code: 'impossible_score', lineNumber, line, fatal: true });
        previousWasCompleted = false;
        continue;
      }
      let awayStart = scoreIndex + 1;
      const halfTimeToken = tokens[awayStart];
      if (halfTimeToken !== undefined && halfTimeToken.startsWith('(')) {
        const parsedHalfTime = halfTimeToken.match(/^\((-?\d+)-(-?\d+)\)$/);
        if (parsedHalfTime === null || Number(parsedHalfTime[1]) < 0 || Number(parsedHalfTime[2]) < 0) {
          addIssue({ code: 'impossible_score', lineNumber, line, fatal: true });
          previousWasCompleted = false;
          continue;
        }
        halfTimeScore = { home: Number(parsedHalfTime[1]), away: Number(parsedHalfTime[2]) };
        awayStart += 1;
      }
      if (awayStart === tokens.length) {
        const scheduledPart = tokens.slice(0, scoreIndex).join(' ');
        const separators = [...scheduledPart.matchAll(/\s(?:v|-)\s/g)];
        if (separators.length !== 1) {
          addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
          previousWasCompleted = false;
          continue;
        }
        const separator = separators[0]!;
        sourceHomeName = scheduledPart.slice(0, separator.index).trim();
        sourceAwayName = scheduledPart.slice(separator.index! + separator[0].length).trim();
      } else {
        sourceHomeName = tokens.slice(0, scoreIndex).join(' ');
        sourceAwayName = tokens.slice(awayStart).join(' ');
      }
      fullTimeScore = score;
    } else {
      const separators = [...matchText.matchAll(/\s(?:v|-)\s/g)];
      if (separators.length !== 1) {
        addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
        previousWasCompleted = false;
        continue;
      }
      const separator = separators[0]!;
      sourceHomeName = matchText.slice(0, separator.index).trim();
      sourceAwayName = matchText.slice(separator.index! + separator[0].length).trim();
    }

    if (sourceHomeName === '' || sourceAwayName === '') {
      addIssue({ code: 'unrecognized_line', lineNumber, line, fatal: true });
      previousWasCompleted = false;
      continue;
    }

    matches.push({
      lineNumber,
      competitionHeader,
      round,
      localDate,
      localTime,
      timeWasInherited: explicitTime === null,
      explicitUtcOffsetMinutes,
      sourceHomeName,
      sourceAwayName,
      fullTimeScore,
      halfTimeScore,
      ...(venue === undefined ? {} : { venue })
    });
    previousWasCompleted = fullTimeScore !== null;
  }

  if (openScoringDetail !== null) {
    addIssue({
      code: 'unrecognized_line',
      lineNumber: openScoringDetail.lineNumber,
      line: openScoringDetail.line,
      fatal: true
    });
  }
  if (competitionHeader === null) {
    addHeaderIssue(1, lines[0] ?? '');
  }

  return { competitionHeader, matches, issues };
}
