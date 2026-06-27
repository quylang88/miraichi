import type {
  AddBetDraft,
  AddBetDraftId,
  AddBetDraftPersistenceAdapter,
  AddBetDraftPersistenceResult,
  MatchGroupId
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { cloneAddBetDraft } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';

const DEFAULT_DATABASE_NAME = 'miraichi-add-bet-drafts';
const DEFAULT_DATABASE_VERSION = 1;
const DEFAULT_STORE_NAME = 'drafts';
const MATCH_GROUP_INDEX_NAME = 'matchGroupId';

export interface IndexedDbAddBetDraftAdapterOptions {
  readonly databaseName?: string;
  readonly databaseVersion?: number;
  readonly storeName?: string;
  readonly indexedDb?: IDBFactory | null;
}

interface OpenDatabaseOptions {
  readonly databaseName: string;
  readonly databaseVersion: number;
  readonly storeName: string;
  readonly indexedDb: IDBFactory;
}

function getIndexedDbFactory(indexedDb: IDBFactory | null | undefined): IDBFactory {
  if (indexedDb === null) {
    throw new Error('IndexedDB is unavailable');
  }

  if (indexedDb) {
    return indexedDb;
  }

  if (typeof globalThis.indexedDB === 'undefined') {
    throw new Error('IndexedDB is unavailable');
  }

  return globalThis.indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

function openDatabase({
  databaseName,
  databaseVersion,
  storeName,
  indexedDb
}: OpenDatabaseOptions): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(storeName)
        ? request.transaction?.objectStore(storeName)
        : database.createObjectStore(storeName, { keyPath: 'draftId' });

      if (store && !store.indexNames.contains(MATCH_GROUP_INDEX_NAME)) {
        store.createIndex(MATCH_GROUP_INDEX_NAME, 'matchGroupId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function sortByUpdatedAtDescending(a: AddBetDraft, b: AddBetDraft): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function createIndexedDbAddBetDraftAdapter(
  options: IndexedDbAddBetDraftAdapterOptions = {}
): AddBetDraftPersistenceAdapter {
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  const databaseVersion = options.databaseVersion ?? DEFAULT_DATABASE_VERSION;
  const storeName = options.storeName ?? DEFAULT_STORE_NAME;

  async function withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const indexedDb = getIndexedDbFactory(options.indexedDb);
    const database = await openDatabase({
      databaseName,
      databaseVersion,
      storeName,
      indexedDb
    });

    try {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);
      const [result] = await Promise.all([requestToPromise(request), transactionDone(transaction)]);
      return result;
    } finally {
      database.close();
    }
  }

  async function saveDraft(draft: AddBetDraft): Promise<AddBetDraft> {
    const clonedDraft = cloneAddBetDraft(draft);
    await withStore('readwrite', (store) => store.put(clonedDraft));
    return cloneAddBetDraft(clonedDraft);
  }

  async function loadDraft(draftId: AddBetDraftId): Promise<AddBetDraft | null> {
    const draft = await withStore<AddBetDraft | undefined>('readonly', (store) => store.get(draftId));
    return draft ? cloneAddBetDraft(draft) : null;
  }

  async function listDraftsByMatch(matchGroupId: MatchGroupId): Promise<readonly AddBetDraft[]> {
    const drafts = await withStore<AddBetDraft[]>('readonly', (store) => {
      return store.index(MATCH_GROUP_INDEX_NAME).getAll(matchGroupId);
    });

    return drafts.sort(sortByUpdatedAtDescending).map(cloneAddBetDraft);
  }

  async function deleteDraft(draftId: AddBetDraftId): Promise<AddBetDraftPersistenceResult> {
    const existingDraft = await loadDraft(draftId);

    if (!existingDraft) {
      return {
        ok: false,
        errorCode: 'draft_not_found'
      };
    }

    await withStore('readwrite', (store) => store.delete(draftId));
    return { ok: true };
  }

  return {
    saveDraft,
    loadDraft,
    listDraftsByMatch,
    deleteDraft
  };
}
