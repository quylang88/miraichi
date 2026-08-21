import type { CloudBackupEnvelope } from '@miraichi/shared';
import { buildApiUrl } from '../config/client-env.js';
import type { FetchLike } from './cloud-persistence-service.js';

function validate(value:unknown):value is CloudBackupEnvelope{if(typeof value!=='object'||value===null)return false;const item=value as Partial<CloudBackupEnvelope>;return item.schemaVersion==='miraichi.cloud-backup.v1'&&typeof item.exportedAt==='string'&&typeof item.ownerProfileId==='string'&&Array.isArray(item.drafts)&&Array.isArray(item.bets)&&Array.isArray(item.bankrollAccounts)&&Array.isArray(item.bankrollLedgerEntries);}
export async function exportCloudBackup(fetcher:FetchLike=fetch):Promise<CloudBackupEnvelope>{const response=await fetcher(buildApiUrl('/api/v1/backups/export'),{method:'POST'});if(!response.ok)throw new Error('Backup export failed');const payload=await response.json();if(!validate(payload))throw new Error('Invalid backup response');return payload;}
export async function importCloudBackup(payload:unknown,fetcher:FetchLike=fetch):Promise<void>{if(!validate(payload))throw new Error('Unsupported backup schema');const response=await fetcher(buildApiUrl('/api/v1/backups/import'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!response.ok)throw new Error(response.status===409?'Backup import conflict':'Backup import failed');}


