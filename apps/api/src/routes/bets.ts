import { validateCloudBetRecord, validateCreateOngoingBetInput, type CloudBetRecord, type DisciplineSnapshot } from '@miraichi/shared';
import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';
import { readJsonObjectRequest } from './json-body.js';
import { evaluateDisciplineAttempt, hashBetAttemptPayload } from '../services/discipline-service.js';

const PATCH_FIELDS=new Set(['status','settlementNote','manualResultPoints','notes','tags']);
export async function handleBets(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  const url=new URL(req.url??'/', 'http://localhost');const id=url.searchParams.get('id');
  try{
    if(req.method==='GET')return sendJson(res,200,await deps.adapter.listBetRecords(deps.ownerProfileId));
    if(req.method!=='POST'&&req.method!=='PATCH')return sendError(res,405,'method_not_allowed','Method not allowed.');
    let payload;try{payload=await readJsonObjectRequest(req);}catch{return sendError(res,400,'invalid_json_body','Invalid JSON request body.');}
    if(payload.ownerProfileId!==undefined&&payload.ownerProfileId!==deps.ownerProfileId)return sendError(res,400,'invalid_cloud_record','Owner profile is server-controlled.');
    if(req.method==='POST'){
      const inputValidation=validateCreateOngoingBetInput(payload);if(!inputValidation.ok)return sendError(res,400,'invalid_cloud_record',inputValidation.errors.join('; '));
      const accounts=await deps.adapter.listBankrollAccounts(deps.ownerProfileId);const account=accounts.find((item)=>item.accountId===payload.bankrollAccountId&&!item.archived);if(!account)return sendError(res,400,'invalid_cloud_record','A valid active bankroll account is required.');
      const currentTime=(deps.now??(()=>new Date()))().toISOString();const config=await deps.adapter.getDisciplineConfig(deps.ownerProfileId);
      const evaluation=evaluateDisciplineAttempt({config,stakePoints:Number(payload.stakePoints),settlementEvents:await deps.adapter.listBetSettlementEvents(deps.ownerProfileId),at:currentTime});
      let acknowledgedAt:string|undefined;
      if(evaluation.triggeredRules.length>0){
        const challengeId=typeof payload.disciplineChallengeId==='string'?payload.disciplineChallengeId:'';const challenge=challengeId?await deps.adapter.findDisciplineChallenge(deps.ownerProfileId,challengeId):null;
        const sameRules=challenge&&JSON.stringify(challenge.triggeredRules)===JSON.stringify(evaluation.triggeredRules);
        if(!challenge||challenge.consumedAt||challenge.payloadHash!==hashBetAttemptPayload(payload)||challenge.ruleVersion!==config?.version||!sameRules||new Date(currentTime)<new Date(challenge.availableAt))return sendError(res,409,'discipline_ack_required','A completed discipline acknowledgement is required.');
        const consumed=await deps.adapter.consumeDisciplineChallenge(deps.ownerProfileId,challengeId,currentTime);if(!consumed)return sendError(res,409,'discipline_ack_required','The discipline acknowledgement was already used.');acknowledgedAt=currentTime;
      }
      const disciplineSnapshot:DisciplineSnapshot|undefined=config?{ruleVersion:config.version,triggeredRules:[...evaluation.triggeredRules],dailyProfitLossPoints:evaluation.dailyProfitLossPoints,weeklyProfitLossPoints:evaluation.weeklyProfitLossPoints,thresholds:{dailyStopLossPoints:config.dailyStopLossPoints,weeklyStopLossPoints:config.weeklyStopLossPoints,bigBetThresholdPoints:config.bigBetThresholdPoints},...(acknowledgedAt?{acknowledgedAt}:{})}:undefined;
      const record={...payload,ownerProfileId:deps.ownerProfileId,status:'pending',updatedAt:currentTime,...(disciplineSnapshot?{disciplineSnapshot}:{}),disciplineChallengeId:undefined} as unknown as CloudBetRecord;
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
