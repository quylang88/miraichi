import { describe, expect, it } from 'vitest';
import { createBankrollAccount, createBankrollTransfer, createLedgerEntry, loadBankrollViewState } from './bankroll-service.js';
describe('bankroll service',()=>{
  it('maps empty and ready accounts',async()=>{expect(await loadBankrollViewState(async()=>new Response('[]',{status:200}))).toEqual({status:'empty'});const fetcher=async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).includes('/ledger')?[]:String(input).includes('/summary')?{realizedBalance:10,openExposure:0,availableBalance:10,accounts:[]}:[{accountId:'a',ownerProfileId:'owner-primary',label:'Main',unit:'points',openingBalancePoints:10,currentBalancePoints:10,archived:false,createdAt:'2026-07-02T00:00:00.000Z',updatedAt:'2026-07-02T00:00:00.000Z'}]),{status:200});expect(await loadBankrollViewState(fetcher)).toMatchObject({status:'ready',selectedAccountId:'a'});});
  it('posts points-only accounts and signed manual ledger amounts',async()=>{const calls:string[]=[];const fetcher=async(_input:RequestInfo|URL,init?:RequestInit)=>{calls.push(String(init?.body));return new Response('{}',{status:201});};await createBankrollAccount({accountId:'a',label:'Main',openingBalancePoints:100},fetcher);await createLedgerEntry({entryId:'e',accountId:'a',entryType:'withdrawal',amountPoints:-10,occurredAt:'2026-07-02T00:00:00.000Z'},fetcher);expect(calls[0]).toContain('"unit":"points"');expect(calls[1]).toContain('"amountPoints":-10');});
  it('loads realized, exposure, and available balances and uses the atomic transfer endpoint', async () => {
    const calls: string[] = [];
    const account = {accountId:'a',ownerProfileId:'owner-primary',label:'Main',unit:'points',openingBalancePoints:100,currentBalancePoints:100,archived:false,createdAt:'2026-07-02T00:00:00.000Z',updatedAt:'2026-07-02T00:00:00.000Z'};
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${String(input)} ${String(init?.body ?? '')}`);
      if (String(input).includes('/summary')) return new Response(JSON.stringify({ realizedBalance: 100, openExposure: 20, availableBalance: 80, accounts: [] }), { status: 200 });
      if (String(input).includes('/ledger')) return new Response('[]', { status: 200 });
      if (String(input).includes('/transfers')) return new Response('{}', { status: 201 });
      return new Response(JSON.stringify([account]), { status: 200 });
    };
    expect(await loadBankrollViewState(fetcher)).toMatchObject({ status: 'ready', summary: { realizedBalance: 100, openExposure: 20, availableBalance: 80 } });
    await createBankrollTransfer({ transferId: 't1', fromAccountId: 'a', toAccountId: 'b', amountPoints: 10, occurredAt: account.createdAt }, fetcher);
    expect(calls.at(-1)).toContain('/bankroll/transfers');
  });
});
