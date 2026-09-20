export type Levels = { bass: number; mid: number; treb: number; amp: number };

export class AudioEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  source: MediaElementAudioSourceNode | null = null;
  freq = new Uint8Array(1024);
  time = new Uint8Array(1024);
  private attached: HTMLAudioElement | null = null;

  async attach(el: HTMLAudioElement) {
    if (this.attached === el && this.ctx && this.source) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    if (this.ctx) {
      await this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.source = null;
      this.analyser = null;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;
    const source = ctx.createMediaElementSource(el);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    this.ctx = ctx;
    this.analyser = analyser;
    this.source = source;
    this.attached = el;
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    this.time = new Uint8Array(analyser.fftSize);
    if (ctx.state === "suspended") await ctx.resume();
  }

  sample(): Levels {
    const a = this.analyser;
    if (!a) return { bass: 0, mid: 0, treb: 0, amp: 0 };
    a.getByteFrequencyData(this.freq);
    a.getByteTimeDomainData(this.time);
    let bass = 0;
    let mid = 0;
    let treb = 0;
    let amp = 0;
    const n = this.freq.length;
    const bEnd = Math.max(1, Math.floor(n * 0.06));
    const mEnd = Math.max(bEnd + 1, Math.floor(n * 0.28));
    for (let i = 0; i < bEnd; i++) bass += this.freq[i] ?? 0;
    for (let i = bEnd; i < mEnd; i++) mid += this.freq[i] ?? 0;
    for (let i = mEnd; i < n; i++) treb += this.freq[i] ?? 0;
    bass /= bEnd * 255;
    mid /= (mEnd - bEnd) * 255;
    treb /= (n - mEnd) * 255;
    for (let i = 0; i < this.time.length; i++) {
      const v = ((this.time[i] ?? 128) - 128) / 128;
      amp += v * v;
    }
    amp = Math.sqrt(amp / this.time.length);
    return { bass, mid, treb, amp };
  }

  async close() {
    if (this.ctx) await this.ctx.close().catch(() => undefined);
    this.ctx = null;
    this.source = null;
    this.analyser = null;
    this.attached = null;
  }
}
