import { describe, expect, it, vi } from 'vitest';
import { createPullDownRefreshController } from './pull-down-refresh.js';

describe('pull-down refresh gesture', () => {
  it('fires once after a vertical threshold gesture starting at scroll top', () => {
    const refresh = vi.fn();
    const controller = createPullDownRefreshController({ getScrollTop: () => 0, onRefresh: refresh, thresholdPx: 72 });
    controller.touchStart({ clientX: 10, clientY: 100 });
    expect(controller.touchMove({ clientX: 14, clientY: 150 })).toBe(false);
    expect(controller.touchMove({ clientX: 15, clientY: 175 })).toBe(true);
    expect(controller.touchMove({ clientX: 15, clientY: 200 })).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    controller.touchEnd();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ignores gestures when canPull returns false', () => {
    const refresh = vi.fn();
    const controller = createPullDownRefreshController({
      getScrollTop: () => 0,
      onRefresh: refresh,
      thresholdPx: 72,
      canPull: () => false
    });
    controller.touchStart({ clientX: 10, clientY: 100 });
    expect(controller.touchMove({ clientX: 10, clientY: 200 })).toBe(false);
    controller.touchEnd();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores gestures away from the top, upward drags, and horizontal swipes', () => {
    const refresh = vi.fn();
    let scrollTop = 5;
    const controller = createPullDownRefreshController({ getScrollTop: () => scrollTop, onRefresh: refresh });
    controller.touchStart({ clientX: 10, clientY: 100 });
    controller.touchMove({ clientX: 10, clientY: 200 });
    scrollTop = 0;
    controller.touchStart({ clientX: 10, clientY: 100 });
    controller.touchMove({ clientX: 10, clientY: 20 });
    controller.touchEnd();
    controller.touchStart({ clientX: 10, clientY: 100 });
    controller.touchMove({ clientX: 120, clientY: 180 });
    controller.touchEnd();
    expect(refresh).not.toHaveBeenCalled();
  });
});
