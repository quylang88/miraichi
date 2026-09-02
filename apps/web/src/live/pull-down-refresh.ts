export interface PullPoint {
  readonly clientX: number;
  readonly clientY: number;
}

export interface PullDownRefreshController {
  touchStart(point: PullPoint): void;
  touchMove(point: PullPoint): boolean;
  touchEnd(): void;
}

export function createPullDownRefreshController(options: {
  readonly getScrollTop: () => number;
  readonly onRefresh: () => void;
  readonly thresholdPx?: number;
  readonly onProgress?: (progress: number) => void;
}): PullDownRefreshController {
  const threshold = options.thresholdPx ?? 72;
  let start: PullPoint | null = null;
  let triggered = false;

  const reset = () => {
    start = null;
    triggered = false;
    options.onProgress?.(0);
  };

  return {
    touchStart(point) {
      reset();
      if (options.getScrollTop() <= 0) start = point;
    },
    touchMove(point) {
      if (!start || options.getScrollTop() > 0) return false;
      const deltaX = point.clientX - start.clientX;
      const deltaY = point.clientY - start.clientY;
      if (deltaY <= 0 || Math.abs(deltaX) >= deltaY) {
        options.onProgress?.(0);
        return false;
      }
      options.onProgress?.(Math.min(1, deltaY / threshold));
      if (!triggered && deltaY >= threshold) {
        triggered = true;
        options.onRefresh();
      }
      return triggered;
    },
    touchEnd: reset
  };
}

export function bindPullDownRefresh(
  element: HTMLElement,
  options: Omit<Parameters<typeof createPullDownRefreshController>[0], 'getScrollTop'>
): () => void {
  const controller = createPullDownRefreshController({
    ...options,
    getScrollTop: () => element.scrollTop
  });
  const start = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) controller.touchStart(touch);
  };
  const move = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch && controller.touchMove(touch)) event.preventDefault();
  };
  const end = () => controller.touchEnd();
  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('touchmove', move, { passive: false });
  element.addEventListener('touchend', end, { passive: true });
  element.addEventListener('touchcancel', end, { passive: true });
  return () => {
    element.removeEventListener('touchstart', start);
    element.removeEventListener('touchmove', move);
    element.removeEventListener('touchend', end);
    element.removeEventListener('touchcancel', end);
  };
}
