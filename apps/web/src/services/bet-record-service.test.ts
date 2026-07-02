import { describe, expect, it } from 'vitest';
import { loadBetRecordsViewState, saveCloudBetDraft } from './bet-record-service.js';
const draft={draftId:'d1',matchGroupId:'m1',marketType:'1X2' as const,oddsFormat:'HK' as const,oddsValue:0.9,stakePoints:10,createdAt:'2026-07-02T00:00:00.000Z',updatedAt:'2026-07-02T00:00:00.000Z'};
describe('bet record service',()=>{
  it('maps drafts, pending, and settled records',async()=>{const fetcher=async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).endsWith('bet-drafts')?[draft]:[{betId:'b1',ownerProfileId:'owner-primary',matchGroupId:'m1',homeTeamName:'Japan',awayTeamName:'Vietnam',marketType:'1X2',selectionLabel:'Japan',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'settled',createdAt:draft.createdAt,updatedAt:draft.updatedAt}]),{status:200});const state=await loadBetRecordsViewState(fetcher);expect(state).toMatchObject({status:'ready',drafts:[{draftId:'d1'}],pending:[],settled:[{betId:'b1'}]});});
  it('rejects forbidden formula fields from responses',async()=>{const fetcher=async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).endsWith('bet-drafts')?[]:[{roi:10}]),{status:200});expect(await loadBetRecordsViewState(fetcher)).toMatchObject({status:'unavailable'});});
  it('sends only allowed draft fields',async()=>{let sent='';await saveCloudBetDraft({...draft,roi:10} as never,async(_input,init)=>{sent=String(init?.body);return new Response(JSON.stringify(draft),{status:201});});expect(sent).not.toContain('roi');});
});
