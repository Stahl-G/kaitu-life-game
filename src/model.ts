import type { Dimension, Education, Role, Specialty } from "./card.js";
import type { BalanceSheet, Journal } from "./finance.js";
import type { Tier } from "./places.js";
import type { Payroll } from "./tax.js";
export type Text = readonly [string, string];
export type Focus = "work" | "balanced" | "people" | "health" | "learning" | "hobby";
export type DecisionKind = "career" | "business" | "abroad" | "invest" | "study" | "stay" | "custom";
export type WorldId =
  | "continuity"
  | "cyberpunk"
  | "corporate_war"
  | "post_scarcity"
  | "agi_flood"
  | "bloc_conflict";
export interface Decision {
  kind: DecisionKind;
  funding?: "self" | "loan";
  investment?: "bonds" | "index" | "property";
  custom?: "creative" | "learning" | "community";
}
/** The player's answer to one choice; option ids belong to that choice, the rest are second-step settings. */
export interface Pick {
  option: string;
  down?: number;
  years?: number;
  funding?: "self" | "loan";
  investment?: "bonds" | "index";
  custom?: "creative" | "learning" | "community";
}
export interface Habits {
  jobSearch: boolean;
  training: boolean;
  monthlyInvestment: number;
}
export type CrashRule = "ask" | "hold" | "add" | "sell";
export type Travel = "none" | "short" | "long";
export interface Loan {
  rate: number;
  /** Monthly instalment in fen. */
  payment: number;
  months: number;
}
export type Partner = "none" | "dating" | "living" | "married";
export interface State {
  age: number;
  props: Record<Dimension, number>;
  role: Exclude<Role, "unknown">;
  education: Education;
  specialty: Specialty;
  experience: number;
  assets: BalanceSheet;
  abroad: boolean;
  investor: boolean;
  housing: "rent" | "shared" | "owned" | "temporary" | "family";
  place: "city" | "hometown";
  city: string;
  hometown: string;
  tier: Tier;
  homeTier: Tier;
  /** Monthly rent while renting. */
  rent: number;
  /** Base yearly pay of the current job, before focus and economy multipliers. */
  salary: number;
  pension: number;
  /** Cumulative price level since the first simulated year. */
  priceLevel: number;
  mortgage: Loan | null;
  carLoan: Loan | null;
  car: boolean;
  insurance: { basic: boolean; medical: boolean; critical: boolean; criticalPremium: number; criticalUntil: number };
  family: {
    partner: Partner;
    partnerName: Text | null;
    since: number | null;
    partnerSalary: number;
    partnerCanSupport: boolean;
    /** Birth years. */
    children: number[];
    pet: boolean;
    /** Birth year of the older parent; null when not applicable. */
    parentsBorn: number | null;
    care: "remote" | "hired" | "together" | "nearby";
  };
  goals: string[];
  flags: Record<string, number | undefined>;
  lastEvents: Record<string, number>;
  /** Year each choice was last put to the player. */
  asked: Record<string, number>;
  salaryFactor: number;
  businessScale: number;
  arrearsYears: number;
  focus: Focus;
  habits: Habits;
  habitsPending: string[];
  crash: CrashRule;
  travel: Travel;
  /** Yearly money sent to parents once one of them is 60. */
  parentsSupport: number;
  exercise: boolean;
}
/** Year plan applied from a given year onward; the latest plan stays in force. */
export interface Plan {
  focus: Focus;
  habits: Habits;
  crash: CrashRule;
  travel: Travel;
  parentsSupport: number;
  exercise: boolean;
}
export interface Story {
  id: string;
  text: Text;
  kind: "ordinary" | "decision" | "consequence" | "habit" | "life" | "world";
  /** Month of the year the beat appears in, 1–12. */
  month?: number;
  outcome?: "success" | "failure";
  support?: { label: string; url: string }[];
  source?: { label: string; url: string };
  /** Statistical facts shown under the beat, see stats.ts. */
  facts?: string[];
}
export interface Market {
  year: number;
  crisis: boolean;
  demand: number;
  world: WorldId;
  inflation: number;
  rentGrowth: number;
  returns: { deposits: number; bonds: number; stocks: number; property: number };
}
export interface Picked {
  key: string;
  choice: string;
  pick: Pick;
  /** Option the carry-on line would have taken here. */
  stayOption: string;
  stay: boolean;
}
export interface Summary {
  netWorth: number;
  change: number;
  /** Household take-home income for the year. */
  income: number;
  household: number;
  perCapita: number;
  percentile: number;
  payroll: Payroll | null;
}
export interface Chapter {
  year: number;
  age: number;
  offset: number;
  market: Market;
  stories: Story[];
  state: State;
  journal: Journal;
  choices: Picked[];
  summary: Summary;
}
export const focusLabels: Record<Focus, Text> = {
  work: ["工作", "Work"],
  balanced: ["均衡", "Balance"],
  people: ["家人朋友", "People"],
  health: ["健康", "Health"],
  learning: ["自我提升", "Learning"],
  hobby: ["兴趣", "Interests"],
};
export const focusHints: Record<Focus, Text> = {
  work: ["收入↑ 健康↓ 关系↓", "Pay ↑ health ↓ people ↓"],
  balanced: ["每样都顾一点", "A little of everything"],
  people: ["关系↑ 快乐↑ 知识↓", "People ↑ happiness ↑"],
  health: ["健康↑ 快乐↑", "Health ↑ happiness ↑"],
  learning: ["知识↑ 健康↓", "Knowledge ↑ health ↓"],
  hobby: ["快乐↑ 知识↑", "Happiness ↑ knowledge ↑"],
};
export const decisionLabels: Record<DecisionKind, Text> = {
  career: ["换工作 / 转行", "Change career"],
  business: ["创业", "Start a business"],
  abroad: ["出国", "Move abroad"],
  invest: ["投资", "Invest"],
  study: ["继续读书", "Further study"],
  stay: ["照现在过", "Carry on"],
  custom: ["自定义", "Your own plan"],
};
export const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
export function changeProps(s: State, e: Partial<State["props"]>) {
  for (const [k, v] of Object.entries(e)) s.props[k as Dimension] = clamp(s.props[k as Dimension] + (v ?? 0));
}
/** Amounts inside story text: ¥12,300 and, for large Chinese amounts, ¥12.3 万. */
export function rmb(fen: number): Text {
  const v = Math.round(fen / 100);
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  const en = `${sign}¥${abs.toLocaleString("en-US")}`;
  if (abs < 100000) return [en, en];
  const wan = abs / 10000;
  return [`${sign}¥${wan >= 100 ? Math.round(wan) : Number(wan.toFixed(1))} 万`, en];
}
