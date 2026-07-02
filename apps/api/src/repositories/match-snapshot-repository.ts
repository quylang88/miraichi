import type { LocalDataSnapshotStatus, LocalMatch, LocalMatchFeedResponse, LocalMatchSnapshotQuery } from '@miraichi/shared';
export interface MatchSnapshotRepository {
  listMatches(query?:LocalMatchSnapshotQuery):Promise<LocalMatchFeedResponse>;
  findById(id:string):Promise<LocalMatch|null>;
  getStatus():Promise<LocalDataSnapshotStatus>;
}
