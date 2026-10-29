export const speeds = [1, 2, 4] as const;
export function yearDuration(speed: number): number {
  if (!speeds.includes(speed as 1)) throw new Error("Invalid playback speed");
  return 45000 / speed;
}
interface ClockDriver {
  now: () => number;
  set: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clear: (handle: ReturnType<typeof setTimeout>) => void;
}
const TICK = 250;
/** Longest stretch one tick may count; a blocked or backgrounded page never catches up on missed time. */
const MAX_STEP = 1000;
/** Year clock. Progress through the current year (0–1) only grows while `canRun` holds, a tick counts at most
 * one second, and a tick ends at most one year. The app reveals the year's beats as progress passes them. */
export function createYearClock(
  canRun: () => boolean,
  onTick: (progress: number) => void,
  onYearEnd: () => void,
  driver: ClockDriver = {
    now: () => globalThis.performance.now(),
    // Browser timer methods require the Window receiver; never alias them onto the driver.
    set: (callback, delay) => globalThis.setTimeout(callback, delay),
    clear: (handle) => globalThis.clearTimeout(handle),
  },
) {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let last = 0;
  let speed = 1;
  let progress = 0;
  function tick() {
    handle = undefined;
    if (!canRun()) return;
    const now = driver.now();
    progress += Math.min(MAX_STEP, Math.max(0, now - last)) / yearDuration(speed);
    last = now;
    if (progress >= 1) {
      progress = 0;
      onYearEnd();
    } else onTick(progress);
    // A callback may already have restarted the clock through `sync`; never run two timers.
    if (canRun() && handle === undefined) {
      last = driver.now();
      handle = driver.set(tick, TICK);
    }
  }
  function stop() {
    if (handle !== undefined) driver.clear(handle);
    handle = undefined;
  }
  return {
    stop,
    /** Starts or keeps running at `nextSpeed`; does nothing while `canRun` is false. */
    sync(nextSpeed: number) {
      yearDuration(nextSpeed);
      speed = nextSpeed;
      if (!canRun()) return stop();
      if (handle === undefined) {
        last = driver.now();
        handle = driver.set(tick, TICK);
      }
    },
    /** Continuing after a pause keeps the year's progress but leaves at least a quarter of the year, without
     * stepping back past `floor`: whatever the year has already shown stays shown. */
    resume(floor = 0) {
      progress = Math.max(Math.min(floor, 1), Math.min(progress, 0.75));
    },
    get progress() {
      return progress;
    },
    set progress(value: number) {
      progress = Math.max(0, Math.min(1, value));
    },
  };
}
/** Month of a beat → share of the year at which it appears. Month 1 shows at once. */
export const beatAt = (month: number) => (Math.max(1, Math.min(12, month)) - 1) / 12;
/** Share of the year at which the year-end summary appears. */
export const summaryAt = 11.5 / 12;
