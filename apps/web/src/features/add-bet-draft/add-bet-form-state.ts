import type {
  AddBetDraftFieldName,
  AddBetFormState,
  IsoDateTimeString
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';

function appendUnique<T extends string>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value) ? values : [...values, value];
}

function omitField<T extends string>(
  values: Readonly<Partial<Record<T, string>>>,
  fieldName: T
): Readonly<Partial<Record<T, string>>> {
  const nextValues = { ...values };
  delete nextValues[fieldName];
  return nextValues;
}

export function createInitialAddBetFormState(): AddBetFormState {
  return {
    activeStep: 'add',
    dirtyFields: [],
    touchedFields: [],
    warnings: {},
    blockingErrors: {},
    reviewReady: false,
    lastSavedAt: null
  };
}

export function markDraftFieldTouched(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName
): AddBetFormState {
  return {
    ...state,
    touchedFields: appendUnique(state.touchedFields, fieldName)
  };
}

export function markDraftFieldDirty(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName
): AddBetFormState {
  return {
    ...state,
    dirtyFields: appendUnique(state.dirtyFields, fieldName)
  };
}

export function setDraftWarning(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName,
  message: string
): AddBetFormState {
  return {
    ...state,
    warnings: {
      ...state.warnings,
      [fieldName]: message
    }
  };
}

export function setDraftBlockingError(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName,
  message: string
): AddBetFormState {
  return {
    ...state,
    blockingErrors: {
      ...state.blockingErrors,
      [fieldName]: message
    },
    reviewReady: false
  };
}

export function clearDraftBlockingError(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName
): AddBetFormState {
  return {
    ...state,
    blockingErrors: omitField(state.blockingErrors, fieldName)
  };
}

export function setDraftReviewReady(state: AddBetFormState, reviewReady: boolean): AddBetFormState {
  return {
    ...state,
    reviewReady
  };
}

export function setDraftLastSavedAt(
  state: AddBetFormState,
  lastSavedAt: IsoDateTimeString | null
): AddBetFormState {
  return {
    ...state,
    lastSavedAt
  };
}
