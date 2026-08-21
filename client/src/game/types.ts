// ネオン神楽回路・パチンコ版: 仮想BALLだけを扱う、始動口起点の遊技状態。
export type Outcome = "miss" | "win" | "jackpot";
export type DisplaySymbol = "ARC" | "SEAL" | "GATE" | "BOLT" | "ZERO" | "VOID";
export type Omen = "quiet" | "scanner" | "packet" | "seal" | "gate";
export type GamePhase = "standby" | "firing" | "variation" | "reach" | "reveal" | "revival" | "jackpot" | "attacker" | "roundSettle" | "support" | "result" | "log";
export type ShotRoute = "left" | "right";
export type NailGuide = "LOW" | "SWEET" | "HIGH";
export type NailEvent = "none" | "open" | "pinch";
export type ReserveSignal = "silent" | "pulse" | "rune" | "static";
export type BallKind = "normal" | "right" | "attacker" | "relay";
export type GimmickHit = "none" | "rotor-left" | "rotor-right";
export const MAX_ACTIVE_BALLS = 20;

export interface BallState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  seed: number;
  captureBias: boolean;
  kind: BallKind;
}

export interface VariationContext {
  id: number;
  source: ShotRoute;
  outcome: Outcome;
  finalSymbols: DisplaySymbol[];
  omen: Omen;
  reach: boolean;
  revive: boolean;
  signal: ReserveSignal;
  ticket: number;
  stopDelays: readonly [number, number, number];
  label: string;
  payout: number;
  rounds: number;
}

export interface GameState {
  phase: GamePhase;
  feedback: "none" | "fire" | "entry" | "spin" | "reach" | "pay" | "rare" | "bonus";
  outcome: Outcome | null;
  heat: number;
  message: string;
  step: string;
  playCount: number;
  history: Outcome[];
  balls: number;
  lowerTray: number;
  lowerTrayLimit: number;
  outBalls: number;
  returnedBalls: number;
  paidBalls: number;
  totalPaidBalls: number;
  activeBalls: BallState[];
  reserve: VariationContext[];
  reserveLimit: number;
  rightReserve: VariationContext[];
  rightReserveLimit: number;
  symbols: DisplaySymbol[];
  currentAward: Outcome | null;
  entryTicket: number | null;
  reelStops: readonly [boolean, boolean, boolean];
  activeSource: ShotRoute | null;
  handleActive: boolean;
  handlePower: number;
  nailGuide: NailGuide;
  nailEvent: NailEvent;
  gimmickHit: GimmickHit;
  shotRoute: ShotRoute;
  rightShotEnabled: boolean;
  electricTulipOpen: boolean;
  attackerOpen: boolean;
  round: number;
  totalRounds: number;
  roundHits: number;
  supportGames: number;
  supportChain: number;
  omen: Omen;
  holdProgress: number;
  hiddenLog: string;
}

export const INITIAL_GAME_STATE: GameState = {
  phase: "standby", feedback: "none", outcome: null, heat: 9,
  message: "始動口へ、一撃。",
  step: "STANDBY / START POCKET", playCount: 0, history: [], balls: 180,
  paidBalls: 0, totalPaidBalls: 0, lowerTray: 0, lowerTrayLimit: 90, outBalls: 0, returnedBalls: 0, activeBalls: [], reserve: [], reserveLimit: 4, rightReserve: [], rightReserveLimit: 4,
  symbols: ["ARC", "SEAL", "BOLT"], currentAward: null, entryTicket: null, reelStops: [false, false, false], activeSource: null, handleActive: false,
  handlePower: 62, nailGuide: "SWEET", nailEvent: "none", gimmickHit: "none", shotRoute: "left", rightShotEnabled: false, electricTulipOpen: false, attackerOpen: false, round: 0, totalRounds: 0, roundHits: 0, supportGames: 0, supportChain: 0,
  omen: "quiet", holdProgress: 0, hiddenLog: "",
};
