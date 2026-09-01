import type { BankrollAccount, DisciplineConfig } from '@miraichi/shared';
import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';

export const PRIMARY_BANKROLL_ACCOUNT_ID = 'bankroll-primary';

export class SingleBankrollError extends Error {
  constructor(readonly code: 'bankroll_setup_required' | 'multiple_bankroll_accounts' | 'bankroll_setup_conflict', message: string) {
    super(message);
  }
}

export async function resolveSingleActiveBankroll(adapter: CloudPersistenceAdapter, ownerProfileId: string): Promise<BankrollAccount> {
  const active = (await adapter.listBankrollAccounts(ownerProfileId)).filter((account) => !account.archived);
  if (active.length === 0) throw new SingleBankrollError('bankroll_setup_required', 'Set opening bankroll before recording bets.');
  if (active.length > 1) throw new SingleBankrollError('multiple_bankroll_accounts', 'Multiple active bankroll accounts require explicit compatibility review.');
  return active[0]!;
}

export async function setupSingleBankroll(input: {
  readonly adapter: CloudPersistenceAdapter;
  readonly ownerProfileId: string;
  readonly openingBalancePoints: number;
  readonly timeZone: string;
  readonly weekStartDay: 'monday' | 'sunday';
  readonly now: string;
}): Promise<{ readonly created: boolean; readonly account: BankrollAccount; readonly disciplineConfig: DisciplineConfig }> {
  const { adapter, ownerProfileId } = input;
  const existingAccounts = await adapter.listBankrollAccounts(ownerProfileId);
  const active = existingAccounts.filter((account) => !account.archived);
  if (active.length > 1) throw new SingleBankrollError('multiple_bankroll_accounts', 'Multiple active bankroll accounts require explicit compatibility review.');
  if (active.length === 0 && existingAccounts.length > 0) throw new SingleBankrollError('bankroll_setup_conflict', 'Archived bankroll history requires explicit compatibility review.');

  let created = false;
  let account = active[0];
  if (!account) {
    try {
      account = await adapter.createBankrollAccount({
        accountId: PRIMARY_BANKROLL_ACCOUNT_ID,
        ownerProfileId,
        label: 'Main',
        openingBalancePoints: input.openingBalancePoints
      });
      created = true;
    } catch (error) {
      const afterRace = (await adapter.listBankrollAccounts(ownerProfileId)).filter((item) => !item.archived);
      if (afterRace.length !== 1) throw error;
      account = afterRace[0]!;
    }
  }

  let disciplineConfig = await adapter.getDisciplineConfig(ownerProfileId);
  if (!disciplineConfig) {
    disciplineConfig = await adapter.upsertDisciplineConfig({
      ownerProfileId,
      dailyStopLossPoints: null,
      weeklyStopLossPoints: null,
      bigBetThresholdPoints: null,
      timeZone: input.timeZone,
      weekStartDay: input.weekStartDay,
      cooldownSeconds: 15,
      version: 1,
      updatedAt: input.now
    });
  }
  return { created, account, disciplineConfig };
}
