import {
  declaresStructuredBetSelection,
  deriveRunningOver,
  formatStructuredSelectionLabel,
  validateStructuredBetSelection,
  type StructuredBetSelection
} from '@miraichi/shared';

type NormalizedPayloadResult =
  | { readonly ok: true; readonly payload: Record<string, unknown> }
  | { readonly ok: false; readonly errors: readonly string[] };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeDeclaredStructuredBetPayload(
  payload: Record<string, unknown>
): NormalizedPayloadResult {
  if (!declaresStructuredBetSelection(payload)) {
    return { ok: false, errors: ['structured selection fields are required'] };
  }
  const validation = validateStructuredBetSelection(payload);
  if (!validation.ok) return validation;
  if (!hasText(payload.homeTeamName) || !hasText(payload.awayTeamName)) {
    return { ok: false, errors: ['homeTeamName and awayTeamName are required for structured selections'] };
  }
  const derived = payload.marketType === 'running'
    ? deriveRunningOver(payload as unknown as StructuredBetSelection) : null;
  const canonical = derived ? { ...payload, ...derived } : payload;
  return {
    ok: true,
    payload: {
      ...canonical,
      selectionLabel: formatStructuredSelectionLabel(canonical as unknown as StructuredBetSelection, {
        homeTeamName: payload.homeTeamName.trim(),
        awayTeamName: payload.awayTeamName.trim()
      })
    }
  };
}
