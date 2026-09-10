import type { DetailMetric, DetailShot, DetailStatisticKey, LocalMatchDetail } from '@miraichi/shared';
import type { SupportedLocale, TranslateFunction } from '../services/i18n-service.js';
import { escapeHtml } from './html.js';

// Raw provider units for these fields have not been established by the accepted probes.
const unverifiedUnits=new Set<DetailStatisticKey>(['distanceCovered','sprintDistance','topSpeed','runningDistance','walkingDistance']);
const numeric=(value:number,locale:SupportedLocale)=>escapeHtml(value.toLocaleString(locale,{maximumFractionDigits:2}));
function metric(value:DetailMetric,key:DetailStatisticKey,locale:SupportedLocale,t:TranslateFunction):string {
  if(value.value===null) return escapeHtml(t('detail.noData'));
  return numeric(value.value,locale)+(value.total===undefined && (key==='possession'||key==='shotAccuracy')?'%':'')
    +(value.total!==undefined?`/${numeric(value.total,locale)}`:'')+(value.percentage!==undefined?` (${numeric(value.percentage,locale)}%)`:'');
}
export function renderRichStatistics(detail:LocalMatchDetail,t:TranslateFunction,locale:SupportedLocale):string {
  return `<section class="match-detail-section match-detail-stats"><h2>${escapeHtml(t('detail.stats'))}</h2>${detail.enrichment!.statistics.map(group=>`
    <details class="detail-period" data-detail-period="${escapeHtml(group.period)}"${group.period==='all'?' open':''}>
      <summary>${escapeHtml(t(`detail.period.${group.period}`))}</summary>
      <div class="match-detail-table-scroll"><table><thead><tr><th scope="col">${escapeHtml(t('detail.stats'))}</th>
        <th scope="col">${escapeHtml(detail.match.homeTeam.name)}</th><th scope="col">${escapeHtml(detail.match.awayTeam.name)}</th></tr></thead>
        <tbody>${group.rows.filter(row=>!unverifiedUnits.has(row.key)).map(row=>`<tr><th scope="row">${escapeHtml(t(`detail.metric.${row.key}`))}</th>
          <td>${metric(row.home,row.key,locale,t)}</td><td>${metric(row.away,row.key,locale,t)}</td></tr>`).join('')}</tbody></table></div>
    </details>`).join('')}</section>`;
}
export function renderEnrichmentMetadata(detail:LocalMatchDetail,t:TranslateFunction,locale:SupportedLocale):string {
  const enrichment=detail.enrichment;if(!enrichment) return '';
  const row=(key:string,value:string)=>`<div><dt>${escapeHtml(t(key))}</dt><dd>${value}</dd></div>`;
  const venue=enrichment.venue;const location=[venue?.city,venue?.country].filter(Boolean).join(', ');
  return (location?row('detail.location',escapeHtml(location)):'')
    +(venue?.capacity!==null && venue?.capacity!==undefined?row('detail.capacity',numeric(venue.capacity,locale)):'')
    +(venue?.surface?row('detail.surface',escapeHtml(venue.surface)):'')
    +(enrichment.attendance!==undefined?row('detail.attendance',numeric(enrichment.attendance,locale)):'');
}
export function renderDetailCoaches(detail:LocalMatchDetail,t:TranslateFunction):string {
  return (detail.enrichment?.coaches??[]).map(coach=>{
    const team=coach.teamId===detail.match.homeTeam.id?detail.match.homeTeam:detail.match.awayTeam;
    return `<p class="detail-coach">${escapeHtml(team.name)} · ${escapeHtml(t('detail.coach'))}: <strong>${escapeHtml(coach.name)}</strong></p>`;
  }).join('');
}
function shotLabel(shot:DetailShot,t:TranslateFunction):string {
  const minute=shot.minute===null?t('detail.noData'):`${shot.minute}${shot.extraMinute?`+${shot.extraMinute}`:''}′`;
  return `${minute} · ${shot.player??t('detail.noData')} · ${t(`detail.shot.${shot.result}`)} · ${t(`detail.bodyPart.${shot.bodyPart}`)}${shot.ownGoal?` · ${t('detail.event.ownGoal')}`:''}`;
}
export function renderDetailShots(detail:LocalMatchDetail,t:TranslateFunction):string {
  const shots=detail.enrichment?.shots;if(!shots) return '';
  const home=detail.match.homeTeam;const away=detail.match.awayTeam;
  if(!shots.length) return `<section class="match-detail-section"><h2>${escapeHtml(t('detail.shotMap'))}</h2><p class="detail-muted">${escapeHtml(t('detail.shotsUnavailable'))}</p></section>`;
  return `<section class="match-detail-section detail-shots"><h2>${escapeHtml(t('detail.shotMap'))}</h2>
    <p class="detail-shot-legend"><span class="shot-home">● ${escapeHtml(home.name)}</span><span class="shot-away">◆ ${escapeHtml(away.name)}</span></p>
    <svg class="detail-shot-map" viewBox="-2 -2 109 72" role="img" aria-label="${escapeHtml(t('detail.shotMap'))}">
      <rect x="0.5" y="0.5" width="104" height="67" rx="1" fill="#10281e" stroke="#668775" stroke-width="0.4"/>
      <path d="M52.5 0.5V67.5M.5 13.84H16.5V54.16H.5M104.5 13.84H88.5V54.16H104.5M.5 24.84H5.5V43.16H.5M104.5 24.84H99.5V43.16H104.5" fill="none" stroke="#668775" stroke-width="0.4"/>
      <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="#668775" stroke-width="0.4"/>
      ${shots.map(shot=>{
        const isHome=shot.teamId===home.id;const label=escapeHtml(`${isHome?home.name:away.name} · ${shotLabel(shot,t)}`);
        const attrs=`class="${isHome?'shot-home':'shot-away'}${shot.result==='goal'?' shot-goal':''}" data-detail-shot="${escapeHtml(shot.result)}"`;
        return isHome?`<circle ${attrs} cx="${escapeHtml(shot.x)}" cy="${escapeHtml(shot.y)}" r="1.3"><title>${label}</title></circle>`:
          `<rect ${attrs} x="${shot.x-1}" y="${shot.y-1}" width="2" height="2" transform="rotate(45 ${escapeHtml(shot.x)} ${escapeHtml(shot.y)})"><title>${label}</title></rect>`;
      }).join('')}
    </svg><p class="detail-muted">${escapeHtml(t('detail.shotLegend'))}</p>
    <details class="detail-period"><summary>${escapeHtml(t('detail.shotList'))} (${shots.length})</summary>
      <ol class="detail-shot-list">${shots.map(shot=>`<li><span>${escapeHtml(shot.teamId===home.id?home.name:away.name)}</span> ${escapeHtml(shotLabel(shot,t))}</li>`).join('')}</ol>
    </details></section>`;
}
export function renderDetailPlayers(detail:LocalMatchDetail,t:TranslateFunction,locale:SupportedLocale):string {
  if(!detail.enrichment?.players.length) return '';
  return `<section class="match-detail-section detail-players"><h2>${escapeHtml(t('detail.playerStats'))}</h2>${[detail.match.homeTeam,detail.match.awayTeam].map(team=>{
    const players=detail.enrichment!.players.filter(player=>player.teamId===team.id);
    if(!players.length) return '';
    return `<h3>${escapeHtml(team.name)}</h3>${players.map(player=>`<details class="detail-player" data-detail-player>
      <summary>${player.shirtNumber!==null?`<span class="match-lineup-number">${escapeHtml(player.shirtNumber)}</span> `:''}${escapeHtml(player.name)}</summary>
      <dl>${player.metrics.filter(row=>!unverifiedUnits.has(row.key)).map(row=>`<div><dt>${escapeHtml(t(`detail.metric.${row.key}`))}</dt><dd>${metric(row.value,row.key,locale,t)}</dd></div>`).join('')}</dl>
    </details>`).join('')}`;
  }).join('')}</section>`;
}
