import { workSupport } from "./events.js";
import type { YearContext } from "./choices.js";
import { type Journal, expense, income, yuan } from "./finance.js";
import { type State, type Story, type Text, changeProps, rmb } from "./model.js";
import { tiers } from "./places.js";
import { sample } from "./random.js";
import { worldModifiers } from "./world.js";
/** Life events drawn from age-based yearly probabilities. The rates are GAME SETTINGS; where a published
 * figure exists it is shown beside the event, never presented as the player's personal odds. */
export const lifeRates = {
  dating: (age: number) => (age < 22 || age > 50 ? 0 : age <= 38 ? 0.16 : 0.07),
  hospital: (age: number) => 0.022 + 0.0012 * Math.max(0, age - 30),
  serious: (age: number) => 0.0015 + 0.0005 * Math.max(0, age - 30),
  jobLoss: (age: number) => (age < 25 ? 0.06 : age < 35 ? 0.04 : age < 50 ? 0.035 : 0.045),
  /** Base yearly chance that a job seeker finds work; most unemployment spells last months, not years. */
  rehire: 0.45,
  retirementAge: 63,
};
/** Game settings for public health insurance: 60% of hospital costs above a ¥1,500 threshold, 50% for serious
 * illness; real rates and caps differ by city and scheme. Private hospital cover pays co-pays above ¥10,000. */
const cover = { hospital: 0.6, serious: 0.5, threshold: yuan(1500), deductible: yuan(10000), critical: yuan(300000) };
export const partnerNames: Text[] = [
  ["阿禾", "A-He"],
  ["小满", "Xiaoman"],
  ["许然", "Xu Ran"],
  ["周宁", "Zhou Ning"],
  ["林夏", "Lin Xia"],
  ["沈一", "Shen Yi"],
];
const life = (id: string, month: number, text: Text, facts?: string[], support?: Story["support"]): Story => ({
  id,
  text,
  kind: "life",
  month,
  ...(facts ? { facts } : {}),
  ...(support ? { support } : {}),
});
function medical(s: State, j: Journal, total: number, publicShare: number) {
  const insured = s.insurance.basic ? Math.round(Math.max(0, total - cover.threshold) * publicShare) : 0;
  const coPay = total - insured;
  const privateCover = s.insurance.medical ? Math.max(0, coPay - cover.deductible) : 0;
  expense(s.assets, j, coPay - privateCover, "medical");
  return { insured, coPay, privateCover };
}
/** Before payday: illness can cost months of pay; a relationship can start. */
export function earlyLife(s: State, j: Journal, c: YearContext): Story[] {
  const stories: Story[] = [];
  const roll = (key: string) => sample(c.seed, c.year, `life-${key}`);
  if (roll("serious") < lifeRates.serious(s.age)) {
    const total = Math.round(yuan(220000) * s.priceLevel);
    const paid = medical(s, j, total, cover.serious);
    const claim = s.insurance.critical ? cover.critical : 0;
    if (claim) income(s.assets, j, claim, "critical-claim");
    if (s.role === "employed") {
      s.flags.unpaidLeave = c.year;
      s.flags.unpaidMonths = 4;
    }
    s.flags.serious = c.year;
    changeProps(s, { health: -14, happiness: -8, relationships: 3 });
    const [paidZh, paidEn] = rmb(paid.coPay - paid.privateCover);
    stories.push(
      life("life-serious", 3, [
        `复查确诊了一种需要手术和后续治疗的疾病。治疗共花了 ${rmb(total)[0]}，医保报销后你付了 ${paidZh}${claim ? "，重疾险一次赔了 30 万" : ""}。这一年大半时间用来恢复。`,
        `A follow-up found an illness needing surgery and treatment. It cost ${rmb(total)[1]} in all; after insurance you paid ${paidEn}${claim ? ", and the critical-illness policy paid ¥300,000" : ""}. Most of the year went to recovery.`,
      ]),
    );
  } else if (roll("hospital") < lifeRates.hospital(s.age)) {
    const total = Math.round(yuan(32000) * s.priceLevel);
    const paid = medical(s, j, total, cover.hospital);
    changeProps(s, { health: -5, happiness: -2 });
    stories.push(
      life("life-hospital", 4, [
        `急性阑尾炎住院一周，共花了 ${rmb(total)[0]}。医保报销后自付 ${rmb(paid.coPay)[0]}${paid.privateCover ? `，百万医疗险又报了 ${rmb(paid.privateCover)[0]}` : ""}。`,
        `A week in hospital with appendicitis cost ${rmb(total)[1]}. After public insurance you owed ${rmb(paid.coPay)[1]}${paid.privateCover ? `; hospital insurance paid back ${rmb(paid.privateCover)[1]}` : ""}.`,
      ]),
    );
  }
  if (
    s.family.partner === "none" &&
    s.flags.breakup !== c.year &&
    roll("dating") < lifeRates.dating(s.age) * (0.5 + s.props.relationships / 100)
  ) {
    const name = partnerNames[Math.floor(roll("name") * partnerNames.length)];
    s.family.partner = "dating";
    s.family.partnerName = name;
    s.family.since = c.year;
    // Game setting: a partner earns around the local average non-private wage (¥129,441 nationally in 2025).
    s.family.partnerSalary = Math.round(
      yuan(129441) * tiers[s.tier].wage * (0.75 + roll("partner-pay") * 0.4) * s.priceLevel,
    );
    changeProps(s, { happiness: 5, relationships: 3 });
    stories.push(
      life("life-dating", 5, [
        `你和${name[0]}开始在一张共享日历上排周末。冰箱上多了一张空日历，第一格写的是“先问对方”。`,
        `You and ${name[1]} started planning weekends on a shared calendar. A blank calendar went up on the fridge; the first square says “ask each other first”.`,
      ]),
    );
  }
  return stories;
}
/** After payday: a job can end at year end, children reach school, parents retire, the player may retire. */
export function lateLife(s: State, j: Journal, c: YearContext): Story[] {
  const stories: Story[] = [];
  const roll = (key: string) => sample(c.seed, c.year, `life-${key}`);
  const risk =
    lifeRates.jobLoss(s.age) *
    (c.market.crisis ? 2.2 : 1) *
    worldModifiers[c.world].jobLoss *
    (s.focus === "work" ? 0.85 : 1) *
    (s.props.knowledge > 70 ? 0.8 : 1);
  if (s.role === "employed" && s.age < lifeRates.retirementAge && roll("job-loss") < risk) {
    // Statutory compensation is one month's pay per year with this employer (N), capped at twelve.
    const months = Math.max(1, Math.min(12, c.year - (s.flags.jobSince ?? c.year - 3)));
    const severance = Math.round(((s.salary * s.salaryFactor) / 12) * months);
    income(s.assets, j, severance, "severance");
    s.role = "unemployed";
    s.flags.jobLost = c.year;
    changeProps(s, { happiness: -8, health: -2 });
    stories.push(
      life(
        "life-job-loss",
        11,
        [
          `年底公司调整业务线，你在名单上。按工龄拿到 ${months} 个月补偿，也开始申领失业保险。`,
          `At year end a restructuring put you on the list. You received ${months} months' severance and applied for unemployment insurance.`,
        ],
        ["unemployment2025"],
        workSupport,
      ),
    );
  }
  const findWork =
    lifeRates.rehire + s.props.knowledge * 0.003 + c.market.demand * 0.5 - (c.market.crisis ? 0.15 : 0);
  if (
    s.role === "unemployed" &&
    s.flags.jobLost !== c.year &&
    s.age < lifeRates.retirementAge &&
    roll("rehire") < findWork / worldModifiers[c.world].jobLoss
  ) {
    s.role = "employed";
    s.salaryFactor *= 0.92;
    s.flags.rehired = c.year;
    s.flags.jobSince = c.year;
    changeProps(s, { happiness: 5 });
    stories.push(
      life("life-rehired", 10, [
        "投了几十份简历，终于有一份合适的邀约。工资比之前略低，你先接下来，把还款日重新排了一遍。",
        "After dozens of applications a suitable offer came. The pay is a little lower; you took it and re-planned your repayments.",
      ]),
    );
  }
  if (s.role === "employed" && s.age >= lifeRates.retirementAge) {
    s.role = "retired";
    // Game setting: the pension replaces 45% of final pay.
    s.pension = Math.round(s.salary * s.salaryFactor * 0.45);
    stories.push(
      life("life-retire", 12, [
        "你办完了退休手续。最后一天，同事送了你一盆绿萝。",
        "You completed your retirement paperwork. On the last day colleagues gave you a pothos plant.",
      ]),
    );
  }
  const milestones: [number, Text][] = [
    [
      3,
      [
        "孩子上幼儿园了。第一周每天早上都哭，第二周开始回头说再见。",
        "Your child started kindergarten: tears every morning the first week, a wave goodbye by the second.",
      ],
    ],
    [
      6,
      [
        "孩子上小学了。你们在学校门口拍了一张照片。",
        "Your child started primary school. You took a photo at the school gate.",
      ],
    ],
    [
      12,
      [
        "孩子上初中了，有些作业你要先查资料才看得懂。",
        "Your child started middle school; some homework now needs research before you understand it.",
      ],
    ],
    [
      18,
      [
        "孩子考上了大学。走的那天，你把行李箱一直拎到了车站。",
        "Your child got into university. On the day they left you carried the suitcase all the way to the station.",
      ],
    ],
  ];
  for (const born of s.family.children)
    for (const [age, text] of milestones)
      if (c.year - born === age) stories.push(life(`life-child-${age}`, 9, text));
  if (s.family.parentsBorn !== null && c.year - s.family.parentsBorn === 60)
    stories.push(
      life("life-parent-retires", 7, [
        "家里年长的那位退休了，电话里说终于有空学太极。",
        "Your older parent retired and says on the phone there is finally time to learn tai chi.",
      ]),
    );
  if (s.family.parentsBorn !== null && c.year - s.family.parentsBorn === 75)
    stories.push(
      life("life-parent-75", 10, [
        "家里给长辈过七十五岁生日，订了一桌老人喜欢的菜。",
        "The family celebrated a seventy-fifth birthday with a table of the dishes your parent likes.",
      ]),
    );
  return stories;
}
