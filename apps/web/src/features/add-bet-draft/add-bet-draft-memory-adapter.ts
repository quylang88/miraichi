import type {
  AddBetDraft,
  AddBetDraftId,
  AddBetDraftPersistenceAdapter,
  AddBetDraftPersistenceResult,
  MatchGroupId
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { cloneAddBetDraft } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';

function sortByUpdatedAtDescending(a: AddBetDraft, b: AddBetDraft): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function createMemoryAddBetDraftAdapter(
  initialDrafts: readonly AddBetDraft[] = []
): AddBetDraftPersistenceAdapter {
  const drafts = new Map<AddBetDraftId, AddBetDraft>();

  initialDrafts.forEach((draft) => {
    drafts.set(draft.draftId, cloneAddBetDraft(draft));
  });

  return {
    async saveDraft(draft: AddBetDraft): Promise<AddBetDraft> {
      const clonedDraft = cloneAddBetDraft(draft);
      drafts.set(clonedDraft.draftId, clonedDraft);
      return cloneAddBetDraft(clonedDraft);
    },

    async loadDraft(draftId: AddBetDraftId): Promise<AddBetDraft | null> {
      const draft = drafts.get(draftId);
      return draft ? cloneAddBetDraft(draft) : null;
    },

    async listDraftsByMatch(matchGroupId: MatchGroupId): Promise<readonly AddBetDraft[]> {
      return Array.from(drafts.values())
        .filter((draft) => draft.matchGroupId === matchGroupId)
        .sort(sortByUpdatedAtDescending)
        .map(cloneAddBetDraft);
    },

    async deleteDraft(draftId: AddBetDraftId): Promise<AddBetDraftPersistenceResult> {
      if (!drafts.has(draftId)) {
        return {
          ok: false,
          errorCode: 'draft_not_found'
        };
      }

      drafts.delete(draftId);
      return { ok: true };
    }
  };
}
