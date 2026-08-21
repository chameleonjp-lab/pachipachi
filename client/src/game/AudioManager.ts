// ネオン神楽回路: 実在機の音源を使わず、遊技イベントを耳で区別できるオリジナルの機械的合成音を生成する。
export class AudioManager {
  private context: AudioContext | null = null;
  private readonly reelTimers: Array<number | null> = [null, null, null];
  private payoutTimer: number | null = null;
  private volume = .78;

  unlock() { if (!this.context) { const AudioContextConstructor = window.AudioContext; this.context = new AudioContextConstructor(); } void this.context.resume(); }
  setVolume(value: number) { this.volume = Math.max(0, Math.min(100, value)) / 100; }
  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, endFrequency?: number) { const context = this.context; if (!context || context.state !== "running" || this.volume <= 0) return; const oscillator = context.createOscillator(); const gain = context.createGain(); const now = context.currentTime; oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), now + duration); gain.gain.setValueAtTime(Math.max(volume * this.volume, 0.0001), now); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(now); oscillator.stop(now + duration); }
  private noise(duration: number, volume: number, cutoff: number) { const context = this.context; if (!context || context.state !== "running" || this.volume <= 0) return; const length = Math.ceil(context.sampleRate * duration); const buffer = context.createBuffer(1, length, context.sampleRate); const data = buffer.getChannelData(0); for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length); const source = context.createBufferSource(); const filter = context.createBiquadFilter(); const gain = context.createGain(); filter.type = "lowpass"; filter.frequency.value = cutoff; gain.gain.setValueAtTime(volume * this.volume, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration); source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start(); }
  private clearReel(reel: number) { const timer = this.reelTimers[reel]; if (timer !== null) window.clearInterval(timer); this.reelTimers[reel] = null; }

  bet() { this.tone(78, .09, "square", .075, 118); window.setTimeout(() => { this.noise(.035, .035, 1900); this.tone(285, .06, "sine", .035); }, 55); }
  lever() { this.tone(62, .14, "sawtooth", .075, 118); this.noise(.06, .05, 1200); }
  startReel(reel: number) { this.clearReel(reel); this.tone(145 + reel * 12, .13, "triangle", .034, 290 + reel * 18); let beat = 0; this.reelTimers[reel] = window.setInterval(() => { beat += 1; this.noise(.026, .018, 1550 + reel * 180); if (beat % 3 === 0) this.tone(210 + reel * 16, .025, "square", .011); }, 57 + reel * 8); }
  startReels() { [0, 1, 2].forEach((reel) => window.setTimeout(() => this.startReel(reel), reel * 42)); }
  reelStop(reel: number, slip = 0) { this.clearReel(reel); this.tone(148 - reel * 9, .09, "square", .07, 76); this.noise(.045, .055, 900); window.setTimeout(() => this.tone(70 + slip * 7, .07, "triangle", .042), 34); }
  replay() { this.tone(510, .06, "sine", .04); window.setTimeout(() => this.tone(380, .1, "triangle", .04), 55); }
  payout(count: number, premium = false) { if (this.payoutTimer !== null) window.clearInterval(this.payoutTimer); const ticks = Math.max(1, Math.min(12, count)); let index = 0; this.payoutTimer = window.setInterval(() => { this.tone(premium ? 560 + index * 24 : 370 + index * 11, .045, "square", premium ? .045 : .032); this.noise(.018, .018, premium ? 3300 : 2200); index += 1; if (index >= ticks) { if (this.payoutTimer !== null) window.clearInterval(this.payoutTimer); this.payoutTimer = null; } }, premium ? 47 : 72); }
  push() { this.tone(92, .11, "square", .09, 164); window.setTimeout(() => this.tone(164, .09, "square", .055), 60); }
  heat() { this.tone(420, .11, "sawtooth", .045); window.setTimeout(() => this.tone(630, .12, "sawtooth", .038), 95); }
  cutIn() { this.tone(250, .16, "sawtooth", .065); window.setTimeout(() => this.tone(950, .12, "square", .052), 54); window.setTimeout(() => this.tone(1420, .18, "triangle", .045), 112); }
  mash() { this.tone(210, .045, "square", .035); }
  signalHit() { this.tone(660, .06, "sine", .045); window.setTimeout(() => this.tone(990, .13, "triangle", .05), 44); }
  gimmick(side: "rotor-left" | "rotor-right") { const base = side === "rotor-left" ? 318 : 392; this.noise(.024, .05, 2850); this.tone(base, .055, "square", .043, base * 1.4); window.setTimeout(() => this.tone(base * 1.84, .075, "triangle", .032), 34); }
  relayTick(remaining: number) { const base = 218 + Math.max(0, 5 - remaining) * 42; this.tone(base, .07, "square", .05, base * 1.22); window.setTimeout(() => this.tone(base * 1.52, .09, "sine", .038), 58); }
  violation() { this.tone(164, .1, "sawtooth", .065, 86); window.setTimeout(() => this.tone(86, .18, "square", .052), 54); }
  hold() { this.tone(370, .03, "sine", .022); }
  reveal() { this.tone(128, .28, "triangle", .09, 370); window.setTimeout(() => this.tone(880, .22, "square", .045), 70); }
  revive() { this.tone(185, .18, "sine", .06); window.setTimeout(() => this.tone(740, .16, "triangle", .07), 110); window.setTimeout(() => this.tone(1174, .42, "sawtooth", .05), 240); }
  result(outcome: "miss" | "win" | "jackpot") { if (outcome === "miss") { this.tone(172, .34, "sine", .055, 94); return; } this.tone(outcome === "jackpot" ? 587 : 440, .2, "square", .065); window.setTimeout(() => this.tone(outcome === "jackpot" ? 880 : 659, .32, "triangle", .08), 155); if (outcome === "jackpot") window.setTimeout(() => this.tone(1174, .5, "sawtooth", .045), 290); }
  dispose() { this.reelTimers.forEach((_, reel) => this.clearReel(reel)); if (this.payoutTimer !== null) window.clearInterval(this.payoutTimer); this.payoutTimer = null; void this.context?.close(); this.context = null; }
}
