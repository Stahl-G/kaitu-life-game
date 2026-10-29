import {            blankCard } from "../card.js";
                                                              
                                        
import { summaryAt } from "../playback.js";
                                                           
                                        
                                                                               
                       
              
                 
           
 
export const app = {
  page: "home"        ,
  card: blankCard()        ,
  pasted: "",
  error: "",
  mode: "reality"        ,
  years: 20         ,
  config: null                 ,
  run: null              ,
  peers: []          ,
  /** Chapters of the player's line revealed so far; the current year is `shown - 1`. */
  shown: 0,
  /** Progress through the current year, 0–1. */
  progress: 0,
  /** The current year has run out: a waiting choice or the end of the run is showing. */
  atEnd: false,
  playing: false,
  speed: 1                 ,
  /** Index of a past year being looked at; time is paused meanwhile. */
  review: null                 ,
  drawer: null                                     ,
  moneyTab: "overview"                                    ,
  selection: null               ,
  collapsed: false,
  menu: false,
  dialog: null                    ,
  /** Playback state to restore when the restart dialog is cancelled. */
  wasPlaying: null                  ,
  /** Why time stopped, shown in the status pill. */
  pause: null                                        ,
  lines: []          ,
  replayKey: null                 ,
  replayPick: null               ,
  committing: false,
  /** The year has settled and waits for "next year". */
  holding: false,
  /** Turn to the next year by itself a few seconds after the settlement. */
  autoYear: false,
};
/** First simulated year: the current calendar year. */
export const startYear = () => new Date().getFullYear();
export const current = ()                 => app.run?.changed[app.shown - 1] ?? null;
export const viewed = ()                 =>
  app.review !== null ? (app.run?.changed[app.review] ?? null) : current();
/** The waiting choice, once the current year has run out. */
export const waiting = () => (app.atEnd && app.run?.pending ? app.run.pending : null);
export const finished = () =>
  !!app.run && !!app.config && app.atEnd && !app.run.pending && app.shown >= app.config.years;
/** Whether the current year's settlement has been reached: panels then show the year-end state. */
export const settled = () => app.review !== null || app.atEnd || app.progress >= summaryAt;
/** State the side panels describe: the reviewed year's end, or the current year's start until it settles. */
export function shownState()               {
  if (!app.run) return null;
  if (app.review !== null) return app.run.changed[app.review]?.state ?? null;
  const index = settled() ? app.shown - 1 : app.shown - 2;
  return index >= 0 ? (app.run.changed[index]?.state ?? app.run.initial) : app.run.initial;
}
/** Index of the last chapter whose numbers the panels may show. */
export const shownIndex = () => (app.review !== null ? app.review : settled() ? app.shown - 1 : app.shown - 2);
