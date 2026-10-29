import { type Card, blankCard } from "../card.js";
import type { Chapter, Pick, State, Text } from "../model.js";
import type { Peer } from "../peers.js";
import { summaryAt } from "../playback.js";
import type { Config, Run, Years } from "../simulation.js";
import type { Mode } from "../world.js";
export type Page = "home" | "import" | "review" | "play" | "ending" | "replay";
export interface Line {
  label: Text;
  config: Config;
  run: Run;
}
export const app = {
  page: "home" as Page,
  card: blankCard() as Card,
  pasted: "",
  error: "",
  mode: "reality" as Mode,
  years: 20 as Years,
  config: null as Config | null,
  run: null as Run | null,
  peers: [] as Peer[],
  /** Chapters of the player's line revealed so far; the current year is `shown - 1`. */
  shown: 0,
  /** Progress through the current year, 0–1. */
  progress: 0,
  /** The current year has run out: a waiting choice or the end of the run is showing. */
  atEnd: false,
  playing: false,
  speed: 1 as 1 | 2 | 4,
  /** Index of a past year being looked at; time is paused meanwhile. */
  review: null as number | null,
  drawer: null as null | "money" | "plan" | "rules",
  moneyTab: "overview" as "overview" | "year" | "accounts",
  selection: null as Pick | null,
  collapsed: false,
  menu: false,
  dialog: null as null | "restart",
  /** Playback state to restore when the restart dialog is cancelled. */
  wasPlaying: null as boolean | null,
  /** Why time stopped, shown in the status pill. */
  pause: null as null | "user" | "details" | "hidden",
  lines: [] as Line[],
  replayKey: null as string | null,
  replayPick: null as Pick | null,
  committing: false,
};
/** First simulated year: the current calendar year. */
export const startYear = () => new Date().getFullYear();
export const current = (): Chapter | null => app.run?.changed[app.shown - 1] ?? null;
export const viewed = (): Chapter | null =>
  app.review !== null ? (app.run?.changed[app.review] ?? null) : current();
/** The waiting choice, once the current year has run out. */
export const waiting = () => (app.atEnd && app.run?.pending ? app.run.pending : null);
export const finished = () =>
  !!app.run && !!app.config && app.atEnd && !app.run.pending && app.shown >= app.config.years;
/** Whether the current year's settlement has been reached: panels then show the year-end state. */
export const settled = () => app.review !== null || app.atEnd || app.progress >= summaryAt;
/** State the side panels describe: the reviewed year's end, or the current year's start until it settles. */
export function shownState(): State | null {
  if (!app.run) return null;
  if (app.review !== null) return app.run.changed[app.review]?.state ?? null;
  const index = settled() ? app.shown - 1 : app.shown - 2;
  return index >= 0 ? (app.run.changed[index]?.state ?? app.run.initial) : app.run.initial;
}
/** Index of the last chapter whose numbers the panels may show. */
export const shownIndex = () => (app.review !== null ? app.review : settled() ? app.shown - 1 : app.shown - 2);
