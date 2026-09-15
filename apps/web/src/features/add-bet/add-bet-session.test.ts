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
  it('clears every field, feedback, validation state, and team locks', () => {
    const target = elements();
    target.homeTeam.readOnly = true;
    target.awayTeam.readOnly = true;

    resetAddBetForm(target);

    expect(target.controls.every((control) => control.value === '')).toBe(true);
    expect(target.feedback.textContent).toBe('');
    expect(target.homeTeam.readOnly).toBe(false);
    expect(target.awayTeam.readOnly).toBe(false);
  });

  it('never carries scoped state into manual or quick sessions and only edit identifies a draft', () => {
    const target = elements();
    const scoped = startAddBetSession('scoped', {
      matchId: 'match-1', matchTitle: 'Japan vs Vietnam', homeTeamName: 'Japan', awayTeamName: 'Vietnam'
    }, target);
    expect(scoped).toEqual({ mode: 'scoped', matchId: 'match-1', matchTitle: 'Japan vs Vietnam', editingDraftId: null });
    expect(target.homeTeam).toMatchObject({ value: 'Japan', readOnly: true });
    expect(target.awayTeam).toMatchObject({ value: 'Vietnam', readOnly: true });

    const manual = startAddBetSession('manual', {}, target);
    expect(manual).toEqual({ mode: 'manual', matchId: '', matchTitle: '', editingDraftId: null });
    expect(target.homeTeam).toMatchObject({ value: '', readOnly: false });
    expect(target.awayTeam).toMatchObject({ value: '', readOnly: false });

    target.controls[3]!.value = 'cached-again';
    expect(startAddBetSession('quick', {}, target).matchId).toBe('');
    expect(target.controls[3]!.value).toBe('');
    expect(startAddBetSession('edit', { draftId: 'draft-1' }, target).editingDraftId).toBe('draft-1');
  });
});
