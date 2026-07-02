import { validateLocalMatch, type CloudMatchSnapshot } from '@miraichi/shared';
import type { LocalMatchSnapshot } from '../repositories/local-match-snapshot-repository.js';
import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
export async function syncLocalMatchSnapshotToCloud(options:{localRepository:{loadSnapshot():Promise<LocalMatchSnapshot>};adapter:CloudPersistenceAdapter;ownerProfileId:string}){
  const snapshot=await options.localRepository.loadSnapshot();
  for(const match of snapshot.matches){const validation=validateLocalMatch(match);if(!validation.ok)throw new Error(`Local match snapshot is invalid: ${validation.errors.join('; ')}`);if(match.competition.type!=='national-team'||String(match.status)==='in_play')throw new Error('Local match snapshot is invalid for Phase 9 cloud sync');}
  await options.adapter.upsertMatchSnapshot(options.ownerProfileId,snapshot as CloudMatchSnapshot);
  return{snapshotId:snapshot.snapshotId,matchCount:snapshot.matches.length,provider:'supabase-postgres' as const};
}
