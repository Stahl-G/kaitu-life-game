import assert from "node:assert/strict";
import { test } from "node:test";
import { beatAt, createTurnTimer, createYearClock, summaryAt, yearDuration } from "../dist/playback.js";

function fakeDriver() {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  return {
    tasks,
    driver: {
      now: () => now,
      set(callback, delay) {
        const handle = ++id;
        tasks.set(handle, { callback, due: now + delay });
        return handle;
      },
      clear(handle) {
        tasks.delete(handle);
      },
    },
    /** Advances time in timer-sized steps, firing due callbacks in order. */
    advance(ms, step = 250) {
      for (let left = ms; left > 0; left -= step) {
        now += Math.min(step, left);
        for (const [handle, task] of [...tasks])
          if (task.due <= now) {
            tasks.delete(handle);
            task.callback();
          }
      }
    },
    /** A blocked main thread: the clock jumps without any callback running. */
    jump(ms) {
      now += ms;
    },
  };
}

test("year clock fills a year in 45/22.5/11.25/5.625 seconds, stops when blocked and never catches up", () => {
  assert.deepEqual([1, 2, 4, 8].map(yearDuration), [45000, 22500, 11250, 5625]);
  assert.throws(() => yearDuration(16));
  const f = fakeDriver();
  let years = 0;
  let running = true;
  let pending = false;
  const ticks = [];
  const clock = createYearClock(
    () => running && !pending,
    (p) => ticks.push(p),
    () => years++,
    f.driver,
  );
  clock.sync(1);
  f.advance(44000);
  assert.equal(years, 0);
  assert.ok(ticks.at(-1) > 0.95 && ticks.at(-1) < 1);
  f.advance(1250);
  assert.equal(years, 1);
  // A five-minute stall counts as one second, not six years.
  f.jump(300000);
  f.advance(250);
  assert.equal(years, 1);
  assert.ok(clock.progress < 0.05);
  // Stopping holds progress; continuing keeps it exactly.
  running = false;
  clock.sync(1);
  clock.progress = 0.9;
  f.advance(60000);
  assert.equal(years, 1);
  running = true;
  clock.resume();
  assert.equal(clock.progress, 0.9);
  clock.sync(4);
  f.advance(1000);
  assert.equal(years, 1);
  f.advance(250);
  assert.equal(years, 2);
  // A pending decision blocks the clock indefinitely.
  pending = true;
  f.advance(600000);
  assert.equal(years, 2);
  assert.equal(f.tasks.size, 0);
  pending = false;
  clock.sync(2);
  f.advance(22500 + 250);
  assert.equal(years, 3);
});

test("beats appear by month and the summary just before the year ends", () => {
  assert.equal(beatAt(1), 0);
  assert.equal(beatAt(7), 0.5);
  assert.ok(beatAt(12) < summaryAt && summaryAt < 1);
});

test("crossing the year boundary first delivers settlement and waits; speed and pauses preserve progress", () => {
  const f = fakeDriver();
  let holding = false;
  let blocked = false;
  let years = 0;
  let settlements = 0;
  const clock = createYearClock(() => !holding && !blocked, p => {
    if (p >= summaryAt) { holding = true; settlements++; }
  }, () => years++, f.driver);
  clock.progress = 0.95;
  clock.sync(8);
  f.jump(1000);
  f.advance(250);
  assert.equal(settlements, 1);
  assert.equal(years, 0);
  assert.equal(f.tasks.size, 0);
  f.advance(10000);
  assert.equal(years, 0);
  holding = false;
  clock.progress = 0.4;
  clock.sync(1);
  clock.sync(8);
  assert.equal(clock.progress, 0.4);
  blocked = true;
  clock.sync(8);
  f.advance(10000);
  clock.resume();
  assert.equal(clock.progress, 0.4);
  blocked = false;
  clock.sync(8);
  f.advance(250);
  assert.ok(clock.progress > 0.4);
});

test("automatic settlement turn resumes a full visible interval after ledger, rules or history closes", () => {
  for (const panel of ["ledger", "rules", "history"]) {
    const f = fakeDriver();
    let open = false;
    let turns = 0;
    const timer = createTurnTimer(() => !open, () => turns++, 4000, f.driver);
    timer.sync();
    f.advance(3000);
    open = true;
    timer.sync();
    f.advance(6000);
    assert.equal(turns, 0, panel);
    open = false;
    timer.sync();
    f.advance(3750);
    timer.sync(); // Rendering again must not reset a pending interval.
    assert.equal(turns, 0, panel);
    f.advance(250);
    assert.equal(turns, 1, panel);
    assert.equal(f.tasks.size, 0);
  }
});
