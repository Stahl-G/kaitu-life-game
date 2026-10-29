import {            blankCard, cardPrompt, parseCard, sampleCard } from "./card.js";
import {              defaultPick, rejectPick } from "./choices.js";
import { exportPng, mapSvg } from "./map.js";
                                                                                      
import { simulatePeers } from "./peers.js";
import { beatAt, createTurnTimer, createYearClock, summaryAt } from "./playback.js";
import {
                   
              
               
           
             
  attribution,
  continueRun,
  parseSave,
  planOf,
  simulate,
} from "./simulation.js";
import { BRANCH_YEAR,            worldFor, worlds } from "./world.js";
import { button, esc, locale, pair, setLocale, t } from "./ui/dom.js";
import {                    endingPage, lineLabel, replayPage } from "./ui/ending.js";
import { homePage, importPage, readReview, reviewCards, reviewPage } from "./ui/pages.js";
import {
  beatsHtml,
  choiceName,
  menu,
  moneyDrawer,
  planDrawer,
  playPage,
  restartDialog,
  rulesDrawer,
  timebar,
  visibleCount,
} from "./ui/play.js";
import { app, current, finished, startYear, waiting } from "./ui/state.js";
const root = document.querySelector                ("#app");
if (!root) throw new Error("Missing #app");
// A Chinese game: Chinese by default, English on request.
setLocale("zh");
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
let sampleIndex = crypto.getRandomValues(new Uint32Array(1))[0] % 3;
/** Name of the life being played, for the shelf on the replay page. */
let label       = lineLabel("original");
/** Options of the past choice selected on the replay page, worked out once per selection. */
let replay                                                              = null;
const attributions = new WeakMap                    ();
let peersKey = "";
/** Peers live in the player's world but never depend on the player's picks or plans. */
function updatePeers(config        ) {
  const key = JSON.stringify([config.worldSeed, config.lifeSeed, config.mode, config.year, config.years, config.card.age]);
  if (key === peersKey) return;
  peersKey = key;
  app.peers = simulatePeers(config, locale());
}
const clock = createYearClock(
  () =>
    app.page === "play" &&
    app.playing &&
    !app.atEnd &&
    app.review === null &&
    app.drawer === null &&
    app.dialog === null &&
    !app.holding &&
    !document.hidden &&
    current() !== null,
  tick,
  yearEnd,
);
/** "中文 / English" messages from the model layer, in the current language. */
function bilingual(message        ) {
  const [zh, en] = message.split(" / ");
  return locale() === "zh" || !en ? zh : en;
}
function report(reason         ) {
  app.playing = false;
  app.error = bilingual(reason instanceof Error ? reason.message : String(reason));
  render();
}
function guard(fn                            ) {
  try {
    const result = fn();
    if (result instanceof Promise) result.catch(report);
  } catch (reason) {
    report(reason);
  }
}
const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
function measure(name        ) {
  performance.mark(`${name}-input`);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => performance.measure(`${name}-to-paint`, `${name}-input`)),
  );
}
// ── Rendering ────────────────────────────────────────────────────────────────
function header() {
  return `<header class="top"><button type="button" class="brand" data-action="home" aria-label="${t("开图 · 回到开局", "Kaitu · Back to the start")}"><span class="brand-icon" aria-hidden="true">开</span><span>开图 <b>KAITU</b></span></button><span class="edition">${t("人生往后推", "The next chapter")}</span><div class="header-right">${button("language", locale() === "zh" ? "EN" : "中文", "quiet", `lang="${locale() === "zh" ? "en" : "zh"}"`)}<div class="menu-wrap">${button("menu", "···", "quiet", `aria-haspopup="menu" aria-expanded="${app.menu}" aria-label="${t("更多操作", "More actions")}"`)}${menu()}</div></div></header>`;
}
function banner() {
  if (!app.error || (app.page === "play" && waiting() && !app.collapsed)) return "";
  return `<div class="banner" role="alert"><span>${esc(app.error)}</span>${button("dismiss-error", "×", "quiet", `aria-label="${t("关闭提示", "Dismiss")}"`)}</div>`;
}
function attributionOf(run     ) {
  let list = attributions.get(run);
  if (!list) {
    list = attribution(run);
    attributions.set(run, list);
  }
  return list;
}
function replayList()                 {
  const run = app.run;
  if (!run) return [];
  return run.changed.slice(0, app.shown).flatMap((ch) =>
    ch.choices.map((p) => ({
      key: p.key,
      year: ch.year,
      choice: p.choice,
      current: choiceName(p),
      taken: p.pick.option,
      options:
        replay?.key === p.key
          ? replay.options.map((o) => ({ id: o.id, label: pair(o.label), blocked: !!o.blocked }))
          : [],
    })),
  );
}
function page() {
  if (app.page === "import") return importPage();
  if (app.page === "review") return reviewPage();
  if (app.page === "play" && app.run) return playPage();
  if (app.page === "ending" && app.run) return endingPage(attributionOf(app.run));
  if (app.page === "replay" && app.run) return replayPage(replayList());
  return homePage();
}
function drawerHtml() {
  if (app.drawer === "money" && app.run) return moneyDrawer();
  if (app.drawer === "plan" && app.run) return planDrawer();
  if (app.drawer === "rules") return rulesDrawer();
  return "";
}
/** Bars are sized from `data-w` (0–1) through the CSSOM: the page's CSP forbids inline style attributes. */
function applyWidths(scope            ) {
  for (const el of scope.querySelectorAll             ("[data-w]"))
    el.style.width = `${Math.max(0, Math.min(1, Number(el.dataset.w) || 0)) * 100}%`;
}
function focusKey() {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || !root?.contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const action = el.dataset.action;
  if (!action) return null;
  const attr = (name        , value                    ) =>
    value === undefined ? "" : `[data-${name}="${CSS.escape(value)}"]`;
  return `[data-action="${CSS.escape(action)}"]${attr("value", el.dataset.value)}${attr("key", el.dataset.key)}`;
}
function render() {
  if (!root) return;
  const focus = focusKey();
  const open = [...root.querySelectorAll                    ("details[id]")].filter((d) => d.open).map((d) => d.id);
  document.documentElement.lang = locale() === "zh" ? "zh-CN" : "en";
  document.body.dataset.page = app.page;
  document.title = t("人生往后推 · 开图", "The next chapter · Kaitu");
  root.innerHTML = `${header()}${app.page === "play" ? timebar() : ""}${banner()}${page()}${drawerHtml()}${app.dialog === "restart" ? restartDialog() : ""}<footer><span>KAITU · ${t("推演，不是预测", "A simulation, not a prediction")}</span><a href="./vendor/remake/LICENSE" target="_blank" rel="noreferrer">Remake · MIT</a></footer>`;
  for (const id of open) {
    const details = document.getElementById(id);
    if (details instanceof HTMLDetailsElement) details.open = true;
  }
  applyWidths(root);
  if (focus) root.querySelector             (focus)?.focus({ preventScroll: true });
  const dialog = document.getElementById("restart-dialog");
  if (dialog instanceof HTMLDialogElement && !dialog.open) {
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancelRestart();
    });
    dialog.showModal();
    dialog.querySelector             ("[data-action=dialog-cancel]")?.focus();
  }
  clock.sync(app.speed);
  scheduleTurn();
}
// ── The year clock ───────────────────────────────────────────────────────────
/** Between settlements only the progress bar and the year's beats change; everything else waits for the year end. */
function tick(progress        ) {
  const before = app.progress;
  app.progress = progress;
  const ch = current();
  if (!ch) return;
  if (before < summaryAt && progress >= summaryAt) return settle();
  const bar = document.getElementById("year-progress");
  if (bar) bar.style.width = `${progress * 100}%`;
  const meter = document.getElementById("year-meter");
  if (meter) meter.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  const label = document.getElementById("year-position");
  if (label) label.textContent = t(`${Math.min(12, Math.floor(progress * 12) + 1)} 月 · ${Math.round(progress * 100)}%`, `Month ${Math.min(12, Math.floor(progress * 12) + 1)} · ${Math.round(progress * 100)}%`);
  const shown = visibleCount(ch, before);
  if (visibleCount(ch, progress) === shown) return;
  const list = document.getElementById("beats");
  if (!list) return;
  list.innerHTML = beatsHtml(ch, progress, false);
  for (const el of [...list.children].slice(shown)) el.classList.add("fresh");
}
/** Seconds the settlement stays on screen before an automatic turn of the year. */
const AUTO_TURN = 4000;
const turnTimer = createTurnTimer(
  () => app.autoYear && app.holding && app.page === "play" && app.playing && app.review === null && !app.drawer && !app.dialog && !document.hidden,
  nextYear,
  AUTO_TURN,
);
/** The year's settlement stops the clock; the player turns the year, or it turns by itself when asked to. */
function settle() {
  app.holding = true;
  app.progress = summaryAt;
  clock.progress = summaryAt;
  render();
  scheduleTurn();
}
function scheduleTurn() {
  turnTimer.sync();
}
function nextYear() {
  turnTimer.stop();
  app.holding = false;
  app.playing = true;
  app.pause = null;
  clock.progress = 0;
  yearEnd();
}
function yearEnd() {
  const run = app.run;
  if (!run) return;
  if (app.shown < run.changed.length) {
    app.shown++;
    app.progress = 0;
  } else {
    app.atEnd = true;
    app.progress = 1;
  }
  render();
  if (waiting()) revealDecision();
}
/** Continue the year without hiding anything it has already shown. */
function resumeClock() {
  const ch = current();
  const floor = !ch
    ? 0
    : app.progress >= summaryAt
      ? summaryAt
      : Math.max(0, ...ch.stories.map((st) => beatAt(st.month ?? 1)).filter((at) => at <= app.progress));
  clock.resume(floor);
  app.progress = clock.progress;
}
/** Place the playhead after the run was worked out up to year `index`: play that year, or keep waiting. */
function enterYear(index        ) {
  const run = app.run;
  if (!run) return;
  app.holding = false;
  if (run.changed.length > index) {
    app.shown = index + 1;
    app.atEnd = false;
    app.progress = 0;
  } else {
    app.shown = index;
    app.atEnd = true;
    app.progress = 1;
  }
  clock.progress = app.atEnd ? 0 : app.progress;
}
function revealDecision() {
  requestAnimationFrame(() =>
    document
      .querySelector(".decision, .decision-bar")
      ?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" }),
  );
}
// ── Starting and leaving a life ──────────────────────────────────────────────
function resetView() {
  app.holding = false;
  turnTimer.stop();
  app.review = null;
  app.drawer = null;
  app.menu = false;
  app.dialog = null;
  app.wasPlaying = null;
  app.selection = null;
  app.collapsed = false;
  app.error = "";
  app.pause = null;
  app.replayKey = null;
  app.replayPick = null;
  replay = null;
}
const newConfig = (card      )         => ({
  card: structuredClone(card),
  worldSeed: newSeed(),
  lifeSeed: newSeed(),
  year: startYear(),
  years: app.years,
  mode: app.mode,
  decisions: {},
  plans: {},
});
/** Starts `config` from its first year; a choice due at once is shown before the clock runs. */
function begin(config        , name       = lineLabel("original"), from = 0) {
  clock.stop();
  app.config = config;
  app.card = config.card;
  app.run = simulate(config);
  updatePeers(config);
  label = name;
  resetView();
  app.page = "play";
  enterYear(from);
  app.playing = true;
  render();
  window.scrollTo(0, 0);
  if (waiting()) revealDecision();
}
function startRandom() {
  measure("kaitu:random");
  app.card = sampleCard(sampleIndex++, locale());
  begin(newConfig(app.card));
}
function goHome() {
  app.page = "home";
  app.playing = false;
  app.pause = "user";
  app.menu = false;
  app.drawer = null;
  app.review = null;
  app.dialog = null;
  render();
  window.scrollTo(0, 0);
}
function backToRun() {
  if (!app.run) return;
  app.page = "play";
  app.error = "";
  app.menu = false;
  render();
  window.scrollTo(0, 0);
}
/** Finished lives stay on the replay page's shelf for this session. */
function remember(run     ) {
  if (!app.config || app.lines.some((line) => line.run === run)) return;
  app.lines.push({ label, config: structuredClone(app.config), run });
}
function showEnding() {
  const run = app.run;
  if (!run || !app.config || run.pending || run.changed.length < app.config.years) return;
  remember(run);
  app.page = "ending";
  app.playing = false;
  app.menu = false;
  app.drawer = null;
  app.review = null;
  render();
  window.scrollTo(0, 0);
}
// ── Playing ──────────────────────────────────────────────────────────────────
function togglePlay() {
  if (app.review !== null) return backNow();
  if (app.holding) return nextYear();
  if (waiting() || finished()) return;
  app.playing = !app.playing;
  app.pause = app.playing ? null : "user";
  if (app.playing) resumeClock();
  render();
}
function setSpeed(value        ) {
  if (value !== 1 && value !== 2 && value !== 4 && value !== 8) return;
  app.speed = value;
  render();
}
/** Reveals every year up to the next choice, or to the end of the run. */
function skip() {
  const run = app.run;
  if (!run || app.review !== null || waiting() || finished()) return;
  turnTimer.stop();
  app.holding = false;
  app.shown = Math.max(app.shown, run.changed.length);
  app.atEnd = true;
  app.progress = 1;
  clock.progress = 0;
  render();
  if (waiting()) revealDecision();
}
function review(index        ) {
  const run = app.run;
  if (!run || !Number.isInteger(index) || index < 0 || index >= run.changed.length || index >= app.shown) return;
  app.review = index;
  render();
  document.getElementById("year-panel")?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
}
function backNow() {
  if (app.review === null) return;
  app.review = null;
  resumeClock();
  render();
}
function openDrawer(kind        ) {
  if (kind !== "money" && kind !== "plan" && kind !== "rules") return;
  app.drawer = kind;
  app.menu = false;
  render();
  // Slide in once on opening; re-renders inside the drawer (tabs, plan changes) must not replay it.
  root?.querySelector(".sheet")?.classList.add("enter");
  root?.querySelector             ("[data-action=close-drawer]")?.focus();
}
function closeDrawer() {
  const was = app.drawer;
  if (!was) return;
  app.drawer = null;
  if (app.playing) resumeClock();
  render();
  root?.querySelector             (`[data-action=drawer][data-value=${was}]`)?.focus();
}
/** A plan always applies from the next year (from the first year while its opening choice is waiting). */
function updatePlan(change                      ) {
  const run = app.run;
  const cfg = app.config;
  if (!run || !cfg || app.review !== null) return;
  const at = app.shown;
  if (at >= cfg.years) return;
  const plan = structuredClone(cfg.plans[at] ?? planOf(run.changed[at - 1]?.state ?? run.initial));
  change(plan);
  cfg.plans[at] = plan;
  app.run = continueRun(run, cfg, at);
  // The plan can make a waiting choice no longer due; the next year then simply begins.
  if (app.atEnd && app.run.changed.length > app.shown) enterYear(app.shown);
  render();
}
function planAction(key        , value        ) {
  updatePlan((p) => {
    if (key === "jobSearch" || key === "training") p.habits[key] = value === "on";
    else if (key === "exercise") p.exercise = value === "on";
    else if (key === "monthly") p.habits.monthlyInvestment = Number(value);
    else if (key === "crash") p.crash = value             ;
    else if (key === "parents") p.parentsSupport = Number(value);
    else if (key === "travel") p.travel = value          ;
  });
}
function choose(id        ) {
  const p = waiting();
  if (!p) return;
  const option = p.choice.options(p.state, p.context).find((o) => o.id === id);
  if (!option || option.blocked) return;
  const pick = defaultPick(p.choice, p.state, p.context, option);
  app.selection = pick.option === id ? pick : { option: id };
  app.error = "";
  render();
}
function adjust(change                      ) {
  if (!app.selection) return;
  const next = structuredClone(app.selection);
  change(next);
  app.selection = next;
  app.error = "";
  render();
}
function commit() {
  const run = app.run;
  const cfg = app.config;
  const p = waiting();
  const pick = app.selection;
  if (!run || !cfg || !p || !pick || app.committing) return;
  const reason = rejectPick(p.choice, p.state, p.context, pick);
  if (reason) {
    app.error = bilingual(reason);
    return render();
  }
  measure("kaitu:decision");
  app.committing = true;
  cfg.decisions[p.key] = structuredClone(pick);
  try {
    app.run = continueRun(run, cfg, p.offset);
  } catch (error) {
    delete cfg.decisions[p.key];
    app.committing = false;
    return report(error);
  }
  app.committing = false;
  app.selection = null;
  app.collapsed = false;
  app.error = "";
  enterYear(p.offset);
  app.playing = true;
  app.pause = null;
  render();
  if (waiting()) revealDecision();
}
function requestRestart() {
  if (app.page !== "play" || finished()) return openReplay();
  app.wasPlaying = app.playing;
  app.playing = false;
  app.menu = false;
  app.dialog = "restart";
  render();
}
function cancelRestart() {
  if (app.dialog === null) return;
  app.dialog = null;
  app.playing = app.wasPlaying ?? false;
  app.wasPlaying = null;
  if (app.playing) resumeClock();
  render();
}
// ── Replaying ────────────────────────────────────────────────────────────────
function openReplay() {
  if (!app.run) return;
  app.page = "replay";
  app.playing = false;
  app.pause = "user";
  app.dialog = null;
  app.menu = false;
  app.drawer = null;
  app.review = null;
  app.replayKey = null;
  app.replayPick = null;
  replay = null;
  render();
  window.scrollTo(0, 0);
}
/** The options of a past choice, as they stood that year: replay the log without it and stop where it is asked. */
function selectReplay(key        ) {
  const cfg = app.config;
  if (!cfg) return;
  const alt = structuredClone(cfg);
  delete alt.decisions[key];
  const pending = simulate(alt, { baseline: false }).pending;
  if (!pending || pending.key !== key) return;
  replay = { key, pending, options: pending.choice.options(pending.state, pending.context) };
  app.replayKey = key;
  app.replayPick = null;
  render();
}
function pickReplay(id        ) {
  if (!replay) return;
  const { choice, state, context } = replay.pending;
  const option = replay.options.find((o) => o.id === id);
  if (!option || option.blocked) return;
  const pick = defaultPick(choice, state, context, option);
  app.replayPick = pick.option === id ? pick : null;
  render();
}
const replayName = () =>
  replay && app.replayPick
    ? `${replay.pending.context.year} ${choiceName({ choice: replay.pending.choice.id, pick: app.replayPick })}`
    : "";
/** Same world, one pick changed: keep everything before it and play on from that year. */
function replayContinue() {
  const run = app.run;
  const cfg = app.config;
  const pick = app.replayPick;
  if (!replay || !run || !cfg || !pick) return;
  const { key, pending } = replay;
  const keep = new Set        ();
  for (const ch of run.changed) {
    if (ch.offset > pending.offset) break;
    for (const p of ch.choices) {
      if (p.key === key) break;
      keep.add(p.key);
    }
  }
  const next = structuredClone(cfg);
  next.decisions = Object.fromEntries(Object.entries(cfg.decisions).filter(([k]) => keep.has(k)));
  next.decisions[key] = pick;
  next.plans = Object.fromEntries(Object.entries(cfg.plans).filter(([k]) => Number(k) <= pending.offset));
  begin(next, lineLabel("changed", replayName()), pending.offset);
}
/** Plays `config` to the end, carrying on wherever a pick is missing or no longer possible, then shows the ending. */
function finishWith(config        , name      ) {
  clock.stop();
  const run = simulate(config, { policy: "stay" });
  config.decisions = Object.fromEntries(
    run.changed.flatMap((ch) => ch.choices.map((p) => [p.key, structuredClone(p.pick)]         )),
  );
  run.config = structuredClone(config);
  app.config = config;
  app.run = run;
  updatePeers(config);
  label = name;
  resetView();
  app.shown = config.years;
  app.atEnd = true;
  app.progress = 1;
  showEnding();
}
function replayEnding() {
  const cfg = app.config;
  if (!replay || !cfg || !app.replayPick) return;
  const next = structuredClone(cfg);
  next.decisions[replay.key] = app.replayPick;
  finishWith(next, lineLabel("changed", replayName()));
}
/** Same choices, another world: a fresh world seed, or one that turns into the asked-for world. */
function replayWorld(value        ) {
  const cfg = app.config;
  if (!cfg) return;
  const next = structuredClone(cfg);
  next.mode = "parallel";
  const end = Math.max(BRANCH_YEAR, next.year + next.years - 1);
  next.worldSeed = newSeed();
  if (value in worlds)
    for (let i = 0; i < 400 && worldFor("parallel", next.worldSeed, end) !== value; i++) next.worldSeed = newSeed();
  const world          = worldFor("parallel", next.worldSeed, end);
  finishWith(next, lineLabel("world", pair(worlds[world].name)));
}
function openLine(index        ) {
  const line = app.lines[index];
  if (!line) return;
  app.config = structuredClone(line.config);
  app.run = line.run;
  updatePeers(app.config);
  label = line.label;
  resetView();
  app.shown = app.config.years;
  app.atEnd = true;
  app.progress = 1;
  showEnding();
}
function restartSame() {
  const cfg = app.config;
  if (!cfg) return;
  begin({ ...structuredClone(cfg), decisions: {}, plans: {} }, ["同一开局，从头再来", "The same start, again"]);
}
// ── Files ────────────────────────────────────────────────────────────────────
function download(blob      , name        ) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function save() {
  if (!app.config) return;
  const text = JSON.stringify({ kind: "kaitu-simulation", version: 3, config: app.config }, null, 2);
  download(new Blob([text], { type: "application/json" }), "kaitu-life.json");
  app.menu = false;
  render();
}
async function loadSave(file      ) {
  if (file.size > 100000) throw new Error("存档过长 / Save too large");
  const config = parseSave(await file.text());
  clock.stop();
  app.config = config;
  app.card = config.card;
  app.run = simulate(config);
  updatePeers(config);
  label = lineLabel("original");
  resetView();
  app.page = "play";
  app.shown = app.run.changed.length;
  app.atEnd = true;
  app.progress = 1;
  app.playing = false;
  render();
  window.scrollTo(0, 0);
}
async function loadCard(file      ) {
  if (file.size > 200000) throw new Error("文件过大 / File too large");
  const text = await file.text();
  app.card = parseCard(text);
  app.pasted = text;
  app.error = "";
  app.page = "review";
  render();
  window.scrollTo(0, 0);
}
async function copyPrompt(el             ) {
  try {
    await navigator.clipboard.writeText(cardPrompt(locale()));
    el.textContent = t("已复制 ✓", "Copied ✓");
  } catch {
    // Clipboard access can be refused; select the text so a keyboard copy still works.
    const area = document.getElementById("prompt");
    if (!(area instanceof HTMLTextAreaElement)) return;
    const details = area.closest("details");
    if (details) details.open = true;
    area.focus();
    area.select();
    el.textContent = t("已选中，按 Ctrl+C 复制", "Selected: press Ctrl+C to copy");
  }
}
function pickFile(id        ) {
  document.getElementById(id)?.click();
}
// ── The review form ──────────────────────────────────────────────────────────
function reviewError(message        ) {
  const el = document.getElementById("review-error");
  if (el) el.textContent = message;
}
/** Field changes refresh the two summary cards in place, so the form keeps its focus and scroll. */
function refreshReview(form                 ) {
  let card      ;
  try {
    card = readReview(form, app.card);
  } catch {
    return;
  }
  app.card = card;
  const cards = reviewCards(card);
  const register = document.getElementById("register");
  const compare = document.getElementById("compare");
  if (register) register.innerHTML = cards.register;
  if (compare) compare.innerHTML = cards.compare;
  applyWidths(form);
  reviewError("");
}
// ── Events ───────────────────────────────────────────────────────────────────
function act(action        , el             )                       {
  const value = el.dataset.value ?? "";
  switch (action) {
    case "home":
      return goHome();
    case "language":
      setLocale(locale() === "zh" ? "en" : "zh");
      return render();
    case "menu":
      app.menu = !app.menu;
      return render();
    case "dismiss-error":
      app.error = "";
      return render();
    case "random":
      return startRandom();
    case "personal":
      app.page = "import";
      app.error = "";
      app.menu = false;
      render();
      return window.scrollTo(0, 0);
    case "mode":
      if (value === "reality" || value === "parallel") app.mode = value        ;
      return render();
    case "years":
      if (value === "10" || value === "20" || value === "30") app.years = Number(value)         ;
      return render();
    case "load":
      return pickFile("load-file");
    case "load-card":
      return pickFile("card-file");
    case "copy-prompt":
      return copyPrompt(el);
    case "parse": {
      app.pasted = document.querySelector                     ("#paste")?.value ?? app.pasted;
      app.card = parseCard(app.pasted);
      app.error = "";
      app.page = "review";
      render();
      return window.scrollTo(0, 0);
    }
    case "manual":
      app.pasted = document.querySelector                     ("#paste")?.value ?? app.pasted;
      app.card = blankCard();
      app.error = "";
      app.page = "review";
      render();
      return window.scrollTo(0, 0);
    case "edit-paste":
      app.page = "import";
      app.error = "";
      return render();
    case "back-to-run":
      return backToRun();
    case "play":
      return togglePlay();
    case "speed":
      return setSpeed(Number(value));
    case "auto-year":
      app.autoYear = !app.autoYear;
      render();
      return scheduleTurn();
    case "skip":
      return skip();
    case "focus":
      return updatePlan((p) => {
        p.focus = value         ;
      });
    case "plan":
      return planAction(el.dataset.key ?? "", value);
    case "drawer":
      return openDrawer(value);
    case "close-drawer":
      return closeDrawer();
    case "money-tab":
      if (value === "overview" || value === "year" || value === "accounts") app.moneyTab = value;
      return render();
    case "review":
      return review(Number(value));
    case "back-now":
      return backNow();
    case "choose":
      return choose(value);
    case "down":
      return adjust((p) => {
        p.down = Number(value);
      });
    case "loan-years":
      return adjust((p) => {
        p.years = Number(value);
      });
    case "funding":
      return adjust((p) => {
        p.funding = value === "loan" ? "loan" : "self";
      });
    case "investment":
      return adjust((p) => {
        p.investment = value === "bonds" ? "bonds" : "index";
      });
    case "custom":
      return adjust((p) => {
        if (value === "creative" || value === "learning" || value === "community") p.custom = value;
      });
    case "collapse":
      app.collapsed = true;
      return render();
    case "expand":
      app.collapsed = false;
      render();
      return revealDecision();
    case "commit":
      return commit();
    case "ending":
      return showEnding();
    case "restart":
      return requestRestart();
    case "dialog-cancel":
      return cancelRestart();
    case "dialog-replay":
      app.dialog = null;
      return openReplay();
    case "dialog-restart":
      app.dialog = null;
      return restartSame();
    case "save":
      return save();
    case "png":
      return app.run ? exportPng(mapSvg(app.run, app.run.changed.length, locale(), true)) : undefined;
    case "to-replay":
      return openReplay();
    case "replay-key":
      return selectReplay(value);
    case "replay-pick":
      return pickReplay(value);
    case "replay-continue":
      return replayContinue();
    case "replay-ending":
      return replayEnding();
    case "replay-world":
      return replayWorld(value);
    case "open-line":
      return openLine(Number(value));
    case "restart-same":
      return restartSame();
  }
}
root.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const el = target.closest             ("[data-action]");
  if (app.menu && !target.closest(".menu-wrap")) {
    app.menu = false;
    if (!el) return render();
  }
  // A click on the shaded area beside a drawer closes it.
  if (target.classList.contains("drawer")) return closeDrawer();
  if (!el || (el instanceof HTMLButtonElement && el.disabled)) return;
  guard(() => act(el.dataset.action ?? "", el));
});
root.addEventListener("change", (event) => {
  const el = event.target;
  if (el instanceof HTMLInputElement && el.type === "file") {
    const file = el.files?.[0];
    el.value = "";
    if (file) guard(() => (el.id === "load-file" ? loadSave(file) : loadCard(file)));
    return;
  }
  const form = el instanceof Element ? el.closest("form") : null;
  if (form instanceof HTMLFormElement && form.id === "review-form") refreshReview(form);
});
root.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "review-form") return;
  event.preventDefault();
  try {
    app.card = readReview(form, app.card);
  } catch (reason) {
    reviewError(bilingual(reason instanceof Error ? reason.message : String(reason)));
    return;
  }
  begin(newConfig(app.card));
});
const arrows                         = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
document.addEventListener("keydown", (event) => {
  const radio = event.target instanceof HTMLElement ? event.target.closest             ("[role=radio]") : null;
  if (radio && event.key in arrows) {
    const group = [...(radio.parentElement?.querySelectorAll                   ("[role=radio]:not([disabled])") ?? [])];
    const next = group[(group.indexOf(radio                     ) + arrows[event.key] + group.length) % group.length];
    if (next) {
      event.preventDefault();
      next.click();
      root.querySelector             (`[role=radio][data-value="${CSS.escape(next.dataset.value ?? "")}"]`)?.focus();
    }
    return;
  }
  if (event.key !== "Escape" || app.dialog) return;
  if (app.menu) {
    app.menu = false;
    render();
    root.querySelector             ("[data-action=menu]")?.focus();
  } else if (app.drawer) closeDrawer();
  else if (app.review !== null && app.page === "play") backNow();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  if (app.dialog && app.wasPlaying) app.wasPlaying = false;
  if (app.page === "play" && app.playing) {
    app.playing = false;
    app.pause = "hidden";
    render();
  }
});
render();
