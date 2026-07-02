import type { LocalMatchSnapshotQuery } from '@miraichi/shared';
import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
import type { MatchSnapshotRepository } from './match-snapshot-repository.js';
export class CloudMatchSnapshotRepository implements MatchSnapshotRepository {
  constructor(private readonly adapter:CloudPersistenceAdapter,private readonly ownerProfileId:string){}
  listMatches(query:LocalMatchSnapshotQuery={}){return this.adapter.listCloudMatches(this.ownerProfileId,query);}
  findById(id:string){return this.adapter.findCloudMatchById(this.ownerProfileId,id);}
  getStatus(){return this.adapter.getCloudMatchSnapshotStatus(this.ownerProfileId);}
}
