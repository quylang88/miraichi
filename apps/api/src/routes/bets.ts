import { validateCloudBetRecord, type CloudBetRecord } from '@miraichi/shared';
import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';
import { readJsonObjectRequest } from './json-body.js';

const PATCH_FIELDS=new Set(['status','settlementNote','manualResultPoints','notes','tags']);
export async function handleBets(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  const url=new URL(req.url??'/', 'http://localhost');const id=url.searchParams.get('id');
  try{
    if(req.method==='GET')return sendJson(res,200,await deps.adapter.listBetRecords(deps.ownerProfileId));
    if(req.method!=='POST'&&req.method!=='PATCH')return sendError(res,405,'method_not_allowed','Method not allowed.');
    let payload;try{payload=await readJsonObjectRequest(req);}catch{return sendError(res,400,'invalid_json_body','Invalid JSON request body.');}
    if(payload.ownerProfileId!==undefined&&payload.ownerProfileId!==deps.ownerProfileId)return sendError(res,400,'invalid_cloud_record','Owner profile is server-controlled.');
    if(req.method==='POST'){
      const record={...payload,ownerProfileId:deps.ownerProfileId} as unknown as CloudBetRecord;
      const validation=validateCloudBetRecord(record);if(!validation.ok)return sendError(res,400,'invalid_cloud_record',validation.errors.join('; '));
      return sendJson(res,201,await deps.adapter.createBetRecord(record));
    }
    if(!id)return sendError(res,400,'invalid_cloud_record','id is required.');
    if(Object.keys(payload).some((field)=>!PATCH_FIELDS.has(field)))return sendError(res,400,'invalid_cloud_record','Patch contains unsupported fields.');
    const current=(await deps.adapter.listBetRecords(deps.ownerProfileId)).find((item)=>item.betId===id);if(!current)return sendError(res,404,'bet_record_not_found','Bet record not found.');
    const updated={...current,...payload,updatedAt:(deps.now??(()=>new Date()))().toISOString()} as CloudBetRecord;
    const validation=validateCloudBetRecord(updated);if(!validation.ok)return sendError(res,400,'invalid_cloud_record',validation.errors.join('; '));
    sendJson(res,200,await deps.adapter.updateBetRecord(updated));
  }catch(error){mapCloudError(res,error);}
}
