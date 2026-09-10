import type { Page, Request, Route } from 'playwright';
import { gate } from '../../scripts/staging-hosted-config.js';
import { validateLocalMatchDetail, validateLocalMatchFeedResponse, type LocalMatch, type LocalMatchDetail } from '../../packages/shared/src/index.js';

const detailPath='/api/v1/matches/detail';
const isDetail=(url:string)=>new URL(url).pathname.startsWith(detailPath);
const json=(route:Route,body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});

async function openMatch(page:Page,match:LocalMatch):Promise<void> {
  await page.locator('[data-primary-tab="matches"]').click();
  const live=page.locator('[data-live-toggle]');
  if(await live.getAttribute('aria-pressed')==='true') await live.click();
  await page.locator('#match-search').fill('');
  const type=page.locator('input[name="filter-type"][value="all"]');
  if(!await type.isVisible()) await page.locator('#filter-panel-toggle-btn').click();
  await type.check();
  const date=match.kickoffUtc.slice(0,10); // The caller creates the browser context in UTC.
  await page.locator('#date-picker-btn').click();
  for(let attempt=0;attempt<24;attempt++) {
    if(await page.locator(`[data-matches-cal-date="${date}"]`).count()) break;
    const visible=await page.locator('[data-matches-cal-date]').first().getAttribute('data-matches-cal-date');
    gate(visible,'calendar month available');
    await page.locator(`[data-matches-cal-nav="${visible<date?'next':'prev'}"]`).click();
  }
  await page.locator(`[data-matches-cal-date="${date}"]`).click();
  await page.locator(`[data-open-match][data-match-id="${match.id}"]`).click();
  await page.locator('#screen-match-detail.active').waitFor();
  gate(await page.locator('[data-detail-tab="bets"]').getAttribute('class')==='active','match opens Bets first');
}

async function explicitRefresh(page:Page,id:string,selector='[data-detail-tab="info"]'):Promise<LocalMatchDetail> {
  const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`${detailPath}/refresh`
    && new URL(r.url()).searchParams.get('id')===id && r.request().method()==='POST')
    .catch(()=>{throw new Error('Hosted gate failed: explicit selected POST refresh missing');}),page.locator(selector).click()]);
  gate(response.status()===200 && response.headers()['cache-control']?.includes('no-store'),'detail refresh 200/no-store');
  const detail:unknown=await response.json();
  gate(validateLocalMatchDetail(detail).ok,'valid hosted detail contract');
  const value=detail as LocalMatchDetail;
  gate(value.match.id===id,'selected canonical detail ID');
  await page.locator('[data-detail-refresh][aria-busy="false"]').waitFor();
  return value;
}

/** UI faults are explicit browser fixtures, never evidence of provider availability. */
export async function runDetailInteractionFixtures(page:Page,completed:LocalMatchDetail,upcoming:LocalMatchDetail):Promise<void> {
  const calls:string[]=[];
  const track=(request:Request)=>{if(isDetail(request.url())) calls.push(`${request.method()} ${new URL(request.url()).search}`);};
  page.on('request',track);
  let release:(()=>void)|undefined;
  try {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await openMatch(page,completed.match);
    await page.route('**/api/v1/matches/detail/refresh?*',route=>json(route,completed));
    await page.locator('[data-detail-tab="info"]').click();
    await page.locator('[data-detail-refresh][aria-busy="false"]').waitFor();
    await page.unroute('**/api/v1/matches/detail/refresh?*');
    await page.route('**/api/v1/matches/detail/refresh?*',route=>json(route,{error:{code:'detail_unavailable'}},503));
    await page.locator('[data-match-detail-retry]').click();
    await page.locator('[data-detail-refresh="unavailable"][aria-busy="false"]').waitFor();
    gate(await page.locator('[data-detail-shot]').count()>0,'failed refresh keeps last-good shots');
    const failedCalls=calls.length;
    await page.clock.fastForward(180_000);
    await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(100);
    gate(calls.length===failedCalls,'idle/focus never auto-refresh detail');
    await page.unroute('**/api/v1/matches/detail/refresh?*');

    const held=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/v1/matches/detail/refresh?*',async route=>{
      if(new URL(route.request().url()).searchParams.get('id')===completed.match.id) {
        await held;await json(route,completed).catch(()=>{}); // Aborted A is expected after leaving.
      } else await json(route,upcoming);
    });
    await Promise.all([page.waitForRequest(request=>request.method()==='POST'
      && new URL(request.url()).pathname===`${detailPath}/refresh`
      && new URL(request.url()).searchParams.get('id')===completed.match.id),page.locator('[data-match-detail-retry]').click()]);
    await openMatch(page,upcoming.match);
    await page.locator('[data-detail-tab="info"]').click();
    await page.locator('[data-detail-refresh][aria-busy="false"]').waitFor().catch(async()=>{
      console.log(JSON.stringify({gate:'detail-race-diagnostic',calls,state:await page.locator('[data-match-detail-state]').getAttribute('data-match-detail-state')}));
      throw new Error('Hosted gate failed: B ready after switching from pending A');
    });
    release?.();
    await page.waitForTimeout(100);
    gate((await page.locator('.match-detail-scoreline').textContent())?.includes(upcoming.match.homeTeam.name),'late A cannot overwrite B');
    gate((await page.locator('.match-detail-scoreline').textContent())?.includes(upcoming.match.awayTeam.name),'B away team retained after late A');
    await page.unroute('**/api/v1/matches/detail/refresh?*');

    await page.route('**/api/v1/matches/detail**',route=>json(route,{status:'pending',match:upcoming.match,retryAfterSeconds:1},202));
    await page.reload({waitUntil:'domcontentloaded'}); // Cold in-memory detail cache for the legacy 202 regression.
    await openMatch(page,upcoming.match);
    await page.locator('[data-detail-tab="info"]').click();
    await page.locator('[data-match-detail-state="pending"]').waitFor();
    const pendingCalls=calls.length;
    await page.clock.fastForward(180_000);await page.waitForTimeout(100);
    gate(calls.length===pendingCalls,'202 pending has no retry timer');
    gate(await page.locator('[data-match-detail-retry]').isVisible(),'202 has explicit retry');
    console.log(JSON.stringify({gate:'detail-browser-fixtures',status:'passed',lastGood:true,race:true,pendingManual:true}));
  } finally {
    release?.();
    await page.unroute('**/api/v1/matches/detail/refresh?*');
    await page.unroute('**/api/v1/matches/detail**');
    page.off('request',track);
    await page.clock.resume();
  }
}

export async function runStagingMatchDetail(page:Page):Promise<void> {
  const request=page.context().request;
  const feed=async(date:string)=>{
    const result=await request.get(`/api/v1/matches?date=${date}&timezone=UTC`);
    gate(result.status()===200,'detail target feed');const body:unknown=await result.json();
    gate(validateLocalMatchFeedResponse(body).ok,'detail target feed contract');
    return (body as {matches:LocalMatch[]}).matches;
  };
  // Accepted current-season completed sample, canonical ID only; no provider locator in browser code.
  const completed=(await feed('2026-08-30')).find(match=>match.id==='match-4f584556baff0c726aa49c86');
  gate(completed?.status==='completed','known completed current-season target');
  let upcoming:LocalMatch|undefined;
  for(let offset=2;offset<=7 && !upcoming;offset++) {
    const date=new Date(Date.now()+offset*86_400_000).toISOString().slice(0,10);
    upcoming=(await feed(date)).find(match=>match.status==='scheduled' && match.sourceRefs.some(ref=>ref.sourceId==='fotmob-unofficial'));
  }
  gate(upcoming,'upcoming current-season target in bounded seven-day window');
  const calls:{method:string;id:string|null}[]=[];
  const track=(r:Request)=>{if(isDetail(r.url())) calls.push({method:r.method(),id:new URL(r.url()).searchParams.get('id')});};
  page.on('request',track);
  let rich:LocalMatchDetail;let future:LocalMatchDetail;
  try {
    await openMatch(page,completed);
    gate(Number(calls.length)===0,'list/card/Bets do not request detail');
    rich=await explicitRefresh(page,completed.id);
    gate(Number(calls.length)===2 && calls[0].method==='GET' && calls[1].method==='POST'
      && calls.every(call=>call.id===completed.id),'one cached GET and one explicit selected POST');
    gate(['refreshed','not_modified','cooldown'].includes(rich.refresh?.outcome??'') && rich.refresh?.lastSuccessAt,'completed refresh usable');
    gate(rich.enrichment && rich.enrichment.statistics.length>=2 && rich.enrichment.players.length>0
      && rich.enrichment.shots.length>0 && rich.events.length>0 && (rich.lineups?.length??0)>0,'real completed rich provider data');
    gate(await page.locator('[data-detail-period]').count()>=2 && await page.locator('[data-detail-player]').count()>0
      && await page.locator('[data-detail-shot]').count()>0,'real rich data rendered');
    gate(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'mobile detail no horizontal overflow');
    const cooldown=await explicitRefresh(page,completed.id,'[data-match-detail-retry]');
    gate(cooldown.refresh?.outcome==='cooldown' && cooldown.refresh.lastSuccessAt===rich.refresh?.lastSuccessAt,'manual cooldown retains last success');
    gate(Number(calls.length)===3,'manual retry makes exactly one POST');
    await page.locator('[data-detail-tab="bets"]').click();
    await page.locator('[data-primary-tab="today"]').click();
    await openMatch(page,upcoming);
    gate(Number(calls.length)===3,'leaving/changing match to Bets makes no detail request');
    future=await explicitRefresh(page,upcoming.id);
    gate(Number(calls.length)===5 && calls.slice(3).every(call=>call.id===upcoming!.id),'upcoming only selected GET/POST');
    gate(['refreshed','not_modified','cooldown'].includes(future.refresh?.outcome??'') && future.refresh?.lastSuccessAt
      && future.enrichment?.observedStatus==='scheduled','real upcoming detail refresh');
    console.log(JSON.stringify({gate:'hosted-match-detail',status:'passed',completedId:completed.id,upcomingId:upcoming.id,
      periods:rich.enrichment.statistics.length,players:rich.enrichment.players.length,shots:rich.enrichment.shots.length,
      completedOutcome:rich.refresh?.outcome,upcomingOutcome:future.refresh?.outcome}));
  } finally {page.off('request',track);}
  await runDetailInteractionFixtures(page,rich,future);
}
