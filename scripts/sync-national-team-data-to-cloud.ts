import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LocalMatchSnapshotRepository } from '../apps/api/src/repositories/local-match-snapshot-repository.js';
import { readCloudPersistenceConfig } from '../apps/api/src/config/cloud-persistence-config.js';
import { createCloudPersistenceAdapter } from '../apps/api/src/persistence/create-cloud-persistence-adapter.js';
import type { CloudPersistenceAdapter } from '../apps/api/src/persistence/cloud-persistence-adapter.js';
import { syncLocalMatchSnapshotToCloud } from '../apps/api/src/services/cloud-match-snapshot-sync.js';
import type { LocalMatchSnapshot } from '../apps/api/src/repositories/local-match-snapshot-repository.js';

export async function runNationalTeamCloudSync(options:{localRepository:{loadSnapshot():Promise<LocalMatchSnapshot>};adapter:CloudPersistenceAdapter;ownerProfileId:string;log?:(message:string)=>void}){
  const result=await syncLocalMatchSnapshotToCloud(options);(options.log??console.log)(`Synced national-team snapshot ${result.snapshotId}: ${result.matchCount} matches to ${result.provider}`);return result;
}
function loadEnv(){const path='.env';if(!existsSync(path))return;for(const line of readFileSync(path,'utf8').split(/\r?\n/)){const trimmed=line.trim();if(!trimmed||trimmed.startsWith('#'))continue;const index=trimmed.indexOf('=');if(index<1)continue;const key=trimmed.slice(0,index).trim();const value=trimmed.slice(index+1).trim().replace(/^['"]|['"]$/g,'');if(process.env[key]===undefined)process.env[key]=value;}}
async function main(){loadEnv();const config=readCloudPersistenceConfig();await runNationalTeamCloudSync({localRepository:new LocalMatchSnapshotRepository(),adapter:createCloudPersistenceAdapter(config),ownerProfileId:config.ownerProfileId});}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])void main().catch((error)=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
