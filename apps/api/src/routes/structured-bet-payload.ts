import {
  declaresStructuredBetSelection,
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
  if (!declaresStructuredBetSelection(payload)) return { ok: true, payload };
  const validation = validateStructuredBetSelection(payload);
  if (!validation.ok) return validation;
  if (!hasText(payload.homeTeamName) || !hasText(payload.awayTeamName)) {
    return { ok: false, errors: ['homeTeamName and awayTeamName are required for structured selections'] };
  }
  return {
    ok: true,
    payload: {
      ...payload,
      selectionLabel: formatStructuredSelectionLabel(payload as unknown as StructuredBetSelection, {
        homeTeamName: payload.homeTeamName.trim(),
        awayTeamName: payload.awayTeamName.trim()
      })
    }
  };
}
