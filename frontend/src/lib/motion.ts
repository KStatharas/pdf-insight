import { useEffect, useState } from 'react';

/** True when the visitor asked the system for less motion (or the environment cannot tell). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts from 0 up to `target` once, for amounts appearing on screen. Shows the final value
 * immediately when motion is reduced (and in environments without animation frames, e.g. tests).
 */
export function useCountUp(target: number, durationMs = 900, delayMs = 0): number {
  const [value, setValue] = useState(() =>
    prefersReducedMotion() || typeof requestAnimationFrame !== 'function' ? target : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number): void => {
      start ??= now + delayMs;
      const progress = Math.min(1, Math.max(0, (now - start) / durationMs));
      // Ease-out cubic: fast start, gentle landing.
      const eased = 1 - (1 - progress) ** 3;
      setValue(progress >= 1 ? target : target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, delayMs]);

  return value;
}
