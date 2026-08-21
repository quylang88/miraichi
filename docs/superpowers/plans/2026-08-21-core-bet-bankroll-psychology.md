# Core Bet Recording, Bankroll & Psychology Discipline Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete core betting workflow, 1-tap HK settlement, bankroll balance sync, anti-tilt discipline engine (stop loss, big bet warning, 15s cooldown), and weekly/monthly P&L analytics across 4 minimalist Black Apple OLED screens.

**Architecture:** TypeScript-first domain modules in `@miraichi/shared` for pure settlement math and contracts; frontend reactive services in `apps/web/src/services` for discipline checks, analytics aggregation, and state synchronization; minimalist high-contrast OLED dark components in `packages/ui` and `apps/web/src/components/app-shell.ts`.

**Tech Stack:** TypeScript, Node.js/pnpm, Vitest, Vanilla Web Component / DOM Shell, CSS Custom Properties (OLED Pure Black).

---

### Task 1: Domain Contracts & Settlement Math Calculator

**Files:**
- Create: `packages/shared/src/contracts/psychology-discipline-contracts.ts`
- Create: `packages/shared/src/contracts/psychology-discipline-contracts.test.ts`
- Create: `packages/shared/src/calculator/settlement-calculator.ts`
- Create: `packages/shared/src/calculator/settlement-calculator.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests for settlement math and discipline contracts**

```typescript
// packages/shared/src/calculator/settlement-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSettlementProfitLoss } from './settlement-calculator.js';

describe('calculateSettlementProfitLoss', () => {
  it('calculates Full Win with HK odds correctly (+stake * odds)', () => {
    // Stake: 100, Odds: 0.95 -> Profit = +95
    expect(calculateSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.95, settlementType: 'win' })).toBe(95);
  });

  it('calculates Half Win correctly (+(stake * odds) / 2)', () => {
    // Stake: 100, Odds: 0.90 -> Profit = +45
    expect(calculateSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.90, settlementType: 'half_win' })).toBe(45);
  });

  it('calculates Void / Push correctly (0 pts)', () => {
    expect(calculateSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.95, settlementType: 'void' })).toBe(0);
  });

  it('calculates Half Loss correctly (-stake / 2)', () => {
    expect(calculateSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.95, settlementType: 'half_loss' })).toBe(-50);
  });

  it('calculates Full Loss correctly (-stake)', () => {
    expect(calculateSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.95, settlementType: 'loss' })).toBe(-100);
  });

  it('calculates Cashout correctly (cashoutPoints - stake)', () => {
    expect(calculateSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.95, settlementType: 'cashout', cashoutPoints: 140 })).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @miraichi/shared test`
Expected: FAIL with missing module `settlement-calculator.js`.

- [ ] **Step 3: Implement discipline contracts and settlement calculator**

```typescript
// packages/shared/src/contracts/psychology-discipline-contracts.ts
export type SettlementType = 'win' | 'half_win' | 'void' | 'half_loss' | 'loss' | 'cashout';
export type PsychologyTag = 'analyzed' | 'favorite' | 'chasing_losses' | 'random_pick';

export interface DisciplineConfig {
  dailyStopLossPoints: number;
  weeklyStopLossPoints: number;
  baseUnitPoints: number;
  bigBetThresholdPoints: number;
  cooldownSeconds: number;
  requireAntiTiltCommit: boolean;
}

export const DEFAULT_DISCIPLINE_CONFIG: DisciplineConfig = Object.freeze({
  dailyStopLossPoints: 300,
  weeklyStopLossPoints: 1000,
  baseUnitPoints: 100,
  bigBetThresholdPoints: 250,
  cooldownSeconds: 15,
  requireAntiTiltCommit: true
});
```

```typescript
// packages/shared/src/calculator/settlement-calculator.ts
import type { SettlementType } from '../contracts/psychology-discipline-contracts.js';

export interface SettlementInput {
  readonly stakePoints: number;
  readonly oddsValue: number;
  readonly settlementType: SettlementType;
  readonly cashoutPoints?: number;
}

export function calculateSettlementProfitLoss(input: SettlementInput): number {
  const { stakePoints, oddsValue, settlementType, cashoutPoints } = input;
  switch (settlementType) {
    case 'win':
      return Number((stakePoints * oddsValue).toFixed(2));
    case 'half_win':
      return Number(((stakePoints * oddsValue) / 2).toFixed(2));
    case 'void':
      return 0;
    case 'half_loss':
      return Number((-stakePoints / 2).toFixed(2));
    case 'loss':
      return -stakePoints;
    case 'cashout':
      return Number(((cashoutPoints ?? stakePoints) - stakePoints).toFixed(2));
    default:
      return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @miraichi/shared test`
Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 2: Discipline State Engine & Anti-Tilt Cooldown Validator

**Files:**
- Create: `apps/web/src/services/discipline-service.ts`
- Create: `apps/web/src/services/discipline-service.test.ts`

- [ ] **Step 1: Write failing tests for discipline-service**

```typescript
// apps/web/src/services/discipline-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDisciplineService } from './discipline-service.js';
import { DEFAULT_DISCIPLINE_CONFIG } from '@miraichi/shared';

describe('DisciplineService', () => {
  it('evaluates normal stake as safe', () => {
    const service = createDisciplineService({ config: DEFAULT_DISCIPLINE_CONFIG });
    const check = service.evaluateBetAttempt({ stakePoints: 100, currentDailyLossPoints: 50 });
    expect(check.status).toBe('safe');
    expect(check.requiresCooldown).toBe(false);
  });

  it('triggers Big Bet warning when stake exceeds threshold', () => {
    const service = createDisciplineService({ config: DEFAULT_DISCIPLINE_CONFIG });
    const check = service.evaluateBetAttempt({ stakePoints: 300, currentDailyLossPoints: 50 });
    expect(check.status).toBe('warning_big_bet');
    expect(check.requiresCooldown).toBe(true);
  });

  it('triggers Stop Loss breached alert when daily loss >= limit', () => {
    const service = createDisciplineService({ config: DEFAULT_DISCIPLINE_CONFIG });
    const check = service.evaluateBetAttempt({ stakePoints: 50, currentDailyLossPoints: 320 });
    expect(check.status).toBe('breached_stop_loss');
    expect(check.requiresCooldown).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @miraichi/web test apps/web/src/services/discipline-service.test.ts`
Expected: FAIL with "module not found".

- [ ] **Step 3: Implement discipline-service**

```typescript
// apps/web/src/services/discipline-service.ts
import { DEFAULT_DISCIPLINE_CONFIG, type DisciplineConfig } from '@miraichi/shared';

export type BetAttemptStatus = 'safe' | 'warning_big_bet' | 'breached_stop_loss';

export interface BetAttemptEvaluation {
  readonly status: BetAttemptStatus;
  readonly requiresCooldown: boolean;
  readonly cooldownSeconds: number;
  readonly message: string;
}

export interface DisciplineService {
  getConfig(): DisciplineConfig;
  updateConfig(patch: Partial<DisciplineConfig>): DisciplineConfig;
  evaluateBetAttempt(params: { stakePoints: number; currentDailyLossPoints: number }): BetAttemptEvaluation;
}

export function createDisciplineService(options?: { config?: DisciplineConfig }): DisciplineService {
  let currentConfig: DisciplineConfig = { ...(options?.config ?? DEFAULT_DISCIPLINE_CONFIG) };

  return {
    getConfig: () => ({ ...currentConfig }),
    updateConfig: (patch) => {
      currentConfig = { ...currentConfig, ...patch };
      return { ...currentConfig };
    },
    evaluateBetAttempt: ({ stakePoints, currentDailyLossPoints }) => {
      if (currentDailyLossPoints >= currentConfig.dailyStopLossPoints) {
        return {
          status: 'breached_stop_loss',
          requiresCooldown: currentConfig.requireAntiTiltCommit,
          cooldownSeconds: currentConfig.cooldownSeconds,
          message: `Bạn đã chạm ngưỡng Stop Loss ngày (-${currentConfig.dailyStopLossPoints} pts). Hãy dừng lại để bảo toàn vốn!`
        };
      }
      if (stakePoints >= currentConfig.bigBetThresholdPoints) {
        return {
          status: 'warning_big_bet',
          requiresCooldown: currentConfig.requireAntiTiltCommit,
          cooldownSeconds: currentConfig.cooldownSeconds,
          message: `Cược ${stakePoints} pts vượt mức Big Bet an toàn (${currentConfig.bigBetThresholdPoints} pts). Bạn có đang all-in/gỡ gạc không?`
        };
      }
      return {
        status: 'safe',
        requiresCooldown: false,
        cooldownSeconds: 0,
        message: 'Kỷ luật an toàn.'
      };
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @miraichi/web test apps/web/src/services/discipline-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

---

### Task 3: Weekly & Monthly P&L Analytics Engine

**Files:**
- Create: `apps/web/src/services/pnl-analytics-service.ts`
- Create: `apps/web/src/services/pnl-analytics-service.test.ts`

- [ ] **Step 1: Write failing tests for analytics aggregation**

```typescript
// apps/web/src/services/pnl-analytics-service.test.ts
import { describe, it, expect } from 'vitest';
import { aggregatePnlAnalytics, type MinimalSettledBet } from './pnl-analytics-service.js';

describe('aggregatePnlAnalytics', () => {
  const sampleBets: MinimalSettledBet[] = [
    { betId: '1', stakePoints: 100, profitLossPoints: 95, settledAt: '2026-08-21T10:00:00Z', psychologyTag: 'analyzed' },
    { betId: '2', stakePoints: 100, profitLossPoints: -100, settledAt: '2026-08-21T12:00:00Z', psychologyTag: 'chasing_losses' },
    { betId: '3', stakePoints: 100, profitLossPoints: 90, settledAt: '2026-08-20T15:00:00Z', psychologyTag: 'analyzed' }
  ];

  it('aggregates total metrics correctly', () => {
    const summary = aggregatePnlAnalytics(sampleBets);
    expect(summary.totalProfitLossPoints).toBe(85); // 95 - 100 + 90
    expect(summary.totalBets).toBe(3);
    expect(summary.winCount).toBe(2);
    expect(summary.lossCount).toBe(1);
    expect(summary.winRatePercent).toBe(66.7);
  });

  it('aggregates psychology breakdown correctly', () => {
    const summary = aggregatePnlAnalytics(sampleBets);
    expect(summary.psychology['analyzed'].pnlPoints).toBe(185);
    expect(summary.psychology['analyzed'].count).toBe(2);
    expect(summary.psychology['chasing_losses'].pnlPoints).toBe(-100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @miraichi/web test apps/web/src/services/pnl-analytics-service.test.ts`
Expected: FAIL with "module not found".

- [ ] **Step 3: Implement pnl-analytics-service**

```typescript
// apps/web/src/services/pnl-analytics-service.ts
import type { PsychologyTag } from '@miraichi/shared';

export interface MinimalSettledBet {
  readonly betId: string;
  readonly stakePoints: number;
  readonly profitLossPoints: number;
  readonly settledAt: string;
  readonly psychologyTag?: PsychologyTag;
}

export interface PsychologyStats {
  pnlPoints: number;
  count: number;
  winCount: number;
  winRatePercent: number;
}

export interface DailyPnlItem {
  date: string;
  pnlPoints: number;
  count: number;
}

export interface PnlSummary {
  totalProfitLossPoints: number;
  totalBets: number;
  totalStakePoints: number;
  winCount: number;
  lossCount: number;
  voidCount: number;
  winRatePercent: number;
  yieldPercent: number;
  dailyBreakdown: DailyPnlItem[];
  psychology: Record<PsychologyTag, PsychologyStats>;
}

export function aggregatePnlAnalytics(bets: readonly MinimalSettledBet[]): PnlSummary {
  let totalPnl = 0;
  let totalStake = 0;
  let winCount = 0;
  let lossCount = 0;
  let voidCount = 0;

  const dailyMap = new Map<string, { pnl: number; count: number }>();
  const psychologyMap: Record<PsychologyTag, { pnl: number; count: number; win: number }> = {
    analyzed: { pnl: 0, count: 0, win: 0 },
    favorite: { pnl: 0, count: 0, win: 0 },
    chasing_losses: { pnl: 0, count: 0, win: 0 },
    random_pick: { pnl: 0, count: 0, win: 0 }
  };

  for (const bet of bets) {
    totalPnl += bet.profitLossPoints;
    totalStake += bet.stakePoints;
    if (bet.profitLossPoints > 0) winCount++;
    else if (bet.profitLossPoints < 0) lossCount++;
    else voidCount++;

    const dateKey = bet.settledAt.slice(0, 10);
    const day = dailyMap.get(dateKey) ?? { pnl: 0, count: 0 };
    day.pnl += bet.profitLossPoints;
    day.count += 1;
    dailyMap.set(dateKey, day);

    const tag: PsychologyTag = bet.psychologyTag ?? 'analyzed';
    if (psychologyMap[tag]) {
      psychologyMap[tag].pnl += bet.profitLossPoints;
      psychologyMap[tag].count += 1;
      if (bet.profitLossPoints > 0) psychologyMap[tag].win += 1;
    }
  }

  const psychology: Record<PsychologyTag, PsychologyStats> = {
    analyzed: {
      pnlPoints: Number(psychologyMap.analyzed.pnl.toFixed(2)),
      count: psychologyMap.analyzed.count,
      winCount: psychologyMap.analyzed.win,
      winRatePercent: psychologyMap.analyzed.count > 0 ? Number(((psychologyMap.analyzed.win / psychologyMap.analyzed.count) * 100).toFixed(1)) : 0
    },
    favorite: {
      pnlPoints: Number(psychologyMap.favorite.pnl.toFixed(2)),
      count: psychologyMap.favorite.count,
      winCount: psychologyMap.favorite.win,
      winRatePercent: psychologyMap.favorite.count > 0 ? Number(((psychologyMap.favorite.win / psychologyMap.favorite.count) * 100).toFixed(1)) : 0
    },
    chasing_losses: {
      pnlPoints: Number(psychologyMap.chasing_losses.pnl.toFixed(2)),
      count: psychologyMap.chasing_losses.count,
      winCount: psychologyMap.chasing_losses.win,
      winRatePercent: psychologyMap.chasing_losses.count > 0 ? Number(((psychologyMap.chasing_losses.win / psychologyMap.chasing_losses.count) * 100).toFixed(1)) : 0
    },
    random_pick: {
      pnlPoints: Number(psychologyMap.random_pick.pnl.toFixed(2)),
      count: psychologyMap.random_pick.count,
      winCount: psychologyMap.random_pick.win,
      winRatePercent: psychologyMap.random_pick.count > 0 ? Number(((psychologyMap.random_pick.win / psychologyMap.random_pick.count) * 100).toFixed(1)) : 0
    }
  };

  const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, item]) => ({
    date,
    pnlPoints: Number(item.pnl.toFixed(2)),
    count: item.count
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalProfitLossPoints: Number(totalPnl.toFixed(2)),
    totalBets: bets.length,
    totalStakePoints: Number(totalStake.toFixed(2)),
    winCount,
    lossCount,
    voidCount,
    winRatePercent: bets.length > 0 ? Number(((winCount / bets.length) * 100).toFixed(1)) : 0,
    yieldPercent: totalStake > 0 ? Number(((totalPnl / totalStake) * 100).toFixed(1)) : 0,
    dailyBreakdown,
    psychology
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @miraichi/web test apps/web/src/services/pnl-analytics-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

---

### Task 4: Bankroll & Bet Settlement State Sync Service

**Files:**
- Modify: `apps/web/src/services/bet-record-service.ts`
- Modify: `apps/web/src/services/bet-record-service.test.ts`
- Modify: `apps/web/src/services/bankroll-service.ts`
- Modify: `apps/web/src/services/bankroll-service.test.ts`

- [ ] **Step 1: Write failing tests for 1-tap settlement and balance calculation**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement settlement patch & bankroll recalculation**
- [ ] **Step 4: Run tests to verify pass**
- [ ] **Step 5: Commit (if auto_commit enabled)**

---

### Task 5: Refactor Web App UI (Black Apple OLED Minimalist Theme) Across 4 Screens

**Files:**
- Modify: `packages/ui/src/index.css`
- Modify: `apps/web/src/components/app-shell.ts`
- Modify: `apps/web/src/shell-entry.ts`
- Create: `apps/web/src/production-shell-psychology.test.ts`

- [ ] **Step 1: Write integration tests for the 4 OLED minimalist panels, settlement palette, and discipline modal**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement HTML/CSS updates and shell event wiring**
- [ ] **Step 4: Run all web unit & integration tests**
- [ ] **Step 5: Run full test suite (`pnpm test`) and boundary verification**
- [ ] **Step 6: Commit (if auto_commit enabled)**

---

## Verification Plan

### Automated Tests
- Unit tests: `pnpm test` (Runs shared math, services, analytics, discipline engine, and shell component tests).
- Boundary check: `pnpm run verify:product-boundary` (Ensures zero automated picks or unauthorized leaks).

### Manual Verification
- Launch local web app (`pnpm run dev:web`).
- Tab 1 `Today`: Check P&L gauge, Stop-loss utilization bar, Composure badge.
- Tab 2 `Matches`: Select match -> open Add Bet -> Test entering stake > Big Bet limit -> Verify 15s cooldown modal & composure checkbox.
- Tab 3 `Bets`: Test 1-tap settlement buttons (Win / Half Win / Loss / etc.) -> Verify instantaneous transition to Settled.
- Tab 4 `Bankroll`: Check Weekly/Monthly P&L charts, Win rate, Psychology breakdown, and Discipline configuration form.
