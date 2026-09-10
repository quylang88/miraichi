import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { runDetailInteractionFixtures } from '../tests/e2e/staging-match-detail.js';
import { detailCanonicalFixture, fotmobDetailFixture } from '../tests/fixtures/fotmob-detail.js';
import { adaptFotMobDetail } from '../apps/worker/src/sources/fotmob/fotmob-detail-adapter.js';
import { toProviderNeutralLocalMatch, validateLocalMatchDetail, type LocalMatchDetail } from '../packages/shared/src/index.js';

const dist=path.resolve('apps/web/dist');
const now=new Date().toISOString();
const completed=adaptFotMobDetail({match:detailCanonicalFixture,payload:fotmobDetailFixture,providerMatchId:'100',leagueId:47,observedAt:now});
completed.match=toProviderNeutralLocalMatch(completed.match);
completed.refresh={outcome:'refreshed',lastSuccessAt:now,retryAfterSeconds:60};
const upcoming:LocalMatchDetail={match:{...completed.match,id:'match-upcoming-browser-fixture',
  competition:{id:'national-browser-fixture',name:'National fixture',type:'national-team',season:'2026'},
  homeTeam:{id:'team-future-home',name:'Future Home'},awayTeam:{id:'team-future-away',name:'Future Away'},
  kickoffUtc:new Date(Date.now()+2*86_400_000).toISOString(),status:'scheduled',score:{home:null,away:null}},
  status:'scheduled',elapsedMinute:null,events:[],updatedAt:now,refresh:completed.refresh,
  enrichment:{observedStatus:'scheduled',score:{home:null,away:null},statistics:[],players:[],shots:[],coaches:[]}};
const matches=[completed.match,upcoming.match];
for(const value of [completed,upcoming]) {const validation=validateLocalMatchDetail(value);if(!validation.ok) throw new Error(validation.errors.join(';'));}
const snapshot={snapshotId:'browser-fixture',generatedAt:now,importedAt:now,matchCount:2,competitions:[],sources:[],freshness:'fresh',warnings:[]};
const server=createServer((req,res)=>{
  const url=new URL(req.url??'/','http://localhost');
  const reply=(body:unknown,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
  if(url.pathname==='/api/v1/auth/session') {reply({authenticated:true});return;}
  if(url.pathname==='/api/v1/matches') {reply({matches:matches.filter(m=>m.kickoffUtc.slice(0,10)===url.searchParams.get('date')),snapshot});return;}
  if(url.pathname.startsWith('/api/v1/matches/detail')) {reply(url.searchParams.get('id')===completed.match.id?completed:upcoming);return;}
  if(url.pathname.startsWith('/api/') || url.pathname==='/dev/live-reload') {reply({},404);return;}
  const file=path.resolve(dist,`.${url.pathname==='/'?'/index.html':url.pathname}`);
  if(!file.startsWith(`${dist}${path.sep}`) || !existsSync(file)) {reply({},404);return;}
  const mime=({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'} as Record<string,string>)[path.extname(file)]??'application/octet-stream';
  res.writeHead(200,{'content-type':mime});res.end(readFileSync(file));
});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();if(!address || typeof address==='string') throw new Error('Local browser fixture address missing');
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({baseURL:`http://127.0.0.1:${address.port}`,timezoneId:'UTC',viewport:{width:390,height:844},serviceWorkers:'block'});
  page.setDefaultTimeout(10_000);
  await page.route('**/dev/live-reload',route=>route.fulfill({status:204,body:''}));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await runDetailInteractionFixtures(page,completed,upcoming);
  console.log(JSON.stringify({gate:'detail-local-browser',status:'passed',providerEvidence:false}));
} finally {
  await browser.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
