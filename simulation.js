import {            blankLife, dimensions, parseCard, startingSettings } from "./card.js";
import {
              
                   
  carriedOn,
  choiceById,
  choiceIdOf,
  choiceKey,
  choices,
  defaultPick,
  downOptions,
  mortgageRate,
  premiums,
  rejectPick,
  yearOptions,
} from "./choices.js";
import { progressChains } from "./decisions.js";
import { createEngine } from "./engine.js";
import { debtSupport, events, support } from "./events.js";
import { everydayEvents } from "./everyday.js";
import {
               
  annuity,
  assetReturn,
  closeJournal,
  emptyBalance,
  expense,
  income,
  liquid,
  netWorth,
  openJournal,
  repay,
  transfer,
  yuan,
} from "./finance.js";
import { earlyLife, lateLife, partnerNames } from "./life.js";
import { invest, investBehavior, marketFor, settleMarket } from "./market.js";
import {
               
              
            
              
            
              
            
             
             
               
  changeProps,
  clamp,
} from "./model.js";
import { tierOf, tiers } from "./places.js";
import { sample } from "./random.js";
import { incomePercentile } from "./stats.js";
import {                               payroll, payrollRules } from "./tax.js";
import {
  BRANCH_YEAR,
            
  crisisNews,
  hiddenChain,
  hiddenNews,
  newsOrder,
  sharedNews,
  transitionNews,
  worldFor,
  worldModifiers,
  worlds,
} from "./world.js";
                                                       
export const windows = [10, 20, 30]         ;
                                             
                         
             
                    
                   
               
               
             
                                                     
                                  
                                                                        
                              
 
/** Which life a step simulates: the player's, the carry-on baseline, or a same-age peer. */
                                                   
/** strict: every due choice needs a pick; stay: missing or no longer valid picks fall back to carrying on. */
                                       
                          
              
                 
                 
                                                                                         
               
                       
 
                      
                 
                 
                      
                     
                          
 
const engine = createEngine([...events, ...everydayEvents]);
export const defaultHabits = ()         => ({ jobSearch: false, training: false, monthlyInvestment: 0 });
export const defaultPlan = ()       => ({
  focus: "balanced",
  habits: defaultHabits(),
  crash: "ask",
  travel: "short",
  parentsSupport: 0,
  exercise: false,
});
export const parentsSupportOptions = [0, 6000, 12000, 24000].map(yuan);
export function planOf(s       )       {
  return {
    focus: s.focus,
    habits: structuredClone(s.habits),
    crash: s.crash,
    travel: s.travel,
    parentsSupport: s.parentsSupport,
    exercise: s.exercise,
  };
}
function applyPlan(s       , plan      ) {
  s.focus = plan.focus;
  s.habits = structuredClone(plan.habits);
  s.crash = plan.crash;
  s.travel = plan.travel;
  s.parentsSupport = plan.parentsSupport;
  s.exercise = plan.exercise;
}
/** Game estimate when the card gives neither a salary nor an income band. */
function estimateSalary(card      , role               , experience        , tier               ) {
  const education = { secondary: 0.86, vocational: 1, degree: 1.12, postgraduate: 1.22, unknown: 1 }[
    card.education
  ];
  const specialty = { service: 0.88, technical: 1.15, creative: 0.95, general: 1 }[card.specialty];
  const base = { employed: 96000, founder: 110000, student: 24000, unemployed: 12000, retired: 36000 }[role];
  return yuan(base * education * specialty * (1 + Math.min(25, experience) * 0.012) * tiers[tier].wage);
}
export function initialState(card      , seed        , year = 2026)        {
  if (card.age === null) throw new Error("请填写当前年龄 / Enter your current age");
  const start = startingSettings(card);
  const life = card.life ?? blankLife();
  const here = tierOf(life.city).tier;
  const home = life.hometown ? tierOf(life.hometown).tier : here;
  const t = tiers[here];
  const assets = emptyBalance();
  assets.cash = yuan(start.cash);
  assets.deposits = yuan(start.deposits);
  const role = start.role;
  const salary = start.salary !== null ? yuan(start.salary) : estimateSalary(card, role, start.experienceYears, here);
  // Game estimate of the housing fund built up so far: both contributions, about half already withdrawn.
  if (role === "employed")
    assets.fund = Math.round(salary * payrollRules.fundRate * 2 * Math.min(start.experienceYears, 4) * 0.5);
  let housing                   = life.housing === "family" ? "family" : "rent";
  let mortgage              = null;
  if (life.housing === "owned" || life.housing === "owned-mortgage") {
    housing = "owned";
    assets.property = t.homePrice * t.homeSize;
    if (life.housing === "owned-mortgage") {
      // Game estimate: half the home value is still owed over twenty years.
      assets.mortgage = Math.round(assets.property * 0.5);
      mortgage = { rate: mortgageRate, payment: annuity(assets.mortgage, mortgageRate, 20), months: 240 };
    }
  }
  const partner = life.partner === "married" ? "married" : life.partner === "dating" ? "dating" : "none";
  const parentsBorn = {
    "under-60": year - 56,
    "60-70": year - 64,
    "over-70": year - 73,
    none: null,
    unknown: year - card.age - 28,
  }[life.parents];
  return {
    age: card.age,
    props: Object.fromEntries(dimensions.map((k) => [k, card.attributes[k].value ?? 50]))                  ,
    role,
    education: card.education,
    specialty: card.specialty,
    experience: start.experienceYears,
    assets,
    abroad: false,
    investor: false,
    housing,
    place: "city",
    city: life.city,
    hometown: life.hometown,
    tier: here,
    homeTier: home,
    // Game setting: people rent what they can afford, at most a quarter of monthly pay.
    rent: housing === "rent" ? Math.min(t.rent, Math.round((salary / 12) * 0.25)) : 0,
    salary,
    pension: role === "retired" ? Math.round(yuan(36000) * t.wage) : 0,
    priceLevel: 1,
    mortgage,
    carLoan: null,
    car: false,
    insurance: {
      basic: life.insurance !== "none",
      medical: life.insurance === "basic-plus",
      critical: false,
      criticalPremium: 0,
      criticalUntil: 0,
    },
    family: {
      partner,
      partnerName:
        partner === "none" ? null : partnerNames[Math.floor(sample(seed, 0, "partner") * partnerNames.length)],
      since: partner === "dating" ? year - 1 : partner === "married" ? year - 4 : null,
      partnerSalary:
        partner === "none" ? 0 : Math.round(yuan(129441) * t.wage * (0.75 + sample(seed, 0, "partner-pay") * 0.4)),
      partnerCanSupport: partner === "married",
      children: Array.from({ length: life.children ?? 0 }, (_, i) => year - 2 - i * 3),
      pet: false,
      parentsBorn,
      care: "remote",
    },
    goals: [...life.goals],
    flags: {
      jobSince: year - Math.min(start.experienceYears, 3),
      ...(partner === "married" ? { married: year - 4 } : {}),
    },
    lastEvents: {},
    asked: {},
    salaryFactor: 1,
    businessScale: 1,
    arrearsYears: 0,
    focus: "balanced",
    habits: defaultHabits(),
    habitsPending: [],
    crash: "ask",
    travel: "short",
    parentsSupport: 0,
    exercise: false,
  };
}
export function annualIncome(s       , m        ) {
  if (s.role === "employed")
    return Math.round(
      s.salary * s.salaryFactor * (1 + m.demand * 0.4) * (s.focus === "work" ? 1.04 : 1) * (s.abroad ? 1.12 : 1),
    );
  if (s.role === "founder")
    return Math.round(s.salary * 1.1 * s.businessScale * (1 + m.demand) * (s.focus === "work" ? 1.06 : 1));
  if (s.role === "student") return Math.round(yuan(24000) * s.priceLevel);
  if (s.role === "unemployed") return Math.round(yuan(12000) * s.priceLevel);
  return s.pension;
}
function focusYear(s       ) {
  const effects                                                  = {
    work: { health: -3, knowledge: 2, relationships: -2, happiness: -1 },
    balanced: { health: 1, happiness: 1 },
    people: { relationships: 5, happiness: 2, knowledge: -1 },
    health: { health: 5, happiness: 1 },
    learning: { knowledge: 5, health: -1 },
    hobby: { happiness: 5, knowledge: 1 },
  };
  changeProps(s, effects[s.focus]);
  // States drift back toward the middle so long runs do not pile up at 0 or 100.
  for (const k of dimensions) s.props[k] = clamp(s.props[k] + Math.round((55 - s.props[k]) * 0.14));
  if (s.age > 45) changeProps(s, { health: -1 });
  if (s.age > 60) changeProps(s, { health: -1 });
}
function habits(s       , j         , m        , seed        , offset        )          {
  const stories          = [];
  s.habitsPending = [];
  if (offset < 1) return stories;
  if (s.habits.training && m.year - (s.flags.lastTraining ?? Number.NEGATIVE_INFINITY) >= 2) {
    if (liquid(s.assets) >= yuan(17000)) {
      s.flags.lastTraining = m.year;
      expense(s.assets, j, yuan(3500), "training");
      changeProps(s, { knowledge: 4 });
      stories.push({
        id: "habit-training",
        text: [
          "两年一次的职训按计划完成，你把新方法带回了日常工作。",
          "The scheduled vocational course gave you a method to try in everyday work.",
        ],
        kind: "habit",
      });
    } else s.habitsPending.push("training");
  }
  if (s.habits.jobSearch && m.year - (s.flags.lastJobSearch ?? Number.NEGATIVE_INFINITY) >= 2) {
    if (s.role === "employed" || s.role === "unemployed") {
      if (liquid(s.assets) >= yuan(14000)) {
        s.flags.lastJobSearch = m.year;
        expense(s.assets, j, yuan(1200), "job-search");
        const ok = sample(seed, m.year, "habit-job") < 0.23 + s.props.knowledge * 0.003 + m.demand * 0.4;
        if (ok) {
          s.role = "employed";
          s.salaryFactor *= 1.08;
        }
        stories.push({
          id: `habit-job-${ok ? "offer" : "waiting"}`,
          text: ok
            ? [
                "定期投递带来一份更合适的邀约，你接受了新工作。",
                "Regular applications brought a better-fitting offer; you accepted.",
              ]
            : [
                "这一轮投递没有合适的邀约，原来的收入安排继续。",
                "This round brought no suitable offer; your current income arrangement continued.",
              ],
          kind: "habit",
        });
      } else s.habitsPending.push("job-search");
    } else s.habitsPending.push("job-search");
  }
  return stories;
}
function deductions(s       , year        )              {
  const list              = [];
  if (s.housing === "rent" || s.housing === "shared")
    list.push({ label: "rent", amount: tiers[s.tier].rentDeduction * 12 });
  else if (s.mortgage) list.push({ label: "mortgage-interest", amount: payrollRules.monthly.mortgageInterest * 12 });
  const kids = s.family.children.filter((born) => year - born <= 21).length;
  if (kids) list.push({ label: "children", amount: payrollRules.monthly.child * 12 * kids });
  if (s.family.parentsBorn !== null && year - s.family.parentsBorn >= 60)
    list.push({ label: "elderly", amount: payrollRules.monthly.elderly * 12 });
  return list;
}
function payday(s       , j         , c             ) {
  const m = c.market;
  const shift = worldModifiers[c.world];
  if (c.offset > 0) {
    if (s.role === "employed") {
      // Game setting: nominal raises slow with seniority, about 4% early in a career and under 3% later.
      const raise =
        0.015 +
        m.inflation * 0.8 +
        (s.experience < 8 ? 0.015 : s.experience < 15 ? 0.006 : 0) +
        (s.focus === "work" ? 0.008 : 0) +
        (s.props.knowledge - 50) * 0.0002 +
        shift.wage +
        (m.crisis ? -0.04 : 0);
      s.salary = Math.round(s.salary * (1 + clamp(raise, -0.12, 0.15)));
    }
    if (s.role === "retired") s.pension = Math.round(s.pension * 1.02);
    if (s.family.partner !== "none")
      s.family.partnerSalary = Math.round(s.family.partnerSalary * (1 + 0.02 + m.inflation + shift.wage));
  }
  const earned = annualIncome(s, m);
  let takeHome = 0;
  let slip                 = null;
  if (s.role === "employed") {
    const unpaid = s.flags.unpaidLeave === c.year ? (s.flags.unpaidMonths ?? 0) : 0;
    const salary = Math.round(((earned * (12 - unpaid)) / 12) * (s.flags.posting === c.year ? 1.25 : 1));
    const months = clamp(Math.floor(sample(c.seed, c.year, "bonus") * 3) - (m.crisis ? 1 : 0), 0, 2);
    const bonus = Math.round((salary / 12) * months);
    slip = payroll(salary, bonus, deductions(s, c.year));
    income(s.assets, j, salary, "salary");
    if (bonus) income(s.assets, j, bonus, "bonus");
    income(s.assets, j, slip.fund, "fund-employer", "fund");
    expense(s.assets, j, slip.social, "social-insurance");
    if (slip.tax) expense(s.assets, j, slip.tax, "income-tax");
    transfer(s.assets, j, "cash", "fund", slip.fund, "fund-employee");
    takeHome = slip.net;
  } else if (s.role === "founder") {
    income(s.assets, j, earned, "business-income");
    // Game settings: a simplified small-business tax and flexible-employment social insurance.
    const tax = Math.round(earned * 0.06);
    const social = Math.round(yuan(12000) * s.priceLevel);
    expense(s.assets, j, tax, "business-tax");
    expense(s.assets, j, social, "social-insurance");
    takeHome = earned - tax - social;
  } else {
    income(s.assets, j, earned, { student: "stipend", unemployed: "odd-jobs", retired: "pension" }[s.role]);
    takeHome = earned;
    if (s.role === "unemployed" && s.flags.jobLost !== undefined && c.year - s.flags.jobLost <= 1) {
      // Game setting for unemployment insurance in the year after losing a job.
      const benefit = Math.round(yuan(1900 * 12) * s.priceLevel);
      income(s.assets, j, benefit, "unemployment-benefit");
      takeHome += benefit;
    }
  }
  if (s.family.partner === "married" || s.family.partner === "living") {
    const share = s.family.partner === "married" ? 1 : 0.45;
    const amount = Math.round(payroll(s.family.partnerSalary, 0).net * share);
    income(s.assets, j, amount, "partner-income");
    takeHome += amount;
  }
  return { slip, takeHome };
}
function payLoan(s       , j         , loan      , liability                        , label        ) {
  const balance = s.assets[liability];
  const months = Math.min(12, loan.months);
  const interest = Math.round(balance * loan.rate * (months / 12));
  const principal = Math.min(balance, Math.max(0, loan.payment * months - interest));
  if (liability === "mortgage")
    transfer(s.assets, j, "fund", "cash", Math.min(s.assets.fund, interest + principal), "fund-mortgage");
  expense(s.assets, j, interest, label);
  repay(s.assets, j, principal, 0, liability);
  loan.months -= months;
  return loan.months <= 0 || s.assets[liability] === 0;
}
function household(s       , j         , c             , takeHome        )          {
  const stories          = [];
  const t = tiers[s.tier];
  const p = s.priceLevel;
  const couple = s.family.partner === "married" || s.family.partner === "living";
  const living = t.living * p * (couple ? 1.6 : 1) * (s.abroad ? 1.35 : 1);
  // Game setting: spending follows income down to a 45% floor instead of staying fixed.
  expense(s.assets, j, Math.round(living * clamp(0.45 + (0.55 * takeHome) / (living * 1.6), 0.45, 1)), "living");
  if (s.family.care === "together" && s.flags.parentsTogether === c.year)
    expense(s.assets, j, Math.round(t.living * p * (s.place === "hometown" ? 0.2 : 0.4)), "parents-living");
  if (s.housing === "rent" || s.housing === "shared") {
    if (c.offset > 0) {
      s.rent = Math.round(s.rent * (1 + c.market.rentGrowth));
      if (c.market.rentGrowth > 0.05 && s.housing === "rent") {
        const rent = Math.round(s.rent / 100).toLocaleString("en-US");
        const texts                  = [
          [
            `房东说房租要涨到每月 ${rent} 元。你对比了三套房，还是续签了。`,
            `The landlord raised the rent to ¥${rent} a month. You compared three flats and renewed anyway.`,
          ],
          [
            `房租又涨了，这次到每月 ${rent} 元。你把搬家的念头记进备忘录，还是签了字。`,
            `The rent went up again, to ¥${rent} a month. You noted down the idea of moving, and signed anyway.`,
          ],
          [
            `房租涨到每月 ${rent} 元。这份合同你已经能背出每一条，没有再去看别的房子。`,
            `The rent rose to ¥${rent} a month. You knew every clause of the lease by heart by now, and did not look elsewhere.`,
          ],
        ];
        stories.push({ id: "rent-rise", kind: "consequence", month: 3, text: texts[Math.min(s.flags.rentRises ?? 0, 2)] });
        s.flags.rentRises = (s.flags.rentRises ?? 0) + 1;
      }
    }
    expense(s.assets, j, Math.round(s.rent * (s.housing === "shared" ? 0.6 : 1) * 12), "rent");
  } else if (s.housing === "temporary") expense(s.assets, j, Math.round(yuan(22000) * p), "temporary-housing");
  else if (s.housing === "owned") expense(s.assets, j, Math.round(yuan(4000) * p), "property-fees");
  if (s.mortgage && payLoan(s, j, s.mortgage, "mortgage", "mortgage-interest")) {
    s.mortgage = null;
    stories.push({
      id: "mortgage-paid",
      kind: "consequence",
      month: 12,
      text: ["最后一笔房贷还完了。你把银行发来的结清证明打印了出来。", "The last mortgage payment went through. You printed the bank's settlement letter."],
    });
  }
  if (s.car) {
    expense(s.assets, j, Math.round(yuan(7000) * p), "car-running");
    assetReturn(s.assets, j, "car", -0.15);
    if (s.carLoan && payLoan(s, j, s.carLoan, "carLoan", "car-interest")) s.carLoan = null;
  } else expense(s.assets, j, Math.round(t.transit * p * (couple ? 1.5 : 1)), "transit");
  for (const born of s.family.children) {
    const age = c.year - born;
    if (age < 0 || age > 21) continue;
    expense(s.assets, j, Math.round(t.child * p * (age < 3 ? 0.8 : age < 6 ? 1 : age < 15 ? 1.15 : 1.3)), "children");
  }
  if (s.parentsSupport > 0 && s.family.parentsBorn !== null && c.year - s.family.parentsBorn >= 60) {
    expense(s.assets, j, s.parentsSupport, "parents-support");
    changeProps(s, { relationships: 1 });
  }
  if (s.insurance.medical) expense(s.assets, j, premiums.medical(s.age), "insurance");
  if (s.insurance.critical && c.year <= s.insurance.criticalUntil)
    expense(s.assets, j, s.insurance.criticalPremium, "insurance");
  const trip = { none: 0, short: 5000, long: 15000 }[s.travel];
  if (trip) {
    expense(s.assets, j, Math.round(yuan(trip) * p * (couple ? 1.7 : 1)), "travel");
    if (s.travel === "long") changeProps(s, { happiness: 2, relationships: couple ? 1 : 0 });
  }
  if (s.exercise) {
    expense(s.assets, j, Math.round(yuan(2400) * p), "exercise");
    changeProps(s, { health: 2, happiness: 1 });
  }
  if (s.family.pet) expense(s.assets, j, Math.round(yuan(2000) * p), "pet");
  // Unpaid bills and personal loans charge interest; scheduled principal is paid from what is left above a
  // small reserve. Only principal paid moves both debt and cash; unpaid principal is not a second expense.
  expense(s.assets, j, Math.round(s.assets.debt * s.assets.interestRate), "interest");
  if (s.assets.debt > 0) repay(s.assets, j, Math.max(yuan(6000), Math.round(s.assets.debt * 0.12)), yuan(6000));
  return stories;
}
function debtConsequences(s       , j         )          {
  const stories          = [];
  const add = (id        , text               , help                   ) =>
    stories.push({ id, text, kind: "consequence", month: 11, ...(help ? { support: help } : {}) });
  if (j.arrears > 0) {
    s.arrearsYears++;
    changeProps(s, { happiness: -4, health: -2 });
    if (s.arrearsYears === 1)
      add("debt-notice", [
        "未付账单进入催缴，你先申请了宽限安排。本年欠款和利息仍留在账上。",
        "Unpaid bills triggered a collection notice. You requested a grace arrangement; debt and interest remained on the books.",
      ], debtSupport);
    else if (s.arrearsYears === 2) {
      const sale = s.assets.stocks + s.assets.bonds + s.assets.property + s.assets.car;
      for (const a of ["stocks", "bonds", "property", "car"]         )
        transfer(s.assets, j, a, "cash", s.assets[a], "debt-asset-sale");
      if (sale > 0) {
        expense(s.assets, j, Math.round(sale * 0.015), "sale-fees");
        if (s.mortgage) repay(s.assets, j, s.assets.mortgage, 0, "mortgage");
        if (s.carLoan) repay(s.assets, j, s.assets.carLoan, 0, "carLoan");
        s.mortgage = s.assets.mortgage ? s.mortgage : null;
        s.carLoan = s.assets.carLoan ? s.carLoan : null;
        s.car = false;
        repay(s.assets, j, s.assets.debt, yuan(12000));
        if (s.housing === "owned") {
          s.housing = "rent";
          s.rent = Math.round(tiers[s.tier].rent * s.priceLevel);
        }
        add("debt-sell", [
          "宽限期后仍未补齐欠款，你出售了可处置的资产。交易费用付出后，所得优先还债。",
          "After the grace period, arrears remained. You sold available assets and used proceeds, after fees, to repay debt.",
        ], debtSupport);
      } else if (s.housing !== "family") {
        s.housing = "shared";
        if (!s.rent) s.rent = Math.round(tiers[s.tier].rent * s.priceLevel);
        expense(s.assets, j, yuan(2400), "moving");
        add("debt-shared", [
          "你搬进合租房压低固定开支。打包时舍弃了一些家具，债务还需要新的收入来解决。",
          "You moved into shared housing to reduce fixed costs, leaving some furniture behind. Debt still required new income.",
        ], debtSupport);
      }
    } else if (s.arrearsYears >= 3 && (s.housing === "rent" || s.housing === "owned")) {
      s.housing = "shared";
      if (!s.rent) s.rent = Math.round(tiers[s.tier].rent * s.priceLevel);
      expense(s.assets, j, yuan(2400), "moving");
      add("debt-shared", [
        "你搬进合租房，把省下的租金排进还款计划。",
        "You moved into shared housing and put the rent saving into the repayment plan.",
      ], debtSupport);
    } else if (
      s.arrearsYears >= 4 &&
      s.housing === "shared" &&
      s.role === "unemployed" &&
      liquid(s.assets) === 0 &&
      !s.family.partnerCanSupport &&
      s.props.relationships < 25
    ) {
      s.housing = "temporary";
      add(
        "housing-temporary",
        [
          "租约无法续上，你暂时没有固定住所，开始联系临时住宿和当地支持服务。",
          "Unable to renew the lease, you temporarily had no stable home and contacted temporary housing and local support services.",
        ],
        support,
      );
    }
  } else if (s.arrearsYears > 0) {
    s.arrearsYears = 0;
    add("debt-current", [
      "本年的账单终于按时付清。旧债还没消失，但催缴停止了，你继续按计划偿还。",
      "This year’s bills were paid on time. Older debt remained, but collection stopped while regular repayments continued.",
    ]);
  }
  if (s.housing === "temporary" && liquid(s.assets) > yuan(16000)) {
    expense(s.assets, j, yuan(4500), "moving");
    s.housing = "shared";
    add("housing-recovery", [
      "新的收入让你付得起押金，你搬回一间固定的合租房。",
      "New income covered a deposit and a stable room in shared housing.",
    ]);
  }
  return stories;
}
function worldStories(c             )          {
  const out          = [];
  const news = (id        , month        , text               ) => out.push({ id, kind: "world", month, text });
  if (c.mode === "parallel") {
    if (c.year === BRANCH_YEAR)
      news("world-transition", 1, [
        `${transitionNews[0]}从这一年起，世界走向「${worlds[c.world].name[0]}」。`,
        `${transitionNews[1]} From this year the world turns toward ${worlds[c.world].name[1]}.`,
      ]);
    const h = hiddenChain(c.worldSeed);
    if (h.contactOk && c.year === h.contact) news("hidden-contact", 2, hiddenNews.contact);
    if (h.aiOk && c.year === h.ai) news("hidden-ai", 4, hiddenNews.ai);
    if (h.robotsOk && c.year === h.robots) news("hidden-robots", 5, hiddenNews.robots);
    if (h.warOk && c.year === h.warStart) news("hidden-war", 2, hiddenNews.warStart);
    if (h.warOk && h.victoryOk && c.year === h.warEnd) news("hidden-ceasefire", 2, hiddenNews.warEnd);
    if (h.unlocked && c.year === h.warEnd + 1) news("hidden-unlock", 1, hiddenNews.unlock);
  }
  const branched = c.mode === "parallel" && c.year >= BRANCH_YEAR;
  const list = branched ? worlds[c.world].news : sharedNews;
  const step = branched ? c.year - BRANCH_YEAR : c.offset;
  const index = newsOrder(c.worldSeed, list.length, branched ? c.world : "shared")[step % list.length];
  if (c.market.crisis) {
    const k = Math.floor(sample(c.worldSeed, c.year, "crisis-news") * crisisNews.length);
    news(`world-crisis-${k}`, 7, crisisNews[k]);
  } else news(`world-news-${c.world}-${index}`, 7, list[index]);
  return out;
}
function beginYear(previous       , config        , offset        , line      ) {
  const s = structuredClone(previous);
  const year = config.year + offset;
  const world = worldFor(config.mode, config.worldSeed, year);
  const market = marketFor(config.worldSeed, year, world);
  if (offset > 0) {
    s.age++;
    s.priceLevel *= 1 + market.inflation;
  }
  const plan = line === "changed" ? config.plans[offset] : undefined;
  if (plan) applyPlan(s, plan);
  const context              = {
    year,
    offset,
    market,
    world,
    mode: config.mode,
    seed: config.lifeSeed,
    worldSeed: config.worldSeed,
  };
  return { s, context };
}
/** Picks for peers: a seeded choice among the options they can take, favouring carrying on. */
function peerPick(choice        , s       , c             ) {
  const options = choice.options(s, c).filter((o) => !o.blocked);
  const weights = options.map((o) => (o.stay ? 2 : 1));
  let roll = sample(c.seed, c.year, `peer-${choice.id}`) * weights.reduce((a, b) => a + b, 0);
  const option =
    options.find((_, i) => {
      roll -= weights[i];
      return roll < 0;
    }) ?? options[0];
  return defaultPick(choice, s, c, option);
}
function runChoices(
  s       ,
  j         ,
  c             ,
  config        ,
  line      ,
  policy        ,
  stopAtMissing         ,
) {
  const stories          = [];
  const picked           = [];
  for (const choice of choices) {
    // At most two stops a year; anything else still due is asked next year.
    if (picked.length >= 2) break;
    if (!choice.due(s, c)) continue;
    const key = choiceKey(choice, c.year);
    const options = choice.options(s, c);
    const stayOption = options.find((o) => o.stay) ?? options[0];
    let pick                  ;
    if (line === "baseline") pick = defaultPick(choice, s, c, stayOption);
    else if (line === "peer") pick = peerPick(choice, s, c);
    else {
      pick = config.decisions[key];
      const rejected = pick ? rejectPick(choice, s, c, pick) : null;
      if (rejected) {
        if (policy === "strict") throw new Error(rejected);
        pick = undefined;
      }
      if (!pick) {
        if (stopAtMissing) return { stories, picked, pending: choice };
        if (policy === "strict") throw new Error(`缺少抉择 / Missing decision: ${key}`);
        pick = defaultPick(choice, s, c, stayOption);
      }
    }
    s.asked[choice.id] = c.year;
    for (const st of choice.apply(s, j, c, pick)) stories.push({ ...st, month: st.month ?? 1 });
    if (choice.repeat) {
      if (pick.option === stayOption.id) s.flags[`carried-${choice.id}`] = carriedOn(s, choice.id) + 1;
      else delete s.flags[`carried-${choice.id}`];
    }
    picked.push({ key, choice: choice.id, pick, stayOption: stayOption.id, stay: pick.option === stayOption.id });
  }
  return { stories, picked, pending: null };
}
/** The next choice the player must answer before `offset` can be simulated, or null. */
export function pendingAt(previous       , config        , offset        )                 {
  const { s, context } = beginYear(previous, config, offset, "changed");
  const r = runChoices(s, openJournal(s.assets), context, config, "changed", "strict", true);
  return r.pending ? { key: choiceKey(r.pending, context.year), choice: r.pending, offset, state: s, context } : null;
}
function summarize(s       , j         , c             , slip                , takeHome        )          {
  const couple = s.family.partner === "married" || s.family.partner === "living";
  const household = 1 + (couple ? 1 : 0) + s.family.children.filter((b) => c.year - b <= 21).length;
  const interest = j.entries
    .filter((e) => e.kind === "return" && (e.label === "deposits" || e.label === "bonds"))
    .reduce((n, e) => n + Math.max(0, e.amount), 0);
  const total = takeHome + interest;
  const perCapita = Math.round(total / household);
  return {
    netWorth: j.closing,
    change: j.closing - j.opening,
    income: total,
    household,
    perCapita,
    percentile: incomePercentile(perCapita, c.year),
    payroll: slip,
  };
}
export function step(
  previous       ,
  config        ,
  offset        ,
  line       = "changed",
  policy         = "strict",
)          {
  const { s, context: c } = beginYear(previous, config, offset, line);
  const market = c.market;
  const journal = openJournal(s.assets);
  const stories          = [];
  const add = (month        , list         ) => {
    for (const st of list) stories.push({ ...st, month: st.month ?? month });
  };
  add(7, worldStories(c));
  const chosen = runChoices(s, journal, c, config, line, policy, false);
  add(1, chosen.stories);
  focusYear(s);
  if (s.role === "student" && s.flags.graduation === undefined) s.flags.graduation = c.year + 2;
  add(2, progressChains(s, journal, market, c.seed));
  add(4, earlyLife(s, journal, c));
  add(5, habits(s, journal, market, c.seed, offset));
  const pay = payday(s, journal, c);
  add(3, household(s, journal, c, pay.takeHome));
  if (!s.investor && liquid(s.assets) > yuan(80000) && investBehavior(s, c.seed, c.year).start)
    invest(s, journal, yuan(12000), "index", true);
  settleMarket(s, journal, market, c.seed, line === "changed" ? s.crash : "temperament");
  if (s.flags.chased === c.year)
    stories.push({
      id: "investment-chase",
      kind: "consequence",
      month: 10,
      text: [
        "上一年的大涨让你追加了一笔投入。买入按这年的价格，结果没有复制上一年的涨幅。",
        "Last year’s rally prompted an extra investment. You bought at this year’s prices; last year’s return did not repeat.",
      ],
    });
  if (s.flags.panic === c.year && s.flags.ruleSale !== c.year && line !== "changed")
    stories.push({
      id: "investment-panic",
      kind: "consequence",
      month: 11,
      text: [
        "下跌让你把股票换回存款。这次卖出锁定了账面结果，后面的行情将发生在账户之外。",
        "The downturn led you to move stocks back to deposits. Selling locked in the account result; later market moves would happen outside that holding.",
      ],
    });
  if (s.flags.ruleSale === c.year || s.flags.ruleAdd === c.year)
    stories.push({
      id: s.flags.ruleSale === c.year ? "investment-rule-sell" : "investment-rule-add",
      kind: "consequence",
      month: 11,
      text:
        s.flags.ruleSale === c.year
          ? [
              "指数大跌，按你定的规则卖出了股票，钱回到存款里。",
              "The index fell hard; your rule sold the stocks back into deposits.",
            ]
          : [
              "指数大跌，按你定的规则又投入了一笔。",
              "The index fell hard; your rule added more at the lower price.",
            ],
    });
  add(3, engine.next(s, journal, market, sample(c.seed, c.year, "annual-event")));
  // A second everyday event in most years, not all: a life of 20–30 years should not use up the pool.
  if (sample(c.seed, c.year, "second-event") < 0.6)
    add(8, engine.next(s, journal, market, sample(c.seed, c.year, "annual-event-2")));
  add(11, lateLife(s, journal, c));
  add(11, debtConsequences(s, journal));
  if (s.role === "employed" || s.role === "founder") s.experience++;
  const buffer = Math.round(yuan(18000) * s.priceLevel);
  if (s.assets.cash > buffer) transfer(s.assets, journal, "cash", "deposits", s.assets.cash - buffer, "savings");
  closeJournal(s.assets, journal);
  stories.sort((a, b) => (a.month ?? 6) - (b.month ?? 6));
  return {
    year: c.year,
    age: s.age,
    offset,
    market,
    stories,
    state: s,
    journal,
    choices: chosen.picked,
    summary: summarize(s, journal, c, pay.slip, pay.takeHome),
  };
}
/** Replays the command log. The baseline always runs to the end; the player's line stops at the first choice
 * still waiting for an answer unless the policy fills it with carrying on. */
export function simulate(input        , options                                          = {})      {
  const config = structuredClone(input);
  const initial = initialState(config.card, config.lifeSeed, config.year);
  const run      = { config, initial, baseline: [], changed: [], pending: null };
  if (options.baseline !== false) {
    let state = initial;
    for (let i = 0; i < config.years; i++) {
      const row = step(state, config, i, "baseline");
      run.baseline.push(row);
      state = row.state;
    }
  }
  return continueRun(run, config, 0, options.policy);
}
/** Keeps the player's chapters before `from` and replays the rest under `input`. Earlier years cannot depend on
 * later plans or picks, so a plan for next year or an answered choice only costs the years after it. */
export function continueRun(run     , input        , from        , policy         = "strict")      {
  const config = input === run.config ? input : structuredClone(input);
  const next      = { ...run, config, changed: run.changed.slice(0, from), pending: null };
  let state = next.changed.at(-1)?.state ?? run.initial;
  for (let i = next.changed.length; i < config.years; i++) {
    if (policy !== "stay") {
      next.pending = pendingAt(state, config, i);
      if (next.pending) break;
    }
    const row = step(state, config, i, "changed", policy);
    next.changed.push(row);
    state = row.state;
  }
  return next;
}
                                             
               
                   
                                                     
 
/** For each choice that differs from carrying on: replay with only that pick changed back and compare the end. */
export function attribution(run     )                {
  const last = run.changed.at(-1);
  if (!last || run.pending) return [];
  const score = (a             ) =>
    Math.abs(a.netWorth) / yuan(100000) + dimensions.reduce((n, k) => n + Math.abs(a.props[k]), 0) / 10;
  return run.changed
    .flatMap((row) => row.choices.map((p) => ({ ...p, year: row.year })))
    .filter((p) => !p.stay)
    .map((p) => {
      const alt = structuredClone(run.config);
      alt.decisions[p.key] = { option: p.stayOption };
      const end = simulate(alt, { policy: "stay", baseline: false }).changed.at(-1)?.state ?? last.state;
      return {
        ...p,
        netWorth: netWorth(last.state.assets) - netWorth(end.assets),
        props: Object.fromEntries(dimensions.map((k) => [k, last.state.props[k] - end.props[k]]))                        ,
      };
    })
    .sort((a, b) => score(b) - score(a));
}
const focuses = ["work", "balanced", "people", "health", "learning", "hobby"];
function validPlan(p         )            {
  if (!p || typeof p !== "object") return false;
  const plan = p        ;
  return (
    focuses.includes(plan.focus) &&
    !!plan.habits &&
    typeof plan.habits.jobSearch === "boolean" &&
    typeof plan.habits.training === "boolean" &&
    Number.isSafeInteger(plan.habits.monthlyInvestment) &&
    plan.habits.monthlyInvestment >= 0 &&
    plan.habits.monthlyInvestment <= yuan(10000) &&
    ["ask", "hold", "add", "sell"].includes(plan.crash) &&
    ["none", "short", "long"].includes(plan.travel) &&
    parentsSupportOptions.includes(plan.parentsSupport) &&
    typeof plan.exercise === "boolean"
  );
}
/** Save boundary: validate the versioned command log, never restore arbitrary runtime state. */
export function parseSave(text        )         {
  if (text.length > 100000) throw new Error("存档过长 / Save too large");
  const data = JSON.parse(text);
  if (data?.kind === "kaitu-simulation" && data.version === 2)
    throw new Error(
      "这是旧版存档（version 2）。新版加入了买房、家庭、保险等抉择，规则不同，无法原样重放，请重新开一局 / This version 2 save uses older rules and cannot be replayed; please start a new life",
    );
  if (!data || data.kind !== "kaitu-simulation" || data.version !== 3)
    throw new Error("需要 version 3 游戏存档 / Version 3 save required");
  const c = data.config;
  if (!c || !Number.isInteger(c.year) || c.year < 1900 || c.year > 2200)
    throw new Error("无效年份 / Invalid year");
  for (const k of ["worldSeed", "lifeSeed"])
    if (typeof c[k] !== "string" || c[k].length < 1 || c[k].length > 40)
      throw new Error("无效种子 / Invalid seed");
  if (!windows.includes(c.years)) throw new Error("无效推演年数 / Invalid number of years");
  if (!["reality", "parallel"].includes(c.mode)) throw new Error("无效模式 / Invalid mode");
  if (
    !c.decisions ||
    !c.plans ||
    typeof c.decisions !== "object" ||
    typeof c.plans !== "object" ||
    Array.isArray(c.decisions) ||
    Array.isArray(c.plans)
  )
    throw new Error("无效操作记录 / Invalid command log");
  const config         = {
    card: parseCard(JSON.stringify(c.card)),
    year: c.year,
    worldSeed: c.worldSeed,
    lifeSeed: c.lifeSeed,
    years: c.years,
    mode: c.mode,
    decisions: {},
    plans: {},
  };
  for (const [key, value] of Object.entries(c.decisions)) {
    const p = value        ;
    if (
      !/^[a-z]+(-\d{4})?$/.test(key) ||
      !choiceById.has(choiceIdOf(key)) ||
      !p ||
      typeof p.option !== "string" ||
      !/^[a-z]{1,16}$/.test(p.option) ||
      (p.down !== undefined && !downOptions.includes(p.down       )) ||
      (p.years !== undefined && !yearOptions.includes(p.years      )) ||
      (p.funding !== undefined && !["self", "loan"].includes(p.funding)) ||
      (p.investment !== undefined && !["bonds", "index"].includes(p.investment)) ||
      (p.custom !== undefined && !["creative", "learning", "community"].includes(p.custom))
    )
      throw new Error("无效决策 / Invalid decision");
    config.decisions[key] = {
      option: p.option,
      ...(p.down !== undefined ? { down: p.down } : {}),
      ...(p.years !== undefined ? { years: p.years } : {}),
      ...(p.funding ? { funding: p.funding } : {}),
      ...(p.investment ? { investment: p.investment } : {}),
      ...(p.custom ? { custom: p.custom } : {}),
    };
  }
  for (const [key, value] of Object.entries(c.plans)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 0 || n >= config.years || !validPlan(value))
      throw new Error("无效年度计划 / Invalid annual plan");
    const p = value        ;
    config.plans[n] = {
      focus: p.focus,
      habits: {
        jobSearch: p.habits.jobSearch,
        training: p.habits.training,
        monthlyInvestment: p.habits.monthlyInvestment,
      },
      crash: p.crash,
      travel: p.travel,
      parentsSupport: p.parentsSupport,
      exercise: p.exercise,
    };
  }
  return config;
}
