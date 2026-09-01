import {
  calculateHkSettlementProfitLoss, validateSettlementCommand,
  type ApplyBetSettlementResult, type BetSettlementEvent, type CloudBetRecord, type SettlementCommand
} from '@miraichi/shared';
import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';

export async function settleBet({adapter,ownerProfileId,betId,command,now}:{
  readonly adapter:CloudPersistenceAdapter;readonly ownerProfileId:string;readonly betId:string;
  readonly command:SettlementCommand;readonly now:string;
}):Promise<ApplyBetSettlementResult>{
  const validation=validateSettlementCommand(command);if(!validation.ok)throw new Error(validation.errors.join('; '));
  const record=(await adapter.listBetRecords(ownerProfileId)).find((item)=>item.betId===betId);if(!record)throw new Error('Bet record not found');
  if(!record.bankrollAccountId)throw new Error('An assigned bankroll account is required before settlement');
  const planAdherence=record.preBetPlanAdherence??record.postBetPlanAdherence??command.planAdherence;
  if(!planAdherence)throw new Error('Legacy bet plan adherence is required before settlement');
  const events=await adapter.listBetSettlementEvents(ownerProfileId,betId);
  const idempotentEvent=events.find((event)=>event.settlementEventId===command.settlementEventId);
  const correctedEvent=command.correctsSettlementEventId?events.find((event)=>event.settlementEventId===command.correctsSettlementEventId):undefined;
  if(command.correctsSettlementEventId&&!correctedEvent)throw new Error('Corrected settlement event not found');
  if(record.status!=='pending'&&!command.correctsSettlementEventId&&!idempotentEvent)throw new Error('Settled bets require a correction event');
  const calculated=calculateHkSettlementProfitLoss({stakePoints:record.stakePoints,oddsValue:record.oddsValue,settlementType:command.settlementType,...(command.profitLossPoints===undefined?{}:{profitLossPoints:command.profitLossPoints})});
  const previous=command.correctsSettlementEventId?(record.profitLossPoints??record.manualResultPoints??0):0;
  const ledgerDelta=Number((calculated-previous).toFixed(4));
  const effectiveAt=correctedEvent?.effectiveAt??command.effectiveAt;
  const event:BetSettlementEvent={...command,planAdherence,ownerProfileId,betId,bankrollAccountId:record.bankrollAccountId,calculatedProfitLossPoints:calculated,ledgerDeltaPoints:ledgerDelta,effectiveAt,occurredAt:now};
  const updated:CloudBetRecord={...record,status:'settled',settlementType:command.settlementType,profitLossPoints:calculated,settledAt:record.settledAt??effectiveAt,postBetPlanAdherence:planAdherence,...(command.lessonNote?{postBetLessonNote:command.lessonNote}:{}),updatedAt:now};
  return adapter.applyBetSettlement({record:updated,event,ledgerEntry:{entryId:`settlement:${command.settlementEventId}`,ownerProfileId,accountId:record.bankrollAccountId,entryType:command.correctsSettlementEventId?'bet_settlement_correction':'bet_settlement',amountPoints:ledgerDelta,betId,settlementEventId:command.settlementEventId,effectiveAt,occurredAt:now,...(command.adjustmentReason?{note:command.adjustmentReason}:{})}});
}
