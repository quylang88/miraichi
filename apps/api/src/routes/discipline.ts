import { randomUUID } from 'node:crypto';
import { validateCreateOngoingBetInput, validateDisciplineConfig, type DisciplineConfig } from '@miraichi/shared';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildDisciplineChallenge, evaluateDisciplineAttempt } from '../services/discipline-service.js';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';
import { readJsonObjectRequest } from './json-body.js';

export async function handleDiscipline(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  const path=new URL(req.url??'/', 'http://localhost').pathname;
  const now=()=> (deps.now??(()=>new Date()))().toISOString();
  try{
    if(path.endsWith('/discipline-config')&&req.method==='GET')return sendJson(res,200,await deps.adapter.getDisciplineConfig(deps.ownerProfileId));
    let payload;try{payload=await readJsonObjectRequest(req);}catch{return sendError(res,400,'invalid_json_body','Invalid JSON request body.');}
    if(payload.ownerProfileId!==undefined)return sendError(res,400,'invalid_discipline_config','Owner profile is server-controlled.');
    if(path.endsWith('/discipline-config')&&req.method==='PUT'){
      const existing=await deps.adapter.getDisciplineConfig(deps.ownerProfileId);
      const config:DisciplineConfig={ownerProfileId:deps.ownerProfileId,dailyStopLossPoints:payload.dailyStopLossPoints===null?null:Number(payload.dailyStopLossPoints),weeklyStopLossPoints:payload.weeklyStopLossPoints===null?null:Number(payload.weeklyStopLossPoints),bigBetThresholdPoints:payload.bigBetThresholdPoints===null?null:Number(payload.bigBetThresholdPoints),timeZone:String(payload.timeZone??''),weekStartDay:(payload.weekStartDay as 'monday' | 'sunday') ?? existing?.weekStartDay ?? 'monday',cooldownSeconds:15,version:(existing?.version??0)+1,updatedAt:now()};
      const validation=validateDisciplineConfig(config);if(!validation.ok)return sendError(res,400,'invalid_discipline_config',validation.errors.join('; '));
      return sendJson(res,200,await deps.adapter.upsertDisciplineConfig(config));
    }
    if(path.endsWith('/discipline-challenges')&&req.method==='POST'){
      const validation=validateCreateOngoingBetInput(payload);if(!validation.ok)return sendError(res,400,'invalid_bet_record',validation.errors.join('; '));
      const config=await deps.adapter.getDisciplineConfig(deps.ownerProfileId);
      const evaluation=evaluateDisciplineAttempt({config,stakePoints:Number(payload.stakePoints),settlementEvents:await deps.adapter.listBetSettlementEvents(deps.ownerProfileId),at:now()});
      if(!config||evaluation.triggeredRules.length===0)return sendJson(res,200,{required:false,evaluation});
      const challenge=buildDisciplineChallenge({challengeId:randomUUID(),ownerProfileId:deps.ownerProfileId,payload,config,evaluation,now:now()});
      await deps.adapter.createDisciplineChallenge(challenge);return sendJson(res,201,{required:true,challenge});
    }
    sendError(res,405,'method_not_allowed','Method not allowed.');
  }catch(error){mapCloudError(res,error);}
}
