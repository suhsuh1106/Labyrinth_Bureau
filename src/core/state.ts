// 게임 상태 S와 새 게임
import { SAVE_VERSION } from './save';
import { pickAgenda } from './agendas';
import { C, CLASS_SHARE, MONSTERS } from './data';
import { fillProvisions } from './founding';
import { rnd } from './rng';

export function learn(who, type, key) { const k = type + ':' + key; if (!S.learned[who][k]) S.learned[who][k] = S.month; }

export let S: any;
export function setState(x: any) { S = x; }

export const schismLines = () => !!(S.schism && (!S.schism.outcome || S.schism.outcome === 'compromise'));

export function newGame() {
  const mons = [...MONSTERS].sort(() => rnd() - 0.5).slice(0, 5);
  S = {
    v: SAVE_VERSION, month: 1, treasury: 25000, M: 20, tab: 'docs', seenTabs: {},
    phase: 'found', dev: {}, devPick: {}, unsold: 0, lootMul: 1, mPriceAdj: 30, runStart: null, soldBacklog: 0,
    budget: { potM: 3200, potC: 0, ws: 0, food: 200, repair: 300, haul: 100, donation: 0, donR: 0, intel: 0, audit: 0, support: 0, trial: 0, rent: 0, priest: 0, recruit: 0, heroPay: 0, heroGear: 0, heroPub: 0 },
    fees: [0, 0, 0, 0, 0], cls: CLASS_SHARE.map(v => v * 20), priestRun: 0,
    learned: { merchant: {}, church: {} }, schism: null, customR: 0, cPriceAdj: 0, deathSens: 1, churchReform: false, eventDocs: [], pressure: 0, anoms: [], overflow: null,
    custom: 0, donHist: [], gM: 0, gC: 0, cap: 0, offers: [], deals: {}, used: {}, evals: [], warn: 0, yearDeaths: 0, rel: 40 + Math.round(rnd() * 30), noAudit: 0, avgVol: 40,
    shock: 0, shockIn: 0, stock: 0, intel: null, cartel: null, cooldown: 0, cartels: 0, cartelMonths: 0, overpaid: 0,
    wsBuilt: false, fac: {}, statOpen: false, deathsTotal: 0, neg: 0,
    floors: mons.map(m => ({ mon: m, weak: m.key, ph: Math.floor(rnd() * 4), prog: 0, known: 0, n: 0, wins: 0, guide: null, say: [], heard: {}, hv: 0, habitKnown: 0, exploit: 0, adapted: 0, root: 0 })), unlocked: 1, trust: 50,
    pendingGuide: null, trial: null, academy: 0, exped: [], lastLoot: 0, statFloor: 0, statRange: 3, guideDraft: {},
    flags: {}, flagM: {}, agenda: null, agendaDone: {}, toll: 0, wsCap: C.WS_CAP, upkeepX: [], adoptBonus: 0, deathMul: 1, lordIncome: 0,
    union: null, leak: null, lord: null, evCool: { union: 0, leak: 0, lord: 0 },
    hero: null, heroApps: [], heroSeq: 0, heroCool: 0, heroFallen: [], fame: C.FAME0, fameLog: [], fameSaved: false, privateExp: null,
    hist: [], books: [], bookView: 'last', last: null, ledgers: null, ledgerArchive: [], archive: [], notes: [], notices: [], log: [], talk: null, over: null,
  };
  fillProvisions();
  pickAgenda();
}

export function log(t) { S.log.push({ m: S.month, t }); }
