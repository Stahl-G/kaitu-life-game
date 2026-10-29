import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleCard } from "../dist/card.js";
import { choiceById, defaultPick } from "../dist/choices.js";
import { closeJournal, emptyBalance, netWorth, openJournal, yuan } from "../dist/finance.js";
import { mapSvg } from "../dist/map.js";
import { invest, marketFor, settleMarket } from "../dist/market.js";
import { simulatePeers } from "../dist/peers.js";
import { sceneSvg } from "../dist/scene.js";
import {
  attribution,
  continueRun,
  defaultPlan,
  initialState,
  parseSave,
  simulate,
  step,
} from "../dist/simulation.js";
import { hiddenChain, worldFor, worlds } from "../dist/world.js";
const config = (seed = "A", patch = {}) => ({
  card: sampleCard(0, "zh"),
  worldSeed: seed,
  lifeSeed: `${seed}-life`,
  year: 2026,
  years: 20,
  mode: "reality",
  decisions: {},
  plans: {},
  ...patch,
});
/** Answers every waiting choice the way a player would, through the same calls the app makes. */
function play(c, choose) {
  let run = simulate(c);
  while (run.pending) {
    const p = run.pending;
    const options = p.choice.options(p.state, p.context).filter((o) => !o.blocked);
    c.decisions[p.key] = defaultPick(p.choice, p.state, p.context, choose(options, p));
    run = continueRun(run, c, p.offset);
  }
  return run;
}
const reconciles = (j) =>
  j.opening +
    j.entries.reduce((n, e) => n + (e.kind === "expense" ? -e.amount : e.kind === "transfer" ? 0 : e.amount), 0) ===
  j.closing;
test("save boundary: version 3 round-trips; version 2 and invalid logs are refused with a reason", () => {
  const c = play(config("save"), (o) => o.find((x) => !x.stay) ?? o[0]).config;
  c.plans[3] = { ...defaultPlan(), focus: "health", habits: { jobSearch: true, training: false, monthlyInvestment: yuan(1000) } };
  const text = JSON.stringify({ kind: "kaitu-simulation", version: 3, config: c });
  assert.deepEqual(parseSave(text), c);
  assert.deepEqual(simulate(parseSave(text)).changed, simulate(c).changed);
  assert.throws(() => parseSave(JSON.stringify({ kind: "kaitu-simulation", version: 2, config: c })), /version 2/);
  const bad = (patch) => JSON.stringify({ kind: "kaitu-simulation", version: 3, config: { ...c, ...patch } });
  for (const patch of [
    { years: 15 },
    { mode: "dream" },
    { decisions: { "no-such-choice": { option: "x" } } },
    { decisions: { home: { option: "city", down: 0.05, years: 30 } } },
    { plans: { 0: { ...defaultPlan(), habits: { jobSearch: false, training: false, monthlyInvestment: -1 } } } },
    { plans: { 25: defaultPlan() } },
  ])
    assert.throws(() => parseSave(bad(patch)));
});
test("100 lives: incremental play equals a fresh replay; markets are shared; every year reconciles; choices are gated", () => {
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const seed = `life-${String(i).padStart(3, "0")}`;
    const c = config(seed, { card: sampleCard(i, i % 2 ? "zh" : "en"), mode: i % 2 ? "parallel" : "reality" });
    let k = i;
    const run = play(c, (options) => options[k++ % options.length]);
    assert.equal(run.changed.length, c.years);
    assert.deepEqual(simulate(c).changed, run.changed);
    const keys = new Set();
    for (const [index, row] of run.changed.entries()) {
      const world = worldFor(c.mode, c.worldSeed, row.year);
      assert.deepEqual(row.market, marketFor(c.worldSeed, row.year, world));
      assert.deepEqual(row.market, run.baseline[index].market);
      if (c.mode === "reality") assert.equal(row.market.world, "continuity");
      assert.ok(reconciles(row.journal), `${seed} ${row.year}`);
      assert.ok(reconciles(run.baseline[index].journal));
      assert.ok(row.choices.length <= 2);
      for (const p of row.choices) {
        assert.ok(!keys.has(p.key), p.key);
        keys.add(p.key);
        assert.equal(/-\d{4}$/.test(p.key), !!choiceById.get(p.choice).repeat);
        seen.add(p.choice);
      }
      for (const st of row.stories) assert.ok(st.month >= 1 && st.month <= 12);
    }
  }
  assert.ok(seen.size >= 9, [...seen].join());
});
test("strict play stops at the first unanswered choice; carrying on fills every choice", () => {
  const c = config("policy");
  const strict = simulate(c);
  assert.ok(strict.pending);
  assert.equal(strict.changed.length, strict.pending.offset);
  const stay = simulate(c, { policy: "stay" });
  assert.equal(stay.pending, null);
  assert.equal(stay.changed.length, c.years);
  assert.ok(stay.changed.every((row) => row.choices.every((p) => p.stay)));
  // The carry-on line answers the same way, so its money matches the baseline.
  assert.equal(stay.changed.at(-1).summary.netWorth, stay.baseline.at(-1).summary.netWorth);
});
test("plans apply from their year onward; earlier years and the baseline never see them", () => {
  const c = config("plans");
  const before = simulate(c, { policy: "stay" });
  const planned = structuredClone(c);
  planned.plans[6] = { ...defaultPlan(), focus: "work", habits: { jobSearch: false, training: false, monthlyInvestment: yuan(2000) } };
  const after = simulate(planned, { policy: "stay" });
  assert.deepEqual(after.baseline, before.baseline);
  assert.deepEqual(after.changed.slice(0, 6), before.changed.slice(0, 6));
  assert.notDeepEqual(after.changed[6].state, before.changed[6].state);
  assert.ok(after.changed[6].state.assets.stocks > before.changed[6].state.assets.stocks);
});
test("attribution changes one pick back to carrying on and replays the same world", () => {
  const c = config("attribution", { years: 10 });
  const run = play(c, (o) => o.find((x) => !x.stay) ?? o[0]);
  const list = attribution(run);
  const changed = run.changed.flatMap((row) => row.choices).filter((p) => !p.stay);
  assert.equal(list.length, changed.length);
  assert.ok(list.length > 0);
  const end = netWorth(run.changed.at(-1).state.assets);
  for (const a of list.slice(0, 2)) {
    const alt = structuredClone(run.config);
    alt.decisions[a.key] = { option: a.stayOption };
    const other = simulate(alt, { policy: "stay", baseline: false }).changed.at(-1).state;
    assert.equal(a.netWorth, end - netWorth(other.assets));
  }
});
test("worlds: one shared line until 2035, six worlds after it in even shares, a rare hidden chain", () => {
  const counts = Object.fromEntries(Object.keys(worlds).map((w) => [w, 0]));
  const n = 3000;
  for (let i = 0; i < n; i++) {
    const seed = `world-${i}`;
    assert.equal(worldFor("parallel", seed, 2034), "continuity");
    assert.equal(worldFor("reality", seed, 2050), "continuity");
    counts[worldFor("parallel", seed, 2035)]++;
  }
  for (const [w, count] of Object.entries(counts)) assert.ok(count / n > 0.08 && count / n < 0.3, `${w} ${count}`);
  let unlocked = 0;
  for (let i = 0; i < 10000; i++) if (hiddenChain(`hidden-${i}`).unlocked) unlocked++;
  assert.ok(unlocked > 50 && unlocked < 200, String(unlocked));
});
test("160 pairs of lives with the same answers: in 95% of pairs, less than half of what is read is the same", () => {
  const normalized = (text) => text.replace(/[\d,.¥￥%]+/g, "#").replace(/\s/g, "");
  function overlap(a, b) {
    const counts = new Map();
    for (const x of a) counts.set(x, (counts.get(x) || 0) + 1);
    let same = 0;
    for (const x of b)
      if (counts.get(x) > 0) {
        same++;
        counts.set(x, counts.get(x) - 1);
      }
    return (2 * same) / (a.length + b.length || 1);
  }
  const p95 = (values) => [...values].sort((a, b) => a - b)[Math.floor(0.95 * (values.length - 1))];
  for (const mode of ["reality", "parallel"]) {
    const lives = [];
    for (let i = 0; i < 320; i++)
      lives.push(
        simulate(config(`pair-${i}`, { mode }), { policy: "stay", baseline: false }).changed.flatMap((row) => row.stories),
      );
    // Everything the player reads, world news and choice stories included; and what happens to the player alone.
    for (const [name, keep] of [
      ["all", () => true],
      ["personal", (st) => st.kind !== "world" && st.kind !== "decision"],
    ]) {
      const pairs = [];
      for (let i = 0; i < 320; i += 2)
        pairs.push(
          overlap(
            lives[i].filter(keep).map((st) => normalized(st.text[0])),
            lives[i + 1].filter(keep).map((st) => normalized(st.text[0])),
          ),
        );
      assert.ok(p95(pairs) < 0.5, `${mode} ${name}: p95 ${p95(pairs)}`);
    }
  }
});
test("the hidden chain happens in order: contact, AI, robots, then the war over machines", () => {
  for (let i = 0; i < 10000; i++) {
    const h = hiddenChain(`order-${i}`);
    assert.ok(h.contact < h.ai && h.ai < h.robots && h.robots < h.warStart && h.warStart < h.warEnd, `order-${i}`);
    assert.ok(h.warEnd + 1 <= 2055, `order-${i} ends ${h.warEnd}`);
  }
});
test("losing a job and falling into arrears come with help links", () => {
  const seen = new Map();
  for (let i = 0; i < 300 && seen.size < 2; i++) {
    const run = simulate(config(`help-${i}`, { years: 30 }), { policy: "stay", baseline: false });
    for (const st of run.changed.flatMap((row) => row.stories))
      if (st.id === "life-job-loss" || st.id === "debt-notice") seen.set(st.id, st);
  }
  for (const id of ["life-job-loss", "debt-notice"]) {
    assert.ok(seen.has(id), id);
    assert.ok(seen.get(id).support?.length && seen.get(id).support.every((x) => x.url.startsWith("https://")), id);
  }
});
test("debt brings a grace period, collection and temporary housing, then recovery", () => {
  const c = config("debt");
  let s = initialState(c.card, c.lifeSeed, c.year);
  s.role = "unemployed";
  s.props.relationships = 5;
  s.props.health = 5;
  s.assets = { ...emptyBalance(), debt: yuan(800000), interestRate: 0.1 };
  const seen = [];
  for (let i = 0; i < 5; i++) {
    // Hold the hard case: out of work (a job lost this year is never followed by a rehire that year) and
    // without people to lean on, who would otherwise drift back toward the middle.
    s.role = "unemployed";
    s.flags.jobLost = c.year + i;
    s.props.relationships = 5;
    const row = step(s, c, i, "changed", "stay");
    assert.ok(reconciles(row.journal));
    seen.push(...row.stories.map((st) => st.id));
    s = row.state;
  }
  for (const id of ["debt-notice", "debt-shared", "housing-temporary"]) assert.ok(seen.includes(id), id);
  assert.ok(!seen.includes("partner-support"));
  s.role = "employed";
  s.assets.cash = yuan(1000000);
  const recovered = step(s, c, 6, "changed", "stay");
  assert.equal(recovered.state.housing, "shared");
  assert.ok(recovered.stories.some((st) => st.id === "housing-recovery"));
});
test("400 paired market seeds: knowledge changes investing behaviour, never the market's return", () => {
  const run = (i, knowledge) => {
    const seed = `investment-${i}`;
    const s = initialState(config().card, seed, 2026);
    s.props.knowledge = knowledge;
    s.assets = { ...emptyBalance(), cash: yuan(112000) };
    s.habits.monthlyInvestment = 0;
    const start = netWorth(s.assets);
    const j = openJournal(s.assets);
    invest(s, j, yuan(100000), "index", false);
    closeJournal(s.assets, j);
    for (let year = 2026; year < 2038; year++) {
      const m = marketFor(seed, year);
      const jy = openJournal(s.assets);
      settleMarket(s, jy, m, seed);
      closeJournal(s.assets, jy);
    }
    return netWorth(s.assets) / start - 1;
  };
  const low = [];
  const high = [];
  for (let i = 0; i < 400; i++) {
    low.push(run(i, 25));
    high.push(run(i, 85));
  }
  const mean = (a) => a.reduce((n, x) => n + x, 0) / a.length;
  assert.ok(mean(high) > mean(low));
  assert.ok(mean(high) - mean(low) < 0.12);
  assert.ok(high.some((x) => x < 0));
  assert.ok(low.some((x) => x > 0));
});
test("the exported card carries no profile text and marks every changed pick; the scene follows the state", () => {
  const c = config("png");
  c.card.name = "<script>PRIVATE-ALIAS</script>";
  c.card.project = "PRIVATE-PROJECT";
  c.card.attributes.health.source = "PRIVATE-SOURCE";
  c.card.life.city = "PRIVATE-CITY";
  c.card.life.goals = ["PRIVATE-GOAL"];
  const run = play(c, (o) => o.find((x) => !x.stay) ?? o[0]);
  const svg = mapSvg(run, run.changed.length, "zh", true);
  for (const word of ["PRIVATE", "<script>", c.worldSeed, c.lifeSeed]) assert.ok(!svg.includes(word), word);
  assert.ok(mapSvg(run, run.changed.length, "zh").includes("&lt;script&gt;"));
  const changed = run.changed.flatMap((row) => row.choices).filter((p) => !p.stay).length;
  assert.equal((svg.match(/r="6"/g) || []).length, changed);
  const s = run.initial;
  const home = sceneSvg(s, "zh");
  assert.notEqual(sceneSvg({ ...s, role: "founder" }, "zh"), home);
  assert.notEqual(sceneSvg({ ...s, housing: "shared" }, "zh"), home);
  assert.notEqual(sceneSvg({ ...s, car: true }, "zh"), home);
});
test("peers share the player's world and do not depend on the player's picks", () => {
  const c = config("peers", { mode: "parallel", years: 10 });
  const alone = simulatePeers(c, "zh");
  const run = play(c, (o) => o.find((x) => !x.stay) ?? o[0]);
  assert.deepEqual(simulatePeers(c, "zh"), alone);
  assert.equal(alone.length, 3);
  for (const peer of alone) assert.equal(peer.years.length, c.years);
  assert.ok(run.changed.length === c.years);
});
