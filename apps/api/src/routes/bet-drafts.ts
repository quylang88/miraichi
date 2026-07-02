import type { AddBetDraft } from '@miraichi/shared';
import { isAddBetDraftReviewReady } from '@miraichi/shared/src/contracts/add-bet-draft-contracts.js';
import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';
import { readJsonObjectRequest } from './json-body.js';

function validOwner(payload:Record<string,unknown>,owner:string){return payload.ownerProfileId===undefined||payload.ownerProfileId===owner;}
function draftFrom(payload:Record<string,unknown>,id?:string):AddBetDraft|null{
  const value={...payload,draftId:id??payload.draftId} as unknown as Partial<AddBetDraft>;
  return isAddBetDraftReviewReady(value)?value as AddBetDraft:null;
}
export async function handleBetDrafts(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  const url=new URL(req.url??'/', 'http://localhost'); const id=url.searchParams.get('id');
  try{
    if(req.method==='GET') return sendJson(res,200,await deps.adapter.listBetDrafts(deps.ownerProfileId));
    if(req.method==='DELETE'){if(!id)return sendError(res,400,'invalid_cloud_record','id is required.');const deleted=await deps.adapter.deleteBetDraft(deps.ownerProfileId,id);if(!deleted)return sendError(res,404,'bet_draft_not_found','Draft not found.');res.writeHead(204);res.end();return;}
    if(req.method!=='POST'&&req.method!=='PUT')return sendError(res,405,'method_not_allowed','Method not allowed.');
    let payload;try{payload=await readJsonObjectRequest(req);}catch{return sendError(res,400,'invalid_json_body','Invalid JSON request body.');}
    if(!validOwner(payload,deps.ownerProfileId))return sendError(res,400,'invalid_cloud_record','Owner profile is server-controlled.');
    const draft=draftFrom(payload,req.method==='PUT'?(id??undefined):undefined);if(!draft)return sendError(res,400,'invalid_cloud_record','Draft payload is invalid.');
    if(req.method==='PUT'&&id&&!((await deps.adapter.listBetDrafts(deps.ownerProfileId)).some((item)=>item.draftId===id)))return sendError(res,404,'bet_draft_not_found','Draft not found.');
    sendJson(res,req.method==='POST'?201:200,await deps.adapter.saveBetDraft(deps.ownerProfileId,draft));
  }catch(error){mapCloudError(res,error);}
}
