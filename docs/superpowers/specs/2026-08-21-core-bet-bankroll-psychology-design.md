# Core Bet Recording, Bankroll & Psychology Discipline Management Design Spec

- **Date**: 2026-08-21
- **Status**: Approved by Owner
- **Design Baseline**: Black Apple OLED Minimalist Ledger
- **Scope**: Screen-by-Screen Web UI Refinement, Core Bet Logging, Settlement, Bankroll Ledger Sync, Discipline / Anti-Tilt Rules, and Weekly/Monthly P&L Analytics.

---

## 1. Context & Objectives

External match feed crawling (OpenFootball) is temporarily pending to focus 100% on the core owner betting workflow and emotional discipline:
1. **Core Philosophy**: *"In gambling, psychology is the most critical factor; mastering psychology leads to long-term profitability."*
2. **Key Objectives**:
   - Refactor the 4 primary tabs (`Today`, `Matches`, `Bets`, `Bankroll`) into a clean, minimalist, high-contrast **Black Apple OLED Dark Mode** UI.
   - Provide fast, frictionless bet recording with mandatory pre-bet discipline checkpoints (size % check, psychology/reason tags).
   - 1-tap bet settlement (Full Win, Half Win, Void, Half Loss, Full Loss, Cashout) with automatic P&L calculation and instant Bankroll ledger synchronization.
   - Anti-All-in / Anti-Tilt enforcement: Daily/Weekly Stop Loss thresholds, Big Bet warnings, mandatory 15-second cooldown timer, and explicit composure commitment.
   - Comprehensive Weekly and Monthly P&L analytics with visual daily bar charts and psychological outcome breakdown (e.g. *Carefully Analyzed* vs *Chasing Losses / All-in*).

---

## 2. Screen-by-Screen UX & Visual Design

### 2.1 Tab 1: `Today` (Daily Discipline Command Center)
- **Top Header**: Current Date + Composure Badge (`🟢 Kỷ luật Chuẩn` / `🟡 Cảnh báo` / `🔴 Chạm Stop Loss`).
- **Stop Loss & P&L Gauge**:
  - Today's Net P&L (e.g., `+195.0 pts` in vibrant green or `-120.0 pts` in red).
  - Stop Loss limit (e.g., Max Loss `-300 pts / ngày`).
  - Sleek horizontal progress bar showing current loss utilization percentage.
- **Active / Ongoing Bets Today**:
  - Clean minimalist cards displaying upcoming/in-progress matches.
  - Teams, League, Kickoff time, Market & Selection, Stake points, Potential return.
- **Quick Action**: Prominent `+ Vào Kèo Nhanh` button triggering the Add Bet sheet.

### 2.2 Tab 2: `Matches` (Calendar & Match-Scoped Entry)
- **Date Ribbon Navigator**: Horizontal scroll chip list (Yesterday, Today, Tomorrow, specific dates) with native date picker button.
- **Minimalist Search & Filters**: Search box for team/league, filter by league or competition type.
- **Match Row**:
  - Left: Home vs Away team, Competition name.
  - Right: Kickoff time or Live/Final score.
- **Interaction**: Clicking a match expands details or directly opens the scoped `Add Bet` sheet pre-filled with the match context.

### 2.3 Tab 3: `Bets` (Bet Management & 1-Tap Settlement)
- **Segmented Filter**: `Đang chạy (Ongoing)` | `Đã xong (Settled)` | `Bản nháp (Drafts)`.
- **Minimalist Bet Card**:
  - Header: Competition · Timestamp · Status.
  - Body: Home vs Away · Market (Handicap, Over/Under, 1X2, Corners, Custom) · Selection @ Odds (HK).
  - Financials: Stake points · Potential Profit (`+95 pts`) or Settled P&L (`-100 pts`).
  - Psychology Tag: `🎯 Đã soi kỹ`, `🔥 Kèo sở trường`, `⚠️ Đang muốn gỡ`, `🎲 Đánh bừa`.
- **1-Tap Settlement Palette (When bet is ongoing)**:
  - Six instant action buttons: `Thắng Đủ (+100%)`, `Thắng Nửa (+50%)`, `Hòa (0)`, `Thua Nửa (-50%)`, `Thua Đủ (-100%)`, `Xả Kèo (Custom)`.
  - Immediate balance update upon selection + optional Post-Match Review field (Lessons Learned).

### 2.4 Tab 4: `Bankroll` (Capital, Analytics & Discipline Rules)
- **Capital Summary Hero**:
  - Current Available Balance (`pts`).
  - Total All-Time P&L (`+2,450 pts` · `+24.5%`).
- **Three Core Sub-Sections**:
  1. **📊 Thống Kê P&L (Analytics)**:
     - Time Filters: `Tuần này (W34)` | `Tháng này` | `Tháng trước` | `Tất cả`.
     - Key Metrics: Net P&L, Win Rate %, Total Bets Placed, Average Stake per Bet, Stop-Loss Compliance Rate.
     - Minimalist Daily P&L Bar Chart (Green = Profit day, Red = Loss day).
     - Behavioral & Psychology Breakdown: P&L and Win Rate grouped by psychology tags.
  2. **⚙️ Quy Tắc Kỷ Luật (Discipline Rules Config)**:
     - Daily Stop Loss (pts).
     - Weekly Stop Loss (pts).
     - Standard Base Unit (pts / % bankroll).
     - Big Bet Threshold (pts).
     - 15s Cooldown & Composure Check toggle.
  3. **📝 Sổ Cái (Ledger)**:
     - Manual Deposit, Withdrawal, and Correction ledger history.

---

## 3. Data Contracts & Schema Specification

### 3.1 Discipline Configuration (`DisciplineConfig`)
```typescript
export interface DisciplineConfig {
  dailyStopLossPoints: number;    // e.g. 300 pts
  weeklyStopLossPoints: number;   // e.g. 1000 pts
  baseUnitPoints: number;         // e.g. 100 pts (1 Unit)
  bigBetThresholdPoints: number;  // e.g. 250 pts (> 2.5 Units)
  cooldownSeconds: number;        // default 15
  requireAntiTiltCommit: boolean; // default true
}
```

### 3.2 Bet Record (`BetRecord`)
```typescript
export type MarketType = '1X2' | 'over_under' | 'handicap' | 'corners' | 'custom';
export type SettlementType = 'win' | 'half_win' | 'void' | 'half_loss' | 'loss' | 'cashout';
export type PsychologyTag = 'analyzed' | 'favorite' | 'chasing_losses' | 'random_pick';

export interface BetRecord {
  betId: string;
  ownerProfileId: string;
  matchGroupId: string;
  matchId?: string | null;
  homeTeamName: string;
  awayTeamName: string;
  competitionLabel?: string;
  marketType: MarketType;
  customMarketLabel?: string;
  selectionLabel: string;
  lineValue?: number | null;
  oddsFormat: 'HK';
  oddsValue: number;
  stakePoints: number;
  
  // Status & Settlement
  status: 'pending' | 'settled' | 'void';
  settlementType?: SettlementType;
  profitLossPoints?: number | null;
  
  // Psychology & Discipline
  psychologyTag?: PsychologyTag;
  disciplineWarningTriggered?: boolean;
  notes?: string;
  settlementNote?: string;
  
  createdAt: string;
  updatedAt: string;
  settledAt?: string;
}
```

---

## 4. Business Logic & Calculation Engine

### 4.1 Settlement Math (Hong Kong Odds Standard)
Given `stakePoints` $S$ and `oddsValue` $O$:
- **Full Win**: $\text{P\&L} = + (S \times O)$
- **Half Win**: $\text{P\&L} = + \frac{S \times O}{2}$
- **Void / Push**: $\text{P\&L} = 0$
- **Half Loss**: $\text{P\&L} = - \frac{S}{2}$
- **Full Loss**: $\text{P\&L} = - S$
- **Cashout**: $\text{P\&L} = \text{cashoutPoints} - S$

### 4.2 Bankroll Synchronization
$$\text{Current Balance} = \text{Opening Balance} + \sum(\text{Ledger Deposits/Withdrawals}) + \sum(\text{Settled Bets P\&L})$$

### 4.3 Anti-Tilt & Cooldown Workflow
1. When submitting a bet where `stakePoints >= bigBetThresholdPoints` OR `currentDailyLoss >= dailyStopLossPoints`:
   - System displays a high-contrast Red Modal: *"Bạn đang vượt ngưỡng an toàn / chạm Stop Loss!"*
   - A mandatory 15-second countdown initiates (`cooldownSeconds`).
   - The confirmation button remains disabled until the timer hits `0` AND the user checks: ☑ *"Tôi hoàn toàn tỉnh táo, đây là cược có tính toán chứ không phải all-in gỡ gạc."*

### 4.4 Analytics Aggregation
- **Daily P&L**: Sum of `profitLossPoints` for all bets with `settledAt` on the given date.
- **Weekly P&L (ISO Week)**: Aggregated P&L, Win/Loss/Void count, Win Rate %, 7-day daily breakdown.
- **Monthly P&L (YYYY-MM)**: Aggregated P&L, Win Rate %, daily breakdown.
- **Psychological Breakdown**: P&L and Win Rate grouped by `psychologyTag`.

---

## 5. Verification & Acceptance Criteria

1. **Automated Unit Tests**:
   - `settlement-calculator.test.ts`: Prove exact P&L formulas for Win, Half Win, Void, Half Loss, Full Loss, Cashout.
   - `analytics-aggregator.test.ts`: Prove weekly, monthly, and psychology aggregation.
   - `discipline-validator.test.ts`: Prove stop-loss detection, big-bet thresholding, and cooldown state machine.
   - `bankroll-sync.test.ts`: Prove bankroll balance correctly reflects settled bets and ledger entries.
2. **UI & Shell Verification**:
   - App shell renders all 4 tabs in Black Apple OLED Dark Mode.
   - 1-tap settlement correctly transitions bets from Ongoing to Settled.
   - Cooldown timer and anti-tilt modal appear when exceeding discipline limits.
   - Weekly/monthly charts and metrics update immediately when bets are settled.
