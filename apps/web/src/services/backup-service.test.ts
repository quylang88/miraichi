import { describe, expect, it } from 'vitest';
import { exportCloudBackup, importCloudBackup } from './backup-service.js';
const envelope={schemaVersion:'miraichi.cloud-backup.v2' as const,exportedAt:'2026-07-02T00:00:00.000Z',ownerProfileId:'owner-primary',drafts:[],bets:[],bankrollAccounts:[],bankrollLedgerEntries:[],disciplineConfigs:[],settlementEvents:[]};
const legacyEnvelope={schemaVersion:'miraichi.cloud-backup.v1' as const,exportedAt:envelope.exportedAt,ownerProfileId:'owner-primary',drafts:[],bets:[],bankrollAccounts:[],bankrollLedgerEntries:[]};
describe('backup service',()=>{
  it('exports validated JSON',async()=>{expect(await exportCloudBackup(async()=>new Response(JSON.stringify(envelope),{status:200}))).toMatchObject(envelope);});
  it('accepts both V1 and V2 imports while export remains V2', async () => {
    const posted: string[] = [];
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => { posted.push(String(init?.body)); return new Response('{}', { status: 200 }); };
    await importCloudBackup(legacyEnvelope, fetcher);
    await importCloudBackup(envelope, fetcher);
    expect(posted).toHaveLength(2);
  });
  it('rejects unsupported schemas before posting',async()=>{let called=false;await expect(importCloudBackup({schemaVersion:'bad'},async()=>{called=true;return new Response();})).rejects.toThrow('Unsupported backup');expect(called).toBe(false);});
});
