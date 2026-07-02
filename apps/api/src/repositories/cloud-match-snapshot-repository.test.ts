import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { CloudMatchSnapshotRepository } from './cloud-match-snapshot-repository.js';
describe('cloud match snapshot repository',()=>{it('delegates owner-scoped reads',async()=>{const adapter=createMemoryCloudPersistenceAdapter();const repo=new CloudMatchSnapshotRepository(adapter,'owner-primary');expect((await repo.listMatches({})).snapshot.freshness).toBe('missing');});});
