import { describe, expect, it } from 'vitest';
import { exportCloudBackup, importCloudBackup } from './backup-service.js';
const envelope={schemaVersion:'miraichi.cloud-backup.v1' as const,exportedAt:'2026-07-02T00:00:00.000Z',ownerProfileId:'owner-primary',drafts:[],bets:[],bankrollAccounts:[],bankrollLedgerEntries:[]};
describe('backup service',()=>{
  it('exports validated JSON',async()=>{expect(await exportCloudBackup(async()=>new Response(JSON.stringify(envelope),{status:200}))).toMatchObject(envelope);});
  it('rejects unsupported schemas before posting',async()=>{let called=false;await expect(importCloudBackup({schemaVersion:'bad'},async()=>{called=true;return new Response();})).rejects.toThrow('Unsupported backup');expect(called).toBe(false);});
});
