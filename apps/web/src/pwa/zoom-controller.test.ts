import { describe, expect, it, vi } from 'vitest';
import { installApplicationZoomConstraints } from './zoom-controller.js';

class FakeEventTarget {
  readonly listeners = new Map<string, { listener: EventListener; options: AddEventListenerOptions | boolean | undefined }>();

  addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions | boolean) {
    this.listeners.set(type, { listener, options });
  }

  removeEventListener(type: string) {
    this.listeners.delete(type);
  }

  dispatch(type: string, target: EventTarget = this as unknown as EventTarget) {
    const event = { preventDefault: vi.fn(), target } as unknown as Event;
    this.listeners.get(type)?.listener(event);
    return event.preventDefault as ReturnType<typeof vi.fn>;
  }
}

describe('PWA zoom constraints', () => {
  it('prevents Safari gesture events with non-passive listeners and cleans them up', () => {
    const target = new FakeEventTarget();
    const cleanup = installApplicationZoomConstraints(target, () => 1_000);
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      expect(target.listeners.get(type)?.options).toMatchObject({ passive: false });
      expect(target.dispatch(type)).toHaveBeenCalledOnce();
    }
    cleanup();
    expect(target.listeners.size).toBe(0);
  });

  it('allows one tap but prevents a rapid second touch end', () => {
    let now = 1_000;
    const target = new FakeEventTarget();
    installApplicationZoomConstraints(target, () => now);
    expect(target.listeners.get('touchend')?.options).toMatchObject({ passive: false });
    expect(target.dispatch('touchend')).not.toHaveBeenCalled();
    now += 250;
    expect(target.dispatch('touchend')).toHaveBeenCalledOnce();
    now += 400;
    expect(target.dispatch('touchend')).not.toHaveBeenCalled();
  });

  it('does not swallow rapid taps on two different controls', () => {
    let now = 1_000;
    const target = new FakeEventTarget();
    installApplicationZoomConstraints(target, () => now);
    expect(target.dispatch('touchend', {} as EventTarget)).not.toHaveBeenCalled();
    now += 100;
    expect(target.dispatch('touchend', {} as EventTarget)).not.toHaveBeenCalled();
  });
});
