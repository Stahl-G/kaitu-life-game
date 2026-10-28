import type { Locale } from "../card.js";
import type { Text } from "../model.js";
let current: Locale = "zh";
export const locale = () => current;
export function setLocale(next: Locale) {
  current = next;
}
export const t = (zh: string, en: string) => (current === "zh" ? zh : en);
export const pair = (v: Text | readonly [string, string]) => v[current === "zh" ? 0 : 1];
export function esc(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}
/** Full amount: ¥12,345. */
export const money = (fen: number) =>
  `${fen < 0 ? "−" : ""}¥${Math.round(Math.abs(fen) / 100).toLocaleString(current === "zh" ? "zh-CN" : "en-US")}`;
/** Compact amount: ¥12.3 万 / ¥123k. */
export function short(fen: number) {
  const v = fen / 100;
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (current === "zh") {
    if (a < 10000) return `${sign}¥${Math.round(a).toLocaleString("zh-CN")}`;
    const wan = a / 10000;
    return `${sign}¥${wan >= 100 ? Math.round(wan).toLocaleString("zh-CN") : wan.toFixed(1)} 万`;
  }
  if (a < 10000) return `${sign}¥${Math.round(a).toLocaleString("en-US")}`;
  if (a < 1000000) return `${sign}¥${Math.round(a / 1000)}k`;
  return `${sign}¥${(a / 1000000).toFixed(2)}m`;
}
export const signed = (fen: number) => (fen > 0 ? `+${short(fen)}` : short(fen));
export const percent = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export function button(action: string, label: string, cls = "", attrs = "") {
  return `<button type="button" data-action="${action}"${cls ? ` class="${cls}"` : ""}${attrs ? ` ${attrs}` : ""}>${label}</button>`;
}
/** Percentile in words: “前 4%” for the top tenth, otherwise “第 62 百分位”. */
export function rank(p: number) {
  if (p >= 90) {
    const top = Math.max(1, Math.round(100 - p));
    return t(`约在全国前 ${top}%`, `about the top ${top}% nationally`);
  }
  return t(`约在全国第 ${Math.round(p)} 百分位`, `about the ${Math.round(p)}th percentile nationally`);
}
