import type { CreateBankrollAccountInput, CreateBankrollLedgerEntryInput, UpdateBankrollAccountInput } from '@miraichi/shared';
import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';
import { readJsonObjectRequest } from './json-body.js';
import { isValidIanaTimeZone } from '@miraichi/shared';
import { setupSingleBankroll, SingleBankrollError } from '../services/single-bankroll-service.js';
const text=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
export async function handleBankroll(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  const url=new URL(req.url??'/', 'http://localhost'); const isSetup=url.pathname.endsWith('/setup'); const isAccounts=url.pathname.endsWith('/accounts'); const isLedger=url.pathname.endsWith('/ledger'); const isSummary=url.pathname.endsWith('/summary'); const isTransfers=url.pathname.endsWith('/transfers');
  try{
    if(isAccounts&&req.method==='GET')return sendJson(res,200,await deps.adapter.listBankrollAccounts(deps.ownerProfileId));
    if(isLedger&&req.method==='GET'){const accountId=url.searchParams.get('accountId');if(!accountId)return sendError(res,400,'invalid_cloud_record','accountId is required.');return sendJson(res,200,await deps.adapter.listBankrollLedgerEntries(deps.ownerProfileId,accountId));}
    if(isSummary&&req.method==='GET'){const selectedId=url.searchParams.get('accountId');const allAccounts=await deps.adapter.listBankrollAccounts(deps.ownerProfileId);const accounts=selectedId?allAccounts.filter((account)=>account.accountId===selectedId):allAccounts;const pending=(await deps.adapter.listBetRecords(deps.ownerProfileId)).filter((bet)=>bet.status==='pending');const summaries=accounts.map((account)=>{const openExposure=pending.filter((bet)=>bet.bankrollAccountId===account.accountId).reduce((sum,bet)=>sum+bet.stakePoints,0);return{...account,realizedBalance:account.currentBalancePoints,openExposure,availableBalance:account.currentBalancePoints-openExposure};});const realizedBalance=summaries.reduce((sum,item)=>sum+item.realizedBalance,0);const openExposure=summaries.reduce((sum,item)=>sum+item.openExposure,0);return sendJson(res,200,{realizedBalance,openExposure,availableBalance:realizedBalance-openExposure,accounts:summaries});}
    let payload;try{payload=await readJsonObjectRequest(req);}catch{return sendError(res,400,'invalid_json_body','Invalid JSON request body.');}
    if(payload.ownerProfileId!==undefined&&payload.ownerProfileId!==deps.ownerProfileId)return sendError(res,400,'invalid_cloud_record','Owner profile is server-controlled.');
    if(isSetup&&req.method==='POST'){
      const openingBalancePoints=Number(payload.openingBalancePoints);const timeZone=String(payload.timeZone??'');const weekStartDay=payload.weekStartDay===undefined?'monday':String(payload.weekStartDay);
      if(!Number.isFinite(openingBalancePoints)||openingBalancePoints<=0||!isValidIanaTimeZone(timeZone)||!['monday','sunday'].includes(weekStartDay))return sendError(res,400,'invalid_bankroll_setup','Positive opening points, a valid timezone, and a valid week start are required.');
      try{const result=await setupSingleBankroll({adapter:deps.adapter,ownerProfileId:deps.ownerProfileId,openingBalancePoints,timeZone,weekStartDay:weekStartDay as 'monday'|'sunday',now:(deps.now??(()=>new Date()))().toISOString()});return sendJson(res,result.created?201:200,result);}catch(error){if(error instanceof SingleBankrollError)return sendError(res,409,error.code,error.message);throw error;}
    }
    if(isAccounts&&req.method==='POST'){
      if(payload.unit!==undefined&&payload.unit!=='points')return sendError(res,400,'invalid_cloud_record','Only points accounts are supported.');
      if(!text(payload.accountId)||!text(payload.label)||!finite(payload.openingBalancePoints)||Number(payload.openingBalancePoints)<=0)return sendError(res,400,'invalid_cloud_record','Opening bankroll must be positive.');
      if((await deps.adapter.listBankrollAccounts(deps.ownerProfileId)).length>0)return sendError(res,409,'single_bankroll_only','V1 supports one active bankroll.');
      const input:CreateBankrollAccountInput={accountId:text(payload.accountId)!,ownerProfileId:deps.ownerProfileId,label:text(payload.label)!,openingBalancePoints:payload.openingBalancePoints as number};
      return sendJson(res,201,await deps.adapter.createBankrollAccount(input));
    }
    if(isAccounts&&req.method==='PATCH'){
      const accountId=url.searchParams.get('id');if(!accountId)return sendError(res,400,'invalid_cloud_record','id is required.');
      const input:UpdateBankrollAccountInput={accountId,ownerProfileId:deps.ownerProfileId,...(text(payload.label)?{label:text(payload.label)!}:{}),...(typeof payload.archived==='boolean'?{archived:payload.archived}:{})};
      try{return sendJson(res,200,await deps.adapter.updateBankrollAccount(input));}catch{return sendError(res,404,'bankroll_account_not_found','Bankroll account not found.');}
    }
    if(isLedger&&req.method==='POST'){
      const entryType=String(payload.entryType);const amountPoints=Number(payload.amountPoints);
      const invalidSign=(entryType==='deposit'&&amountPoints<=0)||(entryType==='withdrawal'&&amountPoints>=0);
      if(!text(payload.entryId)||!text(payload.accountId)||!['deposit','withdrawal','correction'].includes(entryType)||!finite(payload.amountPoints)||amountPoints===0||invalidSign||!text(payload.occurredAt))return sendError(res,400,'invalid_cloud_record','Ledger payload is invalid.');
      const input:CreateBankrollLedgerEntryInput={entryId:text(payload.entryId)!,ownerProfileId:deps.ownerProfileId,accountId:text(payload.accountId)!,entryType:payload.entryType as CreateBankrollLedgerEntryInput['entryType'],amountPoints:payload.amountPoints as number,...(text(payload.note)?{note:text(payload.note)!}:{}),occurredAt:text(payload.occurredAt)!};
      try{const ledgerEntry=await deps.adapter.createBankrollLedgerEntry(input);const account=(await deps.adapter.listBankrollAccounts(deps.ownerProfileId)).find((item)=>item.accountId===input.accountId);return sendJson(res,201,{account,ledgerEntry});}catch(error){if(String(error).includes('Insufficient'))return sendError(res,409,'insufficient_bankroll_balance','The operation would make the bankroll balance negative.');if(String(error).includes('archived'))return sendError(res,409,'bankroll_account_archived','Archived accounts cannot receive ledger entries.');return sendError(res,404,'bankroll_account_not_found','Bankroll account not found.');}
    }
    if(isTransfers&&req.method==='POST'){
      if(!text(payload.transferId)||!text(payload.fromAccountId)||!text(payload.toAccountId)||payload.fromAccountId===payload.toAccountId||!finite(payload.amountPoints)||Number(payload.amountPoints)<=0||!text(payload.occurredAt))return sendError(res,400,'invalid_cloud_record','Transfer payload is invalid.');
      try{return sendJson(res,201,await deps.adapter.createBankrollTransfer({transferId:text(payload.transferId)!,ownerProfileId:deps.ownerProfileId,fromAccountId:text(payload.fromAccountId)!,toAccountId:text(payload.toAccountId)!,amountPoints:Number(payload.amountPoints),...(text(payload.note)?{note:text(payload.note)!}:{}),occurredAt:text(payload.occurredAt)!}));}catch(error){if(String(error).includes('Insufficient'))return sendError(res,409,'insufficient_bankroll_balance','The operation would make the bankroll balance negative.');if(String(error).includes('archived'))return sendError(res,409,'bankroll_account_archived','Archived accounts cannot transfer points.');return sendError(res,404,'bankroll_account_not_found','Bankroll account not found.');}
    }
    sendError(res,405,'method_not_allowed','Method not allowed.');
  }catch(error){mapCloudError(res,error);}
}
