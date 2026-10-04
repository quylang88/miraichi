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

export function toPublicSourceRefs(
  sources: readonly LocalMatchSourceRef[]
): LocalMatchSourceRef[] {
  const latestBySourceId = new Map<string, LocalMatchSourceRef>();
  for (const source of sources) {
    const publicSource = toPublicSourceRef(source);
    const current = latestBySourceId.get(publicSource.sourceId);
    if (
      current === undefined
      || Date.parse(publicSource.importedAt) > Date.parse(current.importedAt)
    ) {
      latestBySourceId.set(publicSource.sourceId, publicSource);
    }
  }
  return [...latestBySourceId.values()].sort((left, right) => (
    left.sourceId.localeCompare(right.sourceId)
  ));
}

export function toPublicSnapshotStatus(
  status: LocalDataSnapshotStatus
): LocalDataSnapshotStatus {
  return {
    ...status,
    sources: toPublicSourceRefs(status.sources)
  };
}
