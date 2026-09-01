import { createHash } from 'node:crypto';
import type { CloudBackupEnvelope, CloudBackupEnvelopeV2, CloudBetRecord } from '@miraichi/shared';
import { isAddBetDraftReviewReady, validateBankrollLedgerEntry, validateBetSettlementEvent, validateCloudBetRecord, validateDisciplineConfig } from '@miraichi/shared';
import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';
import { readJsonObjectRequest } from './json-body.js';

function migrateLegacyBet(bet:CloudBetRecord):CloudBetRecord{return{...bet,...(bet.manualResultPoints!=null&&bet.profitLossPoints==null?{profitLossPoints:bet.manualResultPoints}:{}),...(bet.status==='void'?{status:'settled' as const,settlementType:'void' as const,profitLossPoints:bet.manualResultPoints??0,settledAt:bet.updatedAt}:{})};}
function canonical(envelope:CloudBackupEnvelope):CloudBackupEnvelope{const common={...envelope,drafts:[...envelope.drafts].sort((a,b)=>a.draftId.localeCompare(b.draftId)),bets:[...envelope.bets].map((bet)=>envelope.schemaVersion==='miraichi.cloud-backup.v1'?migrateLegacyBet(bet):bet).sort((a,b)=>a.betId.localeCompare(b.betId)),bankrollAccounts:[...envelope.bankrollAccounts].sort((a,b)=>a.accountId.localeCompare(b.accountId)),bankrollLedgerEntries:[...envelope.bankrollLedgerEntries].sort((a,b)=>a.entryId.localeCompare(b.entryId))};if(envelope.schemaVersion==='miraichi.cloud-backup.v2')return{...common,schemaVersion:'miraichi.cloud-backup.v2',disciplineConfigs:[...envelope.disciplineConfigs].sort((a,b)=>a.ownerProfileId.localeCompare(b.ownerProfileId)),settlementEvents:[...envelope.settlementEvents].sort((a,b)=>a.settlementEventId.localeCompare(b.settlementEventId))};return{...common,schemaVersion:'miraichi.cloud-backup.v1'};}
function validEnvelope(value:unknown,owner:string):value is CloudBackupEnvelope{
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;const item=value as Partial<CloudBackupEnvelope>;
  if(!['miraichi.cloud-backup.v1','miraichi.cloud-backup.v2'].includes(String(item.schemaVersion))||item.ownerProfileId!==owner||typeof item.exportedAt!=='string'||!Array.isArray(item.drafts)||!Array.isArray(item.bets)||!Array.isArray(item.bankrollAccounts)||!Array.isArray(item.bankrollLedgerEntries))return false;
  const common=item.drafts.every(isAddBetDraftReviewReady)&&item.bets.every((bet)=>validateCloudBetRecord(bet).ok)&&item.bankrollAccounts.every((account)=>account&&typeof account.accountId==='string'&&account.ownerProfileId===owner&&account.unit==='points'&&typeof account.currentBalancePoints==='number')&&item.bankrollLedgerEntries.every((entry)=>validateBankrollLedgerEntry(entry).ok);
  if(!common||item.schemaVersion==='miraichi.cloud-backup.v1')return common;
  const v2=item as Partial<CloudBackupEnvelopeV2>;return Array.isArray(v2.disciplineConfigs)&&v2.disciplineConfigs.every((config)=>validateDisciplineConfig(config).ok)&&Array.isArray(v2.settlementEvents)&&v2.settlementEvents.every((event)=>event.ownerProfileId===owner&&validateBetSettlementEvent(event).ok);
}
export async function handleBackups(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  const path=new URL(req.url??'/', 'http://localhost').pathname;
  try{
    if(path.endsWith('/log')&&req.method==='GET')return sendJson(res,200,await deps.adapter.listBackupExports(deps.ownerProfileId));
    if(path.endsWith('/export')&&req.method==='POST'){
      const exportedAt=(deps.now??(()=>new Date()))().toISOString();const envelope=canonical(await deps.adapter.exportOwnerData(deps.ownerProfileId,exportedAt));const sha256=createHash('sha256').update(JSON.stringify(envelope),'utf8').digest('hex');
      await deps.adapter.recordBackupExport({exportId:`export-${sha256.slice(0,16)}`,ownerProfileId:deps.ownerProfileId,schemaVersion:envelope.schemaVersion,exportedAt,sha256,recordCounts:{betDrafts:envelope.drafts.length,bets:envelope.bets.length,bankrollAccounts:envelope.bankrollAccounts.length,bankrollLedgerEntries:envelope.bankrollLedgerEntries.length,...(envelope.schemaVersion==='miraichi.cloud-backup.v2'?{disciplineConfigs:envelope.disciplineConfigs.length,settlementEvents:envelope.settlementEvents.length}:{})}});
      return sendJson(res,200,{...envelope,sha256});
    }
    if(path.endsWith('/import')&&req.method==='POST'){
      let payload;try{payload=await readJsonObjectRequest(req);}catch{return sendError(res,400,'invalid_json_body','Invalid JSON request body.');}
      if(!validEnvelope(payload,deps.ownerProfileId))return sendError(res,400,'invalid_backup','Backup envelope is invalid or unsupported.');
      const [drafts,bets,accounts,ledger]=await Promise.all([deps.adapter.listBetDrafts(deps.ownerProfileId),deps.adapter.listBetRecords(deps.ownerProfileId),deps.adapter.listBankrollAccounts(deps.ownerProfileId),Promise.all(payload.bankrollAccounts.map((account)=>deps.adapter.listBankrollLedgerEntries(deps.ownerProfileId,account.accountId))).then((items)=>items.flat())]);
      const conflict=payload.drafts.some((item)=>drafts.some((existing)=>existing.draftId===item.draftId))||payload.bets.some((item)=>bets.some((existing)=>existing.betId===item.betId))||payload.bankrollAccounts.some((item)=>accounts.some((existing)=>existing.accountId===item.accountId))||payload.bankrollLedgerEntries.some((item)=>ledger.some((existing)=>existing.entryId===item.entryId));
      if(conflict)return sendError(res,409,'backup_import_conflict','Backup contains identities that already exist.');
      await deps.adapter.importOwnerData(deps.ownerProfileId,canonical(payload));return sendJson(res,200,{imported:true});
    }
    sendError(res,405,'method_not_allowed','Method not allowed.');
  }catch(error){mapCloudError(res,error);}
}
