import { dimensions, labels, roleLabels } from "../card.js";
import {
  type Option,
  choiceById,
  downOptions,
  homePrice,
  minimumDown,
  mortgagePayment,
  premiums,
  trackLabels,
  yearOptions,
} from "../choices.js";
import { liquid, netWorth, yuan } from "../finance.js";
import { lifeRates } from "../life.js";
import { crashThreshold, marketConfig } from "../market.js";
import { type Chapter, type Picked, type State, type Story, type Text, decisionLabels, focusHints, focusLabels } from "../model.js";
import { peerLine } from "../peers.js";
import { tiers } from "../places.js";
import { beatAt, summaryAt } from "../playback.js";
import { sceneSvg } from "../scene.js";
import { type Pending, parentsSupportOptions } from "../simulation.js";
import { type FactId, facts, sources } from "../stats.js";
import { BRANCH_YEAR, axes, axisLabels, worldAxes, worlds } from "../world.js";
import { lineChart } from "./charts.js";
import { button, esc, locale, money, pair, percent, rank, short, signed, t } from "./dom.js";
import { crashNames, entryLabels, housingNames, optionNames, travelNames } from "./labels.js";
import { factLine, sourceLink } from "./pages.js";
import { app, current, finished, shownIndex, shownState, waiting } from "./state.js";
export function choiceName(p: Pick<Picked, "choice" | "pick">): string {
  const named = optionNames[`${p.choice}:${p.pick.option}`];
  if (named) return pair(named);
  if (p.choice === "crossroads") return pair(decisionLabels[p.pick.option as keyof typeof decisionLabels] ?? ["", ""]);
  if (p.choice === "world") return t("世界里的工作转折", "A turn at work in the new world");
  return p.pick.option;
}
const seg = (action: string, value: string, label: string, pressed: boolean, extra = "") =>
  `<button type="button" data-action="${action}" data-value="${value}" aria-pressed="${pressed}"${extra}>${label}</button>`;
export function timebar() {
  const cfg = app.config;
  if (!cfg) return "";
  const ch = app.review !== null ? app.run?.changed[app.review] : current();
  const done = finished();
  const wait = waiting();
  const [state, label] = done
    ? ["done", t("本局结束", "Run complete")]
    : wait
      ? ["waiting", t("等待抉择 · 时间暂停", "Choice waiting · Time paused")]
      : app.review !== null
        ? ["paused", t("回看往年 · 已暂停", "Looking back · Paused")]
        : app.drawer
          ? ["paused", t("看细节 · 已暂停", "Details open · Paused")]
          : app.pause === "hidden"
            ? ["paused", t("离开了页面 · 已暂停", "Page hidden · Paused")]
            : app.playing
              ? ["running", t("时间流动中", "Time is running")]
              : ["paused", t("已暂停", "Paused")];
  const locked = done || !!wait;
  const playLabel =
    app.review !== null ? t("回到现在", "Back to now") : app.playing && !locked ? t("暂停", "Pause") : t("继续", "Continue");
  return `<div class="timebar"><div class="time-year"><strong>${ch?.year ?? cfg.year}</strong><span>${ch?.age ?? cfg.card.age} ${t("岁", "yrs")}</span><small>${t(`第 ${app.review !== null ? app.review + 1 : app.shown} / ${cfg.years} 年`, `Year ${app.review !== null ? app.review + 1 : app.shown} of ${cfg.years}`)} · ${cfg.mode === "parallel" ? t("平行世界", "Parallel worlds") : t("现实线", "Reality line")}</small></div><span class="status" data-state="${state}" role="status">${label}</span><div class="playback">${button("play", playLabel, "primary", locked && app.review === null ? "disabled" : "")}<div class="speed" role="group" aria-label="${t("速度", "Speed")}">${[1, 2, 4].map((n) => seg("speed", String(n), `${n}×`, app.speed === n)).join("")}</div><span class="duration">${t(`约 ${45 / app.speed} 秒 / 年`, `About ${45 / app.speed} s / year`)}</span>${button("skip", t("到下个抉择 ↠", "Next choice ↠"), "quiet", locked || app.review !== null ? "disabled" : "")}</div><div class="progress" aria-hidden="true"><i data-w="${done ? 1 : app.atEnd ? 1 : app.progress}" id="year-progress"></i></div></div>`;
}
function chip(text: string, tone = "") {
  return `<span class="chip${tone ? ` ${tone}` : ""}">${esc(text)}</span>`;
}
function familyChips(s: State, year: number) {
  const out: string[] = [chip(pair(roleLabels[s.role]))];
  out.push(chip(pair(housingNames[s.housing])));
  if (s.mortgage) out.push(chip(t("房贷中", "Mortgage")));
  const partner = s.family.partnerName ? pair(s.family.partnerName) : "";
  if (s.family.partner === "married") out.push(chip(t(`已婚 · ${partner}`, `Married · ${partner}`)));
  else if (s.family.partner === "living") out.push(chip(t(`同居 · ${partner}`, `Living with ${partner}`)));
  else if (s.family.partner === "dating") out.push(chip(t(`恋爱中 · ${partner}`, `Dating ${partner}`)));
  const kids = s.family.children.filter((b) => year - b >= 0);
  if (kids.length) out.push(chip(t(`孩子 ${kids.map((b) => `${year - b} 岁`).join("、")}`, `Children ${kids.map((b) => year - b).join(", ")}`)));
  if (s.car) out.push(chip(t("有车", "Car")));
  if (s.insurance.critical) out.push(chip(t("医疗 + 重疾险", "Hospital + critical cover")));
  else if (s.insurance.medical) out.push(chip(t("百万医疗险", "Hospital cover")));
  if (s.abroad) out.push(chip(t("海外", "Abroad")));
  if (s.arrearsYears) out.push(chip(t("有欠款", "In arrears"), "warn"));
  return out.join("");
}
function personCard(s: State, year: number) {
  const card = app.config?.card;
  const job = s.role === "employed" && card?.background?.occupation ? card.background.occupation : pair(roleLabels[s.role]);
  const where = s.place === "hometown" ? s.hometown : s.city;
  return `<section class="card person"><div class="person-top"><div class="portrait" aria-hidden="true">${esc(card?.name.slice(0, 1) || "·")}</div><div><h2>${esc(card?.name || t("玩家", "Player"))}</h2><p>${s.age} ${t("岁", "years")}${where ? ` · ${esc(where)}` : ""}</p></div></div><p class="job">${esc(job)}</p><div class="chips">${familyChips(s, year)}</div></section>`;
}
function statsCard(s: State, before: State | null) {
  return `<section class="card stats"><div class="section-head"><h2>${t("状态", "State")}</h2><span class="hint">0–100</span></div>${dimensions
    .map((k) => {
      const d = before ? s.props[k] - before.props[k] : 0;
      return `<div class="stat"><span>${pair(labels[k])}</span><b>${s.props[k]}</b><small class="${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? `+${d}` : d < 0 ? `${d}` : ""}</small><span class="bar"><i data-w="${s.props[k] / 100}"></i></span></div>`;
    })
    .join("")}</section>`;
}
function depositProgress(s: State) {
  const total = homePrice(s, "city");
  const need = total * 0.22 + yuan(20000);
  return Math.min(1, (liquid(s.assets) + s.assets.fund) / need);
}
function planCard(state: State, nextYear: number) {
  // A plan changed this year shows as it will run from next year; facts (home, insurance) stay as they are now.
  const next = app.review === null ? app.config?.plans[app.shown] : undefined;
  const s = next ? { ...state, ...next } : state;
  const rows: [Text, string][] = [
    [
      trackLabels.work,
      [
        s.habits.jobSearch ? t("每两年看一次机会", "Look around every two years") : t("留在现在的岗位", "Stay put"),
        s.habits.training ? t("两年一次职训", "Training every two years") : "",
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      trackLabels.money,
      `${s.habits.monthlyInvestment ? t(`每月定投 ${money(s.habits.monthlyInvestment)}`, `${money(s.habits.monthlyInvestment)} a month into the index`) : t("不定投", "No monthly investing")} · ${t("大跌时", "In a crash: ")}${pair(crashNames[s.crash])}`,
    ],
    [
      trackLabels.home,
      s.housing === "owned"
        ? s.mortgage
          ? t(`自己的房子 · 月供 ${money(s.mortgage.payment)}`, `Own home · ${money(s.mortgage.payment)} a month`)
          : t("自己的房子，没有房贷", "Own home, no mortgage")
        : t(`${pair(housingNames[s.housing])} · 首付进度 ${percent(depositProgress(s))}`, `${pair(housingNames[s.housing])} · deposit ${percent(depositProgress(s))} saved`),
    ],
    [
      trackLabels.family,
      s.parentsSupport ? t(`每年给父母 ${money(s.parentsSupport)}`, `${money(s.parentsSupport)} a year to parents`) : t("暂时不给父母钱", "No money to parents yet"),
    ],
    [
      trackLabels.health,
      `${s.insurance.critical ? t("医保 + 医疗 + 重疾", "Public + hospital + critical") : s.insurance.medical ? t("医保 + 百万医疗", "Public + hospital cover") : s.insurance.basic ? t("只有基本医保", "Public cover only") : t("没有医保", "No cover")} · ${s.exercise ? t("运动习惯", "Exercising") : t("没有运动习惯", "No exercise habit")}`,
    ],
    [trackLabels.far, pair(travelNames[s.travel])],
  ];
  const last = !!app.config && app.shown >= app.config.years;
  return `<section class="card plans"><div class="section-head"><h2>${t("计划", "Plans")}</h2>${button("drawer", t("改计划", "Change"), "quiet small", `data-value="plan"${last || app.review !== null ? " disabled" : ""}`)}</div><dl>${rows.map(([k, v]) => `<div><dt>${pair(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl><p class="hint">${last ? t("这是最后一年，计划不再改动。", "This is the last year; plans no longer change.") : next ? t(`已改：以上是 ${nextYear} 年起的计划`, `Changed: this is the plan from ${nextYear}`) : t(`改动从 ${nextYear} 年起生效`, `Changes apply from ${nextYear}`)}</p></section>`;
}
function factsHtml(ids: string[] | undefined) {
  return (ids ?? []).filter((id): id is FactId => id in facts).map((id) => factLine(id)).join("");
}
function beat(st: Story) {
  return `<li class="beat kind-${st.kind}"><span class="month">${t(`${st.month ?? 1} 月`, `M${st.month ?? 1}`)}</span><div><p>${esc(pair(st.text))}</p>${factsHtml(st.facts)}${st.support ? `<p class="support">${st.support.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noreferrer">${esc(x.label)} ↗</a>`).join(" · ")}</p>` : ""}</div></li>`;
}
function summaryBeat(ch: Chapter) {
  const s = ch.summary;
  return `<li class="beat kind-summary"><span class="month">${t("年末", "Year end")}</span><div><p>${t(`这一年结束：净资产 ${short(s.netWorth)}（${signed(s.change)}）。家庭人均到手 ${short(s.perCapita)}，${rank(s.percentile)}。`, `Year end: net worth ${short(s.netWorth)} (${signed(s.change)}). Take-home per person ${short(s.perCapita)}, ${rank(s.percentile)}.`)}</p><p class="fact"><span>${t("资料", "Data")}</span>${t("百分位按 2025 年全国五等份收入插值，粗略估算", "Percentile interpolated from 2025 national quintiles; a rough estimate")} <small>${sourceLink("nbsIncome2025")}</small></p></div></li>`;
}
/** Beats of a year visible at `progress`; all of them when looking back or once the year has run out. */
export function beatsHtml(ch: Chapter, progress: number, all: boolean) {
  const visible = ch.stories.filter((st) => all || beatAt(st.month ?? 1) <= progress);
  return `${visible.map(beat).join("")}${all || progress >= summaryAt ? summaryBeat(ch) : ""}`;
}
export const visibleCount = (ch: Chapter, progress: number) =>
  ch.stories.filter((st) => beatAt(st.month ?? 1) <= progress).length + (progress >= summaryAt ? 1 : 0);
function focusRow(nextYear: number) {
  const plan = app.config?.plans[app.shown];
  const focus = plan?.focus ?? shownState()?.focus ?? "balanced";
  return `<div class="focus"><div class="section-head"><h3>${t("下一年重心", "Next year's focus")}</h3><span class="hint">${t(`从 ${nextYear} 年起`, `From ${nextYear}`)}</span></div><div class="focus-row" role="group" aria-label="${t("下一年重心", "Next year's focus")}">${Object.entries(
    focusLabels,
  )
    .map(
      ([k, v]) =>
        `<button type="button" data-action="focus" data-value="${k}" aria-pressed="${focus === k}"><b>${pair(v)}</b><small>${pair(focusHints[k as keyof typeof focusHints])}</small></button>`,
    )
    .join("")}</div></div>`;
}
function yearPanel() {
  const ch = app.review !== null ? app.run?.changed[app.review] : current();
  if (!ch || !app.config) return "";
  const review = app.review !== null;
  const all = review || app.atEnd;
  const tag = ch.market.crisis
    ? chip(t("经济衰退", "Recession"), "warn")
    : app.config.mode === "parallel" && ch.year >= BRANCH_YEAR
      ? chip(pair(worlds[ch.market.world].name))
      : "";
  return `<section class="card year" id="year-panel"><div class="section-head"><h2>${review ? t("回看", "Looking back") : t("今年", "This year")} · ${ch.year} · ${ch.age} ${t("岁", "yrs")}</h2>${tag}</div>${!review && !finished() && app.shown < app.config.years ? focusRow(ch.year + 1) : ""}<ol class="beats" id="beats">${beatsHtml(ch, app.progress, all)}</ol>${review ? button("back-now", t("回到现在", "Back to now"), "text-button") : ""}</section>`;
}
function journal() {
  const run = app.run;
  if (!run) return "";
  const last = app.atEnd ? app.shown - 1 : app.shown - 2;
  const rows: string[] = [];
  for (let i = last; i >= 0; i--) {
    const ch = run.changed[i];
    const picks = ch.choices.filter((p) => p.choice !== "crossroads" || p.pick.option !== "stay");
    rows.push(
      `<li><button type="button" data-action="review" data-value="${i}" aria-current="${app.review === i}"><span class="y">${ch.year}</span><span class="a">${ch.age} ${t("岁", "")}</span><span class="s">${picks.map((p) => `◆ ${esc(choiceName(p))}`).join(" ")}${picks.length ? " · " : ""}${t("净资产", "Net")} ${esc(signed(ch.summary.change))}</span></button></li>`,
    );
  }
  return `<section class="card journal"><div class="section-head"><h2>${t("人生记录", "Life journal")}</h2><span class="hint">${t("点一年回看", "Pick a year to look back")}</span></div>${rows.length ? `<ol>${rows.join("")}</ol>` : `<p class="hint">${t("第一年过完后，这里会一年一行地记下来。", "After the first year, each year gets a line here.")}</p>`}</section>`;
}
function stepControls(option: Option, p: Pending) {
  const sel = app.selection;
  const s = p.state;
  if (option.step === "mortgage") {
    const total = homePrice(s, option.id === "hometown" ? "hometown" : "city");
    const min = minimumDown(s, total) ?? 1;
    const down = sel?.down ?? 0.3;
    const years = sel?.years ?? 30;
    const loan = Math.round(total * (1 - down));
    const pay = mortgagePayment(total, down, years);
    return `<div class="step"><h3>${t("房贷怎么贷？", "How will you borrow?")}</h3><div class="step-row"><span>${t("首付", "Deposit")}</span><div class="seg" role="group">${downOptions.map((d) => seg("down", String(d), `${d * 100}%`, down === d, d < min ? " disabled" : "")).join("")}</div></div><div class="step-row"><span>${t("年限", "Term")}</span><div class="seg" role="group">${yearOptions.map((y) => seg("loan-years", String(y), t(`${y} 年`, `${y} yrs`), years === y)).join("")}</div></div><dl class="kv"><div><dt>${t("首付", "Deposit")}</dt><dd>${short(Math.round(total * down))}</dd></div><div><dt>${t("贷款", "Loan")}</dt><dd>${short(loan)}</dd></div><div><dt>${t("月供", "Monthly")}</dt><dd>${money(pay)}</dd></div><div><dt>${t("利息合计", "Total interest")}</dt><dd>${short(pay * years * 12 - loan)}</dd></div></dl>${factLine("lpr2026")}</div>`;
  }
  if (option.step === "funding") {
    const cost = yuan(42000 * (1 + p.context.market.demand));
    const canSelf = liquid(s.assets) >= cost + yuan(12000);
    return `<div class="step"><h3>${t("启动资金怎么来？", "How will you fund the start?")}</h3><div class="seg" role="group">${seg("funding", "self", t(`自筹 ${short(cost)}`, `Self-fund ${short(cost)}`), sel?.funding === "self", canSelf ? "" : " disabled")}${seg("funding", "loan", t("借款 ¥60,000 · 年利率 6.5%", "Borrow ¥60,000 at 6.5%"), sel?.funding === "loan")}</div></div>`;
  }
  if (option.step === "investment")
    return `<div class="step"><h3>${t("这笔钱放在哪里？", "Where does the money go?")}</h3><div class="seg" role="group">${seg("investment", "bonds", t("债券基金", "Bond fund"), sel?.investment === "bonds")}${seg("investment", "index", t("股票指数", "Stock index"), sel?.investment === "index")}</div></div>`;
  if (option.step === "custom")
    return `<div class="step"><h3>${esc(app.config?.card.project || t("你想做的一件事", "Something you want to do"))}</h3><div class="seg" role="group">${seg("custom", "creative", t("创作 / 做作品", "Create something"), sel?.custom === "creative")}${seg("custom", "learning", t("学一项技能", "Learn a skill"), sel?.custom === "learning")}${seg("custom", "community", t("组织 / 连接他人", "Bring people together"), sel?.custom === "community")}</div></div>`;
  return "";
}
export function decisionCard(p: Pending) {
  const choice = p.choice;
  const options = choice.options(p.state, p.context);
  const stayId = (options.find((o) => o.stay) ?? options[0]).id;
  const selected = options.find((o) => o.id === app.selection?.option);
  if (app.collapsed)
    return `<section class="card decision-bar" role="status"><b>${t("抉择待定 · 时间暂停", "Choice waiting · Time paused")}</b><span>${esc(pair(choice.title(p.state, p.context)))}</span>${button("expand", t("展开抉择", "Show the choice"), "primary")}</section>`;
  const option = (o: Option) =>
    `<button type="button" class="option" data-action="choose" data-value="${o.id}" aria-pressed="${app.selection?.option === o.id}"${o.blocked ? " disabled" : ""}><strong>${esc(pair(o.label))}</strong>${o.costs.map((c) => `<span class="cost">${esc(pair(c))}</span>`).join("")}${o.effects.map((e) => `<span class="effect">${esc(pair(e))}</span>`).join("")}${o.id === stayId ? `<em class="stay-tag">${t("“照现在过”会选这个", "The carry-on line picks this")}</em>` : ""}${o.blocked ? `<span class="blocked">${esc(pair(o.blocked))}</span>` : ""}</button>`;
  return `<section class="card decision" aria-labelledby="decision-title"><p class="eyebrow">${pair(trackLabels[choice.track])} · ${t(`${p.context.year} 年初`, `Early ${p.context.year}`)} · ${t("时间已暂停", "Time paused")}</p><h2 id="decision-title">${esc(pair(choice.title(p.state, p.context)))}</h2><p class="body">${esc(pair(choice.body(p.state, p.context)))}</p>${factsHtml(choice.facts)}<div class="options">${options.map(option).join("")}</div>${selected?.step ? stepControls(selected, p) : ""}${app.error ? `<p class="error" role="alert">${esc(app.error)}</p>` : ""}<div class="decision-actions">${button("collapse", t("先收起，看看账本", "Set aside and check the books"), "text-button")}<span class="hint">${selected ? t("选好后，这一年继续", "Confirm and the year carries on") : t("先选一项；只算当下能算清的账，不预告结果", "Pick one; costs are shown, outcomes are not")}</span>${button("commit", selected ? t(`确定：${pair(selected.label)} →`, `Confirm: ${pair(selected.label)} →`) : t("确定 →", "Confirm →"), "primary", selected && !app.committing ? "" : "disabled")}</div></section>`;
}
function finishCard() {
  const ch = current();
  if (!ch) return "";
  return `<section class="card finish"><p class="eyebrow">${t("推演结束", "THE RUN IS OVER")}</p><h2>${ch.year} · ${ch.age} ${t("岁", "years")}</h2><p>${t("两条人生已经走到同一个终点年份。看看它们差在哪里。", "Both lives have reached the same final year. See where they differ.")}</p>${button("ending", t("看结局 →", "See the ending →"), "primary")}</section>`;
}
function sceneCard(s: State, year: number) {
  const where = s.place === "hometown" ? s.hometown : s.city;
  const couple = s.family.partner === "living" || s.family.partner === "married";
  const kids = s.family.children.filter((b) => year - b >= 0 && year - b <= 21).length;
  const people = t(
    `${couple ? "两个人" : "一个人"}${kids ? `和 ${kids} 个孩子` : ""}${s.family.care === "together" ? "，还有父母" : ""}`,
    `${couple ? "The two of you" : "On your own"}${kids ? ` with ${kids} child${kids > 1 ? "ren" : ""}` : ""}${s.family.care === "together" ? ", and your parents" : ""}`,
  );
  return `<section class="card scene"><div class="scene-art">${sceneSvg(s, locale(), true, year)}</div><p class="caption">${esc([where, pair(housingNames[s.housing]), people].filter(Boolean).join(" · "))}</p></section>`;
}
function moneyCard(s: State, index: number) {
  const run = app.run;
  if (!run) return "";
  const ch = index >= 0 ? run.changed[index] : null;
  const years = run.changed.slice(0, index + 1).map((r) => r.year);
  const you = run.changed.slice(0, index + 1).map((r) => r.summary.netWorth);
  const base = run.baseline.slice(0, index + 1).map((r) => r.summary.netWorth);
  const inflow = ch?.journal.entries.filter((e) => e.kind === "income").reduce((n, e) => n + e.amount, 0) ?? 0;
  const outflow = ch?.journal.entries.filter((e) => e.kind === "expense").reduce((n, e) => n + e.amount, 0) ?? 0;
  const chart =
    years.length > 1
      ? `<div class="legend"><span class="key base">${t("照现在过", "Carrying on")}</span><span class="key you">${t("你的选择", "Your choices")}</span></div>${lineChart(
          years,
          [
            { label: t("照现在过", "Carrying on"), values: base, tone: "base" },
            { label: t("你的选择", "Your choices"), values: you, tone: "you" },
          ],
          [],
          { height: 150, width: 300, title: t("净资产：两条线", "Net worth on both lines") },
        )}`
      : `<p class="hint">${t("第一年过完后，这里会画出两条线的净资产。", "After the first year, both lines' net worth is drawn here.")}</p>`;
  return `<section class="card money"><div class="section-head"><h2>${t("钱", "Money")}</h2><span class="tag">${t("模拟人民币", "Simulated RMB")}</span></div><p class="hero">${short(netWorth(s.assets))}</p><p class="sub">${t("净资产", "Net worth")}${ch ? ` · ${t("这一年", "this year")} ${esc(signed(ch.summary.change))}` : ""}</p>${ch ? `<p class="rank">${t("家庭人均到手", "Take-home per person")} ${short(ch.summary.perCapita)} · ${esc(rank(ch.summary.percentile))}</p>` : ""}${chart}${ch ? `<dl class="kv"><div><dt>${t("这一年收入", "Income")}</dt><dd>${short(inflow)}</dd></div><div><dt>${t("这一年支出", "Spending")}</dt><dd>${short(outflow)}</dd></div><div><dt>${t("负债", "Debts")}</dt><dd>${short(s.assets.mortgage + s.assets.carLoan + s.assets.debt)}</dd></div></dl>` : ""}${button("drawer", t("打开账本", "Open the books"), "", 'data-value="money"')}</section>`;
}
function familyCard(s: State, year: number) {
  const rows: [string, string][] = [];
  rows.push([t("住处", "Home"), `${pair(housingNames[s.housing])}${s.housing === "rent" || s.housing === "shared" ? t(` · 每月 ${money(s.rent)}`, ` · ${money(s.rent)} a month`) : ""}`]);
  if (s.family.partner !== "none")
    rows.push([
      t("伴侣", "Partner"),
      `${s.family.partnerName ? pair(s.family.partnerName) : ""} · ${
        {
          dating: t("恋爱中", "dating"),
          living: t("住在一起", "living together"),
          married: t("已婚", "married"),
          none: "",
        }[s.family.partner]
      }`,
    ]);
  const kids = s.family.children.filter((b) => year - b >= 0);
  if (kids.length) rows.push([t("孩子", "Children"), kids.map((b) => t(`${year - b} 岁`, `${year - b}`)).join("、")]);
  if (s.family.parentsBorn !== null)
    rows.push([
      t("父母", "Parents"),
      `${t(`年长的一位 ${year - s.family.parentsBorn} 岁`, `older parent ${year - s.family.parentsBorn}`)}${s.family.care === "together" ? t(" · 住在一起", " · living together") : s.place === "hometown" ? t(" · 在附近", " · nearby") : ""}`,
    ]);
  rows.push([t("车", "Car"), s.car ? t("有一辆纯电车", "An electric car") : t("没有车", "No car")]);
  if (s.family.pet) rows.push([t("宠物", "Pet"), t("一只猫", "A cat")]);
  return `<section class="card family"><h2>${t("家", "Home life")}</h2><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></section>`;
}
function peersCard(index: number) {
  if (!app.peers.length) return "";
  return `<section class="card peers"><div class="section-head"><h2>${t("和你同岁的三个人", "Three people your age")}</h2></div><ul>${app.peers
    .map((p) => {
      // Like the player's panels, a peer's year shows only once the player's year has settled.
      const year = index >= 0 ? p.years[index] : null;
      return `<li><b>${esc(pair(p.name))}</b><span>${esc(pair(p.city))}</span><p>${year ? esc(pair(peerLine(p, year.state))) : esc(pair(p.job))}</p></li>`;
    })
    .join("")}</ul><p class="hint">${t("虚构人物，和你在同一个世界里各自过日子。", "Invented people living their own lives in the same world.")}</p></section>`;
}
function worldCard(ch: Chapter | null) {
  const cfg = app.config;
  if (!cfg) return "";
  const year = ch?.year ?? cfg.year;
  const market = ch?.market;
  const branched = cfg.mode === "parallel" && year >= BRANCH_YEAR;
  const head = cfg.mode === "parallel"
    ? branched && market
      ? `<p class="world-name">${esc(pair(worlds[market.world].name))}</p><p class="hint">${esc(pair(worlds[market.world].basis))} · ${t("科幻推演", "Science fiction")}</p>`
      : `<p class="hint">${t(`${BRANCH_YEAR} 年以前大家走在同一条线上；之后世界会转向六个之一。`, `Until ${BRANCH_YEAR} everyone shares one line; then the world turns into one of six.`)}</p>`
    : `<p class="hint">${t("现实线：世界按现在的统计缓慢变化，不分叉。", "Reality line: the world changes slowly along current statistics.")}</p>`;
  const meters =
    cfg.mode === "parallel" && ch
      ? `<div class="axes">${axes
          .map((k) => {
            const v = worldAxes(cfg.worldSeed, year)[k];
            return `<div class="axis"><span>${pair(axisLabels[k])}</span><span class="bar"><i data-w="${v}"></i></span></div>`;
          })
          .join("")}</div>`
      : "";
  return `<section class="card world"><div class="section-head"><h2>${t("世界", "World")}</h2>${market?.crisis ? chip(t("衰退", "Recession"), "warn") : ""}</div>${head}${meters}${market ? `<p class="market">${t("指数", "Index")} ${percent(market.returns.stocks, 1)} · ${t("房价", "Homes")} ${percent(market.returns.property, 1)} · ${t("物价", "Prices")} ${percent(market.inflation, 1)}</p>` : ""}</section>`;
}
/** First year a plan changed now takes effect: next year, or the first year while its opening choice waits. */
const planYear = () => (app.shown === 0 ? (app.config?.year ?? 0) : (current()?.year ?? app.config?.year ?? 0) + 1);
export function playPage() {
  const run = app.run;
  const cfg = app.config;
  if (!run || !cfg) return "";
  const s = shownState() ?? run.initial;
  const index = shownIndex();
  const before = index > 0 ? run.changed[index - 1]?.state : index === 0 ? run.initial : null;
  const ch = app.review !== null ? run.changed[app.review] : current();
  const year = ch?.year ?? cfg.year;
  const p = waiting();
  return `<main class="play"><aside class="col-left">${personCard(s, year)}${statsCard(s, before ?? null)}${planCard(shownState() ?? s, planYear())}</aside><section class="col-main">${sceneCard(s, year)}${p && app.review === null ? decisionCard(p) : ""}${finished() && app.review === null ? finishCard() : ""}${yearPanel()}${journal()}</section><aside class="col-right">${moneyCard(s, index)}${familyCard(s, year)}${peersCard(index)}${worldCard(index >= 0 ? run.changed[index] : null)}</aside></main>`;
}
function entryRows(entries: { label: string; amount: number }[]) {
  const grouped = new Map<string, number>();
  for (const e of entries) grouped.set(e.label, (grouped.get(e.label) ?? 0) + e.amount);
  return [...grouped]
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([k, v]) => `<div><dt>${esc(entryLabels[k] ? pair(entryLabels[k]) : k)}</dt><dd>${money(v)}</dd></div>`)
    .join("");
}
function moneyTabs() {
  const tabs: [typeof app.moneyTab, string][] = [
    ["overview", t("总览", "Overview")],
    ["year", t("这一年的账", "This year's accounts")],
    ["accounts", t("资产与负债", "Assets and debts")],
  ];
  return `<div class="tabs" role="tablist">${tabs.map(([k, v]) => `<button type="button" role="tab" data-action="money-tab" data-value="${k}" aria-selected="${app.moneyTab === k}">${v}</button>`).join("")}</div>`;
}
function moneyOverview(index: number) {
  const run = app.run;
  if (!run) return "";
  const rows = run.changed.slice(0, index + 1);
  const s = rows.at(-1)?.state ?? run.initial;
  const years = rows.map((r) => r.year);
  const you = rows.map((r) => r.summary.netWorth);
  const base = run.baseline.slice(0, index + 1).map((r) => r.summary.netWorth);
  const marks = rows.flatMap((r, i) => r.choices.filter((p) => !p.stay).map((p) => ({ index: i, label: choiceName(p) })));
  const a = s.assets;
  const items: [string, number][] = [
    [t("现金", "Cash"), a.cash],
    [t("存款", "Deposits"), a.deposits],
    [t("债券基金", "Bond fund"), a.bonds],
    [t("股票指数", "Index fund"), a.stocks],
    [t("房产", "Home"), a.property],
    [t("车", "Car"), a.car],
    [t("公积金", "Housing fund"), a.fund],
  ];
  const debts: [string, number][] = [
    [t("房贷", "Mortgage"), a.mortgage],
    [t("车贷", "Car loan"), a.carLoan],
    [t("欠款和借款", "Arrears and loans"), a.debt],
  ];
  const max = Math.max(1, ...items.map(([, v]) => v), ...debts.map(([, v]) => v));
  const bars = (list: [string, number][], cls: string) =>
    list
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<div class="hbar ${cls}"><span>${k}</span><span class="bar"><i data-w="${v / max}"></i></span><b>${short(v)}</b></div>`)
      .join("");
  const table = `<details id="money-table"><summary>${t("看表格", "As a table")}</summary><table class="table"><thead><tr><th>${t("年份", "Year")}</th><th>${t("照现在过", "Carrying on")}</th><th>${t("你的选择", "Your choices")}</th></tr></thead><tbody>${years.map((y, i) => `<tr><td>${y}</td><td>${money(base[i])}</td><td>${money(you[i])}</td></tr>`).join("")}</tbody></table></details>`;
  return `<p class="hero">${short(netWorth(a))}</p><p class="sub">${t("净资产 = 资产 − 负债，全部是模拟人民币", "Net worth = assets − debts, all simulated RMB")}</p>${years.length > 1 ? `<div class="legend"><span class="key base">${t("照现在过", "Carrying on")}</span><span class="key you">${t("你的选择", "Your choices")}</span><span class="key mark">${t("你做了不同的选择", "A different choice")}</span></div>${lineChart(years, [{ label: t("照现在过", "Carrying on"), values: base, tone: "base" }, { label: t("你的选择", "Your choices"), values: you, tone: "you" }], marks)}${table}` : ""}<h3>${t("资产", "Assets")}</h3>${bars(items, "asset") || `<p class="hint">${t("还没有资产", "No assets yet")}</p>`}<h3>${t("负债", "Debts")}</h3>${bars(debts, "debt") || `<p class="hint">${t("没有负债", "No debts")}</p>`}`;
}
function moneyYear(index: number) {
  const ch = app.run?.changed[index];
  if (!ch) return `<p class="hint">${t("第一年过完后才有这一年的账。", "The year's accounts appear once the first year ends.")}</p>`;
  const j = ch.journal;
  const inc = j.entries.filter((e) => e.kind === "income");
  const exp = j.entries.filter((e) => e.kind === "expense");
  const ret = j.entries.filter((e) => e.kind === "return");
  const tr = j.entries.filter((e) => e.kind === "transfer" && e.amount > 0);
  const sum = (list: { amount: number }[]) => list.reduce((n, e) => n + e.amount, 0);
  const pay = ch.summary.payroll;
  const payroll = pay
    ? `<h3>${t("个税怎么算的", "How the income tax was worked out")}</h3><dl class="kv"><div><dt>${t("工资和年终奖", "Salary and bonus")}</dt><dd>${money(pay.salary + pay.bonus)}</dd></div><div><dt>${t("减：基本减除", "Less: basic deduction")}</dt><dd>${money(-yuan(60000))}</dd></div><div><dt>${t("减：社保（个人）", "Less: social insurance")}</dt><dd>${money(-pay.social)}</dd></div><div><dt>${t("减：公积金（个人）", "Less: housing fund")}</dt><dd>${money(-pay.fund)}</dd></div>${pay.deductions.map((d) => `<div><dt>${t("减：", "Less: ")}${esc({ rent: t("住房租金", "rent"), "mortgage-interest": t("房贷利息", "mortgage interest"), children: t("子女", "children"), elderly: t("赡养老人", "elderly support") }[d.label] ?? d.label)}</dt><dd>${money(-d.amount)}</dd></div>`).join("")}<div><dt>${t("应纳税所得额", "Taxable income")}</dt><dd>${money(pay.taxable)}</dd></div><div><dt>${t("个人所得税", "Income tax")}</dt><dd>${money(pay.tax)}</dd></div><div><dt>${t("到手", "Take-home")}</dt><dd>${money(pay.net)}</dd></div></dl>${factLine("iit")}`
    : "";
  const ok = j.opening + sum(inc) - sum(exp) + sum(ret) === j.closing;
  return `<p class="sub">${ch.year} · ${ch.age} ${t("岁", "years")}</p><div class="ledger"><section><h3>${t("收入", "Income")} <b>${money(sum(inc))}</b></h3><dl class="kv">${entryRows(inc)}</dl></section><section><h3>${t("支出", "Spending")} <b>${money(sum(exp))}</b></h3><dl class="kv">${entryRows(exp)}</dl></section><section><h3>${t("资产涨跌", "Changes in value")} <b>${money(sum(ret))}</b></h3><dl class="kv">${entryRows(ret)}</dl></section><section class="muted"><h3>${t("转账（不改变净资产）", "Transfers (no change in net worth)")}</h3><dl class="kv">${entryRows(tr)}</dl></section></div><p class="check ${ok ? "ok" : "bad"}">${t("核对", "Check")}：${money(j.opening)} + ${money(sum(inc))} − ${money(sum(exp))} ${sum(ret) < 0 ? "−" : "+"} ${money(Math.abs(sum(ret)))} = ${money(j.closing)} ${ok ? "✓" : "✗"}</p>${payroll}`;
}
function moneyAccounts(index: number) {
  const s = (index >= 0 ? app.run?.changed[index]?.state : app.run?.initial) ?? null;
  if (!s) return "";
  const loan = (name: string, balance: number, l: State["mortgage"]) =>
    l && balance
      ? `<div><dt>${name}</dt><dd>${t(`余额 ${money(balance)} · 年利率 ${(l.rate * 100).toFixed(1)}% · 月供 ${money(l.payment)} · 还剩 ${l.months} 个月`, `${money(balance)} left · ${(l.rate * 100).toFixed(1)}% · ${money(l.payment)} a month · ${l.months} months to go`)}</dd></div>`
      : "";
  return `<dl class="kv wide">${loan(t("房贷", "Mortgage"), s.assets.mortgage, s.mortgage)}${loan(t("车贷", "Car loan"), s.assets.carLoan, s.carLoan)}<div><dt>${t("公积金", "Housing fund")}</dt><dd>${money(s.assets.fund)} · ${t("只能用于买房和还房贷", "Only for buying a home or the mortgage")}</dd></div><div><dt>${t("欠款和借款", "Arrears and loans")}</dt><dd>${money(s.assets.debt)}${s.assets.debt ? t(` · 年利率 ${(s.assets.interestRate * 100).toFixed(1)}%`, ` · ${(s.assets.interestRate * 100).toFixed(1)}% a year`) : ""}${s.arrearsYears ? t(` · 已连续 ${s.arrearsYears} 年拖欠`, ` · ${s.arrearsYears} year(s) in arrears`) : ""}</dd></div><div><dt>${t("保险", "Insurance")}</dt><dd>${s.insurance.basic ? t("基本医保", "Public health insurance") : t("没有医保", "No public cover")}${s.insurance.medical ? t(` · 百万医疗险（每年约 ${money(premiums.medical(s.age))}）`, ` · hospital cover (about ${money(premiums.medical(s.age))} a year)`) : ""}${s.insurance.critical ? t(` · 重疾险（每年 ${money(s.insurance.criticalPremium)}）`, ` · critical illness (${money(s.insurance.criticalPremium)} a year)`) : ""}</dd></div></dl>${s.arrearsYears ? `<p class="warn-line">${t("欠款会先有宽限期，再卖出资产，最后搬进合租房；收入恢复后可以搬回。", "Arrears bring a grace period, then asset sales, then shared housing; recovered income lets you move back.")}</p>` : ""}`;
}
export function moneyDrawer() {
  const index = shownIndex();
  const body = app.moneyTab === "year" ? moneyYear(index) : app.moneyTab === "accounts" ? moneyAccounts(index) : moneyOverview(index);
  return drawer(t("账本", "The books"), `${moneyTabs()}<div class="sheet-body">${body}</div>`);
}
function drawer(title: string, body: string) {
  return `<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div class="sheet"><header><h2 id="drawer-title">${title}</h2>${button("close-drawer", t("关闭", "Close"), "quiet")}</header>${body}</div></div>`;
}
export function planDrawer() {
  const cfg = app.config;
  if (!cfg) return "";
  const s = shownState() ?? app.run?.initial;
  if (!s) return "";
  const plan = cfg.plans[app.shown] ?? {
    focus: s.focus,
    habits: s.habits,
    crash: s.crash,
    travel: s.travel,
    parentsSupport: s.parentsSupport,
    exercise: s.exercise,
  };
  const nextYear = planYear();
  const toggle = (key: string, on: boolean, label: string) =>
    `<button type="button" data-action="plan" data-key="${key}" data-value="${on ? "off" : "on"}" aria-pressed="${on}" class="toggle">${label}</button>`;
  const segs = (key: string, list: [string, string][], value: string) =>
    `<div class="seg" role="group">${list.map(([v, l]) => `<button type="button" data-action="plan" data-key="${key}" data-value="${v}" aria-pressed="${value === v}">${l}</button>`).join("")}</div>`;
  return drawer(
    t("计划", "Plans"),
    `<div class="sheet-body plans-form"><p class="hint">${t(`这一年已经开始，改动从 ${nextYear} 年起生效。计划会一直执行，直到你再改。`, `This year has started; changes apply from ${nextYear} and stay in force until you change them.`)}</p><section><h3>${pair(trackLabels.work)}</h3>${toggle("jobSearch", plan.habits.jobSearch, t("每两年找一次更好的工作", "Look for a better job every two years"))}${toggle("training", plan.habits.training, t("每两年一次职训", "Training every two years"))}</section><section><h3>${pair(trackLabels.money)}</h3><p>${t("每月定投指数", "Monthly into the index")}</p>${segs("monthly", [0, 500, 1000, 2000, 3000].map((n) => [String(yuan(n)), n ? money(yuan(n)) : t("不投", "None")]), String(plan.habits.monthlyInvestment))}<p>${t(`指数一年跌超过 ${crashThreshold * 100}% 时`, `When the index falls more than ${crashThreshold * 100}% in a year`)}</p>${segs("crash", Object.entries(crashNames).map(([k, v]) => [k, pair(v)]), plan.crash)}<p class="hint">${t("定了规则就不再停下来问；“照现在过”的那条线按性格随机反应。", "With a rule set you are not asked again; the carry-on line reacts by temperament.")}</p></section><section><h3>${pair(trackLabels.family)}</h3><p>${t("父母 60 岁以后，每年给父母", "After a parent turns 60, each year send")}</p>${segs("parents", parentsSupportOptions.map((n) => [String(n), n ? money(n) : t("不给", "Nothing")]), String(plan.parentsSupport))}</section><section><h3>${pair(trackLabels.health)}</h3>${toggle("exercise", plan.exercise, t("运动习惯（每年约 ¥2,400，健康 +2）", "Exercise habit (about ¥2,400 a year, health +2)"))}<p class="hint">${t("保险在抉择里买；生病的概率按年龄上升（游戏设定）。", "Insurance is bought in a choice; illness becomes likelier with age (game setting).")}</p></section><section><h3>${pair(trackLabels.far)}</h3>${segs("travel", Object.entries(travelNames).map(([k, v]) => [k, pair(v)]), plan.travel)}</section></div>`,
  );
}
export function rulesDrawer() {
  const tierRows = Object.values(tiers)
    .map(
      (tier) =>
        `<tr><td>${pair(tier.label)}</td><td>${money(tier.rent)}</td><td>${money(tier.homePrice)}</td><td>${money(tier.living)}</td><td>${tier.wage}</td></tr>`,
    )
    .join("");
  const sourceRows = (Object.keys(sources) as (keyof typeof sources)[])
    .map((id) => `<li>${sourceLink(id)} · ${sources[id].published}</li>`)
    .join("");
  return drawer(
    t("规则、参数与来源", "Rules, settings and sources"),
    `<div class="sheet-body rules"><p>${t("这是推演，不是预测。统计数字来自下面的公开资料；概率、城市价格、工资倍数和行情参数是游戏设定，写明了就不冒充统计。", "This is a simulation, not a prediction. Statistics come from the public sources below; probabilities, city prices, wage multipliers and market parameters are game settings and are labelled as such.")}</p><h3>${t("统计来源", "Statistical sources")}</h3><ul>${sourceRows}</ul><h3>${t("城市设定（游戏设定）", "City settings (game settings)")}</h3><div class="table-wrap"><table class="table"><thead><tr><th>${t("城市类型", "City type")}</th><th>${t("一居月租", "1-bed rent")}</th><th>${t("房价/㎡", "Price/m²")}</th><th>${t("一人年生活费", "Living / year")}</th><th>${t("工资倍数", "Wage ×")}</th></tr></thead><tbody>${tierRows}</tbody></table></div><h3>${t("行情（游戏设定）", "Markets (game settings)")}</h3><ul>${(["deposits", "bonds", "stocks", "property"] as const).map((k) => `<li>${pair(entryLabels[k])}: μ ${(marketConfig[k].mean * 100).toFixed(1)}%, σ ${(marketConfig[k].volatility * 100).toFixed(1)}%</li>`).join("")}<li>${t(`每年衰退概率 ${marketConfig.crisisProbability * 100}%，平行世界里按世界加减`, `Recession odds ${marketConfig.crisisProbability * 100}% a year, adjusted by world in parallel mode`)}</li></ul><h3>${t("人生事件（游戏设定）", "Life events (game settings)")}</h3><ul><li>${t(`住院：30 岁每年约 ${percent(lifeRates.hospital(30), 1)}，之后每年加 0.12 个百分点`, `Hospital stay: about ${percent(lifeRates.hospital(30), 1)} a year at 30, rising 0.12 points a year`)}</li><li>${t(`失业：35–49 岁每年约 ${percent(lifeRates.jobLoss(40), 1)}，衰退年翻倍；找到工作的基础概率每年 ${percent(lifeRates.rehire)}`, `Job loss: about ${percent(lifeRates.jobLoss(40), 1)} a year at 35–49, doubled in recessions; finding work starts at ${percent(lifeRates.rehire)} a year`)}</li><li>${t(`退休：${lifeRates.retirementAge} 岁，养老金按最后工资的 45%`, `Retirement at ${lifeRates.retirementAge} with a pension of 45% of final pay`)}</li><li>${t("主角不会死亡；疾病只写一行，不描写过程。", "The player never dies; illness gets one line, never a scene.")}</li></ul>${factLine("lifeExpectancy2024")}</div>`,
  );
}
export function restartDialog() {
  return `<dialog id="restart-dialog" aria-labelledby="restart-title"><h2 id="restart-title">${t("要重玩这一局吗？", "Replay this life?")}</h2><p>${t("这一局还没走完。你可以先去重玩页：改一件事、换一个世界，原来的这局会留在对照里。", "This run is not finished. The replay page lets you change one thing or the world; this run stays for comparison.")}</p><div class="dialog-actions">${button("dialog-cancel", t("取消，回到这一局", "Cancel and go back"), "primary")}${button("dialog-replay", t("去重玩页", "Open the replay page"))}${button("dialog-restart", t("同一开局从头来", "Start this life over"), "text-button")}</div></dialog>`;
}
export function menu() {
  if (!app.menu) return "";
  const inRun = app.page === "play" || app.page === "ending" || app.page === "replay";
  return `<div class="menu" role="menu">${inRun ? button("save", t("导出这局存档", "Export this life"), "", 'role="menuitem"') : ""}${inRun ? button("drawer", t("规则、参数与来源", "Rules and sources"), "", 'role="menuitem" data-value="rules"') : ""}${inRun ? button("restart", t("重玩…", "Replay…"), "", 'role="menuitem"') : ""}${button("home", t("回到开局", "Back to the start"), "", 'role="menuitem"')}</div>`;
}
