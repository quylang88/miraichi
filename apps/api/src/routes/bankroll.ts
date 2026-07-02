import type { CreateBankrollAccountInput, CreateBankrollLedgerEntryInput, UpdateBankrollAccountInput } from '@miraichi/shared';
import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';
import { readJsonObjectRequest } from './json-body.js';
const text=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
export async function handleBankroll(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  const url=new URL(req.url??'/', 'http://localhost'); const isAccounts=url.pathname.endsWith('/accounts'); const isLedger=url.pathname.endsWith('/ledger');
  try{
    if(isAccounts&&req.method==='GET')return sendJson(res,200,await deps.adapter.listBankrollAccounts(deps.ownerProfileId));
    if(isLedger&&req.method==='GET'){const accountId=url.searchParams.get('accountId');if(!accountId)return sendError(res,400,'invalid_cloud_record','accountId is required.');return sendJson(res,200,await deps.adapter.listBankrollLedgerEntries(deps.ownerProfileId,accountId));}
    let payload;try{payload=await readJsonObjectRequest(req);}catch{return sendError(res,400,'invalid_json_body','Invalid JSON request body.');}
    if(payload.ownerProfileId!==undefined&&payload.ownerProfileId!==deps.ownerProfileId)return sendError(res,400,'invalid_cloud_record','Owner profile is server-controlled.');
    if(isAccounts&&req.method==='POST'){
      if(payload.unit!==undefined&&payload.unit!=='points')return sendError(res,400,'invalid_cloud_record','Only points accounts are supported.');
      if(!text(payload.accountId)||!text(payload.label)||!finite(payload.openingBalancePoints))return sendError(res,400,'invalid_cloud_record','Account payload is invalid.');
      const input:CreateBankrollAccountInput={accountId:text(payload.accountId)!,ownerProfileId:deps.ownerProfileId,label:text(payload.label)!,openingBalancePoints:payload.openingBalancePoints as number};
      return sendJson(res,201,await deps.adapter.createBankrollAccount(input));
    }
    if(isAccounts&&req.method==='PATCH'){
      const accountId=url.searchParams.get('id');if(!accountId)return sendError(res,400,'invalid_cloud_record','id is required.');
      const input:UpdateBankrollAccountInput={accountId,ownerProfileId:deps.ownerProfileId,...(text(payload.label)?{label:text(payload.label)!}:{}),...(typeof payload.archived==='boolean'?{archived:payload.archived}:{})};
      try{return sendJson(res,200,await deps.adapter.updateBankrollAccount(input));}catch{return sendError(res,404,'bankroll_account_not_found','Bankroll account not found.');}
    }
    if(isLedger&&req.method==='POST'){
      if(!text(payload.entryId)||!text(payload.accountId)||!['deposit','withdrawal','transfer_in','transfer_out','correction'].includes(String(payload.entryType))||!finite(payload.amountPoints)||payload.amountPoints===0||!text(payload.occurredAt))return sendError(res,400,'invalid_cloud_record','Ledger payload is invalid.');
      const input:CreateBankrollLedgerEntryInput={entryId:text(payload.entryId)!,ownerProfileId:deps.ownerProfileId,accountId:text(payload.accountId)!,entryType:payload.entryType as CreateBankrollLedgerEntryInput['entryType'],amountPoints:payload.amountPoints as number,...(text(payload.note)?{note:text(payload.note)!}:{}),occurredAt:text(payload.occurredAt)!};
      try{const ledgerEntry=await deps.adapter.createBankrollLedgerEntry(input);const account=(await deps.adapter.listBankrollAccounts(deps.ownerProfileId)).find((item)=>item.accountId===input.accountId);return sendJson(res,201,{account,ledgerEntry});}catch(error){if(String(error).includes('archived'))return sendError(res,409,'bankroll_account_archived','Archived accounts cannot receive ledger entries.');return sendError(res,404,'bankroll_account_not_found','Bankroll account not found.');}
    }
    sendError(res,405,'method_not_allowed','Method not allowed.');
  }catch(error){mapCloudError(res,error);}
}
