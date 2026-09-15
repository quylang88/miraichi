export type AddBetSessionMode = 'scoped' | 'edit';

interface ResettableForm {
  reset(): void;
}

interface ResettableControl {
  value: string;
  removeAttribute(name: string): void;
  setCustomValidity?(message: string): void;
}

interface TeamControl extends ResettableControl {
  readOnly: boolean;
  setAttribute?(name: string, value: string): void;
}

export interface AddBetFormElements {
  readonly form: ResettableForm;
  readonly controls: readonly ResettableControl[];
  readonly homeTeam: TeamControl;
  readonly awayTeam: TeamControl;
  readonly feedback: { textContent: string | null };
}

export interface AddBetSessionContext {
  readonly matchId?: string;
  readonly matchTitle?: string;
  readonly homeTeamName?: string;
  readonly awayTeamName?: string;
  readonly draftId?: string;
}

export interface AddBetSessionState {
  readonly mode: AddBetSessionMode;
  readonly matchId: string;
  readonly matchTitle: string;
  readonly editingDraftId: string | null;
}

function setTeamLock(control: TeamControl, locked: boolean): void {
  control.readOnly = locked;
  if (locked) control.setAttribute?.('aria-readonly', 'true');
  else control.removeAttribute('aria-readonly');
}

export function resetAddBetForm(elements: AddBetFormElements): void {
  elements.form.reset();
  for (const control of elements.controls) {
    control.setCustomValidity?.('');
    control.removeAttribute('aria-invalid');
    control.removeAttribute('data-validation-error');
  }
  setTeamLock(elements.homeTeam, true);
  setTeamLock(elements.awayTeam, true);
  elements.feedback.textContent = '';
}

export function startAddBetSession(
  mode: AddBetSessionMode,
  context: AddBetSessionContext,
  elements: AddBetFormElements
): AddBetSessionState {
  resetAddBetForm(elements);
  if (mode === 'scoped') {
    elements.homeTeam.value = context.homeTeamName ?? '';
    elements.awayTeam.value = context.awayTeamName ?? '';
    setTeamLock(elements.homeTeam, true);
    setTeamLock(elements.awayTeam, true);
  }
  return {
    mode,
    matchId: context.matchId ?? '',
    matchTitle: mode === 'scoped' ? context.matchTitle ?? '' : '',
    editingDraftId: mode === 'edit' ? context.draftId ?? null : null
  };
}
