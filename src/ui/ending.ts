import { dimensions, labels, roleLabels } from "../card.js";
import { choiceById, trackLabels } from "../choices.js";
import { netWorth } from "../finance.js";
import type { State, Text, WorldId } from "../model.js";
import { peerLine } from "../peers.js";
import type { Attribution, Run } from "../simulation.js";
import { BRANCH_YEAR, axes, axisLabels, hiddenEndings, worldAxes, worlds } from "../world.js";
import { lineChart } from "./charts.js";
import { button, esc, pair, rank, short, signed, t } from "./dom.js";
import { housingNames } from "./labels.js";
import { choiceName } from "./play.js";
import { app } from "./state.js";
/** Life-trace endings from the six-world event table draft; at most three plus the open ending. */
const traces: { id: string; title: Text; text: Text; when: (run: Run, end: State) => boolean }[] = [
  {
    id: "venture-on",
    title: ["这门生意还在", "The business is still going"],
    text: [
      "账上有收入，也有成本和不能随口答应的售后。你留下了一门具体的生意：有人付钱，有人使用，有人和你一起承担它。它的大小，不替这一段人生打分。",
      "There is income on the books, and costs, and promises you cannot make lightly. You left a real business: someone pays, someone uses it, someone carries it with you. Its size does not grade this life.",
    ],
    when: (_r, s) => s.role === "founder",
  },
  {
    id: "venture-off",
    title: ["结束不等于没有发生", "Ending is not the same as never happening"],
    text: [
      "这门生意已经停营。客户的安排与剩下的账有了去处，合作过的人也没有自动变成失败证据。你不再继续它，并不抹去它曾解决过的具体问题。",
      "The business closed. Customers and the remaining accounts found a place; the people you worked with did not become evidence of failure. Stopping it does not erase the problems it once solved.",
    ],
    when: (_r, s) => s.flags.businessFailed !== undefined && s.role !== "founder",
  },
  {
    id: "work",
    title: ["职位以外，仍有一段工作", "Beyond the job title, there was work"],
    text: [
      "你经历过合同、岗位或工时的变化，也留下了能让后来者少猜几步的经验。最后一张工牌不能概括这一段；离开岗位，也不把此前做过的事清零。",
      "You lived through changes of contract, role or hours, and left experience that saves the next person some guessing. The last badge does not sum up this stretch; leaving a post does not erase the work before it.",
    ],
    when: (r, s) => s.flags.jobLost !== undefined || (s.flags.jobSince ?? 0) > r.config.year,
  },
  {
    id: "learning",
    title: ["你真的学会过一件事", "You really learned something"],
    text: [
      "起初有一处你不会，后来多了一件你能辨认、能解释或能亲手做出的东西。它未必换来证书和涨薪，却已经进入你看世界的方法里。",
      "At first there was something you could not do; later there was one more thing you could recognise, explain or make. It may not have brought a certificate or a raise, but it is now part of how you see the world.",
    ],
    when: (r, s) => s.props.knowledge - r.initial.props.knowledge >= 8 || s.education !== r.initial.education,
  },
  {
    id: "creative",
    title: ["作品留下自己的去向", "The work found its own way"],
    text: [
      "有一件作品，因为你作出的取舍而与最初不同。它可以被人看见，也可以暂时收好；这一局没有把热度当作它唯一存在的证据。",
      "One piece of work turned out different from the first idea because of your choices. It can be seen or put away for now; this run did not treat popularity as the only proof it exists.",
    ],
    when: (_r, s) => s.flags["custom-creative"] !== undefined,
  },
  {
    id: "care",
    title: ["没有写在头衔里的那一段", "The part no title mentions"],
    text: [
      "你把不少时间放在照料与日常维持上，也终于让别人接过一小班。故事没有因为这些事缺少响亮名字，就把它们归到空白年份。",
      "You spent a lot of time caring and keeping daily life going, and finally let someone else take a shift. The story does not file these years as blank just because they lack a loud name.",
    ],
    when: (_r, s) => s.flags.caregiver !== undefined || s.family.children.length > 0,
  },
  {
    id: "connection",
    title: ["有些人仍能找到你", "Some people can still find you"],
    text: [
      "有人搬走，有人换了账户，也有人只在一顿普通晚饭里出现。关系没有被计成连续签到；这一段留下的，是几个不必每次都有好消息才敢联系的人。",
      "Some moved away, some changed accounts, some only appeared at an ordinary dinner. Relationships were not counted as daily check-ins; what remains is a few people you can call without good news first.",
    ],
    when: (_r, s) => s.props.relationships >= 65,
  },
];
const open: { title: Text; text: Text } = {
  title: ["故事在这里存档，不是在这里定论", "The story is saved here, not settled here"],
  text: [
    "有些事尚未发生，有些问题你没有回答，还有一些计划只走到中途。这张卡记录的是本次模拟停下的位置，不是你余生的判词。",
    "Some things have not happened, some questions went unanswered, some plans are only halfway. This card records where the simulation stopped, not a verdict on the rest of your life.",
  ],
};
function lineColumn(s: State, label: string, tone: "base" | "you", perCapita: number, percentile: number, year: number) {
  const kids = s.family.children.filter((b) => year - b >= 0).length;
  const family =
    s.family.partner === "married"
      ? t(`已婚${kids ? `，${kids} 个孩子` : ""}`, `Married${kids ? `, ${kids} child${kids > 1 ? "ren" : ""}` : ""}`)
      : s.family.partner === "living"
        ? t("和伴侣住在一起", "Living with a partner")
        : s.family.partner === "dating"
          ? t("恋爱中", "In a relationship")
          : t("单身", "Single");
  return `<div class="line-col ${tone}"><h3><span class="key ${tone}"></span>${label}</h3><p class="hero">${short(netWorth(s.assets))}</p><p class="sub">${t("净资产", "Net worth")} · ${esc(rank(percentile))}</p><dl class="kv"><div><dt>${t("工作", "Work")}</dt><dd>${pair(roleLabels[s.role])}</dd></div><div><dt>${t("住处", "Home")}</dt><dd>${esc(s.place === "hometown" ? s.hometown : s.city)} · ${pair(housingNames[s.housing])}</dd></div><div><dt>${t("家庭", "Family")}</dt><dd>${esc(family)}</dd></div><div><dt>${t("人均到手", "Take-home pp")}</dt><dd>${short(perCapita)}</dd></div>${dimensions.map((k) => `<div><dt>${pair(labels[k])}</dt><dd>${s.props[k]}</dd></div>`).join("")}</dl></div>`;
}
function causes(list: Attribution[]) {
  if (!list.length)
    return `<p class="sub">${t("每一步都照现在过", "You carried on at every step")}</p>`;
  return `<ol class="causes">${list
    .slice(0, 3)
    .map((a) => {
      const props = dimensions
        .filter((k) => Math.abs(a.props[k]) >= 3)
        .map((k) => `${pair(labels[k])} ${a.props[k] > 0 ? "+" : ""}${a.props[k]}`)
        .join(" · ");
      const track = choiceById.get(a.choice)?.track ?? "work";
      return `<li><span class="mark">◆</span><div><b>${a.year} · ${pair(trackLabels[track])}：${esc(choiceName(a))}</b><p>${t("和只把这一步换回“照现在过”相比", "Compared with changing only this step back")}：${t("净资产", "net worth")} ${esc(signed(a.netWorth))}${props ? ` · ${esc(props)}` : ""}</p></div></li>`;
    })
    .join("")}</ol>`;
}
export function endingPage(attribution: Attribution[]) {
  const run = app.run;
  const cfg = app.config;
  if (!run || !cfg) return "";
  const last = run.changed.at(-1);
  const base = run.baseline[run.changed.length - 1];
  if (!last || !base) return "";
  const world: WorldId = last.market.world;
  const parallel = cfg.mode === "parallel" && last.year >= BRANCH_YEAR;
  const hidden = last.state.flags.bridge !== undefined ? "bridge" : last.state.flags.witness !== undefined ? "witness" : null;
  const years = run.changed.map((r) => r.year);
  const marks = run.changed.flatMap((r, i) => r.choices.filter((p) => !p.stay).map((p) => ({ index: i, label: choiceName(p) })));
  const picked = traces.filter((x) => x.when(run, last.state)).slice(0, 3);
  const axesHtml = parallel
    ? `<div class="axes"><h3>${t(`${BRANCH_YEAR} 年的世界变量`, `World variables in ${BRANCH_YEAR}`)}</h3>${axes.map((k) => `<div class="axis"><span>${pair(axisLabels[k])}</span><span class="bar"><i data-w="${worldAxes(cfg.worldSeed, BRANCH_YEAR)[k]}"></i></span></div>`).join("")}</div>`
    : "";
  return `<main class="ending"><section class="ending-head"><p class="eyebrow">${last.year} · ${last.age} ${t("岁 · 推演结束", "years · The run is over")}</p><h1>${esc(cfg.card.name || t("你", "You"))}${t(`，往后推了 ${cfg.years} 年`, `, ${cfg.years} years on`)}</h1></section><section class="card world-end"><p class="eyebrow">${parallel ? t(`平行世界 · ${BRANCH_YEAR} 年转弯 · 科幻推演`, `Parallel worlds · Turned in ${BRANCH_YEAR} · Science fiction`) : t("现实线 · 世界没有分叉", "Reality line · No branch")}</p><h2>${pair(worlds[world].name)}</h2><p class="basis">${esc(pair(worlds[world].basis))}</p><p class="ending-text">${esc(pair(worlds[world].ending))}</p>${hidden ? `<div class="hidden-end"><p class="eyebrow">${t("隐藏世界 · 人机融合", "Hidden world · Human–machine merging")}</p><h3>${esc(pair(hiddenEndings[hidden].title))}</h3><p>${esc(pair(hiddenEndings[hidden].text))}</p></div>` : ""}${axesHtml}</section><section class="card two-lines"><div class="section-head"><h2>${t("同一个世界，两条人生", "One world, two lives")}</h2></div><div class="lines">${lineColumn(base.state, t("照现在过", "Carrying on"), "base", base.summary.perCapita, base.summary.percentile, last.year)}<div class="line-chart"><div class="legend"><span class="key base">${t("照现在过", "Carrying on")}</span><span class="key you">${t("你的选择", "Your choices")}</span><span class="key mark">${t("你做了不同的选择", "A different choice")}</span></div>${lineChart(
    years,
    [
      { label: t("照现在过", "Carrying on"), values: run.baseline.slice(0, years.length).map((r) => r.summary.netWorth), tone: "base" },
      { label: t("你的选择", "Your choices"), values: run.changed.map((r) => r.summary.netWorth), tone: "you" },
    ],
    marks,
    { height: 260, title: t("两条线的净资产", "Net worth on both lines") },
  )}</div>${lineColumn(last.state, t("你的选择", "Your choices"), "you", last.summary.perCapita, last.summary.percentile, last.year)}</div></section><section class="card"><h2>${t("改变最多的几步", "The steps that changed most")}</h2>${causes(attribution)}</section><section class="traces">${[...picked.map((x) => ({ title: x.title, text: x.text })), open].map((x) => `<article class="card trace"><h3>${esc(pair(x.title))}</h3><p>${esc(pair(x.text))}</p></article>`).join("")}</section>${app.peers.length ? `<section class="card peers"><h2>${t(`和你同岁的三个人，${last.year} 年`, `Three people your age, ${last.year}`)}</h2><ul>${app.peers.map((p) => `<li><b>${esc(pair(p.name))}</b><span>${esc(pair(p.city))}</span><p>${esc(pair(peerLine(p, (p.years[years.length - 1] ?? p.years.at(-1))?.state ?? run.initial)))}</p></li>`).join("")}</ul></section>` : ""}<section class="ending-actions">${button("png", t("导出对照卡 PNG", "Export comparison PNG"))}${button("save", t("导出这局存档", "Export this life"))}${button("to-replay", t("再推一次 →", "Play again →"), "primary")}</section></main>`;
}
export interface ReplayOption {
  key: string;
  year: number;
  choice: string;
  current: string;
  /** Option id the run took. */
  taken: string;
  options: { id: string; label: string; blocked: boolean }[];
}
export function replayPage(list: ReplayOption[]) {
  const run = app.run;
  const cfg = app.config;
  if (!run || !cfg) return "";
  const done = !run.pending && run.changed.length >= cfg.years;
  const selected = list.find((o) => o.key === app.replayKey);
  const choices = list.length
    ? `<ol class="replay-list">${list
        .map(
          (o) =>
            `<li><button type="button" data-action="replay-key" data-value="${esc(o.key)}" aria-pressed="${o.key === app.replayKey}"><span class="y">${o.year}</span><span>${esc(pair(trackLabels[choiceById.get(o.choice)?.track ?? "work"]))}</span><b>${esc(o.current)}</b></button></li>`,
        )
        .join("")}</ol>`
    : `<p class="hint">${t("还没有做过抉择", "No choices yet")}</p>`;
  const alternatives = selected
    ? `<div class="replay-options"><p>${t("换成：", "Change to:")}</p><div class="seg wrap" role="group">${selected.options
        .map(
          (o) =>
            `<button type="button" data-action="replay-pick" data-value="${esc(o.id)}" aria-pressed="${app.replayPick?.option === o.id}"${o.blocked || o.id === selected.taken ? " disabled" : ""}>${esc(o.label)}${o.id === selected.taken ? t("（原来选的）", " (taken)") : ""}</button>`,
        )
        .join("")}</div><div class="row">${button("replay-continue", t("从这一年接着玩", "Play on from that year"), "primary", app.replayPick ? "" : "disabled")}${button("replay-ending", t("直接看结局", "Go straight to the ending"), "", app.replayPick ? "" : "disabled")}</div></div>`
    : "";
  const worldButtons =
    cfg.mode === "parallel"
      ? `<div class="seg wrap" role="group">${(Object.keys(worlds) as WorldId[]).map((w) => `<button type="button" data-action="replay-world" data-value="${w}">${pair(worlds[w].name)}</button>`).join("")}<button type="button" data-action="replay-world" data-value="random">${t("随机一个世界", "A random world")}</button></div>`
      : `${button("replay-world", t("改用平行世界再推一次", "Replay in parallel worlds"), "primary", 'data-value="random"')}`;
  const shelf = app.lines.length
    ? `<section class="card shelf"><h2>${t("这次打开后推过的人生", "Lives played this session")}</h2><div class="table-wrap"><table class="table"><thead><tr><th></th><th>${t("世界", "World")}</th><th>${t("净资产", "Net worth")}</th>${dimensions.map((k) => `<th>${pair(labels[k])}</th>`).join("")}<th></th></tr></thead><tbody>${app.lines
        .map((line, i) => {
          const end = line.run.changed.at(-1);
          if (!end) return "";
          return `<tr><td>${esc(pair(line.label))}</td><td>${esc(pair(worlds[end.market.world].name))}</td><td>${short(end.summary.netWorth)}</td>${dimensions.map((k) => `<td>${end.state.props[k]}</td>`).join("")}<td>${button("open-line", t("看结局", "Ending"), "text-button", `data-value="${i}"`)}</td></tr>`;
        })
        .join("")}</tbody></table></div></section>`
    : "";
  return `<main class="replay"><h1>${t("再推一次", "Play it again")}</h1>${done ? "" : `<p class="notice">${t(`这一局停在 ${run.changed[app.shown - 1]?.year ?? cfg.year} 年。`, `This run is paused in ${run.changed[app.shown - 1]?.year ?? cfg.year}.`)} ${button("back-to-run", t("回到这一局", "Back to the run"), "text-button")}</p>`}<div class="replay-grid"><section class="card"><h2>${t("同一个世界，只改一件事", "Same world, change one thing")}</h2>${choices}${alternatives}</section><section class="card"><h2>${t("同一个我，换一个世界", "Same me, another world")}</h2>${worldButtons}</section><section class="card"><h2>${t("换一个人", "Someone else")}</h2><div class="row">${button("random", t("随机人生 ↗", "A random life ↗"), "primary")}${button("personal", t("用我的资料 ↗", "Use my profile ↗"))}${button("restart-same", t("同一开局从头来", "Start this life over"), "text-button")}</div></section></div>${shelf}</main>`;
}
export function lineLabel(kind: "original" | "changed" | "world", detail = ""): Text {
  if (kind === "original") return ["原来的你", "The original run"];
  if (kind === "changed") return [`改了：${detail}`, `Changed: ${detail}`];
  return [`换到：${detail}`, `World: ${detail}`];
}
