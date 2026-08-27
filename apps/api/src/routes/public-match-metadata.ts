import type {
  LocalDataSnapshotStatus,
  LocalMatchSourceRef
} from '@miraichi/shared';

export function toPublicSourceRef(source: LocalMatchSourceRef): LocalMatchSourceRef {
  return {
    sourceId: source.sourceId,
    importedAt: source.importedAt
  };
}

export function toPublicSnapshotStatus(
  status: LocalDataSnapshotStatus
): LocalDataSnapshotStatus {
  return {
    ...status,
    sources: status.sources.map(toPublicSourceRef)
  };
}
