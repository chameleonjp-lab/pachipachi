// ネオン神楽回路・パチンコ版: ハンドル、遊技球、始動口、保留、LCD、アタッカーを一つの因果で進める。
import { AudioManager } from "./AudioManager";
import { advanceBall, createVariation, cycleSymbols, guideForPower, launchBall } from "./PachinkoEngine";
import { INITIAL_GAME_STATE, MAX_ACTIVE_BALLS, type BallState, type DisplaySymbol, type GameState, type NailEvent, type Outcome, type ShotRoute, type VariationContext } from "./types";

type StateListener = (state: GameState) => void;

const OUTCOME_COPY: Record<Outcome, { message: string; step: string }> = {
  miss: { message: "信号は、始動口をすり抜けた。", step: "SIGNAL LOST" },
  win: { message: "朱の小当たり。仮想BALLを受信。", step: "SIGNAL LINK" },
  jackpot: { message: "金紋が三つ、接続。大当たりを開始。", step: "ZERO GATE JACKPOT" },
};

export class GameWorld {
  private state: GameState = { ...INITIAL_GAME_STATE, activeBalls: [], reserve: [], rightReserve: [], history: [], symbols: [...INITIAL_GAME_STATE.symbols] };
  private readonly timers: number[] = [];
  private readonly audio = new AudioManager();
  private current: VariationContext | null = null;
  private lastFrame = performance.now();
  private fireAccumulator = 0;
  private symbolAccumulator = 0;
  private attackerSettling = false;
  private nailEventEndsAt = 0;
  private nextNailEventAt = performance.now() + 7200;
  private gimmickSoundAt = 0;
  private readonly ticker: number;

  constructor(private readonly publish: StateListener) {
    this.emit();
    this.ticker = window.setInterval(() => this.tick(), 33);
  }

  private emit() {
    this.publish({ ...this.state, history: [...this.state.history], symbols: [...this.state.symbols], activeBalls: this.state.activeBalls.map((ball) => ({ ...ball })), reserve: this.state.reserve.map((item) => ({ ...item, finalSymbols: [...item.finalSymbols] })), rightReserve: this.state.rightReserve.map((item) => ({ ...item, finalSymbols: [...item.finalSymbols] })) });
  }
  private patch(next: Partial<GameState>) { this.state = { ...this.state, ...next }; this.emit(); }
  private cue(delay: number, action: () => void) { this.timers.push(window.setTimeout(action, delay)); }
  private clearTimeline() { this.timers.splice(0).forEach((timer) => window.clearTimeout(timer)); }
  private isDisplayBusy() { return this.state.phase === "variation" || this.state.phase === "reach" || this.state.phase === "reveal" || this.state.phase === "revival" || this.state.phase === "jackpot" || this.state.phase === "attacker" || this.state.phase === "roundSettle"; }

  private receiveToTrays(amount: number, lowerTray = this.state.lowerTray, outBalls = this.state.outBalls) {
    const toUpper = Math.min(amount, Math.max(0, 180 - this.state.balls));
    const remaining = amount - toUpper;
    const toLower = Math.min(remaining, Math.max(0, this.state.lowerTrayLimit - lowerTray));
    return { balls: this.state.balls + toUpper, lowerTray: lowerTray + toLower, outBalls: outBalls + remaining - toLower };
  }

  private routeBallReturns(returned: number, out: number) {
    const accepted = Math.min(returned, Math.max(0, this.state.lowerTrayLimit - this.state.lowerTray));
    return { lowerTray: this.state.lowerTray + accepted, outBalls: this.state.outBalls + out + returned - accepted, returnedBalls: this.state.returnedBalls + accepted };
  }

  setHandle(active: boolean) {
    this.audio.unlock();
    if (active && !this.state.handleActive) this.audio.lever();
    const phase = active && this.state.phase === "standby" ? "firing" : !active && this.state.phase === "firing" && this.state.activeBalls.length === 0 ? "standby" : this.state.phase;
    const rightShot = this.state.shotRoute === "right";
    this.patch({ handleActive: active, phase, message: active && !this.isDisplayBusy() ? rightShot ? "右打ち。電チューへ。" : "左打ち。始動口へ。" : this.state.message, step: active && !this.isDisplayBusy() ? rightShot ? "RIGHT HANDLE / E-TULIP" : "LEFT HANDLE / START POCKET" : this.state.step });
  }

  setHandlePower(power: number) {
    const handlePower = Math.round(Math.max(35, Math.min(100, power)));
    const nailGuide = guideForPower(handlePower);
    this.patch({ handlePower, nailGuide, message: nailGuide === "SWEET" ? "釘路、整列。中央ゲートへ。" : nailGuide === "LOW" ? "信号弱。左で失速。" : "信号過熱。右へ流出。", step: nailGuide === "SWEET" ? "NAIL ROUTE / SWEET" : nailGuide === "LOW" ? "NAIL ROUTE / LOW" : "NAIL ROUTE / HIGH" });
  }
  setShotRoute(route: ShotRoute) {
    if (route === "right" && !this.state.rightShotEnabled) { this.patch({ message: "右打ちは電チュー支援中だけ有効です。", step: "RIGHT SHOT LOCKED" }); return; }
    this.patch({ shotRoute: route, message: route === "right" ? "右打ち。電チューへ。" : "左打ち。始動口へ。", step: route === "right" ? "RIGHT SHOT / E-TULIP" : "LEFT SHOT / START POCKET" });
  }

  setVolume(volume: number) { this.audio.setVolume(volume); }

  private tick() {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, .06);
    this.lastFrame = now;
    if (this.state.nailEvent !== "none" && now >= this.nailEventEndsAt) this.patch({ nailEvent: "none", message: "釘路、通常へ。", step: "NAIL ROUTE / NORMAL" });
    if (this.state.nailEvent === "none" && !this.isDisplayBusy() && now >= this.nextNailEventAt) {
      const nailEvent: NailEvent = Math.random() < .56 ? "open" : "pinch";
      this.nailEventEndsAt = now + 3600;
      this.nextNailEventAt = now + 10400 + Math.random() * 3000;
      this.audio.cutIn();
      this.patch({ nailEvent, heat: nailEvent === "open" ? Math.max(this.state.heat, 58) : Math.max(this.state.heat, 44), feedback: nailEvent === "open" ? "rare" : "none", message: nailEvent === "open" ? "釘路開放。中央へ。" : "釘路緊縮。横へ流出。", step: nailEvent === "open" ? "NAIL EVENT / OPEN" : "NAIL EVENT / PINCH" });
    }
    let balls = this.state.activeBalls;
    if (this.state.handleActive && (!this.state.attackerOpen || this.state.shotRoute === "right") && this.state.balls > 0 && balls.length < MAX_ACTIVE_BALLS) {
      this.fireAccumulator += dt;
      const interval = .23 - this.state.handlePower * .0011;
      if (this.fireAccumulator >= interval) {
        this.fireAccumulator = 0;
        balls = [...balls, launchBall(this.state.handlePower, this.state.shotRoute === "right" ? "right" : "normal", this.state.nailEvent)];
        this.audio.bet();
        this.patch({ balls: Math.max(0, this.state.balls - 1), feedback: "fire" });
      }
    } else {
      this.fireAccumulator = 0;
      if (this.state.handleActive && balls.length >= MAX_ACTIVE_BALLS && this.state.step !== "BOARD LIMIT / 20") this.patch({ feedback: "none", message: `盤面球数 ${MAX_ACTIVE_BALLS}/${MAX_ACTIVE_BALLS}。排出まで発射待機。`, step: "BOARD LIMIT / 20" });
    }

    let startEntries = 0;
    let rightEntries = 0;
    let attackerHits = 0;
    let returned = 0;
    let out = 0;
    let gimmickHit: GameState["gimmickHit"] = "none";
    const nextBalls: BallState[] = [];
    balls.forEach((ball) => {
      const update = advanceBall(ball, dt, this.state.reserve.length + startEntries < this.state.reserveLimit, this.state.attackerOpen, this.state.rightReserve.length + rightEntries < this.state.rightReserveLimit, this.state.electricTulipOpen, this.state.nailEvent);
      if (update.ball) nextBalls.push(update.ball);
      if (update.startEntry) startEntries += 1;
      if (update.rightEntry) rightEntries += 1;
      if (update.attackerHit) attackerHits += 1;
      if (update.returnBall) returned += 1;
      if (update.outBall) out += 1;
      if (update.gimmickHit !== "none") gimmickHit = update.gimmickHit;
    });

    if (gimmickHit !== "none" && now - this.gimmickSoundAt > 120) { this.gimmickSoundAt = now; this.audio.gimmick(gimmickHit); }

    const returnFlow = this.routeBallReturns(returned, out);

    if (startEntries > 0 || rightEntries > 0) {
      const add = Array.from({ length: startEntries }, () => createVariation(undefined, "left"));
      const addRight = Array.from({ length: rightEntries }, () => createVariation(undefined, "right"));
      const reserve = [...this.state.reserve, ...add].slice(0, this.state.reserveLimit);
      const rightReserve = [...this.state.rightReserve, ...addRight].slice(0, this.state.rightReserveLimit);
      this.audio.signalHit();
      const rightEntry = rightEntries > 0;
      this.patch({ activeBalls: nextBalls, reserve, rightReserve, lowerTray: returnFlow.lowerTray, outBalls: returnFlow.outBalls, returnedBalls: returnFlow.returnedBalls, gimmickHit, feedback: "entry", heat: Math.min(82, 24 + (reserve.length + rightReserve.length) * 9 + (rightEntry ? 14 : 0)), message: rightEntry ? `電チュー入賞。右保留 ${rightReserve.length}/${this.state.rightReserveLimit}。` : `始動口入賞。左保留 ${reserve.length}/${this.state.reserveLimit}。`, step: rightEntry ? "E-TULIP / RIGHT HOLD" : "START POCKET / LEFT HOLD" });
      this.cue(150, () => { if (this.state.feedback === "entry") this.patch({ feedback: "none" }); });
      if (!this.isDisplayBusy() && (this.state.phase === "standby" || this.state.phase === "firing" || this.state.phase === "support")) this.cue(180, () => this.beginVariation());
      return;
    }

    if (attackerHits > 0) {
      const roundHits = this.state.roundHits + attackerHits;
      const paid = attackerHits * 4;
      this.audio.payout(attackerHits, true);
      const paidFlow = this.receiveToTrays(paid, returnFlow.lowerTray, returnFlow.outBalls);
      this.patch({ activeBalls: nextBalls, roundHits, ...paidFlow, returnedBalls: returnFlow.returnedBalls, gimmickHit, paidBalls: this.state.paidBalls + paid, totalPaidBalls: this.state.totalPaidBalls + paid, feedback: "pay", message: `右球道→ATTACKER入賞 ${roundHits}/5。上皿・下皿へ仮想BALL +${paid}。`, step: `ROUND ${this.state.round} / RIGHT ROUTE` });
      if (roundHits >= 5 && !this.attackerSettling) { this.attackerSettling = true; this.cue(380, () => this.settleRound()); }
      return;
    }

    if (nextBalls !== this.state.activeBalls) {
      const phase = this.state.phase === "firing" && !this.state.handleActive && nextBalls.length === 0 ? "standby" : this.state.phase;
      this.patch({ activeBalls: nextBalls, lowerTray: returnFlow.lowerTray, outBalls: returnFlow.outBalls, returnedBalls: returnFlow.returnedBalls, gimmickHit, phase, ...(returned || out ? { message: returned ? `戻り球 ${returned}。下皿へ受領。` : `アウト口 ${out}。盤面外へ回収。`, step: returned ? "RETURN / LOWER TRAY" : "OUT / DRAIN" } : {}) });
    }

    if (this.state.phase === "variation") {
      this.symbolAccumulator += dt;
      if (this.symbolAccumulator > .09) {
        this.symbolAccumulator = 0;
        this.patch({ symbols: cycleSymbols(Math.floor(now / 90)), feedback: "spin" });
      }
    }
  }

  private beginVariation() {
    if (this.isDisplayBusy() || (this.state.reserve.length === 0 && this.state.rightReserve.length === 0)) return;
    const useRight = this.state.phase === "support" ? this.state.rightReserve.length > 0 : this.state.reserve.length === 0 && this.state.rightReserve.length > 0;
    const [current, ...tail] = useRight ? this.state.rightReserve : this.state.reserve;
    if (!current) return;
    const reserve = useRight ? this.state.reserve : tail;
    const rightReserve = useRight ? tail : this.state.rightReserve;
    this.current = current;
    this.symbolAccumulator = 0;
    this.audio.startReels();
    this.patch({ phase: "variation", reserve, rightReserve, currentAward: current.outcome, entryTicket: current.ticket, reelStops: [false, false, false], activeSource: current.source, outcome: null, symbols: cycleSymbols(0), feedback: "spin", heat: current.omen === "gate" ? 66 : current.omen === "seal" ? 48 : 28, omen: current.omen, paidBalls: 0, message: current.source === "right" ? "物理入賞。RELAY抽選を固定。" : "物理入賞。図柄抽選を固定。", step: current.source === "right" ? `ENTRY ${String(current.ticket).padStart(4, "0")} / RELAY LOCK` : `ENTRY ${String(current.ticket).padStart(4, "0")} / RNG LOCK` });
    [0, 1].forEach((reel) => this.cue(current.stopDelays[reel], () => {
      if (!this.current || this.current.id !== current.id || this.state.phase !== "variation") return;
      const reelStops: [boolean, boolean, boolean] = reel === 0 ? [true, false, false] : [true, true, false];
      const symbols = this.state.symbols.map((symbol, index) => index <= reel ? current.finalSymbols[index] : symbol) as DisplaySymbol[];
      this.audio.reelStop(reel);
      this.patch({ symbols, reelStops, feedback: "spin", message: `図柄${reel + 1}、停止。抽選結果は固定済み。`, step: `VIRTUAL RNG LOCK / REEL ${reel + 1} STOP` });
    }));
    this.cue(1450, () => {
      if (!this.current || this.current.id !== current.id || this.state.phase !== "variation") return;
      if (current.reach) this.beginReach(current); else this.revealVariation(current);
    });
  }

  private beginReach(current: VariationContext) {
    this.audio.cutIn();
    const relay = current.source === "right";
    this.patch({ phase: "reach", feedback: "reach", heat: current.outcome === "jackpot" ? 91 : 73, reelStops: [true, true, false], symbols: [current.finalSymbols[0], current.finalSymbols[1], "VOID"], message: relay ? current.outcome === "jackpot" ? "RELAY GATE。中継、臨界。" : "RELAY RIFT。信号を繋げ。" : current.outcome === "jackpot" ? "GATE接続。最終図柄、同期中。" : "図柄が接近。神楽リーチへ移行。", step: relay ? "KAGURA RELAY REACH" : "KAGURA REACH" });
    this.cue(1350, () => this.revealVariation(current));
  }

  private revealVariation(current: VariationContext) {
    if (!this.current || this.current.id !== current.id) return;
    this.audio.reelStop(2);
    if (current.revive) {
      this.patch({ phase: "reveal", feedback: "none", reelStops: [true, true, true], symbols: [current.finalSymbols[0], current.finalSymbols[1], "VOID"], heat: 24, message: "信号断。沈黙。", step: "RELAY LOST" });
      this.cue(560, () => this.beginRevival(current));
      return;
    }
    this.patch({ phase: "reveal", feedback: current.outcome === "jackpot" ? "bonus" : current.outcome === "win" ? "rare" : "none", reelStops: [true, true, true], symbols: current.finalSymbols, heat: current.outcome === "jackpot" ? 100 : current.outcome === "win" ? 67 : 26, message: OUTCOME_COPY[current.outcome].message, step: current.label });
    this.cue(640, () => this.settleVariation(current));
  }

  private beginRevival(current: VariationContext) {
    if (!this.current || this.current.id !== current.id) return;
    this.audio.reveal();
    this.patch({ phase: "revival", feedback: "bonus", symbols: current.finalSymbols, heat: 98, message: "封印、再点火。RELAY復活。", step: "RELAY REVIVAL" });
    this.cue(760, () => this.settleVariation(current));
  }

  private settleVariation(current: VariationContext) {
    if (!this.current || this.current.id !== current.id) return;
    if (current.outcome === "jackpot") { this.beginJackpot(current); return; }
    if (current.outcome === "win") {
      this.audio.payout(current.payout);
      const paidFlow = this.receiveToTrays(current.payout);
      this.patch({ ...paidFlow, paidBalls: current.payout, totalPaidBalls: this.state.totalPaidBalls + current.payout, feedback: "pay" });
    }
    if (current.source === "right" && this.state.supportGames > 0) { this.routeSupport(current.outcome); return; }
    this.finishResult(current.outcome);
  }

  private beginJackpot(current: VariationContext) {
    this.audio.reveal();
    this.patch({ phase: "jackpot", outcome: "jackpot", feedback: "bonus", heat: 100, electricTulipOpen: false, attackerOpen: false, round: 0, totalRounds: current.rounds, roundHits: 0, message: "ZERO GATE JACKPOT。アタッカー開放を準備。", step: "JACKPOT / READY" });
    this.cue(820, () => this.startRound(1));
  }

  private startRound(round: number) {
    if (!this.current || this.current.outcome !== "jackpot") return;
    this.attackerSettling = false;
    this.patch({ phase: "attacker", shotRoute: "right", rightShotEnabled: true, electricTulipOpen: true, attackerOpen: true, round, roundHits: 0, feedback: "bonus", heat: 96, message: `ROUND ${round}/${this.state.totalRounds}。電チュー支援、アタッカー開放。`, step: "E-TULIP / ATTACKER OPEN" });
    this.cue(1750, () => {
      if (this.state.phase === "attacker" && !this.attackerSettling) {
        this.attackerSettling = true;
        this.settleRound();
      }
    });
  }

  private settleRound() {
    if (this.state.phase !== "attacker") return;
    this.patch({ phase: "roundSettle", electricTulipOpen: false, attackerOpen: false, feedback: "pay", message: `ROUND ${this.state.round} 終了。仮想BALL払い出しを確定。`, step: "ROUND SETTLE" });
    this.cue(680, () => {
      if (this.state.round < this.state.totalRounds) this.startRound(this.state.round + 1);
      else this.enterSupport();
    });
  }

  private enterSupport() {
    this.current = null;
    this.audio.relayTick(5);
    this.patch({ phase: "support", outcome: null, feedback: "rare", heat: 82, shotRoute: "right", rightShotEnabled: true, electricTulipOpen: true, attackerOpen: false, supportGames: 5, supportChain: 0, message: "RELAY起動。右打ち。電チューへ。", step: "RIGHT SHOT / KAGURA RELAY 05" });
  }

  private routeSupport(outcome: Outcome) {
    const remaining = Math.max(0, this.state.supportGames - 1);
    const supportChain = outcome === "win" ? this.state.supportChain + 1 : this.state.supportChain;
    if (remaining === 0) {
      this.patch({ phase: "result", outcome: "jackpot", feedback: "bonus", heat: 92, shotRoute: "left", rightShotEnabled: false, electricTulipOpen: false, attackerOpen: false, message: `KAGURA RELAY終了。LINK ${supportChain}。大当たりの余韻が沈む。`, step: "RELAY END" , playCount: this.state.playCount + 1, history: ["jackpot" as Outcome, ...this.state.history].slice(0, 5) });
      this.audio.result("jackpot");
      this.current = null;
      return;
    }
    this.current = null;
    this.audio.relayTick(remaining);
    this.patch({ phase: "support", outcome: null, feedback: outcome === "win" ? "rare" : "none", heat: outcome === "win" ? 90 : 74, shotRoute: "right", rightShotEnabled: true, electricTulipOpen: true, attackerOpen: false, supportGames: remaining, supportChain, message: outcome === "win" ? `RELAY LINK。右打ち継続、残り${remaining}G。` : `電サポ継続。右保留を獲得、残り${remaining}G。`, step: outcome === "win" ? "RELAY LINK / RIGHT SHOT" : `KAGURA RELAY / ${remaining}G` });
    if (this.state.rightReserve.length > 0) this.cue(420, () => this.beginVariation());
  }

  private finishResult(outcome: Outcome) {
    this.audio.result(outcome);
    this.current = null;
    const copy = OUTCOME_COPY[outcome];
    this.patch({ phase: "result", outcome, activeSource: null, feedback: outcome === "jackpot" ? "bonus" : outcome === "win" ? "rare" : "none", heat: outcome === "jackpot" ? 100 : outcome === "win" ? 67 : 22, shotRoute: "left", rightShotEnabled: false, electricTulipOpen: false, attackerOpen: false, message: copy.message, step: copy.step, playCount: this.state.playCount + 1, history: [outcome, ...this.state.history].slice(0, 5) });
    if (this.state.reserve.length > 0) this.cue(1250, () => { if (this.state.phase === "result") this.beginVariation(); });
  }

  actionPush() {
    this.audio.unlock(); this.audio.push();
    if (this.state.phase === "result") {
      this.patch({ phase: "log", message: `PLAY ${String(this.state.playCount).padStart(3, "0")} / HOLD ${this.state.reserve.length} / PAID ${this.state.paidBalls}。PUSHで盤面へ戻る。`, step: "PACHINKO LOG" });
      return;
    }
    if (this.state.phase === "log") {
      const phase = this.state.handleActive ? "firing" : "standby";
      this.patch({ phase, outcome: null, feedback: "none", heat: 12, message: this.state.reserve.length || this.state.rightReserve.length ? "保留を消化します。" : "ハンドルを長押し。始動口への入賞を待機。", step: this.state.reserve.length || this.state.rightReserve.length ? "HOLD READY" : "STANDBY / START POCKET" });
      if (this.state.reserve.length || this.state.rightReserve.length) this.beginVariation();
      return;
    }
    this.patch({ message: "PUSHは結果ログの確認に使用します。ハンドルで遊技球を打ち出してください。", step: "AUXILIARY PUSH" });
  }

  transferLowerTray() {
    this.audio.unlock();
    const transferable = Math.min(this.state.lowerTray, Math.max(0, 180 - this.state.balls));
    if (transferable <= 0) { this.patch({ message: this.state.lowerTray > 0 ? "上皿満杯。移送待機。" : "下皿は空です。", step: "TRAY TRANSFER / HOLD" }); return; }
    this.audio.payout(transferable);
    this.patch({ balls: this.state.balls + transferable, lowerTray: this.state.lowerTray - transferable, feedback: "pay", message: `下皿→上皿へ仮想BALL ${transferable}。`, step: "TRAY TRANSFER / COMPLETE" });
  }

  resetSession() {
    if (this.isDisplayBusy()) return;
    this.clearTimeline(); this.current = null; this.nailEventEndsAt = 0; this.nextNailEventAt = performance.now() + 7200;
    this.patch({ ...INITIAL_GAME_STATE, activeBalls: [], reserve: [], rightReserve: [], history: [], symbols: [...INITIAL_GAME_STATE.symbols], message: "仮想BALL、再装填。", step: "NEW DEMO SESSION" });
  }

  runDemo() {
    this.clearTimeline(); this.current = null;
    const demoOutcomes: Outcome[] = ["miss", "win", "jackpot"];
    const reserve = demoOutcomes.map((outcome) => createVariation(outcome, "left"));
    this.patch({ ...INITIAL_GAME_STATE, reserve, rightReserve: [], activeBalls: [], history: [], symbols: [...INITIAL_GAME_STATE.symbols], message: "DEMO：始動口に三つの保留を受信。", step: "DEMO LEFT HOLD QUEUE" });
    this.cue(640, () => this.beginVariation());
  }

  showPreview(outcome: Outcome) {
    this.clearTimeline(); this.current = null;
    const context = createVariation(outcome);
    this.patch({ ...INITIAL_GAME_STATE, phase: "result", outcome, playCount: 1, history: [outcome], symbols: context.finalSymbols, paidBalls: outcome === "win" ? context.payout : outcome === "jackpot" ? 60 : 0, totalPaidBalls: outcome === "win" ? context.payout : outcome === "jackpot" ? 60 : 0, balls: 180 + (outcome === "win" ? context.payout : outcome === "jackpot" ? 60 : 0), message: OUTCOME_COPY[outcome].message, step: OUTCOME_COPY[outcome].step });
  }

  showSupportPreview() {
    this.clearTimeline(); this.current = null;
    const rightReserve = [createVariation("win", "right"), createVariation("miss", "right")];
    this.patch({ ...INITIAL_GAME_STATE, phase: "support", rightReserve, activeBalls: [], history: ["jackpot" as Outcome], symbols: ["GATE", "GATE", "SEAL"], shotRoute: "right", rightShotEnabled: true, electricTulipOpen: true, supportGames: 4, supportChain: 1, heat: 86, message: "KAGURA RELAY。右打ちで電チュー保留を消化。", step: "RIGHT SHOT / RELAY 04" });
  }

  showRelayPreview(revival: boolean) {
    this.clearTimeline(); this.current = null;
    const context = createVariation("win", "right");
    this.patch({ ...INITIAL_GAME_STATE, phase: revival ? "revival" : "reach", activeSource: "right", rightReserve: [createVariation("miss", "right")], activeBalls: [], history: ["jackpot" as Outcome], symbols: revival ? context.finalSymbols : [context.finalSymbols[0], context.finalSymbols[1], "VOID"], shotRoute: "right", rightShotEnabled: true, electricTulipOpen: true, supportGames: 3, supportChain: 1, feedback: revival ? "bonus" : "reach", heat: revival ? 98 : 84, message: revival ? "封印、再点火。RELAY復活。" : "RELAY RIFT。信号を繋げ。", step: revival ? "RELAY REVIVAL" : "KAGURA RELAY REACH" });
  }

  showNailPreview(nailEvent: Exclude<NailEvent, "none">) {
    this.clearTimeline(); this.current = null;
    this.nailEventEndsAt = performance.now() + 999999;
    this.nextNailEventAt = performance.now() + 999999;
    this.patch({ ...INITIAL_GAME_STATE, nailEvent, nailGuide: "SWEET", message: nailEvent === "open" ? "釘路開放。中央へ。" : "釘路緊縮。横へ流出。", step: nailEvent === "open" ? "NAIL EVENT / OPEN" : "NAIL EVENT / PINCH" });
  }

  showAttackerPreview() {
    this.clearTimeline(); this.current = null;
    this.patch({ ...INITIAL_GAME_STATE, phase: "attacker", activeBalls: [launchBall(70, "attacker"), launchBall(70, "attacker")], shotRoute: "right", rightShotEnabled: true, electricTulipOpen: true, attackerOpen: true, round: 2, totalRounds: 3, roundHits: 2, feedback: "bonus", heat: 96, message: "右球道、開放。ATTACKERへ。", step: "E-TULIP → ATTACKER" });
  }

  dispose() { this.clearTimeline(); window.clearInterval(this.ticker); this.audio.dispose(); }
}
