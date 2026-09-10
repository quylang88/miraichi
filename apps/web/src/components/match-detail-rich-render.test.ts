import { describe, expect, it } from 'vitest';
import { DETAIL_STATISTIC_KEYS } from '@miraichi/shared';
import { renderMatchDetailView } from './match-detail-view.js';
import { createTranslator, getCatalogKeys } from '../services/i18n-service.js';
import { detailCanonicalFixture, fotmobDetailFixture } from '../../../../tests/fixtures/fotmob-detail.js';
import { adaptFotMobDetail } from '../../../worker/src/sources/fotmob/fotmob-detail-adapter.js';
const detail=adaptFotMobDetail({match:detailCanonicalFixture,payload:fotmobDetailFixture,providerMatchId:'100',leagueId:47,observedAt:detailCanonicalFixture.updatedAt});
describe('rich factual match detail UI',()=>{
  it('keeps known coaches visible when confirmed player lineups are absent',()=>{
    const html=renderMatchDetailView({status:'ready',detail:{...detail,lineups:[]}},createTranslator('en'),'en','UTC');
    expect(html).toContain('Coach H'); expect(html).not.toContain('Confirmed lineups');
  });
  it('renders shot accuracy fractions without labelling their numerator as a percentage',()=>{
    const fractions={...detail,enrichment:{...detail.enrichment!,statistics:[{period:'all' as const,rows:[
      {key:'shotAccuracy' as const,home:{value:3,total:4},away:{value:0,total:1}},
      {key:'possession' as const,home:{value:55},away:{value:45}}
    ]}]}};
    const html=renderMatchDetailView({status:'ready',detail:fractions},createTranslator('en'),'en','UTC');
    expect(html).toContain('<td>3/4</td>'); expect(html).toContain('<td>0/1</td>');
    expect(html).toContain('<td>55%</td>'); expect(html).not.toContain('3%/4');
  });
  it('does not show a prematch score separator when the observed match is live with an incomplete score',()=>{
    const partial={...detail,match:{...detail.match,status:'scheduled' as const},
      enrichment:{...detail.enrichment!,observedStatus:'live' as const,score:{home:0,away:null}}};
    const html=renderMatchDetailView({status:'ready',detail:partial},createTranslator('en'),'en','UTC');
    expect(html).not.toContain('<strong>vs</strong>'); expect(html).toContain('<strong>–</strong>');
  });
  it('does not claim saved detail exists when the first refresh failed',()=>{
    const {enrichment:_enrichment,...basic}=detail;
    const firstFailure={...basic,refresh:{outcome:'unavailable' as const,lastSuccessAt:null,retryAfterSeconds:60}};
    const html=renderMatchDetailView({status:'ready',detail:firstFailure},createTranslator('en'),'en','UTC');
    expect(html).not.toContain('Saved detail remains visible');
    expect(html).toContain('Detail could not be loaded. Try again manually.');
  });
  it('renders period statistics, player details, coaches, attendance and an accessible factual shot map',()=>{
    const html=renderMatchDetailView({status:'ready',detail},createTranslator('vi'),'vi','UTC');
    expect(html).toContain('data-detail-period="all"'); expect(html).toContain('data-detail-period="firstHalf"');
    expect(html).toContain('502 (89%)'); expect(html).toContain('data-detail-player');
    expect(html).toContain('Coach H'); expect(html).toContain('29.000'); expect(html).toContain('Đội hình xác nhận');
    expect(html).toContain('data-detail-shot'); expect(html).toContain('role="img"'); expect(html).toContain('Bản đồ cú sút');
    expect(html).not.toMatch(/expectedGoals|xG|rating|sourceMatchId|sourceUrl/);
  });
  it('shows observed live score/status without replacing the canonical feed or inventing a confirmed lineup',()=>{
    const upcoming={...detail,match:{...detail.match,status:'scheduled' as const,score:{home:null,away:null}},status:'scheduled' as const,
      enrichment:{...detail.enrichment!,observedStatus:'live' as const,score:{home:3,away:1}},lineups:[],elapsedMinute:67};
    const html=renderMatchDetailView({status:'ready',detail:upcoming},createTranslator('en'),'en','UTC');
    expect(html).toContain('3 – 1'); expect(html).toContain('Live'); expect(html).toContain('67&#39;');
    expect(html).not.toContain('Confirmed lineups'); expect(upcoming.match.status).toBe('scheduled');
  });
  it('keeps last-good content visible with explicit refresh/error/cooldown state and a manual button',()=>{
    const cached={...detail,refresh:{outcome:'cooldown' as const,lastSuccessAt:detail.updatedAt,retryAfterSeconds:60}};
    const html=renderMatchDetailView({status:'ready',detail:cached,refreshError:true},createTranslator('vi'),'vi','UTC');
    expect(html).toContain('data-match-detail-retry'); expect(html).toContain('data-detail-refresh="unavailable"');
    expect(html).toContain('Test Ground'); expect(html).toContain('Dữ liệu đã lưu');
    const refreshing=renderMatchDetailView({status:'ready',detail:cached,refreshing:true},createTranslator('en'),'en','UTC');
    expect(refreshing).toContain('aria-busy="true"'); expect(refreshing).toContain('disabled');
    const pending=renderMatchDetailView({status:'pending',match:detail.match,retryAfterSeconds:150},createTranslator('en'),'en','UTC');
    expect(pending).toContain('data-match-detail-retry');
  });
  it('escapes labels and excludes physical values whose measurement unit is unverified',()=>{
    const injected={...detail,enrichment:{...detail.enrichment!,players:[{...detail.enrichment!.players[0],name:'<img src=x onerror=alert(1)>',
      metrics:[{key:'distanceCovered' as const,value:{value:12345}}]}]}};
    const html=renderMatchDetailView({status:'ready',detail:injected},createTranslator('en'),'en','UTC');
    expect(html).not.toContain('<img src=x'); expect(html).toContain('&lt;img'); expect(html).not.toContain('12345');
  });
  it('has EN/VI labels for every allowlisted statistic',()=>{
    for(const locale of ['en','vi'] as const) {
      const keys=getCatalogKeys(locale);
      for(const key of DETAIL_STATISTIC_KEYS) expect(keys.includes(`detail.metric.${key}`)).toBe(true);
    }
  });
});
