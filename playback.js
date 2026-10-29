export const speeds = [1, 2, 4, 8]         ;
export function yearDuration(speed        )         {
  if (!speeds.includes(speed     )) throw new Error("Invalid playback speed");
  return 45000 / speed;
}
                       
                    
                                                                              
                                                         
 
const TICK = 250;
/** Longest stretch one tick may count; a blocked or backgrounded page never catches up on missed time. */
const MAX_STEP = 1000;
/** Year clock. Progress through the current year (0–1) only grows while `canRun` holds, a tick counts at most
 * one second, and a tick ends at most one year. The app reveals the year's beats as progress passes them. */
export function createYearClock(
  canRun               ,
  onTick                            ,
  onYearEnd            ,
  driver              = {
    now: () => globalThis.performance.now(),
    // Browser timer methods require the Window receiver; never alias them onto the driver.
    set: (callback, delay) => globalThis.setTimeout(callback, delay),
    clear: (handle) => globalThis.clearTimeout(handle),
  },
) {
  let handle                                           ;
  let last = 0;
  let speed = 1;
  let progress = 0;
  function tick() {
    handle = undefined;
    if (!canRun()) return;
    const now = driver.now();
    progress = Math.min(1, progress + Math.min(MAX_STEP, Math.max(0, now - last)) / yearDuration(speed));
    last = now;
    // Deliver every crossed beat (including settlement) before attempting a turn.
    onTick(progress);
    if (progress >= 1 && canRun()) {
      progress = 0;
      onYearEnd();
    }
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
    sync(nextSpeed        ) {
      yearDuration(nextSpeed);
      speed = nextSpeed;
      if (!canRun()) return stop();
      if (handle === undefined) {
        last = driver.now();
        handle = driver.set(tick, TICK);
      }
    },
    /** Continuing keeps the exact year position; already revealed beats never move backwards. */
    resume(floor = 0) {
      progress = Math.max(progress, Math.min(floor, 1));
    },
    get progress() {
      return progress;
    },
    set progress(value        ) {
      progress = Math.max(0, Math.min(1, value));
    },
  };
}
/** Month of a beat → share of the year at which it appears. Month 1 shows at once. */
export const beatAt = (month        ) => (Math.max(1, Math.min(12, month)) - 1) / 12;
/** Share of the year at which the year-end summary appears. */
export const summaryAt = 11.5 / 12;

/** A settlement must get a full visible interval after returning from a blocking panel. */
export function createTurnTimer(
  canTurn               ,
  turn            ,
  delay        ,
  driver                                     = {
    set: (callback, ms) => globalThis.setTimeout(callback, ms),
    clear: handle => globalThis.clearTimeout(handle),
  },
) {
  let handle                                           ;
  function stop() {
    if (handle !== undefined) driver.clear(handle);
    handle = undefined;
  }
  return {
    stop,
    sync() {
      if (!canTurn()) return stop();
      if (handle !== undefined) return;
      handle = driver.set(() => {
        handle = undefined;
        if (canTurn()) turn();
      }, delay);
    },
  };
}
