import { describe, expect, it, vi } from 'vitest';
import { resetAddBetForm, startAddBetSession, type AddBetFormElements } from './add-bet-session.js';

function elements(): AddBetFormElements & { readonly controls: Array<{ value: string; readOnly: boolean }> } {
  const controls = Array.from({ length: 7 }, () => ({
    value: 'cached', readOnly: false, removeAttribute: vi.fn(), setCustomValidity: vi.fn()
  }));
  const form = { reset: vi.fn(() => controls.forEach((control) => { control.value = ''; })) };
  return {
    form,
    controls,
    homeTeam: controls[0]!,
    awayTeam: controls[1]!,
    feedback: { textContent: 'old validation' }
  } as unknown as AddBetFormElements & { readonly controls: Array<{ value: string; readOnly: boolean }> };
}

describe('Add Bet session isolation', () => {
  it('clears every field, feedback and validation while keeping team names locked', () => {
    const target = elements();
    target.homeTeam.readOnly = true;
    target.awayTeam.readOnly = true;

    resetAddBetForm(target);

    expect(target.controls.every((control) => control.value === '')).toBe(true);
    expect(target.feedback.textContent).toBe('');
    expect(target.homeTeam.readOnly).toBe(true);
    expect(target.awayTeam.readOnly).toBe(true);
  });

  it('locks selected canonical teams and locks legacy draft teams without carrying scoped state', () => {
    const target = elements();
    const scoped = startAddBetSession('scoped', {
      matchId: 'match-1', matchTitle: 'Japan vs Vietnam', homeTeamName: 'Japan', awayTeamName: 'Vietnam'
    }, target);
    expect(scoped).toEqual({ mode: 'scoped', matchId: 'match-1', matchTitle: 'Japan vs Vietnam', editingDraftId: null });
    expect(target.homeTeam).toMatchObject({ value: 'Japan', readOnly: true });
    expect(target.awayTeam).toMatchObject({ value: 'Vietnam', readOnly: true });

    target.controls[3]!.value = 'cached-again';
    const edit = startAddBetSession('edit', { draftId: 'draft-1' }, target);
    expect(edit).toEqual({ mode: 'edit', matchId: '', matchTitle: '', editingDraftId: 'draft-1' });
    expect(target.homeTeam).toMatchObject({ value: '', readOnly: true });
    expect(target.awayTeam).toMatchObject({ value: '', readOnly: true });
    expect(target.controls[3]!.value).toBe('');

    expect(startAddBetSession('edit', { draftId: 'linked', matchId: 'match-1' }, target).matchId).toBe('match-1');
  });
});
