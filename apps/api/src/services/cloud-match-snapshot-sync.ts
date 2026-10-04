import { validateLocalMatch, type CloudMatchSnapshot } from '@miraichi/shared';
import type { LocalMatchSnapshot } from '../repositories/serving-match-store.js';
import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
export async function syncServingMatchStoreToCloud(options:{servingRepository:{loadSnapshot():Promise<LocalMatchSnapshot>};adapter:CloudPersistenceAdapter;ownerProfileId:string}){
  const snapshot=await options.servingRepository.loadSnapshot();
  for(const match of snapshot.matches){const validation=validateLocalMatch(match);if(!validation.ok)throw new Error(`Serving match store is invalid: ${validation.errors.join('; ')}`);if(String(match.status)==='in_play')throw new Error('Serving match store is invalid for cloud sync');}
  await options.adapter.upsertMatchSnapshot(options.ownerProfileId,snapshot as CloudMatchSnapshot);
  return{snapshotId:snapshot.snapshotId,matchCount:snapshot.matches.length,provider:'supabase-postgres' as const};
}
