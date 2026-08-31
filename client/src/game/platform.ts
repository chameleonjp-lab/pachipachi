import type { GameState, Outcome } from "./types";

export const GAME_URL = "https://chameleonjp-lab.github.io/pachipachi/";
export const LAB_URL = "https://chameleonjp-lab.github.io/chameleonjp_lab/";
const SUPABASE_URL = "https://mlpnjgezrnhdxsxolyzj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM";
const GAME_SLUG = "pachipachi";
const CLIENT_VERSION = "pachipachi-2026-08-31-platform";
const PLAYER_NAME_KEY = "pachipachi.player-name";

export interface RankingRow {
  rank: number;
  displayName: string;
  score: number;
}

export function cleanPlayerName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 20);
}

export function readPlayerName(): string {
  try {
    return cleanPlayerName(localStorage.getItem(PLAYER_NAME_KEY) ?? "");
  } catch {
    return "";
  }
}

export function savePlayerName(value: string): string {
  const name = cleanPlayerName(value);
  try {
    if (name) localStorage.setItem(PLAYER_NAME_KEY, name);
    else localStorage.removeItem(PLAYER_NAME_KEY);
  } catch {
    // The entered name remains available in React state for this session.
  }
  return name;
}

export function scoreForResult(game: Pick<GameState, "outcome" | "totalPaidBalls" | "returnedBalls" | "outBalls" | "round" | "supportChain">): number {
  const outcomeBase = game.outcome === "jackpot" ? 100_000 : game.outcome === "win" ? 10_000 : 0;
  return outcomeBase + game.totalPaidBalls * 100 + game.returnedBalls * 10 + game.outBalls + game.round * 250 + game.supportChain * 500;
}

function outcomeLabel(outcome: Outcome): string {
  if (outcome === "jackpot") return "大当たり";
  if (outcome === "win") return "当たり";
  return "ハズレ";
}

export function homeShareText(): string {
  return `【GEKIAZU RUSH】ネオン神楽回路の仮想パチンコで運命を回す！\n${GAME_URL}\n#GEKIAZURUSH #カメレオンJP`;
}

export function resultShareText(game: Pick<GameState, "outcome" | "playCount" | "totalPaidBalls" | "returnedBalls" | "outBalls" | "round" | "supportChain">): string {
  const outcome = game.outcome ?? "miss";
  const score = scoreForResult(game);
  return [
    `【GEKIAZU RUSH】${readPlayerName() || "プレイヤー"}の結果`,
    `${outcomeLabel(outcome)} / ${score.toLocaleString()}点 / PLAY ${String(game.playCount).padStart(3, "0")}`,
    `払出BALL ${game.totalPaidBalls}・戻り球 ${game.returnedBalls}・OUT ${game.outBalls}・RELAY LINK ${game.supportChain}`,
    "仮想BALLで運命のゲートを開いた！",
    GAME_URL,
    "#GEKIAZURUSH #超激アツ #カメレオンJP",
  ].join("\n");
}

function apiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  };
}

async function callRpc<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`ランキング通信に失敗しました (${response.status})`);
  return (await response.json()) as T;
}

function normalizeRanking(payload: unknown): RankingRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.slice(0, 10).map((row, index) => {
    const item = row as Record<string, unknown>;
    return {
      rank: Number(item.rank) || index + 1,
      displayName: cleanPlayerName(String(item.display_name ?? item.player_name ?? "プレイヤー")) || "プレイヤー",
      score: Number(item.score) || 0,
    };
  });
}

export async function submitAndLoadRanking(score: number, playerName: string): Promise<RankingRow[]> {
  await callRpc<unknown>("submit_score", {
    p_display_name: cleanPlayerName(playerName),
    p_game_slug: GAME_SLUG,
    p_score: Math.max(0, Math.round(score)),
    p_client_version: CLIENT_VERSION,
  });
  const payload = await callRpc<unknown>("get_best_score_ranking", {
    p_game_slug: GAME_SLUG,
    p_limit: 10,
  });
  return normalizeRanking(payload);
}

export async function shareOrCopy(text: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied ? "copied" : "failed";
  } catch {
    return "failed";
  }
}

export function shareStatusText(status: "shared" | "copied" | "cancelled" | "failed"): string {
  if (status === "shared") return "シェア画面を開きました";
  if (status === "copied") return "シェア文をコピーしました";
  if (status === "cancelled") return "シェアをキャンセルしました";
  return "コピーできませんでした。シェア文を長押ししてコピーしてください";
}
