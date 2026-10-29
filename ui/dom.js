                                         
                                        
let current         = "zh";
export const locale = () => current;
export function setLocale(next        ) {
  current = next;
}
export const t = (zh        , en        ) => (current === "zh" ? zh : en);
export const pair = (v                                  ) => v[current === "zh" ? 0 : 1];
export function esc(value         )         {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}
/** Full amount: ¥12,345. */
export const money = (fen        ) =>
  `${fen < 0 ? "−" : ""}¥${Math.round(Math.abs(fen) / 100).toLocaleString(current === "zh" ? "zh-CN" : "en-US")}`;
/** Compact amount: ¥12.3 万 / ¥123k. */
export function short(fen        ) {
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
export const signed = (fen        ) => (fen > 0 ? `+${short(fen)}` : short(fen));
export const percent = (x        , digits = 0) => `${(x * 100).toFixed(digits)}%`;
export function button(action        , label        , cls = "", attrs = "") {
  return `<button type="button" data-action="${action}"${cls ? ` class="${cls}"` : ""}${attrs ? ` ${attrs}` : ""}>${label}</button>`;
}
/** Percentile of take-home per person, read one way only: “高于全国约 62% 的家庭”. */
export function rank(p        ) {
  const share = Math.max(1, Math.min(99, Math.round(p)));
  return t(`高于全国约 ${share}% 的家庭`, `above about ${share}% of households nationally`);
}
