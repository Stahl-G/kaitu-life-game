import { esc, short } from "./dom.js";
export interface Series {
  label: string;
  values: number[];
  /** Colour token: base = carrying on, you = the player's line. */
  tone: "base" | "you";
}
function ticks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => span / s <= count) ?? magnitude * 10;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(v);
  return out;
}
/** Net worth over the years for one or two lines, with optional decision markers on the player's line.
 * Lines are 2px with end dots ringed in the surface colour; every year has a hover title with both values. */
export function lineChart(
  years: number[],
  series: Series[],
  marks: { index: number; label: string }[] = [],
  options: { height?: number; title?: string; width?: number } = {},
) {
  // The viewBox matches the rendered width, so text stays at its real size in narrow cards.
  const W = options.width ?? 640;
  const H = options.height ?? 220;
  const narrow = W < 420;
  const pad = { left: narrow ? 46 : 56, right: narrow ? 66 : 92, top: marks.length ? 26 : 14, bottom: 26 };
  const all = series.flatMap((s) => s.values);
  if (!all.length) return "";
  const t = ticks(Math.min(0, ...all), Math.max(...all, 1));
  const lo = t[0];
  const hi = t[t.length - 1];
  const x = (i: number) => pad.left + (years.length < 2 ? 0 : (i * (W - pad.left - pad.right)) / (years.length - 1));
  const y = (v: number) => pad.top + ((hi - v) * (H - pad.top - pad.bottom)) / (hi - lo || 1);
  const grid = t
    .map(
      (v) =>
        `<line x1="${pad.left}" x2="${W - pad.right}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.left - 8}" y="${y(v) + 4}" text-anchor="end" class="tick">${esc(short(v))}</text>`,
    )
    .join("");
  const step = Math.max(1, Math.ceil(years.length / (narrow ? 3 : 6)));
  const xLabels = years
    .map((yr, i) =>
      (i % step === 0 && years.length - 1 - i >= step / 2) || i === years.length - 1
        ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="tick">${yr}</text>`
        : "",
    )
    .join("");
  const ends = series.map((s) => {
    const i = s.values.length - 1;
    return { s, i, x: x(i), y: y(s.values[i]) };
  });
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 16) {
    const [a, b] = ends[0].y <= ends[1].y ? [ends[0], ends[1]] : [ends[1], ends[0]];
    const mid = (a.y + b.y) / 2;
    (a as { ly?: number }).ly = mid - 9;
    (b as { ly?: number }).ly = mid + 9;
  }
  const lines = ends
    .map(({ s, i, x: ex, y: ey, ...rest }) => {
      const ly = (rest as { ly?: number }).ly ?? ey;
      const points = s.values.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      return `<polyline points="${points}" class="line ${s.tone}"/>${ly !== ey ? `<line x1="${ex + 6}" y1="${ey}" x2="${ex + 12}" y2="${ly}" class="leader"/>` : ""}<circle cx="${ex}" cy="${ey}" r="4.5" class="dot ${s.tone}"/><text x="${ex + 14}" y="${ly + 4}" class="end-label">${esc(short(s.values[i]))}</text>`;
    })
    .join("");
  const you = series.find((s) => s.tone === "you") ?? series[0];
  // Every marker names its choice on hover; a label is printed only where it has room.
  let labelled = Number.NEGATIVE_INFINITY;
  const markers = marks
    .filter((m) => m.index < you.values.length)
    .map((m) => {
      const mx = x(m.index);
      const my = y(you.values[m.index]);
      const room = mx - labelled >= (narrow ? 999 : 84);
      if (room) labelled = mx;
      return `<path d="M${mx} ${my - 6}l6 6-6 6-6-6z" class="mark"><title>${esc(`${years[m.index]} · ${m.label}`)}</title></path>${room ? `<text x="${mx}" y="${Math.max(11, my - 10)}" text-anchor="middle" class="mark-label">${esc(m.label)}</text>` : ""}`;
    })
    .join("");
  const hover = years
    .map((yr, i) => {
      const w = years.length < 2 ? W - pad.left - pad.right : (W - pad.left - pad.right) / (years.length - 1);
      const values = series
        .filter((s) => i < s.values.length)
        .map((s) => `${s.label} ${short(s.values[i])}`)
        .join(" · ");
      return `<rect x="${x(i) - w / 2}" y="${pad.top}" width="${w}" height="${H - pad.top - pad.bottom}" class="hit"><title>${esc(`${yr} · ${values}`)}</title></rect>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(options.title ?? series.map((s) => s.label).join(" / "))}">${grid}${xLabels}${lines}${markers}${hover}</svg>`;
}
/** Five published income groups as horizontal bars with the median and an optional marker for the player. */
export function incomeChart(
  rows: { label: string; value: number }[],
  median: { label: string; value: number },
  marker?: { label: string; value: number },
  width = 560,
) {
  const W = width;
  const rowH = 30;
  const top = 8;
  const left = W < 420 ? 74 : 96;
  const right = W < 420 ? 70 : 96;
  const H = top + rows.length * rowH + 30;
  const max = Math.max(...rows.map((r) => r.value), marker?.value ?? 0, median.value) * 1.08;
  const x = (v: number) => left + (Math.min(v, max) * (W - left - right)) / max;
  const bars = rows
    .map((r, i) => {
      const yy = top + i * rowH + 7;
      const end = x(r.value);
      return `<text x="${left - 10}" y="${yy + 12}" text-anchor="end" class="tick">${esc(r.label)}</text><path d="M${left} ${yy}h${Math.max(0, end - left - 4)}a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-${Math.max(0, end - left - 4)}z" class="bar"/><text x="${end + 6}" y="${yy + 12}" class="end-label">${esc(short(r.value))}</text>`;
    })
    .join("");
  const bottom = top + rows.length * rowH;
  const line = (v: number, label: string, cls: string, dy: number) =>
    `<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${bottom}" class="${cls}"/><text x="${Math.min(x(v), W - 4)}" y="${bottom + dy}" text-anchor="${x(v) > W - right ? "end" : "middle"}" class="${cls}-label">${esc(label)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart income" role="img" aria-label="${esc(rows.map((r) => `${r.label} ${short(r.value)}`).join("; "))}">${bars}${line(median.value, median.label, "median", 14)}${marker ? line(marker.value, marker.label, "marker", 26) : ""}</svg>`;
}
