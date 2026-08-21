// ネオン神楽回路・パチンコ版: LCD、盤面、遊技球、始動口、ハンドルを正面筐体として一体表示する。
/* ネオン神楽回路: LCD→物理盤面→祝祭朱FIREを一本の儀式機関として扱い、金は公式クレストと決着に限定する。 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Settings2, Volume2, Zap } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { GAME_ASSETS } from "@/game/assets";
import { BOARD_BUMPERS, BOARD_PINS, BOARD_RAILS } from "@/game/PachinkoBoard";
import { createGameScene, type GameHandle } from "@/game/scene";
import { createShareCard, createShareText, createXIntentUrl, downloadShareCard } from "@/game/shareCard";
import { INITIAL_GAME_STATE, MAX_ACTIVE_BALLS, type DisplaySymbol, type GameState, type Outcome } from "@/game/types";

const OUTCOME_LABELS: Record<Outcome, { title: string; kicker: string }> = {
  miss: { title: "信号途絶", kicker: "図柄、非同期" },
  win: { title: "小当たり", kicker: "仮想BALLを受信" },
  jackpot: { title: "大当たり", kicker: "ZERO GATE 解放" },
};
const SYMBOL_LABELS: Record<DisplaySymbol, string> = { ARC: "◒", SEAL: "封", GATE: "門", BOLT: "ϟ", ZERO: "0", VOID: "·" };
const STAGE_LABELS: Record<GameState["phase"], string> = { standby: "SILENT GATE", firing: "RED FIRE", variation: "FATE SPIN", reach: "KAGURA RIFT", reveal: "FINAL LOCK", revival: "REIGNITE", jackpot: "GOLD OVERCLOCK", attacker: "RED ACCESS", roundSettle: "ROUND SETTLE", support: "CYAN RELAY", result: "FATE VERDICT", log: "SIGNAL LOG" };
const NAIL_LABELS: Record<GameState["nailGuide"], { title: string; note: string }> = { LOW: { title: "LOW", note: "左釘で失速" }, SWEET: { title: "GATE LOCK", note: "始動口へ整列" }, HIGH: { title: "HIGH", note: "右へ流出" } };
const SETTINGS_STORAGE_KEY = "gekiazu-rush.settings.v1";
const DEFAULT_SETTINGS = { effects: 80, volume: 78 };
type GameSettings = typeof DEFAULT_SETTINGS;

function loadSettings(): GameSettings {
  try {
    const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const value = JSON.parse(saved) as Partial<GameSettings>;
    return { effects: Math.max(0, Math.min(100, Math.round(value.effects ?? DEFAULT_SETTINGS.effects))), volume: Math.max(0, Math.min(100, Math.round(value.volume ?? DEFAULT_SETTINGS.volume))) };
  } catch { return DEFAULT_SETTINGS; }
}

function HistoryMark({ outcome }: { outcome: Outcome }) { return <span className={`history-mark history-mark--${outcome}`} aria-label={OUTCOME_LABELS[outcome].title} />; }

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const handleRef = useRef<GameHandle | null>(null);
  const [game, setGame] = useState<GameState>(INITIAL_GAME_STATE);
  const [shareStatus, setShareStatus] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(() => new URLSearchParams(window.location.search).has("settings"));
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const isHandleDown = useRef(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    let disposed = false;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    void createGameScene(engine, canvas, setGame).then((handle) => {
      if (disposed) { handle.dispose(); return; }
      handleRef.current = handle;
      handle.setEffectIntensity(settingsRef.current.effects);
      handle.setVolume(settingsRef.current.volume);
      engine.runRenderLoop(() => handle.scene.render());
    });
    const onResize = () => engine.resize();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); if (!isHandleDown.current) { isHandleDown.current = true; handleRef.current?.setHandle(true); } }
      if (event.key.toLowerCase() === "p") handleRef.current?.actionPush();
      if (event.key.toLowerCase() === "r") handleRef.current?.resetSession();
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === "Space") { event.preventDefault(); isHandleDown.current = false; handleRef.current?.setHandle(false); } };
    window.addEventListener("resize", onResize); window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
    return () => { disposed = true; window.removeEventListener("resize", onResize); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); handleRef.current?.dispose(); handleRef.current = null; engine.dispose(); startedRef.current = false; };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    try { window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch { /* 設定保存が制限された環境でも調整自体は継続する。 */ }
    handleRef.current?.setEffectIntensity(settings.effects);
    handleRef.current?.setVolume(settings.volume);
  }, [settings]);

  const startHandle = useCallback(() => { isHandleDown.current = true; handleRef.current?.setHandle(true); }, []);
  const stopHandle = useCallback(() => { isHandleDown.current = false; handleRef.current?.setHandle(false); }, []);
  const setPower = useCallback((value: number) => handleRef.current?.setHandlePower(value), []);
  const setShotRoute = useCallback((route: "left" | "right") => handleRef.current?.setShotRoute(route), []);
  const actionPush = useCallback(() => handleRef.current?.actionPush(), []);
  const transferLowerTray = useCallback(() => handleRef.current?.transferLowerTray(), []);
  const resetSession = useCallback(() => handleRef.current?.resetSession(), []);
  const setEffectIntensity = useCallback((effects: number[]) => setSettings((current) => ({ ...current, effects: effects[0] ?? current.effects })), []);
  const setVolume = useCallback((volume: number[]) => setSettings((current) => ({ ...current, volume: volume[0] ?? current.volume })), []);
  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);
  const result = game.outcome ? OUTCOME_LABELS[game.outcome] : null;
  const isVariating = game.phase === "variation" || game.phase === "reach";

  const shareResult = useCallback(async () => {
    if (!game.outcome) return;
    const text = createShareText(game.outcome, game.playCount);
    const gameUrl = window.location.href.split("?")[0];
    const intentUrl = createXIntentUrl(text, gameUrl);
    const xWindow = window.open("about:blank", "gekiazu-x-share", "noopener,noreferrer,width=620,height=640");
    setShareStatus("共有画像を準備中…");
    try {
      const card = await createShareCard(game.outcome, game.playCount);
      const fileShareData = { files: [card] };
      if (navigator.share && navigator.canShare?.(fileShareData)) { xWindow?.close(); await navigator.share({ title: "GEKIAZU RUSH", text, url: gameUrl, files: [card] }); setShareStatus("共有シートを開きました。Xを選択して投稿できます。"); return; }
      downloadShareCard(card); if (xWindow) xWindow.location.replace(intentUrl); else window.open(intentUrl, "_blank", "noopener,noreferrer"); setShareStatus("投稿文をXにセットし、共有画像を保存しました。");
    } catch (error) {
      xWindow?.close(); if (error instanceof DOMException && error.name === "AbortError") { setShareStatus("共有をキャンセルしました。"); return; }
      window.open(intentUrl, "_blank", "noopener,noreferrer"); setShareStatus("投稿文をXにセットしました。");
    }
  }, [game.outcome, game.playCount]);

  return (
    <main className={`game-shell pachinko-shell phase-${game.phase} omen-${game.omen} feedback-${game.feedback} nail-event-${game.nailEvent} ${game.outcome ? `outcome-${game.outcome}` : ""} ${game.handleActive ? "handle-active" : ""} ${game.activeBalls.length >= MAX_ACTIVE_BALLS ? "board-full" : ""} ${game.shotRoute === "right" ? "right-shot-active" : ""} ${game.activeSource === "right" && (game.phase === "reach" || game.phase === "revival") ? "relay-ritual-active" : ""}`} style={{ "--machine-reference": `url(${GAME_ASSETS.machineReference})`, "--cyber-circuit-bg": `url(${GAME_ASSETS.cyberCircuitBackground})`, "--effect-level": settings.effects / 100 } as React.CSSProperties}>
      <canvas ref={canvasRef} className="game-canvas" aria-hidden="true" />
      <div className="cyber-grid" aria-hidden="true" /><div className="circuit-stream circuit-stream--one" aria-hidden="true" /><div className="circuit-stream circuit-stream--two" aria-hidden="true" /><div className="machine-grain" aria-hidden="true" /><div className="screen-scanlines" aria-hidden="true" /><div className="lightning-field" aria-hidden="true" />
      <section className="game-hud" aria-label="GEKIAZU RUSH パチンコ筐体">
        <header className="machine-header">
          <div className="brand-lockup"><img src={GAME_ASSETS.logo} alt="" className="brand-crest" /><div><p className="eyebrow">NEON KAGURA PACHINKO</p><h1><span className="wordmark-core">GEKI<span className="wordmark-a">A</span>ZU</span><span className="wordmark-rush">RUSH</span></h1></div></div>
          <div className="header-actions"><div className="top-status"><span>PLAY</span><strong>{String(game.playCount).padStart(3, "0")}</strong><i /><span>VIRTUAL FATE MODE</span></div><button type="button" className="settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="演出と音量の設定を開く"><Settings2 aria-hidden="true" /><span>SET</span></button></div>
        </header>

        <section className="result-stage lcd-stage" aria-live="polite">
          <div className="stage-topline"><span className="heat-label">SIGNAL HEAT</span><div className="heat-track"><span style={{ width: `${game.heat}%` }} /></div><strong>{String(game.heat).padStart(3, "0")}%</strong></div>
          <div className="lcd-reserve" aria-label={`左保留 ${game.reserve.length}/${game.reserveLimit}、右保留 ${game.rightReserve.length}/${game.rightReserveLimit}`}><span>{Array.from({ length: game.reserveLimit }, (_, index) => <i className={index < game.reserve.length ? `is-filled signal-${game.reserve[index]?.signal ?? "silent"}` : ""} key={index} />)}<b>L</b></span><span className="right-hold">{Array.from({ length: game.rightReserveLimit }, (_, index) => <i className={index < game.rightReserve.length ? `is-filled signal-${game.rightReserve[index]?.signal ?? "silent"}` : ""} key={index} />)}<b>R</b></span></div>
          <div className="ring-wrap" aria-hidden="true"><img src={GAME_ASSETS.goldRing} alt="" className="gold-ring" /></div><img src={GAME_ASSETS.holoSeal} alt="" className="holo-seal" aria-hidden="true" />{game.outcome === "jackpot" && <img src={GAME_ASSETS.confettiBurst} alt="" className="confetti-burst" />}
          <div className="lcd-axis-rail" aria-hidden="true"><i /><i /><b>ϟ</b></div><div className="lcd-official-seal" aria-hidden="true"><span>GEKIAZU</span><img src={GAME_ASSETS.logo} alt="" /><b>ϟ</b></div>
          <div className="lcd-ritual-pressure" aria-hidden="true"><i /><i /><i /><b>12 // KAGURA LINK</b></div>
          <div className="portrait-oracle-compact" aria-live="polite"><span>{game.step}</span><b>{result ? result.title : game.phase === "standby" ? "運命待機" : STAGE_LABELS[game.phase]}</b><div>{game.symbols.map((symbol, index) => <i key={`portrait-${symbol}-${index}`}>{SYMBOL_LABELS[symbol]}</i>)}</div><small>{game.message}</small></div>
          {(game.phase === "standby" || game.phase === "firing") && <div className="lcd-idle-declaration" aria-hidden="true"><span>ORACLE // LINK READY</span><b>運命待機</b><i>START POCKET AWAITS</i></div>}
          <div className="lcd-content">
            <p className="phase-copy">{game.step}</p>
            {game.entryTicket !== null && <div className="entry-lock" aria-label={`入賞抽選ID ${String(game.entryTicket).padStart(4, "0")}`}><span>PHYSICAL ENTRY</span><b>{String(game.entryTicket).padStart(4, "0")}</b><i>VIRTUAL RNG LOCKED</i><em>{game.reelStops.map((stopped, index) => <u className={stopped ? "is-stopped" : ""} key={index}>R{index + 1}</u>)}</em></div>}
            <div className={`lcd-symbol-bank ${isVariating ? "is-variating" : ""}`} aria-label="三図柄表示">{game.symbols.map((symbol, index) => <b key={`${symbol}-${index}`} className={`lcd-symbol symbol-${symbol.toLowerCase()}`}>{SYMBOL_LABELS[symbol]}</b>)}</div>
            <p className="lcd-stage-label">{result ? result.kicker : STAGE_LABELS[game.phase]}</p>
            <p className="status-message">{game.message}</p>
            {game.phase === "attacker" && <div className="round-meter"><span style={{ width: `${game.roundHits * 20}%` }} /><b>ROUND {game.round}/{game.totalRounds} · ATTACKER {game.roundHits}/5</b></div>}
            {game.phase === "support" && <><div className="support-meter"><span style={{ width: `${(game.supportGames / 5) * 100}%` }} /><b>KAGURA RELAY · RIGHT SHOT · {game.supportGames}G · LINK {game.supportChain}</b></div><div className="relay-countdown" aria-label={`KAGURA RELAY 残り${game.supportGames}ゲーム`}>{Array.from({ length: 5 }, (_, index) => { const spent = index < 5 - game.supportGames; const current = index === 5 - game.supportGames; return <i className={spent ? "is-spent" : current ? "is-current" : ""} key={index}><b>{5 - index}</b></i>; })}<span>RELAY COUNT</span></div></>}
            {game.activeSource === "right" && (game.phase === "reach" || game.phase === "revival") && <div className={`relay-ritual relay-ritual--${game.phase}`}><i>ϟ</i><b>{game.phase === "revival" ? "REVIVAL / REIGNITE" : "RELAY RIFT / CONNECT"}</b></div>}
            {result && <div className="share-result"><button type="button" className="x-share-button" onClick={shareResult}><span aria-hidden="true">𝕏</span>結果画像をシェア</button><p className="share-status" role="status">{shareStatus || "PUSHで遊技ログを確認できます"}</p></div>}
          </div>
          <a href="#mobile-playfield" className="mobile-playfield-jump">PLAYFIELD <b>↓</b></a><div className="display-corners" aria-hidden="true"><i /><i /><i /><i /></div><div className="bezel-bolts" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        </section>

        <section className="pachinko-deck" aria-label="パチンコ盤面と操作部">
          <div className="ritual-conduit" aria-hidden="true"><i /><i /><div><span>GEKIAZU</span><img src={GAME_ASSETS.logo} alt="" /><b>ϟ</b></div></div>
          <div className="portrait-axis-crest" aria-hidden="true"><i>12</i><img src={GAME_ASSETS.logo} alt="" /><b>ϟ</b></div>
          <div className="machine-readouts pachinko-readouts"><div><span>UPPER TRAY</span><strong>{String(game.balls).padStart(3, "0")}</strong></div><div className="lower-readout"><span>LOWER TRAY</span><strong>{String(game.lowerTray).padStart(3, "0")}</strong></div><div><span>LEFT HOLD</span><strong>{game.reserve.length}/{game.reserveLimit}</strong></div><div className="right-readout"><span>RIGHT HOLD</span><strong>{game.rightReserve.length}/{game.rightReserveLimit}</strong></div><div><span>PAID</span><strong>{String(game.paidBalls).padStart(2, "0")}</strong></div><div className="out-readout"><span>OUT</span><strong>{String(game.outBalls).padStart(3, "0")}</strong></div></div>
          <div id="mobile-playfield" className={`pachinko-board ${game.attackerOpen ? "is-attacker-open" : ""}`} aria-label="始動口とアタッカーを備えたパチンコ盤面">
            <img className="pachinko-board__art" src={GAME_ASSETS.pachinkoBoard} alt="" />
            <div className="board-official-seal" aria-hidden="true"><span>GEKIAZU</span><img src={GAME_ASSETS.logo} alt="" /><b>ϟ</b></div>
            <div className="board-ball-count" aria-label={`盤面上の遊技球 ${game.activeBalls.length}/${MAX_ACTIVE_BALLS}`}><span>BOARD BALLS</span><b>{String(game.activeBalls.length).padStart(2, "0")}</b><i>/ {MAX_ACTIVE_BALLS}</i></div>
            <div className="board-sigil board-sigil--top" aria-hidden="true"><i /><b>ϟ</b></div><div className="board-sigil board-sigil--bottom" aria-hidden="true"><i /><b>ϟ</b></div>
            <svg className="physics-rail-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{BOARD_RAILS.map((rail) => <line className={`physics-rail physics-rail--${rail.role}`} key={rail.id} x1={rail.ax} y1={rail.ay} x2={rail.bx} y2={rail.by} />)}</svg><div className={`seal-shutter seal-shutter--${game.nailEvent}`} aria-label={`SEAL SHUTTER ${game.nailEvent === "open" ? "OPEN" : game.nailEvent === "pinch" ? "PINCH" : "NORMAL"}`}><i /><i /><b>SEAL<br />SHUTTER</b></div><div className="kagura-rotor-bank" aria-label="KAGURA ROTOR 物理バンパー">{BOARD_BUMPERS.map((bumper) => <div className={`kagura-rotor kagura-rotor--${bumper.id} ${game.gimmickHit === bumper.id ? "is-hit" : ""}`} key={bumper.id} style={{ left: `${bumper.x}%`, top: `${bumper.y}%` }}><i /><i /><b>ϟ</b></div>)}</div><div className="pin-field" aria-hidden="true">{BOARD_PINS.map((pin) => <i className={`pin--${pin.role}`} key={pin.id} style={{ left: `${pin.x}%`, top: `${pin.y}%` }} />)}</div>
            <div className="board-reserve" aria-hidden="true">{Array.from({ length: game.reserveLimit }, (_, index) => <i className={index < game.reserve.length ? `is-filled signal-${game.reserve[index]?.signal ?? "silent"}` : ""} key={index} />)}</div>
            <div className="right-reserve" aria-label={`右保留 ${game.rightReserve.length}/${game.rightReserveLimit}`}>{Array.from({ length: game.rightReserveLimit }, (_, index) => <i className={index < game.rightReserve.length ? `is-filled signal-${game.rightReserve[index]?.signal ?? "silent"}` : ""} key={index} />)}<b>R HOLD</b></div>
            <div className={`nail-guide nail-guide--${game.nailGuide.toLowerCase()}`}><span>NAIL ROUTE</span><b>{NAIL_LABELS[game.nailGuide].title}</b><small>{NAIL_LABELS[game.nailGuide].note}</small><i /></div>
            {game.nailEvent !== "none" && <div className={`nail-event-card nail-event-card--${game.nailEvent}`}><b>{game.nailEvent === "open" ? "OPEN" : "PINCH"}</b><span>{game.nailEvent === "open" ? "CENTRE GATE" : "SIDE FLOW"}</span></div>}
            {game.gimmickHit !== "none" && <div className={`gimmick-impact gimmick-impact--${game.gimmickHit}`}>{game.gimmickHit === "rotor-left" ? "LEFT ROTOR KICK" : "RIGHT ROTOR KICK"}</div>}
            <div className={`start-pocket ${game.feedback === "entry" ? "is-hit" : ""}`}><img src={GAME_ASSETS.startPocket} alt="始動口" /><span>START</span></div>
            <div className={`electric-tulip ${game.electricTulipOpen ? "is-open" : ""}`}><i /><i /><span>{game.electricTulipOpen ? "E-TULIP OPEN" : "E-TULIP"}</span></div>
            <div className={`attacker-gate attacker-stage-${game.roundHits} ${game.roundHits >= 5 ? "is-full" : ""}`} aria-label={`アタッカー役物 ${game.roundHits}/5`}><div className="attacker-petals" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i className={index < game.roundHits ? "is-lit" : ""} key={index} />)}</div><div className="attacker-gate__mechanism"><i /><i /><i /></div><span>{game.attackerOpen ? `PETAL ${game.roundHits}/5` : "ATTACKER"}</span></div>
            <div className="return-gate" aria-label={`下皿戻り球 ${game.returnedBalls}`}><b>RETURN</b><span>LOWER</span></div><div className="out-gate" aria-label={`アウト口 ${game.outBalls}`}><b>OUT</b></div>
            {game.attackerOpen && <div className="relay-channel" aria-label="右球道からアタッカーへの誘導球道"><i /><b>E-TULIP → ATTACKER</b></div>}
            <div className="ball-layer" aria-hidden="true">{game.activeBalls.map((ball) => <img className={`pachinko-ball pachinko-ball--${ball.kind}`} src={GAME_ASSETS.steelBall} alt="" key={ball.id} style={{ left: `${ball.x}%`, top: `${ball.y}%` }} />)}</div>
            <div className="board-corner board-corner--left">LEFT<br />LANE</div><div className="board-corner board-corner--right">E-TULIP<br />LINE</div>
          </div>
          <nav className="mobile-live-dock" aria-label="スマホ用遊技操作ドック">
            <div className="mobile-live-dock__top"><div className="mobile-board-status"><span>BOARD</span><b>{String(game.activeBalls.length).padStart(2, "0")}<i>/ {MAX_ACTIVE_BALLS}</i></b></div><div className="mobile-route-switch" role="group" aria-label="スマホ用発射球道"><button type="button" className={game.shotRoute === "left" ? "is-active" : ""} onClick={() => setShotRoute("left")}><span>LEFT</span><b>START</b></button><button type="button" className={game.shotRoute === "right" ? "is-active" : ""} onClick={() => setShotRoute("right")} disabled={!game.rightShotEnabled}><span>RIGHT</span><b>E-TULIP</b></button></div><button type="button" className="mobile-settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="演出と音量の設定を開く"><Settings2 aria-hidden="true" /><span>SET</span></button></div>
            <div className="mobile-live-dock__fire"><label htmlFor="mobile-handle-power">FORCE <b>{game.handlePower}</b></label><input id="mobile-handle-power" aria-label="スマホ用発射強度" type="range" min="35" max="100" value={game.handlePower} onChange={(event) => setPower(Number(event.target.value))} /><button type="button" className="mobile-fire-control" onPointerDown={startHandle} onPointerUp={stopHandle} onPointerCancel={stopHandle} onPointerLeave={stopHandle} aria-pressed={game.handleActive}><small>GEKIAZU / HOLD TO</small><b>FIRE</b><i aria-hidden="true">ϟ</i></button></div>
          </nav>
          <div className="pachinko-controls">
            <div className="shot-route" role="group" aria-label="発射球道"><button type="button" className={game.shotRoute === "left" ? "is-active" : ""} onClick={() => setShotRoute("left")}>LEFT<br /><b>START</b></button><button type="button" className={game.shotRoute === "right" ? "is-active" : ""} onClick={() => setShotRoute("right")} disabled={!game.rightShotEnabled}>RIGHT<br /><b>E-TULIP</b></button></div>
            <p className="control-label">RITUAL FORCE <strong>{game.handlePower}</strong><em>GATE 55–75</em></p>
            <input aria-label="発射強度" className="handle-power" type="range" min="35" max="100" value={game.handlePower} onChange={(event) => setPower(Number(event.target.value))} />
            <button type="button" className="handle-control" onPointerDown={startHandle} onPointerUp={stopHandle} onPointerCancel={stopHandle} onPointerLeave={stopHandle} onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") startHandle(); }} onKeyUp={stopHandle} aria-pressed={game.handleActive}><span className="handle-control__arm" /><span className="handle-control__dial"><small>HOLD TO</small><b>FIRE</b></span></button>
            <button type="button" className="pachinko-push" onClick={actionPush}><small>SEAL AUX</small><b>PUSH</b></button>
            <button type="button" className="demo-reset" onClick={resetSession} disabled={game.phase === "attacker" || game.phase === "jackpot"}><span>VIRTUAL</span><b>VOID RESET</b></button>
            <button type="button" className="tray-transfer" onClick={transferLowerTray} disabled={game.lowerTray === 0 || game.balls >= 180}><span>LOWER → UPPER</span><b>TRAY TRANSFER</b></button>
          </div>
          <div className="deck-footer pachinko-footer"><div className="history-panel"><span className="history-title">LAST 5</span><div className="history-row">{game.history.length === 0 ? <span className="history-empty">— — — — —</span> : game.history.map((item, index) => <HistoryMark outcome={item} key={`${item}-${index}`} />)}</div></div><p className="control-hint">{game.shotRoute === "right" ? "RIGHT // E-TULIP DECIDES" : "LEFT // START GATE DECIDES"}<br />SPACE: FIRE　P: PUSH　R: RESET　•　VIRTUAL BALL ONLY</p></div>
        </section>
      </section>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="settings-modal" aria-describedby="settings-description">
          <DialogHeader className="settings-modal__header"><p>RITUAL CONTROL</p><DialogTitle>演出・音量設定</DialogTitle><DialogDescription id="settings-description">端末内に保存され、次回の遊技にも適用されます。</DialogDescription></DialogHeader>
          <div className="settings-modal__controls">
            <section className="setting-control"><div className="setting-control__head"><div><Zap aria-hidden="true" /><span>演出強度</span></div><output>{settings.effects}%</output></div><p>発光、走査線、筐体ランプの強さを調整します。</p><Slider value={[settings.effects]} min={0} max={100} step={5} onValueChange={setEffectIntensity} aria-label="演出強度" /></section>
            <section className="setting-control"><div className="setting-control__head"><div><Volume2 aria-hidden="true" /><span>音量</span></div><output>{settings.volume}%</output></div><p>発射、入賞、役物、図柄変動の合成音を調整します。</p><Slider value={[settings.volume]} min={0} max={100} step={5} onValueChange={setVolume} aria-label="音量" /></section>
          </div>
          <DialogFooter className="settings-modal__footer"><button type="button" className="settings-reset" onClick={resetSettings}>初期値へ戻す</button><DialogClose asChild><button type="button" className="settings-close">適用して閉じる</button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
