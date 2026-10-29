import {
            
  blankLife,
  cardPrompt,
  dimensions,
  educationLabels,
  housingLabels,
  incomeLabels,
  insuranceLabels,
  labels,
  parentsLabels,
  parseCard,
  partnerLabels,
  roleLabels,
  savingsLabels,
  specialtyLabels,
  startingSettings,
} from "../card.js";
import { yuan } from "../finance.js";
import { tierOf, tiers } from "../places.js";
import { sceneSvg } from "../scene.js";
import {              initialState, step } from "../simulation.js";
import { facts, sources } from "../stats.js";
import { incomeChart } from "./charts.js";
import { button, esc, locale, pair, rank, short, t } from "./dom.js";
import { app, startYear } from "./state.js";
const seg = (action        , value        , label        , pressed         ) =>
  `<button type="button" data-action="${action}" data-value="${value}" aria-pressed="${pressed}">${label}</button>`;
export function sourceLink(id                      ) {
  const s = sources[id];
  const label = esc(pair(s.label));
  return "url" in s && s.url ? `<a href="${s.url}" target="_blank" rel="noreferrer">${label} ↗</a>` : label;
}
export function factLine(id                    ) {
  const f = facts[id];
  return `<p class="fact"><span>${t("资料", "Data")}</span>${esc(pair(f.text))} <small>${sourceLink(f.source)}</small></p>`;
}
const quintiles = () => [
  { label: t("低收入组", "Lowest 20%"), value: yuan(10150) },
  { label: t("中间偏下", "Lower middle"), value: yuan(22702) },
  { label: t("中间组", "Middle"), value: yuan(35536) },
  { label: t("中间偏上", "Upper middle"), value: yuan(55586) },
  { label: t("高收入组", "Highest 20%"), value: yuan(103778) },
];
function setup() {
  const minutes = Math.round((app.years * 45) / 60);
  return `<fieldset class="setup"><legend>${t("这一局", "This run")}</legend><div class="row"><div class="seg" role="group" aria-label="${t("模式", "Mode")}">${seg("mode", "reality", t("现实线", "Reality line"), app.mode === "reality")}${seg("mode", "parallel", t("平行世界", "Parallel worlds"), app.mode === "parallel")}</div></div><div class="row"><div class="seg" role="group" aria-label="${t("推演年数", "Years")}">${[10, 20, 30].map((n) => seg("years", String(n), t(`${n} 年`, `${n} years`), app.years === n)).join("")}</div><span class="hint">${t(`约 ${minutes} 分钟`, `About ${minutes} min`)}</span></div></fieldset>`;
}
export function homePage() {
  const median = { label: t("中位数 ¥36,231", "Median ¥36,231"), value: yuan(36231) };
  return `<main class="home"><section class="home-intro"><p class="eyebrow">${t("下一页，怎么过", "HOW WILL THE NEXT CHAPTER GO")}</p><h1>${t("把人生往后推。<br>这次，你来选。", "A life ahead.<br>Your turn to choose.")}</h1><div class="entries">${button("random", t("随机人生 ↗", "A random life ↗"), "entry primary")}${button("personal", t("用我的资料 ↗", "Use my profile ↗"), "entry")}</div>${app.run ? `<p class="resume">${button("back-to-run", t(`回到刚才那一局（${(app.run.changed[app.shown - 1]?.year ?? app.run.config.year)} 年）→`, `Back to the run in progress (${app.run.changed[app.shown - 1]?.year ?? app.run.config.year}) →`), "text-button")}</p>` : ""}${setup()}<div class="home-foot">${button("load", t("载入存档", "Load a saved life"), "text-button")}<input id="load-file" type="file" accept=".json,application/json" hidden></div></section><section class="home-data card"><p class="eyebrow">${t("此刻的一个普通人", "AN ORDINARY PERSON TODAY")}</p><h2>${t("全国居民人均可支配收入（2025）", "China's per-capita disposable income, 2025")}</h2>${incomeChart(quintiles(), median)}<p class="source">${t("资料", "Data")}：${sourceLink("nbsIncome2025")}</p></section></main>`;
}
export function importPage() {
  return `<main class="import"><h1>${t("从你开始。", "Begin with you.")}</h1><div class="import-grid"><section class="card"><h2>${t("开图资料包", "Kaitu start pack")}</h2>${button("load-card", t("选择资料包文件", "Choose a start pack"), "primary")}<input id="card-file" type="file" accept=".json,application/json,text/plain" hidden></section><section class="card"><h2>ChatGPT / Claude / Gemini</h2>${button("copy-prompt", t("复制角色卡提示词", "Copy character prompt"), "primary")}<details id="prompt-details"><summary>${t("查看提示词", "View prompt")}</summary><textarea id="prompt" readonly>${esc(cardPrompt(locale()))}</textarea></details></section><section class="card paste"><label for="paste">${t("粘贴角色卡", "Paste a character card")}</label><textarea id="paste" placeholder="${t("把 AI 的回答整段贴进来，说明文字也可以", "Paste the whole answer, notes included")}">${esc(app.pasted)}</textarea><div class="row">${button("parse", t("检查角色卡 →", "Review card →"), "primary")}${button("manual", t("自己填写", "Fill in myself"), "text-button")}</div></section></div></main>`;
}
/** First simulated year for the preview: rough take-home, household size and national percentile. */
function preview(card      ) {
  try {
    const config         = {
      card,
      worldSeed: "preview",
      lifeSeed: "preview",
      year: startYear(),
      years: 10,
      mode: "reality",
      decisions: {},
      plans: {},
    };
    const s = initialState(card, "preview", startYear());
    const row = step(s, config, 0, "baseline");
    return { state: s, summary: row.summary };
  } catch {
    return null;
  }
}
const tag = (known         , from = t("资料", "Profile")) =>
  `<span class="tag ${known ? "known" : "unknown"}">${known ? from : t("未知 · 中性设定", "Unknown · neutral")}</span>`;
/** Left and middle cards of the review page; refreshed in place when a field changes. */
export function reviewCards(card      ) {
  const life = card.life ?? blankLife();
  const bg = card.background ?? {
    education: "",
    major: "",
    industry: "",
    occupation: "",
    experienceYears: null,
    source: "",
  };
  const start = startingSettings(card);
  const p = preview(card);
  const tier = tierOf(life.city);
  const fact = (label        , value        , known         ) =>
    `<div><dt>${label}</dt><dd>${value ? esc(value) : "—"} ${tag(known)}</dd></div>`;
  const facts = [
    fact(t("城市", "City"), life.city ? `${life.city} · ${pair(tiers[tier.tier].label)}` : "", !!life.city),
    fact(t("老家", "Hometown"), life.hometown, !!life.hometown),
    fact(t("工作", "Work"), [bg.occupation, bg.industry].filter(Boolean).join(" · ") || pair(roleLabels[card.role]), !!bg.occupation || card.role !== "unknown"),
    fact(t("学历", "Education"), [bg.education || pair(educationLabels[card.education]), bg.major].filter(Boolean).join(" · "), card.education !== "unknown" || !!bg.education),
    fact(t("住房", "Home"), pair(housingLabels[life.housing]), life.housing !== "unknown"),
    fact(
      t("家庭", "Family"),
      `${pair(partnerLabels[life.partner])}${life.children ? t(` · ${life.children} 个孩子`, ` · ${life.children} children`) : ""}`,
      life.partner !== "unknown",
    ),
    fact(t("父母", "Parents"), pair(parentsLabels[life.parents]), life.parents !== "unknown"),
    fact(t("收入", "Income"), pair(incomeLabels[life.income]), life.income !== "unknown"),
    fact(t("存款", "Savings"), pair(savingsLabels[life.savings]), life.savings !== "unknown"),
    fact(t("保险", "Insurance"), pair(insuranceLabels[life.insurance]), life.insurance !== "unknown"),
    fact(t("目标", "Goals"), life.goals.join("；"), life.goals.length > 0),
  ].join("");
  const compare = p
    ? `<div class="compare-row"><span>${t("游戏里的税前年薪", "Simulated pre-tax salary")}</span><strong>${short(p.state.salary)}</strong><small>${start.estimated.includes("salary") ? (life.income !== "unknown" ? t("按你的收入档取中值", "Midpoint of your income band") : t("游戏按职业和城市估计", "Game estimate from job and city")) : t("你设定的游戏起点", "Your game setting")}</small></div><div class="compare-row"><span>${t("第一年家庭人均到手", "Year-one take-home per person")}</span><strong>${short(p.summary.perCapita)}</strong><small>${esc(rank(p.summary.percentile))}${t("（粗略估算）", " (rough estimate)")}</small></div>${incomeChart(quintiles(), { label: t("中位数", "Median"), value: yuan(36231) }, { label: t("你", "You"), value: p.summary.perCapita }, 380)}${factLine("wage2025")}${factLine("unemployment2025")}`
    : incomeChart(quintiles(), { label: t("中位数", "Median"), value: yuan(36231) }, undefined, 380);
  const register = `<header><span class="eyebrow">${t("开局登记", "STARTING POINT")}</span><span>${startYear()} · ${card.age ?? "?"} ${t("岁", "years")}</span></header><div class="register-top"><div class="portrait" aria-hidden="true">${esc(card.name.slice(0, 1) || "·")}</div><div><h2>${esc(card.name || t("玩家", "Player"))}</h2><p class="who">${esc(card.project || t("还没写下想做的事", "No project written yet"))}</p></div></div><dl class="facts">${facts}</dl>${p ? `<div class="mini-scene">${sceneSvg(p.state, locale(), true)}</div>` : ""}`;
  return { register, compare: `<h2>${t("和全国比", "Against the national picture")}</h2>${compare}` };
}
export function reviewPage() {
  const card = app.card;
  const life = card.life ?? blankLife();
  const bg = card.background ?? {
    education: "",
    major: "",
    industry: "",
    occupation: "",
    experienceYears: null,
    source: "",
  };
  const start = startingSettings(card);
  const cards = reviewCards(card);
  const field = (name        , label        , value        , extra = "") =>
    `<label>${label}<input name="${name}" id="f-${name}" value="${esc(value)}" ${extra}></label>`;
  const select = (name        , label        , options                                           , value        ) =>
    `<label>${label}<select name="${name}" id="f-${name}">${Object.entries(options)
      .map(([k, v]) => `<option value="${esc(k)}"${k === value ? " selected" : ""}>${esc(pair(v))}</option>`)
      .join("")}</select></label>`;
  const attributes = dimensions
    .map(
      (k) =>
        `<div class="attr"><label for="f-${k}">${pair(labels[k])}</label><input id="f-${k}" name="${k}" type="number" min="0" max="100" placeholder="${t("未知", "Unknown")}" value="${card.attributes[k].value ?? ""}"><input id="f-source-${k}" name="source-${k}" value="${esc(card.attributes[k].source)}" maxlength="160" aria-label="${pair(labels[k])} ${t("依据", "source")}" placeholder="${t("依据 / 游戏设定", "Source / game setting")}"></div>`,
    )
    .join("");
  return `<main class="review"><h1>${t("这一局，从这里开始。", "This run starts here.")}</h1><form id="review-form" class="review-grid"><section class="card register" id="register">${cards.register}</section><section class="card compare" id="compare">${cards.compare}</section><section class="card start-form"><h2>${t("游戏起点", "Game starting point")}</h2><div class="field-row"><label>${t("年龄", "Age")}<input name="age" id="f-age" type="number" min="18" max="90" required value="${card.age ?? ""}"></label>${select("game-role", t("就业状态", "Employment"), Object.fromEntries(Object.entries(roleLabels).filter(([k]) => k !== "unknown")), start.role)}</div><div class="field-row">${field("game-salary", t("税前年薪 · 元", "Pre-tax salary · RMB"), start.salary === null ? "" : String(start.salary), `type="number" min="0" max="100000000" placeholder="${t("留空按职业和城市估计", "Blank: estimate from job and city")}"`)}${field("game-experience", t("工作年数", "Years worked"), String(start.experienceYears), 'type="number" min="0" max="76" required')}</div><div class="field-row">${field("game-cash", t("现金 · 元", "Cash · RMB"), String(start.cash), 'type="number" min="0" max="1000000000" required')}${field("game-deposits", t("存款和投资 · 元", "Savings · RMB"), String(start.deposits), 'type="number" min="0" max="1000000000" required')}</div><h3>${t("四种状态 · 0–100", "Four states · 0–100")}</h3><div class="attributes">${attributes}</div><details id="facts-form"${app.error ? " open" : ""}><summary>${t("改开局资料", "Edit starting facts")}</summary><div class="field-row">${field("name", t("昵称", "Alias"), card.name, 'maxlength="24"')}${field("project", t("想做的一件事", "Something you want to do"), card.project, 'maxlength="80"')}</div><div class="field-row">${field("city", t("现在的城市", "Current city"), life.city, 'maxlength="40"')}${field("hometown", t("老家", "Hometown"), life.hometown, 'maxlength="40"')}</div><div class="field-row">${select("housing", t("住房", "Home"), housingLabels, life.housing)}${select("partner", t("伴侣", "Partner"), partnerLabels, life.partner)}</div><div class="field-row">${field("children", t("孩子个数", "Children"), life.children === null ? "" : String(life.children), 'type="number" min="0" max="12"')}${select("parents", t("年长一位父母", "Older parent"), parentsLabels, life.parents)}</div><div class="field-row">${select("income", t("税前年收入档", "Income band"), incomeLabels, life.income)}${select("savings", t("存款档", "Savings band"), savingsLabels, life.savings)}</div><div class="field-row">${select("insurance", t("保险", "Insurance"), insuranceLabels, life.insurance)}${select("role", t("资料里的就业状态", "Employment on record"), roleLabels, card.role)}</div><div class="field-row">${field("bg-occupation", t("具体岗位", "Occupation"), bg.occupation, 'maxlength="100"')}${field("bg-industry", t("行业", "Industry"), bg.industry, 'maxlength="100"')}</div><div class="field-row">${field("bg-education", t("已完成学历", "Completed education"), bg.education, 'maxlength="80"')}${field("bg-major", t("专业", "Field of study"), bg.major, 'maxlength="100"')}</div><div class="field-row">${select("education", t("学历规则标签", "Education rule tag"), educationLabels, card.education)}${select("specialty", t("专业规则标签", "Field rule tag"), specialtyLabels, card.specialty)}</div><div class="field-row">${[0, 1, 2].map((i) => field(`goal-${i}`, t(`目标 ${i + 1}`, `Goal ${i + 1}`), life.goals[i] ?? "", 'maxlength="40"')).join("")}</div></details><p class="error" id="review-error" role="alert"></p><div class="form-actions">${button("edit-paste", t("返回", "Back"), "text-button")}<button class="primary" type="submit">${t("开始这一局 →", "Start this life →")}</button></div></section></form></main>`;
}
/** Reads the review form back through the card parser, so the same validation applies. */
export function readReview(form                 , card      )       {
  const d = new FormData(form);
  const num = (name        ) => (d.get(name) === "" || d.get(name) === null ? null : Number(d.get(name)));
  const text = (name        ) => String(d.get(name) ?? "");
  const life = card.life ?? blankLife();
  return parseCard(
    JSON.stringify({
      ...card,
      name: text("name") || card.name,
      age: num("age"),
      role: text("role") || card.role,
      education: text("education") || card.education,
      specialty: text("specialty") || card.specialty,
      project: d.has("project") ? text("project") : card.project,
      background: {
        ...(card.background ?? {}),
        education: d.has("bg-education") ? text("bg-education") : card.background?.education,
        major: d.has("bg-major") ? text("bg-major") : card.background?.major,
        industry: d.has("bg-industry") ? text("bg-industry") : card.background?.industry,
        occupation: d.has("bg-occupation") ? text("bg-occupation") : card.background?.occupation,
        experienceYears: card.background?.experienceYears ?? null,
        source: card.background?.source ?? "",
      },
      starting: {
        role: text("game-role") || null,
        experienceYears: num("game-experience"),
        cash: num("game-cash"),
        deposits: num("game-deposits"),
        salary: num("game-salary"),
      },
      life: {
        ...life,
        city: d.has("city") ? text("city") : life.city,
        hometown: d.has("hometown") ? text("hometown") : life.hometown,
        housing: text("housing") || life.housing,
        partner: text("partner") || life.partner,
        children: d.has("children") ? num("children") : life.children,
        parents: text("parents") || life.parents,
        income: text("income") || life.income,
        savings: text("savings") || life.savings,
        insurance: text("insurance") || life.insurance,
        goals: d.has("goal-0") ? [0, 1, 2].map((i) => text(`goal-${i}`)).filter(Boolean) : life.goals,
      },
      attributes: Object.fromEntries(
        dimensions.map((k) => [k, { value: num(k), source: text(`source-${k}`) }]),
      ),
    }),
  );
}
