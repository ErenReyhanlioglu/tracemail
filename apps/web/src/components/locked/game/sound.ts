// 8-bit sound, synthesized with Web Audio. The audio device is opened in the
// visitor's own click on the envelope (audio.ts) and handed over here; the
// mute choice is kept in the browser under "tm-mute".

import { MUTE_KEY, readMuted, type WebkitWindow } from "../audio";

type Schedule = (a: AudioContext, t0: number) => void;

// How far a jump's pitch may stray from the reference, up or down.
const JUMP_DETUNE = 0.03;

function env8(g: GainNode, t0: number, peak: number, dur: number): void {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

// Square-wave notes in a row: each lasts 0.09 s except the last, which lasts
// lastLen; each stops tail seconds after it fades.
function notes(
  a: AudioContext,
  t0: number,
  freqs: number[],
  step: number,
  peak: number,
  lastLen: number,
  tail: number,
): void {
  freqs.forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    const s = t0 + i * step;
    const len = i === freqs.length - 1 ? lastLen : 0.09;
    o.type = "square";
    o.frequency.setValueAtTime(f, s);
    env8(g, s, peak, len);
    o.connect(g);
    g.connect(a.destination);
    o.start(s);
    o.stop(s + len + tail);
  });
}

export class Sound {
  muted = readMuted();
  private actx: AudioContext | null;
  private noise: AudioBuffer | null = null;

  constructor(opened: AudioContext | null = null) {
    this.actx = opened;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // Storage may be blocked; the choice then lasts for this page only.
    }
    if (!muted) this.warm();
  }

  private audio(): AudioContext | null {
    if (this.muted) return null;
    if (!this.actx) {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.actx = new Ctor();
      } catch {
        return null;
      }
    }
    if (!this.noise) {
      // Crunchy noise: random values held for 6 samples, like an old sound chip.
      const buffer = this.actx.createBuffer(1, this.actx.sampleRate * 0.4, this.actx.sampleRate);
      const data = buffer.getChannelData(0);
      let v = 0;
      for (let i = 0; i < data.length; i++) {
        if (i % 6 === 0) v = Math.random() * 2 - 1;
        data[i] = v;
      }
      this.noise = buffer;
    }
    return this.actx;
  }

  // Plays only once the device is running; a sound scheduled on a waking
  // context is dropped.
  private play(fn: Schedule): void {
    const a = this.audio();
    if (!a) return;
    if (a.state === "running") fn(a, a.currentTime + 0.005);
    else
      a.resume()
        .then(() => fn(a, a.currentTime + 0.005))
        .catch(() => undefined);
  }

  // Called from the envelope click: opening the device takes a moment, so it
  // happens during the intro, not on the first jump.
  warm(): void {
    this.play((a, t0) => {
      const s = a.createBufferSource();
      s.buffer = a.createBuffer(1, 1, a.sampleRate);
      s.connect(a.destination);
      s.start(t0);
    });
  }

  // The reference's chirp, 280 to 760 Hz in 0.1 s, pitched up to 3% up or
  // down at random on each jump (owner's addition), so repeats never sound
  // identical.
  jump(): void {
    this.play((a, t0) => {
      const o = a.createOscillator();
      const g = a.createGain();
      const tune = 1 + (Math.random() * 2 - 1) * JUMP_DETUNE;
      o.type = "square";
      o.frequency.setValueAtTime(280 * tune, t0);
      o.frequency.exponentialRampToValueAtTime(760 * tune, t0 + 0.1);
      env8(g, t0, 0.06, 0.14);
      o.connect(g);
      g.connect(a.destination);
      o.start(t0);
      o.stop(t0 + 0.16);
    });
  }

  // Two quick rising square notes, the classic "point" blip.
  point(): void {
    this.play((a, t0) => notes(a, t0, [988, 1319], 0.075, 0.045, 0.09, 0.01));
  }

  // Every 1000 points: a rising three-note arpeggio with a held top note.
  tier(): void {
    this.play((a, t0) => notes(a, t0, [784, 988, 1319], 0.085, 0.05, 0.22, 0.02));
  }

  hit(): void {
    this.play((a, t0) => {
      const n = a.createBufferSource();
      const f = a.createBiquadFilter();
      const gn = a.createGain();
      n.buffer = this.noise;
      f.type = "lowpass";
      f.frequency.setValueAtTime(3200, t0);
      f.frequency.exponentialRampToValueAtTime(300, t0 + 0.25);
      env8(gn, t0, 0.12, 0.28);
      n.connect(f);
      f.connect(gn);
      gn.connect(a.destination);
      n.start(t0);
      n.stop(t0 + 0.3);
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(220, t0);
      o.frequency.exponentialRampToValueAtTime(48, t0 + 0.32);
      env8(g, t0, 0.07, 0.34);
      o.connect(g);
      g.connect(a.destination);
      o.start(t0);
      o.stop(t0 + 0.36);
    });
  }

  close(): void {
    void this.actx?.close();
    this.actx = null;
  }
}
