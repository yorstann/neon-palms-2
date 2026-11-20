// All sound is synthesised with WebAudio — no audio files. A lazy
// AudioContext (created on the first user gesture), a bank of one-shot
// voices for effects, a two-tone siren loop, an engine hum whose pitch
// follows the car, and a slow synthwave bass loop for music.
// Other modules call the exported sfx('name', ...) helper, which no-ops
// until main.js has installed the instance on G.
import { G } from './state.js';

export function sfx(name, arg) {
  const s = G.sfx;
  if (s && typeof s[name] === 'function') {
    try { s[name](arg); } catch { /* audio must never break the game */ }
  }
}

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.siren = null;
    this.engine = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.03);
  }

  tone(freq, dur, { type = 'square', gain = 0.16, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, { gain = 0.2, freq = 1200, q = 0.8, delay = 0, type = 'lowpass' } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  punch() { this.noise(0.08, { gain: 0.25, freq: 500 }); this.tone(95, 0.09, { gain: 0.2, slide: -40 }); }
  shot() { this.noise(0.13, { gain: 0.34, freq: 2600, type: 'highpass' }); this.tone(150, 0.11, { gain: 0.22, slide: -95 }); }
  dry() { this.tone(1150, 0.035, { gain: 0.1 }); }
  crash(v = 1) { this.noise(0.24, { gain: 0.16 + 0.2 * v, freq: 750 }); this.tone(64, 0.22, { gain: 0.2 * v, slide: -26 }); }
  cash() { this.tone(920, 0.07, { type: 'sine', gain: 0.16 }); this.tone(1318, 0.1, { type: 'sine', gain: 0.16, delay: 0.06 }); }
  pickup() { this.tone(659, 0.07, { type: 'sine', gain: 0.15 }); this.tone(988, 0.11, { type: 'sine', gain: 0.15, delay: 0.055 }); }
  ok() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', gain: 0.16, delay: i * 0.07 })); }
  fail() { this.tone(300, 0.16, { type: 'sawtooth', gain: 0.12, slide: -60 }); this.tone(210, 0.24, { type: 'sawtooth', gain: 0.12, slide: -70, delay: 0.13 }); }
  honk() { this.tone(372, 0.16, { gain: 0.07 }); this.tone(466, 0.16, { gain: 0.05 }); }
  door() { this.noise(0.05, { gain: 0.14, freq: 900 }); this.tone(180, 0.06, { gain: 0.1, slide: -60, delay: 0.03 }); }
  blip() { this.tone(1046, 0.06, { type: 'sine', gain: 0.12 }); }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.siren) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 760;
      lfo.frequency.value = 0.65;
      lfoGain.gain.value = 165;
      lfo.connect(lfoGain).connect(osc.frequency);
      g.gain.value = 0.035;
      osc.connect(g).connect(this.master);
      osc.start();
      lfo.start();
      this.siren = { osc, lfo, g };
    } else if (!on && this.siren) {
      try { this.siren.osc.stop(); this.siren.lfo.stop(); } catch { /* already stopped */ }
      this.siren = null;
    }
  }

  setEngine(on, load = 0) {
    if (!this.ctx) return;
    if (on && !this.engine) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 52;
      g.gain.value = 0.028;
      osc.connect(g).connect(this.master);
      osc.start();
      this.engine = { osc, g };
    }
    if (this.engine) {
      const t = this.ctx.currentTime;
      this.engine.osc.frequency.setTargetAtTime(50 + load * 118, t, 0.06);
      this.engine.g.gain.setTargetAtTime(on ? 0.02 + load * 0.03 : 0, t, 0.09);
      if (!on) {
        const eng = this.engine;
        this.engine = null;
        setTimeout(() => { try { eng.osc.stop(); } catch { /* done */ } }, 350);
      }
    }
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 82.4, 55, 65.4, 55, 49, 73.4]; // A minor, slow and low
    this.musicTimer = setInterval(() => {
      if (!this.ctx || G.mode === 'pause') return;
      const i = this.musicStep++;
      const f = bass[i % bass.length];
      this.tone(f, 0.34, { type: 'triangle', gain: 0.11 });
      if (i % 2 === 0) this.tone(f * 2, 0.2, { type: 'sine', gain: 0.045 });
      if (i % 8 === 4) this.noise(0.05, { gain: 0.02, freq: 6000, type: 'highpass' });
    }, 265);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
