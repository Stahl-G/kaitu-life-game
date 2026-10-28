/** All balances and journal amounts are integer fen (1 RMB = 100 fen). */
export const yuan = (value: number) => Math.round(value * 100);
export const assetAccounts = ["cash", "deposits", "bonds", "stocks", "property", "car", "fund"] as const;
export const liabilityAccounts = ["debt", "mortgage", "carLoan"] as const;
export type Asset = (typeof assetAccounts)[number];
export type Liability = (typeof liabilityAccounts)[number];
export type Account = Asset | Liability;
export interface BalanceSheet {
  cash: number;
  deposits: number;
  bonds: number;
  stocks: number;
  property: number;
  /** Vehicle at its depreciated value. */
  car: number;
  /** Housing provident fund (公积金): usable for a home purchase or mortgage, not for daily spending. */
  fund: number;
  /** Unpaid bills plus personal or business loans. */
  debt: number;
  mortgage: number;
  carLoan: number;
  interestRate: number;
}
export interface Entry {
  label: string;
  kind: "income" | "expense" | "return" | "transfer";
  amount: number;
}
export interface Journal {
  opening: number;
  entries: Entry[];
  closing: number;
  arrears: number;
  principalPaid: number;
}
export function emptyBalance(): BalanceSheet {
  return {
    cash: 0,
    deposits: 0,
    bonds: 0,
    stocks: 0,
    property: 0,
    car: 0,
    fund: 0,
    debt: 0,
    mortgage: 0,
    carLoan: 0,
    interestRate: 0.065,
  };
}
export const netWorth = (b: BalanceSheet) =>
  assetAccounts.reduce((n, k) => n + b[k], 0) - liabilityAccounts.reduce((n, k) => n + b[k], 0);
export const liquid = (b: BalanceSheet) => b.cash + b.deposits;
/** Monthly payment of an equal-instalment loan (等额本息). */
export function annuity(principal: number, rate: number, years: number) {
  const r = rate / 12;
  const n = years * 12;
  return Math.round(r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n));
}
export function openJournal(b: BalanceSheet): Journal {
  return { opening: netWorth(b), closing: netWorth(b), entries: [], arrears: 0, principalPaid: 0 };
}
export function income(b: BalanceSheet, j: Journal, requested: number, label: string, to: Asset = "cash") {
  const amount = Math.max(0, Math.round(requested));
  b[to] += amount;
  j.entries.push({ label, kind: "income", amount });
}
export function transfer(b: BalanceSheet, j: Journal, from: Asset, to: Asset, requested: number, label: string) {
  const amount = Math.min(b[from], Math.max(0, Math.round(requested)));
  b[from] -= amount;
  b[to] += amount;
  j.entries.push({ label, kind: "transfer", amount });
  return amount;
}
export function borrow(
  b: BalanceSheet,
  j: Journal,
  requested: number,
  liability: Liability = "debt",
  label = "loan",
) {
  const amount = Math.max(0, Math.round(requested));
  b.cash += amount;
  b[liability] += amount;
  j.entries.push({ label, kind: "transfer", amount });
}
function makeCash(b: BalanceSheet, j: Journal, amount: number) {
  if (b.cash < amount) transfer(b, j, "deposits", "cash", amount - b.cash, "withdrawal");
}
export function expense(b: BalanceSheet, j: Journal, requested: number, label: string) {
  const amount = Math.max(0, Math.round(requested));
  makeCash(b, j, amount);
  const unpaid = Math.max(0, amount - b.cash);
  b.debt += unpaid;
  b.cash = Math.max(0, b.cash - amount);
  j.arrears += unpaid;
  j.entries.push({ label, kind: "expense", amount });
}
/** Pays scheduled principal from cash and deposits above `reserve`; the unpaid part stays owed and counts as arrears. */
export function repay(
  b: BalanceSheet,
  j: Journal,
  requested: number,
  reserve = 0,
  liability: Liability = "debt",
) {
  const due = Math.min(b[liability], Math.max(0, Math.round(requested)));
  const paid = Math.min(due, Math.max(0, liquid(b) - reserve));
  makeCash(b, j, paid);
  b.cash -= paid;
  b[liability] -= paid;
  j.principalPaid += paid;
  j.arrears += due - paid;
  j.entries.push({
    label: liability === "debt" ? "principal" : `${liability}-principal`,
    kind: "transfer",
    amount: paid,
  });
  return paid;
}
export function assetReturn(b: BalanceSheet, j: Journal, asset: Exclude<Asset, "cash">, rate: number) {
  const gain = Math.max(-b[asset], Math.round(b[asset] * rate));
  b[asset] += gain;
  j.entries.push({ label: asset, kind: "return", amount: gain });
}
export function closeJournal(b: BalanceSheet, j: Journal) {
  j.closing = netWorth(b);
  const expected =
    j.opening +
    j.entries.reduce(
      (sum, e) => sum + (e.kind === "expense" ? -e.amount : e.kind === "transfer" ? 0 : e.amount),
      0,
    );
  if (expected !== j.closing) throw new Error(`Unbalanced journal: ${expected} != ${j.closing}`);
  if (
    Object.entries(b).some(
      ([key, value]) => key !== "interestRate" && (!Number.isSafeInteger(value) || value < 0),
    )
  )
    throw new Error("Invalid balance");
  return j;
}
