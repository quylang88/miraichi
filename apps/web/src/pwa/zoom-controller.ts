export interface ZoomConstraintTarget {
  addEventListener(type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListener, options?: boolean | EventListenerOptions): void;
}

const SAFARI_GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const;
const DOUBLE_TAP_WINDOW_MS = 300;

export function installApplicationZoomConstraints(
  target: ZoomConstraintTarget = document,
  now: () => number = Date.now
): () => void {
  const listenerOptions = { passive: false } as const;
  const preventGesture: EventListener = (event) => event.preventDefault();
  let previousTouchEnd: number | null = null;
  let previousTouchTarget: EventTarget | null = null;
  const preventDoubleTap: EventListener = (event) => {
    const currentTouchEnd = now();
    if (previousTouchEnd !== null
      && event.target === previousTouchTarget
      && currentTouchEnd - previousTouchEnd <= DOUBLE_TAP_WINDOW_MS) {
      event.preventDefault();
    }
    previousTouchEnd = currentTouchEnd;
    previousTouchTarget = event.target;
  };

  for (const eventName of SAFARI_GESTURE_EVENTS) {
    target.addEventListener(eventName, preventGesture, listenerOptions);
  }
  target.addEventListener('touchend', preventDoubleTap, listenerOptions);

  return () => {
    for (const eventName of SAFARI_GESTURE_EVENTS) {
      target.removeEventListener(eventName, preventGesture);
    }
    target.removeEventListener('touchend', preventDoubleTap);
  };
}
