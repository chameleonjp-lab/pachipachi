// 漆黒の祝祭機: 結果を、金の菊花と祝祭朱を保った一枚の共有カードへ変換する。
import { GAME_ASSETS } from "./assets";
import type { Outcome } from "./types";

const SHARE_COPY: Record<Outcome, { title: string; line: string; accent: string }> = {
  miss: { title: "ハズレ", line: "熱は、沈んだ。", accent: "#8ce6ff" },
  win: { title: "当たり", line: "朱の扉が、開く。", accent: "#e62135" },
  jackpot: { title: "大当たり", line: "祝祭、解放。", accent: "#fff1ae" },
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function createShareText(outcome: Outcome, round: number) {
  const copy = SHARE_COPY[outcome];
  return `GEKIAZU RUSHで「${copy.title}」！\n${copy.line}\nROUND ${String(round).padStart(3, "0")}\n#GEKIAZURUSH #超激アツ`;
}

export function createXIntentUrl(text: string, url: string) {
  const parameters = new URLSearchParams({ text, url, hashtags: "GEKIAZURUSH,超激アツ", lang: "ja" });
  return `https://x.com/intent/tweet?${parameters.toString()}`;
}

export async function createShareCard(outcome: Outcome, round: number) {
  await document.fonts?.ready;
  const width = 1200;
  const height = 630;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("共有画像を生成できませんでした。");

  const copy = SHARE_COPY[outcome];
  const [stage, ring, logo, confetti] = await Promise.all([
    loadImage(GAME_ASSETS.lacquerStage),
    loadImage(GAME_ASSETS.goldRing),
    loadImage(GAME_ASSETS.logo),
    outcome === "jackpot" ? loadImage(GAME_ASSETS.confettiBurst) : Promise.resolve(null),
  ]);

  context.fillStyle = "#050507";
  context.fillRect(0, 0, width, height);
  drawCover(context, stage, width, height);
  const shade = context.createLinearGradient(0, 0, width, height);
  shade.addColorStop(0, "rgba(3, 4, 8, .88)");
  shade.addColorStop(.52, "rgba(12, 2, 6, .40)");
  shade.addColorStop(1, "rgba(3, 4, 8, .90)");
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(237, 191, 84, .76)";
  context.lineWidth = 3;
  context.strokeRect(32, 32, width - 64, height - 64);
  context.strokeStyle = "rgba(140, 230, 255, .28)";
  context.lineWidth = 1;
  context.strokeRect(47, 47, width - 94, height - 94);

  context.drawImage(logo, 68, 68, 68, 68);
  context.fillStyle = "#f7ead0";
  context.font = '700 30px "Space Grotesk", sans-serif';
  context.fillText("GEKIAZU", 154, 104);
  context.fillStyle = "#e62135";
  context.fillText("RUSH", 310, 104);
  context.fillStyle = "rgba(237, 191, 84, .82)";
  context.font = '700 13px "Space Grotesk", sans-serif';
  context.letterSpacing = "2px";
  context.fillText("FESTIVAL REACH ENGINE", 154, 130);
  context.letterSpacing = "0px";

  const ringSize = 420;
  context.globalAlpha = outcome === "miss" ? .36 : .78;
  context.drawImage(ring, (width - ringSize) / 2, 112, ringSize, ringSize);
  context.globalAlpha = 1;
  if (confetti) context.drawImage(confetti, 70, 128, width - 140, 382);

  context.textAlign = "center";
  context.fillStyle = "#8ce6ff";
  context.font = '700 15px "Space Grotesk", sans-serif';
  context.letterSpacing = "4px";
  context.fillText("運命、確定。", width / 2, 220);
  context.letterSpacing = "0px";
  context.shadowColor = copy.accent;
  context.shadowBlur = 28;
  context.fillStyle = copy.accent;
  context.font = '900 132px "Zen Kaku Gothic New", sans-serif';
  context.fillText(copy.title, width / 2, 380);
  context.shadowBlur = 0;
  context.fillStyle = "#fff6e4";
  context.font = '700 32px "Zen Kaku Gothic New", sans-serif';
  context.fillText(copy.line, width / 2, 432);
  context.textAlign = "left";

  context.fillStyle = "rgba(140, 230, 255, .84)";
  context.font = '700 17px "Space Grotesk", sans-serif';
  context.fillText(`ROUND ${String(round).padStart(3, "0")}`, 70, height - 72);
  context.textAlign = "right";
  context.fillStyle = "rgba(247, 234, 208, .76)";
  context.fillText("NO WAGER • ENTERTAINMENT MODE", width - 70, height - 72);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((image) => (image ? resolve(image) : reject(new Error("共有画像を保存できませんでした。"))), "image/png");
  });
  return new File([blob], `gekiazu-rush-${outcome}-${String(round).padStart(3, "0")}.png`, { type: "image/png" });
}

export function downloadShareCard(file: File) {
  const downloadUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 2_000);
}
