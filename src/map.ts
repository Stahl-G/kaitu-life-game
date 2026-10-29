import { type Locale, dimensions, labels, roleLabels } from "./card.js";
import { choiceById, trackLabels } from "./choices.js";
import { netWorth } from "./finance.js";
import type { Run } from "./simulation.js";
import { worlds } from "./world.js";
export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
}
/** Two-line comparison card. The exported version carries only game numbers, roles, the kind of each choice
 * and the world: no alias, goals, city, source notes, age or seeds. */
export function mapSvg(run: Run | null, count: number, locale: Locale, exported = false): string {
  const en = locale === "en";
  const idx = en ? 1 : 0;
  const end = Math.min(count, run?.changed.length ?? 0);
  const a = run?.baseline[end - 1]?.state ?? run?.initial;
  const b = run?.changed[end - 1]?.state ?? run?.initial;
  const years = run?.config.years ?? 1;
  const money = (n: number) => `${n < 0 ? "−" : ""}¥${Math.round(Math.abs(n) / 100).toLocaleString("en")}`;
  const cards = [a, b]
    .map(
      (s, i) =>
        `<rect x="${40 + i * 450}" y="118" width="410" height="244" rx="10" fill="${i ? "#efe3d2" : "#e6ecf1"}"/><text x="${66 + i * 450}" y="154" font-size="20" fill="${i ? "#b4472b" : "#3a6ea5"}">${i ? (en ? "YOUR CHOICES" : "你的选择") : en ? "CARRYING ON" : "照现在过"}</text><text x="${66 + i * 450}" y="197" font-size="28">${s ? money(netWorth(s.assets)) : "—"}</text><text x="${66 + i * 450}" y="223" font-size="13" fill="#83796c">${en ? "SIMULATED NET ASSETS" : "模拟净资产"} · ${s ? roleLabels[s.role][idx] : ""}</text>${dimensions.map((k, j) => `<text x="${66 + i * 450}" y="${253 + j * 25}" font-size="14">${labels[k][idx]} <tspan x="${408 + i * 450}" text-anchor="end">${s?.props[k] ?? "—"}</tspan></text>`).join("")}`,
    )
    .join("");
  const forks =
    run?.changed.slice(0, end).flatMap((row) => row.choices.filter((p) => !p.stay).map((p) => ({ row, p }))) ?? [];
  const last = run?.changed[end - 1];
  const world =
    run?.config.mode === "parallel" && last && last.year >= 2035
      ? `${en ? "WORLD" : "世界"} · ${worlds[last.market.world].name[idx]}`
      : en
        ? "REALITY LINE"
        : "现实线";
  const marks = forks
    .map(({ row, p }, i) => {
      const x = 70 + (row.offset / Math.max(1, years - 1)) * 800;
      const track = choiceById.get(p.choice)?.track ?? "work";
      return `<path d="M${x} 452v56" stroke="#b4472b" stroke-width="1"/><circle cx="${x}" cy="508" r="6" fill="#b4472b"/><text x="${x}" y="${i % 2 ? 430 : 440}" font-size="12" text-anchor="middle">+${row.offset + 1}${en ? "y" : " 年"}</text><text x="${x}" y="${i % 2 ? 548 : 538}" font-size="14" text-anchor="middle">${trackLabels[track][idx]}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 620" role="img" aria-label="${en ? "Life choices and two paths" : "人生抉择与双线回顾"}"><rect width="940" height="620" rx="12" fill="#f8f3e8"/><g font-family="Georgia, PingFang SC, serif" fill="#352f27"><text x="40" y="48" font-size="15" letter-spacing="3">KAITU / ${en ? "THE NEXT CHAPTER" : "人生的下一页"}</text><text x="40" y="87" font-size="25">${exported ? (en ? `${end} years. More than one path.` : `${end} 年，不止一种走法。`) : `${escapeHtml(run?.config.card.name || "")} · ${en ? "TWO PATHS" : "两条人生"}`}</text><text x="900" y="87" font-size="14" text-anchor="end" fill="#83796c">${escapeHtml(world)}</text>${cards}<text x="40" y="403" font-size="16">${en ? "CHOICES ALONG THE WAY" : "一路上的抉择"}</text><path d="M60 452H880" stroke="#3a6ea5" stroke-width="2"/><path d="M60 508H880" stroke="#b4472b" stroke-width="3"/>${marks}<path d="M40 568H900" stroke="#d8d0c1"/><text x="40" y="596" font-size="12" fill="#83796c">${en ? "Shared world · Different choices · Simulated RMB" : "同一个世界 · 不同的选择 · 模拟人民币"}</text><text x="900" y="596" text-anchor="end" font-size="12" fill="#83796c">${en ? "A game, not a prediction" : "这是推演，不是预测"}</text></g></svg>`;
}
export async function exportPng(svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1880;
    canvas.height = 1240;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Image export failed"))),
        "image/png",
      ),
    );
    const download = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = download;
    a.download = "kaitu-two-paths.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(download), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
