// ネオン神楽回路・パチンコ版: 固定釘、レール、捕捉窓に対する遊技球物理をDOM非依存で扱う。
import { BOARD_BUMPERS, BOARD_PINS, BOARD_RAILS, PHYSICS_CONSTANTS, PHYSICS_POCKETS, sealShutterRails, type BoardRail } from "./PachinkoBoard";
import type { BallState, DisplaySymbol, GimmickHit, NailEvent, NailGuide, Outcome, Omen, ReserveSignal, ShotRoute, VariationContext } from "./types";

let contextSerial = 0;
let ballSerial = 0;

const SYMBOLS: readonly DisplaySymbol[] = ["ARC", "SEAL", "GATE", "BOLT", "ZERO", "VOID"];
const choose = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const square = (value: number) => value * value;

export function guideForPower(power: number): NailGuide {
  if (power < 55) return "LOW";
  if (power > 75) return "HIGH";
  return "SWEET";
}

export function createVariation(forced?: Outcome, source: ShotRoute = "left"): VariationContext {
  const ticket = forced === "jackpot" ? 420 : forced === "win" ? 2100 : forced === "miss" ? 7200 : Math.floor(Math.random() * 10000);
  const roll = Math.random();
  const signal: ReserveSignal = choose(["silent", "pulse", "rune", "static"]);
  const outcome = forced ?? (source === "right" ? (ticket < 1400 ? "jackpot" : ticket < 3900 ? "win" : "miss") : (ticket < 1050 ? "jackpot" : ticket < 3300 ? "win" : "miss"));
  const omen: Omen = outcome === "jackpot" ? "gate" : outcome === "win" ? (roll < .2 ? "seal" : "packet") : choose(["quiet", "scanner", "packet"]);
  const finalSymbols: DisplaySymbol[] = outcome === "jackpot"
    ? ["ZERO", "ZERO", "ZERO"]
    : outcome === "win"
      ? ["GATE", "GATE", "SEAL"]
      : [choose(["ARC", "SEAL", "BOLT"]), choose(["ARC", "SEAL", "GATE", "BOLT"]), choose(["ARC", "SEAL", "BOLT", "VOID"])];
  return { id: ++contextSerial, source, outcome, finalSymbols, omen, reach: outcome !== "miss" || roll > .67, revive: source === "right" && outcome === "win" && roll < .2, signal, ticket, stopDelays: [540, 980, 1450], label: outcome === "jackpot" ? "ZERO GATE JACKPOT" : outcome === "win" ? "SIGNAL LINK" : "SIGNAL LOST", payout: outcome === "win" ? 8 : 0, rounds: outcome === "jackpot" ? 3 : 0 };
}

export function launchBall(power: number, kind: BallState["kind"] = "normal", nailEvent: NailEvent = "none"): BallState {
  const seed = Math.random();
  const isRight = kind === "right";
  const isAttacker = kind === "attacker";
  const eventVelocity = nailEvent === "open" ? -3.2 : nailEvent === "pinch" ? 4.8 : 0;
  return {
    id: ++ballSerial,
    x: isAttacker ? 86 + (seed - .5) * 2 : isRight ? 88 + (seed - .5) * 2.4 : 10.4 + seed * 1.8,
    y: isAttacker ? 41 : 5.8,
    vx: isAttacker ? -2.2 + (seed - .5) * 2.1 : isRight ? -2.7 + (seed - .5) * 3.4 : 23 + power * .28 + eventVelocity + (seed - .5) * 4,
    vy: isAttacker ? 19 : isRight ? 16.8 : 16 + power * .05,
    seed,
    captureBias: false,
    kind,
  };
}

export interface BallUpdate {
  ball: BallState | null;
  startEntry: boolean;
  rightEntry: boolean;
  attackerHit: boolean;
  returnBall: boolean;
  outBall: boolean;
  gimmickHit: GimmickHit;
}

type Capture = "start" | "right" | "attacker" | null;

function resolvePin(x: number, y: number, vx: number, vy: number, pinX: number, pinY: number, pinRadius: number) {
  const dx = x - pinX;
  const dy = y - pinY;
  const minimum = PHYSICS_CONSTANTS.ballRadius + pinRadius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= minimum * minimum) return { x, y, vx, vy };
  const distance = Math.max(.0001, Math.sqrt(distanceSquared));
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minimum - distance;
  x += nx * overlap;
  y += ny * overlap;
  const normalVelocity = vx * nx + vy * ny;
  if (normalVelocity < 0) {
    const tangentX = vx - normalVelocity * nx;
    const tangentY = vy - normalVelocity * ny;
    vx = tangentX * .86 - normalVelocity * PHYSICS_CONSTANTS.pinRestitution * nx;
    vy = tangentY * .86 - normalVelocity * PHYSICS_CONSTANTS.pinRestitution * ny;
  }
  return { x, y, vx, vy };
}

function resolveRail(x: number, y: number, vx: number, vy: number, rail: BoardRail) {
  const abx = rail.bx - rail.ax;
  const aby = rail.by - rail.ay;
  const lengthSquared = abx * abx + aby * aby;
  const projection = clamp(((x - rail.ax) * abx + (y - rail.ay) * aby) / lengthSquared, 0, 1);
  const closestX = rail.ax + abx * projection;
  const closestY = rail.ay + aby * projection;
  const dx = x - closestX;
  const dy = y - closestY;
  const distanceSquared = dx * dx + dy * dy;
  const minimum = PHYSICS_CONSTANTS.ballRadius;
  if (distanceSquared >= minimum * minimum) return { x, y, vx, vy };
  const distance = Math.max(.0001, Math.sqrt(distanceSquared));
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minimum - distance;
  x += nx * overlap;
  y += ny * overlap;
  const normalVelocity = vx * nx + vy * ny;
  if (normalVelocity < 0) {
    const tangentX = vx - normalVelocity * nx;
    const tangentY = vy - normalVelocity * ny;
    vx = tangentX * .91 - normalVelocity * rail.restitution * nx;
    vy = tangentY * .91 - normalVelocity * rail.restitution * ny;
  }
  return { x, y, vx, vy };
}

function resolveBumper(x: number, y: number, vx: number, vy: number, bumper: (typeof BOARD_BUMPERS)[number]) {
  const dx = x - bumper.x;
  const dy = y - bumper.y;
  const minimum = PHYSICS_CONSTANTS.ballRadius + bumper.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= minimum * minimum) return { x, y, vx, vy, hit: false };
  const distance = Math.max(.0001, Math.sqrt(distanceSquared));
  const nx = dx / distance;
  const ny = dy / distance;
  x += nx * (minimum - distance);
  y += ny * (minimum - distance);
  const speed = Math.max(22, Math.hypot(vx, vy));
  vx = nx * speed * .76 + bumper.kickX;
  vy = ny * speed * .68 + bumper.kickY;
  return { x, y, vx, vy, hit: true };
}

function insidePocket(x: number, y: number, pocket: { x: number; y: number; radiusX: number; radiusY: number }) {
  return square((x - pocket.x) / pocket.radiusX) + square((y - pocket.y) / pocket.radiusY) <= 1;
}

function evaluateCapture(ball: BallState, x: number, y: number, vy: number, canEnterStart: boolean, attackerOpen: boolean, canEnterRight: boolean, electricTulipOpen: boolean): Capture {
  if (vy <= 0) return null;
  if (ball.kind === "normal" && canEnterStart && insidePocket(x, y, PHYSICS_POCKETS.start)) return "start";
  if (ball.kind === "right" && electricTulipOpen && canEnterRight && insidePocket(x, y, PHYSICS_POCKETS.electricTulip)) return "right";
  if (ball.kind === "relay" && attackerOpen && insidePocket(x, y, PHYSICS_POCKETS.attacker)) return "attacker";
  return null;
}

export function advanceBall(ball: BallState, deltaSeconds: number, canEnterStart: boolean, attackerOpen: boolean, canEnterRight: boolean, electricTulipOpen: boolean, nailEvent: NailEvent): BallUpdate {
  const steps = Math.max(1, Math.ceil(Math.min(deltaSeconds, .06) / PHYSICS_CONSTANTS.maxSubstep));
  const step = Math.min(deltaSeconds, .06) / steps;
  let { x, y, vx, vy } = ball;
  let gimmickHit: GimmickHit = "none";
  for (let index = 0; index < steps; index += 1) {
    vy += PHYSICS_CONSTANTS.gravity * step;
    x += vx * step;
    y += vy * step;
    const drag = Math.pow(PHYSICS_CONSTANTS.drag, step * 60);
    vx *= drag;
    vy *= drag;
    for (const pin of BOARD_PINS) ({ x, y, vx, vy } = resolvePin(x, y, vx, vy, pin.x, pin.y, pin.radius));
    for (const rail of [...BOARD_RAILS, ...sealShutterRails(nailEvent)]) ({ x, y, vx, vy } = resolveRail(x, y, vx, vy, rail));
    for (const bumper of BOARD_BUMPERS) {
      const resolved = resolveBumper(x, y, vx, vy, bumper);
      ({ x, y, vx, vy } = resolved);
      if (resolved.hit) gimmickHit = bumper.id;
    }
    if (x < 5.8) { x = 5.8; vx = Math.abs(vx) * .43; }
    if (x > 94.2) { x = 94.2; vx = -Math.abs(vx) * .43; }
    if (attackerOpen && electricTulipOpen && (ball.kind === "right" || ball.kind === "attacker") && insidePocket(x, y, PHYSICS_POCKETS.electricTulip)) {
      return { ball: { ...ball, x: 84.2, y: 68.2, vx: -40 + (ball.seed - .5) * 5, vy: 14.5, captureBias: false, kind: "relay" }, startEntry: false, rightEntry: false, attackerHit: false, returnBall: false, outBall: false, gimmickHit };
    }
    const capture = evaluateCapture(ball, x, y, vy, canEnterStart, attackerOpen, canEnterRight, electricTulipOpen);
    if (capture === "start") return { ball: null, startEntry: true, rightEntry: false, attackerHit: false, returnBall: false, outBall: false, gimmickHit };
    if (capture === "right") return { ball: null, startEntry: false, rightEntry: true, attackerHit: false, returnBall: false, outBall: false, gimmickHit };
    if (capture === "attacker") return { ball: null, startEntry: false, rightEntry: false, attackerHit: true, returnBall: false, outBall: false, gimmickHit };
    if (insidePocket(x, y, PHYSICS_POCKETS.returnLeft) || insidePocket(x, y, PHYSICS_POCKETS.returnRight)) return { ball: null, startEntry: false, rightEntry: false, attackerHit: false, returnBall: true, outBall: false, gimmickHit };
    if (insidePocket(x, y, PHYSICS_POCKETS.out) || y > 106) return { ball: null, startEntry: false, rightEntry: false, attackerHit: false, returnBall: false, outBall: true, gimmickHit };
  }
  return { ball: { ...ball, x, y, vx, vy }, startEntry: false, rightEntry: false, attackerHit: false, returnBall: false, outBall: false, gimmickHit };
}

export function cycleSymbols(offset: number): DisplaySymbol[] { return [0, 2, 4].map((start) => SYMBOLS[(start + offset) % SYMBOLS.length]); }
