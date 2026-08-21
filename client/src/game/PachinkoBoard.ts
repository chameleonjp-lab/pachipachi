// ネオン神楽回路・物理盤面: 正規化座標で定義する実機風の釘、レール、入賞口。
export type PinRole = "field" | "guide" | "gate" | "right" | "attacker";

export interface BoardPin {
  id: string;
  x: number;
  y: number;
  radius: number;
  role: PinRole;
}

export interface BoardRail {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  restitution: number;
  role: "outer" | "left" | "right" | "relay" | "tray" | "shutter";
}

export interface CapturePocket {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

export interface BoardBumper {
  id: "rotor-left" | "rotor-right";
  x: number;
  y: number;
  radius: number;
  kickX: number;
  kickY: number;
}

const row = (name: string, y: number, xs: readonly number[], role: PinRole = "field"): BoardPin[] => xs.map((x, index) => ({ id: `${name}-${index}`, x, y, radius: role === "gate" ? .98 : .76, role }));

export const BOARD_PINS: readonly BoardPin[] = [
  ...row("top-a", 12, [19, 30, 41, 52, 63, 74], "guide"),
  ...row("top-b", 18, [14, 25, 36, 47, 58, 69, 80]),
  ...row("top-c", 24, [18, 29, 40, 51, 62, 73], "guide"),
  ...row("top-d", 30, [13, 24, 35, 46, 57, 68, 79]),
  ...row("mid-a", 36, [18, 29, 40, 61, 72], "field"),
  ...row("mid-b", 42, [13, 24, 35, 65, 76], "field"),
  { id: "start-gate-left", x: 44.7, y: 47.6, radius: 1.04, role: "gate" },
  { id: "start-gate-right", x: 55.3, y: 47.6, radius: 1.04, role: "gate" },
  ...row("mid-c", 49, [18, 28, 38, 62, 72, 82]),
  ...row("mid-d", 56, [13, 23, 33, 67, 77], "field"),
  ...row("mid-e", 63, [18, 29, 40, 60, 71], "field"),
  ...row("low-a", 70, [13, 24, 35, 46, 57, 68, 79]),
  ...row("low-b", 77, [18, 29, 40, 60, 71], "field"),
  ...row("low-c", 83, [14, 25, 36, 64, 75], "attacker"),
  ...row("right-guide", 34, [85, 90], "right"),
  ...row("right-mid", 44, [84, 91], "right"),
  ...row("right-tulip", 55, [81, 89, 93], "right"),
  ...row("right-lower", 70, [82, 90], "right"),
];

export const BOARD_RAILS: readonly BoardRail[] = [
  { id: "outer-left", ax: 5.2, ay: 3, bx: 5.2, by: 98, restitution: .43, role: "outer" },
  { id: "outer-right", ax: 94.8, ay: 3, bx: 94.8, by: 98, restitution: .43, role: "outer" },
  { id: "left-rail-inner", ax: 10.2, ay: 5, bx: 12.6, by: 38, restitution: .47, role: "left" },
  { id: "left-rail-exit", ax: 12.6, ay: 38, bx: 19.5, by: 44.5, restitution: .47, role: "left" },
  { id: "right-rail-inner", ax: 79.2, ay: 8, bx: 81.7, by: 60.5, restitution: .45, role: "right" },
  { id: "right-rail-outer", ax: 92.3, ay: 7, bx: 90.2, by: 66, restitution: .45, role: "right" },
  { id: "relay-guide-inner", ax: 82, ay: 68, bx: 57.5, by: 88.4, restitution: .42, role: "relay" },
  { id: "relay-guide-outer", ax: 90, ay: 69, bx: 65.5, by: 92.3, restitution: .42, role: "relay" },
  { id: "return-left", ax: 19.5, ay: 80, bx: 9.5, by: 94, restitution: .36, role: "tray" },
  { id: "return-right", ax: 80.5, ay: 80, bx: 90.5, by: 94, restitution: .36, role: "tray" },
];

export const BOARD_BUMPERS: readonly BoardBumper[] = [
  { id: "rotor-left", x: 42, y: 39.6, radius: 5.35, kickX: 18, kickY: -19 },
  { id: "rotor-right", x: 84.3, y: 54, radius: 4.7, kickX: -18, kickY: -19 },
];

export function sealShutterRails(event: "none" | "open" | "pinch"): readonly BoardRail[] {
  const spread = event === "open" ? 9 : event === "pinch" ? 2.35 : 5.3;
  return [
    { id: "seal-shutter-left", ax: 50 - spread, ay: 43.2, bx: 46.2, by: 50.8, restitution: .48, role: "shutter" },
    { id: "seal-shutter-right", ax: 50 + spread, ay: 43.2, bx: 53.8, by: 50.8, restitution: .48, role: "shutter" },
  ];
}

export const PHYSICS_POCKETS = {
  start: { x: 50, y: 53, radiusX: 4.1, radiusY: 3.1 },
  electricTulip: { x: 85, y: 64, radiusX: 4, radiusY: 3.4 },
  attacker: { x: 50, y: 90.2, radiusX: 12, radiusY: 4.8 },
  returnLeft: { x: 20, y: 94.2, radiusX: 15.5, radiusY: 4.4 },
  returnRight: { x: 80, y: 94.2, radiusX: 15.5, radiusY: 4.4 },
  out: { x: 50, y: 102.2, radiusX: 31, radiusY: 4.1 },
} satisfies Record<string, CapturePocket>;

export const PHYSICS_CONSTANTS = {
  ballRadius: 1.05,
  gravity: 58,
  drag: .995,
  pinRestitution: .56,
  maxSubstep: .012,
} as const;
