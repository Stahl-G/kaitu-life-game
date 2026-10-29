import { type Card, type Locale, blankCard, dimensions } from "./card.js";
import { netWorth } from "./finance.js";
import { type State, type Text, rmb } from "./model.js";
import { sample } from "./random.js";
import { type Config, initialState, step } from "./simulation.js";
/** Three invented people of the player's age, simulated by the same engine in the same world with their own
 * seeded choices. They make the spread of ordinary lives visible; they are characters, not statistics. */
interface Preset {
  name: Text;
  job: Text;
  city: Text;
  hometown: Text;
  role: "employed" | "founder";
  education: Card["education"];
  specialty: Card["specialty"];
  salary: number;
  deposits: number;
  partner: "none" | "dating" | "married";
  housing: "rent" | "family" | "owned-mortgage";
  children: number;
}
const presets: Preset[] = [
  {
    name: ["小雅", "Ya"],
    job: ["县城中学老师", "County school teacher"],
    city: ["营山县", "Yingshan County"],
    hometown: ["营山县", "Yingshan County"],
    role: "employed",
    education: "degree",
    specialty: "service",
    salary: 78000,
    deposits: 50000,
    partner: "dating",
    housing: "family",
    children: 0,
  },
  {
    name: ["阿杰", "Jie"],
    job: ["外卖骑手", "Delivery rider"],
    city: ["郑州", "Zhengzhou"],
    hometown: ["周口", "Zhoukou"],
    role: "employed",
    education: "secondary",
    specialty: "service",
    salary: 96000,
    deposits: 20000,
    partner: "none",
    housing: "rent",
    children: 0,
  },
  {
    name: ["Mia", "Mia"],
    job: ["外企财务", "Finance at a multinational"],
    city: ["上海", "Shanghai"],
    hometown: ["无锡", "Wuxi"],
    role: "employed",
    education: "postgraduate",
    specialty: "general",
    salary: 320000,
    deposits: 260000,
    partner: "married",
    housing: "rent",
    children: 0,
  },
  {
    name: ["老秦", "Qin"],
    job: ["工厂班组长", "Factory shift lead"],
    city: ["佛山", "Foshan"],
    hometown: ["湛江", "Zhanjiang"],
    role: "employed",
    education: "vocational",
    specialty: "technical",
    salary: 110000,
    deposits: 90000,
    partner: "married",
    housing: "owned-mortgage",
    children: 1,
  },
  {
    name: ["小舟", "Zhou"],
    job: ["开奶茶店", "Runs a tea shop"],
    city: ["长沙", "Changsha"],
    hometown: ["衡阳", "Hengyang"],
    role: "founder",
    education: "vocational",
    specialty: "creative",
    salary: 90000,
    deposits: 40000,
    partner: "dating",
    housing: "rent",
    children: 0,
  },
];
function peerCard(p: Preset, age: number, locale: Locale, seed: string): Card {
  const i = locale === "zh" ? 0 : 1;
  const card = blankCard();
  card.name = p.name[i];
  card.age = age;
  card.role = p.role;
  card.education = p.education;
  card.specialty = p.specialty;
  if (card.background) card.background.occupation = p.job[i];
  card.life = {
    city: p.city[i],
    hometown: p.hometown[i],
    housing: p.housing,
    partner: p.partner,
    children: p.children,
    parents: "unknown",
    income: "unknown",
    savings: "unknown",
    insurance: "basic",
    goals: [],
    source: "",
  };
  card.starting = {
    role: p.role,
    experienceYears: Math.max(0, age - 22),
    cash: 10000,
    deposits: p.deposits,
    salary: p.salary,
  };
  for (const [k, key] of dimensions.entries())
    card.attributes[key] = { value: 40 + Math.floor(sample(seed, k, "peer-attr") * 25), source: "" };
  return card;
}
export interface PeerYear {
  year: number;
  state: State;
}
export interface Peer {
  name: Text;
  job: Text;
  city: Text;
  years: PeerYear[];
}
/** Picks three presets by the life seed and simulates them for the whole window. */
export function simulatePeers(config: Config, locale: Locale): Peer[] {
  const age = config.card.age ?? 30;
  const order = presets
    .map((p, i) => [p, sample(config.lifeSeed, i, "peer-order")] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([p]) => p);
  return order.map((p, n) => {
    const peerConfig: Config = {
      ...config,
      card: peerCard(p, age, locale, `${config.lifeSeed}-${n}`),
      lifeSeed: `${config.lifeSeed}-peer-${n}`,
      decisions: {},
      plans: {},
    };
    let state = initialState(peerConfig.card, peerConfig.lifeSeed, config.year);
    const years: PeerYear[] = [];
    for (let i = 0; i < config.years; i++) {
      const row = step(state, peerConfig, i, "peer");
      years.push({ year: row.year, state: row.state });
      state = row.state;
    }
    return { name: p.name, job: p.job, city: p.city, years };
  });
}
/** One line about a peer's year: work, home, family and a rounded net worth. */
export function peerLine(peer: Peer, s: State): Text {
  const work: Text =
    s.role === "employed"
      ? peer.job
      : (
          {
            founder: ["自己做生意", "running a business"],
            student: ["回学校读书", "back in school"],
            unemployed: ["在找工作", "looking for work"],
            retired: ["退休了", "retired"],
          } as const
        )[s.role];
  const home: Text =
    s.housing === "owned"
      ? ["有了自己的房子", "owns a home"]
      : s.housing === "family"
        ? ["住在家里", "lives with family"]
        : ["租房", "renting"];
  const family: Text =
    s.family.partner === "married"
      ? s.family.children.length
        ? [`已婚，${s.family.children.length} 个孩子`, `married, ${s.family.children.length} child${s.family.children.length > 1 ? "ren" : ""}`]
        : ["已婚", "married"]
      : s.family.partner === "dating" || s.family.partner === "living"
        ? ["恋爱中", "in a relationship"]
        : ["单身", "single"];
  const worth = rmb(Math.round(netWorth(s.assets) / 1000000) * 1000000);
  return [
    `${work[0]} · ${home[0]} · ${family[0]} · 净资产约 ${worth[0]}`,
    `${work[1]} · ${home[1]} · ${family[1]} · about ${worth[1]}`,
  ];
}
