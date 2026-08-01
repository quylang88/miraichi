export interface OpenFootballTeamAlias {
  sourceEntryId: string;
  sourceName: string;
  teamId: string;
  canonicalName: string;
}

const PREMIER_LEAGUE_ENTRY_ID = 'openfootball-england-premier-league-2026-27';
const WORLD_CUP_ENTRY_ID = 'openfootball-world-cup-2026-group-stage';

const premierLeagueAliases = [
  ['Arsenal FC', 'team-arsenal', 'Arsenal'],
  ['Coventry City FC', 'team-coventry-city', 'Coventry City'],
  ['Hull City AFC', 'team-hull-city', 'Hull City'],
  ['Manchester United FC', 'team-manchester-united', 'Manchester United'],
  ['Ipswich Town FC', 'team-ipswich-town', 'Ipswich Town'],
  ['Sunderland AFC', 'team-sunderland', 'Sunderland'],
  ['Nottingham Forest FC', 'team-nottingham-forest', 'Nottingham Forest'],
  ['Leeds United FC', 'team-leeds-united', 'Leeds United'],
  ['Everton FC', 'team-everton', 'Everton'],
  ['Crystal Palace FC', 'team-crystal-palace', 'Crystal Palace'],
  ['Brentford FC', 'team-brentford', 'Brentford'],
  ['Tottenham Hotspur FC', 'team-tottenham-hotspur', 'Tottenham Hotspur'],
  ['Manchester City FC', 'team-manchester-city', 'Manchester City'],
  ['AFC Bournemouth', 'team-afc-bournemouth', 'AFC Bournemouth'],
  ['Brighton & Hove Albion FC', 'team-brighton-hove-albion', 'Brighton & Hove Albion'],
  ['Aston Villa FC', 'team-aston-villa', 'Aston Villa'],
  ['Newcastle United FC', 'team-newcastle-united', 'Newcastle United'],
  ['Liverpool FC', 'team-liverpool', 'Liverpool'],
  ['Fulham FC', 'team-fulham', 'Fulham'],
  ['Chelsea FC', 'team-chelsea', 'Chelsea']
] as const;

const worldCupAliases = [
  ['Mexico', 'team-mexico', 'Mexico'], ['South Africa', 'team-south-africa', 'South Africa'],
  ['South Korea', 'team-south-korea', 'South Korea'], ['Czech Republic', 'team-czech-republic', 'Czech Republic'],
  ['Canada', 'team-canada', 'Canada'], ['Bosnia & Herzegovina', 'team-bosnia-herzegovina', 'Bosnia & Herzegovina'],
  ['Qatar', 'team-qatar', 'Qatar'], ['Switzerland', 'team-switzerland', 'Switzerland'],
  ['Brazil', 'team-brazil', 'Brazil'], ['Morocco', 'team-morocco', 'Morocco'],
  ['Haiti', 'team-haiti', 'Haiti'], ['Scotland', 'team-scotland', 'Scotland'],
  ['USA', 'team-usa', 'USA'], ['Paraguay', 'team-paraguay', 'Paraguay'],
  ['Australia', 'team-australia', 'Australia'], ['Turkey', 'team-turkey', 'Turkey'],
  ['Germany', 'team-germany', 'Germany'], ['Curaçao', 'team-curacao', 'Curaçao'],
  ['Ivory Coast', 'team-ivory-coast', 'Ivory Coast'], ['Ecuador', 'team-ecuador', 'Ecuador'],
  ['Netherlands', 'team-netherlands', 'Netherlands'], ['Japan', 'team-japan', 'Japan'],
  ['Sweden', 'team-sweden', 'Sweden'], ['Tunisia', 'team-tunisia', 'Tunisia'],
  ['Belgium', 'team-belgium', 'Belgium'], ['Egypt', 'team-egypt', 'Egypt'],
  ['Iran', 'team-iran', 'Iran'], ['New Zealand', 'team-new-zealand', 'New Zealand'],
  ['Spain', 'team-spain', 'Spain'], ['Cape Verde', 'team-cape-verde', 'Cape Verde'],
  ['Saudi Arabia', 'team-saudi-arabia', 'Saudi Arabia'], ['Uruguay', 'team-uruguay', 'Uruguay'],
  ['France', 'team-france', 'France'], ['Senegal', 'team-senegal', 'Senegal'],
  ['Iraq', 'team-iraq', 'Iraq'], ['Norway', 'team-norway', 'Norway'],
  ['Argentina', 'team-argentina', 'Argentina'], ['Algeria', 'team-algeria', 'Algeria'],
  ['Austria', 'team-austria', 'Austria'], ['Jordan', 'team-jordan', 'Jordan'],
  ['Portugal', 'team-portugal', 'Portugal'], ['DR Congo', 'team-dr-congo', 'DR Congo'],
  ['Uzbekistan', 'team-uzbekistan', 'Uzbekistan'], ['Colombia', 'team-colombia', 'Colombia'],
  ['England', 'team-england', 'England'], ['Croatia', 'team-croatia', 'Croatia'],
  ['Ghana', 'team-ghana', 'Ghana'], ['Panama', 'team-panama', 'Panama']
] as const;

export const OPENFOOTBALL_TEAM_ALIASES: readonly OpenFootballTeamAlias[] = Object.freeze([
  ...premierLeagueAliases.map(([sourceName, teamId, canonicalName]) => ({
    sourceEntryId: PREMIER_LEAGUE_ENTRY_ID,
    sourceName,
    teamId,
    canonicalName
  })),
  ...worldCupAliases.map(([sourceName, teamId, canonicalName]) => ({
    sourceEntryId: WORLD_CUP_ENTRY_ID,
    sourceName,
    teamId,
    canonicalName
  }))
]);

function normalizeLookupName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export function resolveOpenFootballTeamAlias(
  entryId: string,
  sourceName: string
): Pick<OpenFootballTeamAlias, 'teamId' | 'canonicalName'> | undefined {
  const normalizedSourceName = normalizeLookupName(sourceName);
  const alias = OPENFOOTBALL_TEAM_ALIASES.find((candidate) =>
    candidate.sourceEntryId === entryId && normalizeLookupName(candidate.sourceName) === normalizedSourceName
  );

  return alias === undefined
    ? undefined
    : { teamId: alias.teamId, canonicalName: alias.canonicalName };
}
