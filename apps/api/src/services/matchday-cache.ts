export type CacheStatus = 'hit' | 'miss' | 'disabled';

export type DailyQuotaSnapshot = {
  dailyLimit: number;
  consumedToday: number;
  remainingToday: number;
};

type Clock = () => Date;

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createMatchdayCache<T>({
  ttlSeconds,
  now = () => new Date()
}: {
  ttlSeconds: number;
  now?: Clock;
}) {
  const entries = new Map<string, { expiresAtMs: number; value: T }>();

  return {
    get(key: string): T | null {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAtMs <= now().getTime()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key: string, value: T): void {
      entries.set(key, {
        value,
        expiresAtMs: now().getTime() + ttlSeconds * 1000
      });
    },
    clear(): void {
      entries.clear();
    }
  };
}

export function createDailyQuotaGuard({
  dailyLimit,
  now = () => new Date()
}: {
  dailyLimit: number;
  now?: Clock;
}) {
  let activeDay = utcDay(now());
  let consumedToday = 0;

  function resetIfNeeded(): void {
    const currentDay = utcDay(now());
    if (currentDay !== activeDay) {
      activeDay = currentDay;
      consumedToday = 0;
    }
  }

  function snapshot(): DailyQuotaSnapshot {
    resetIfNeeded();
    return {
      dailyLimit,
      consumedToday,
      remainingToday: Math.max(0, dailyLimit - consumedToday)
    };
  }

  return {
    snapshot,
    tryConsume(): { allowed: boolean; snapshot: DailyQuotaSnapshot } {
      resetIfNeeded();
      if (consumedToday >= dailyLimit) {
        return { allowed: false, snapshot: snapshot() };
      }
      consumedToday += 1;
      return { allowed: true, snapshot: snapshot() };
    }
  };
}
