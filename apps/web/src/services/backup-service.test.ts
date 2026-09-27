import { describe, expect, it } from 'vitest';
import { createCloudBackupEnvelopeV3 } from '@miraichi/shared';
import { exportCloudBackup, importCloudBackup } from './backup-service.js';
const envelope={schemaVersion:'miraichi.cloud-backup.v2' as const,exportedAt:'2026-07-02T00:00:00.000Z',ownerProfileId:'owner-primary',drafts:[],bets:[],bankrollAccounts:[],bankrollLedgerEntries:[],disciplineConfigs:[],settlementEvents:[]};
const legacyEnvelope={schemaVersion:'miraichi.cloud-backup.v1' as const,exportedAt:envelope.exportedAt,ownerProfileId:'owner-primary',drafts:[],bets:[],bankrollAccounts:[],bankrollLedgerEntries:[]};
const currentEnvelope=()=>createCloudBackupEnvelopeV3({exportedAt:envelope.exportedAt,ownerProfileId:'owner-primary',ownerProfile:null,drafts:[],bets:[],bankrollAccounts:[],bankrollLedgerEntries:[],disciplineConfigs:[],settlementEvents:[]});
describe('backup service',()=>{
  it('exports validated V3 JSON',async()=>{const current=await currentEnvelope();expect(await exportCloudBackup(async()=>new Response(JSON.stringify(current),{status:200}))).toMatchObject(current);});
  it('accepts V1, V2, and V3 imports while export requires V3', async () => {
    const posted: string[] = [];
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => { posted.push(String(init?.body)); return new Response('{}', { status: 200 }); };
    await importCloudBackup(legacyEnvelope, fetcher);
    await importCloudBackup(envelope, fetcher);
    await importCloudBackup(await currentEnvelope(), fetcher);
    expect(posted).toHaveLength(3);
  });
  it('rejects unsupported schemas before posting',async()=>{let called=false;await expect(importCloudBackup({schemaVersion:'bad'},async()=>{called=true;return new Response();})).rejects.toThrow('Unsupported backup');expect(called).toBe(false);});
});
