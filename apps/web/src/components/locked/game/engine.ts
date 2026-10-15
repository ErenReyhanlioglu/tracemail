// The mail runner, a line-for-line port of the approved reference: physics,
// obstacle spawning, drawing, and input live here, outside React; the loop
// runs on requestAnimationFrame and never triggers a render. Every tuning
// value (jump, gravity, squash, trace, difficulty, hit-stop) is the
// reference's own. createGame takes the stage's elements and returns open()
// for the envelope's click and destroy() for when the page goes away.
import { type Palette, readPalette, type Rows, sprite } from "../pixels";
import { BODY, dims, ICON_OFF, ICON_ON, LEGS, OBSTACLES, type ObstacleKind } from "./art";
import { Sound } from "./sound";

export interface GameElements {
  stage: HTMLElement;
  openClass: string;
  mail: HTMLButtonElement;
  readClass: string;
  canvas: HTMLCanvasElement;
  score: HTMLElement;
  best: HTMLElement;
  over: HTMLElement;
  hint: HTMLElement;
  goneClass: string;
  close: HTMLButtonElement;
  mute: HTMLButtonElement;
  labels: { muteOn: string; muteOff: string };
}

export interface GameController {
  open(): void;
  destroy(): void;
}

type State = "closed" | "intro" | "morph" | "run" | "dying" | "over" | "unmorph" | "closing";

interface Obstacle {
  rows: Rows;
  w: number;
  h: number;
  x: number;
  y: number;
  fly?: boolean;
}

interface Envelope {
  y: number;
  vy: number;
  ground: boolean;
  k: number;
  hold: number;
}

interface Point {
  x: number;
  y: number;
  px: number;
  py: number;
}

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
}

const BEST_KEY = "tm-best";
const PX = 2;
const EW = 14;
const EH = 12;
const TRACE = 12;
const SEG = 2;
const NODES = TRACE + 1;
const BUFFER_MS = 110;
const FREEZE_MS = 75;
const SHAKE_MS = 260;
// Closing plays the opening's morph backwards, a little faster than its
// 700 ms (owner's review): the trace folds back into the TraceMail dot.
const UNMORPH_MS = 500;

// The opening's ease, in and out (cubic).
function easeInOut(raw: number): number {
  return raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
}

function pad(n: number): string {
  return `00000${Math.floor(n)}`.slice(-5);
}

function readBest(): number {
  try {
    return Number.parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function pline(ctx: CanvasRenderingContext2D, ax: number, ay: number, x1: number, y1: number): void {
  let x0 = ax;
  let y0 = ay;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// Envelope body at any size: outline, paper fill, and a flap V drawn as pixel lines.
function drawBody(
  ctx: CanvasRenderingContext2D,
  C: Palette,
  x: number,
  y: number,
  w: number,
  h: number,
  ink: string,
): void {
  ctx.fillStyle = C.paper;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  const apex = y + Math.max(2, Math.round((h - 1) * 0.65));
  const c0 = x + Math.floor((w - 1) / 2);
  const c1 = x + Math.ceil((w - 1) / 2);
  pline(ctx, x + 1, y + 1, c0, apex);
  pline(ctx, x + w - 2, y + 1, c1, apex);
  if (c1 > c0) ctx.fillRect(c0, apex, c1 - c0 + 1, 1);
}

function iconSvg(rows: Rows): string {
  let r = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row.charAt(x) === "#") r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  });
  return `<svg width="20" height="14" viewBox="0 0 10 7" fill="currentColor" aria-hidden="true">${r}</svg>`;
}

export function createGame(el: GameElements, audio: AudioContext | null): GameController {
  const { stage, mail, canvas: cv } = el;
  const ctxOrNull = cv.getContext("2d");
  const buf = document.createElement("canvas");
  const bOrNull = buf.getContext("2d");
  if (!ctxOrNull || !bOrNull) return { open: () => undefined, destroy: () => undefined };
  const ctx = ctxOrNull;
  const b = bOrNull;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sound = new Sound(audio);
  let C = readPalette(stage);

  // ---------- world ----------
  let W = 400;
  let H = 100;
  let GROUND = 84;
  let EX = 26;
  let state: State = "closed";
  let morphStart = 0;
  let morphP = 0;
  // The morph's height above the ground: 0 when opening, the envelope's
  // height when it is closed mid-jump.
  let morphLift = 0;
  // Where the backwards morph starts: 1 from the game, less when the
  // opening morph is cut short.
  let unmorphFrom = 1;
  let env: Envelope | null = null;
  let obs: Obstacle[] = [];
  let clouds: { x: number; y: number }[] = [];
  let pebbles: { x: number; y: number; w: number }[] = [];
  let speed = 3;
  let score = 0;
  let nextGap = 180;
  let t = 0;
  let last = 0;
  let introStart = 0;
  let introP = 0;
  let jumped = false;
  let best = readBest();
  let rope: Point[] = [];
  let wave = 0;
  let dust: Puff[] = [];
  let milestone = 0;
  let blinkUntil = 0;
  let held = false;
  let buffered = 0;
  let dieAt = 0;
  let shakeX = 0;
  let shakeY = 0;
  let frame = 0;
  let destroyed = false;
  const timers: number[] = [];
  el.best.textContent = pad(best);

  function raf(fn: FrameRequestCallback): void {
    if (!destroyed) frame = requestAnimationFrame(fn);
  }

  function later(fn: () => void, ms: number): void {
    timers.push(window.setTimeout(fn, ms));
  }

  function fit(): void {
    const r = cv.getBoundingClientRect();
    // A canvas leaving the page or hidden measures 0: keep the last size
    // until the observer reports a real one (drawing a 0-sized buffer throws;
    // the reference has the same gap).
    if (r.width === 0 || r.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    W = Math.max(120, Math.round(r.width / PX));
    H = Math.round(r.height / PX);
    GROUND = H - 22;
    EX = Math.max(26, Math.round(W * 0.14));
    buf.width = W;
    buf.height = H;
    // Only once the stage is open: the observer's first call arrives after
    // the first click, while the envelope must still wait for the stage.
    const opened = stage.classList.contains(el.openClass);
    if (opened && (state === "intro" || state === "run")) placeMail(0);
    if (state !== "run") draw();
  }

  function anchor(): { x: number; y: number } {
    return { x: EX - 2, y: GROUND - EH - (env ? env.y : 0) + 5 };
  }

  function initRope(): void {
    const a = anchor();
    rope = [];
    for (let i = 0; i < NODES; i++) rope.push({ x: a.x - i * SEG, y: a.y, px: a.x - i * SEG, py: a.y });
  }

  function stepRope(dt: number): void {
    const a = anchor();
    const wind = -(0.42 + speed * 0.04);
    const grav = 0.035;
    const damp = 0.8;
    const root = rope[0];
    if (!root) return;
    // The trace carries part of the envelope's vertical move with it, so a
    // jump bends it gently instead of whipping it.
    const lift = a.y - root.y;
    for (let c = 1; c < rope.length; c++) {
      const share = 0.6 * (1 - (0.4 * c) / rope.length);
      const p = rope[c];
      if (p) {
        p.y += lift * share;
        p.py += lift * share;
      }
    }
    root.x = root.px = a.x;
    root.y = root.py = a.y;
    for (let i = 1; i < rope.length; i++) {
      const p = rope[i];
      if (!p) continue;
      const vx = (p.x - p.px) * damp;
      const vy = (p.y - p.py) * damp;
      // Faint physical ripple; the visible running wave is added at draw time.
      const flutter = Math.sin(t * 0.16 - i * 0.5) * 0.015 * (i / rope.length);
      p.px = p.x;
      p.py = p.y;
      p.x += vx + wind * dt * dt;
      p.y += vy + (grav + flutter) * dt * dt;
    }
    for (let it = 0; it < 8; it++) {
      for (let j = 1; j < rope.length; j++) {
        const p0 = rope[j - 1];
        const p1 = rope[j];
        if (!p0 || !p1) continue;
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const diff = (d - SEG) / d;
        if (j === 1) {
          p1.x -= dx * diff;
          p1.y -= dy * diff;
        } else {
          p0.x += dx * diff * 0.5;
          p0.y += dy * diff * 0.5;
          p1.x -= dx * diff * 0.5;
          p1.y -= dy * diff * 0.5;
        }
      }
      // Keep the trace above the ground line.
      for (let m = 1; m < rope.length; m++) {
        const p = rope[m];
        if (p && p.y > GROUND - 1) p.y = GROUND - 1;
      }
    }
  }

  function reset(): void {
    env = { y: 0, vy: 0, ground: true, k: 0, hold: 0 };
    obs = [];
    dust = [];
    clouds = [
      { x: W * 0.55, y: 18 },
      { x: W * 0.85, y: 30 },
      { x: W * 0.25, y: 26 },
    ];
    pebbles = [];
    for (let i = 0; i < Math.ceil(W / 9) + 1; i++) {
      pebbles.push({
        x: i * 9 + Math.random() * 6,
        y: GROUND + 2 + Math.floor(Math.random() * 6),
        w: 1 + Math.floor(Math.random() * 3),
      });
    }
    speed = 3;
    score = 0;
    nextGap = 180;
    t = 0;
    initRope();
    el.score.textContent = pad(0);
    milestone = 0;
    blinkUntil = 0;
    el.score.style.visibility = "";
    el.score.style.color = "";
  }

  function placeMail(lift: number): void {
    mail.style.left = `${EX * PX}px`;
    mail.style.top = `${32 + (GROUND - EH - lift) * PX}px`;
  }

  // ---------- open / close ----------
  function open(): void {
    if (state !== "closed") return;
    state = "intro";
    morphLift = 0;
    mail.classList.add(el.readClass);
    sound.warm();
    reset();
    jumped = false;
    el.hint.classList.remove(el.goneClass);
    later(
      () => {
        stage.classList.add(el.openClass);
        // Also as an attribute, for the page around the stage to follow
        // (LockedSection lifts it on phones; ADR-0047).
        stage.dataset.open = "";
        placeMail(0);
        introStart = performance.now() + (reduce ? 0 : 250);
        raf(introLoop);
      },
      reduce ? 0 : 220,
    );
  }

  function introLoop(now: number): void {
    if (state !== "intro") return;
    const dur = reduce ? 1 : 750;
    const raw = Math.max(0, Math.min(1, (now - introStart) / dur));
    introP = easeInOut(raw);
    draw();
    if (raw < 1 || now - introStart < (reduce ? 0 : 600)) {
      raf(introLoop);
      return;
    }
    // The envelope has landed on the ground line: swap the HTML envelope for the canvas one.
    mail.hidden = true;
    state = "morph";
    morphStart = performance.now();
    cv.focus({ preventScroll: true });
    raf(morphLoop);
  }

  function morphLoop(now: number): void {
    if (state !== "morph") return;
    const raw = reduce ? 1 : Math.min(1, (now - morphStart) / 700);
    morphP = easeInOut(raw);
    draw();
    if (raw < 1) {
      raf(morphLoop);
      return;
    }
    initRope();
    state = "run";
    last = performance.now();
    raf(loop);
  }

  // Closing first folds the trace back into the dot (the opening's morph,
  // backwards), where the envelope is, then hands over to the HTML envelope.
  function close(): void {
    if (state !== "run" && state !== "over" && state !== "morph") return;
    unmorphFrom = state === "morph" ? morphP : 1;
    morphLift = env ? env.y : 0;
    shakeX = shakeY = 0;
    el.over.hidden = true;
    state = "unmorph";
    morphStart = performance.now();
    raf(unmorphLoop);
  }

  function unmorphLoop(now: number): void {
    if (state !== "unmorph") return;
    const span = UNMORPH_MS * unmorphFrom;
    const raw = reduce || span === 0 ? 1 : Math.min(1, (now - morphStart) / span);
    morphP = unmorphFrom * (1 - easeInOut(raw));
    draw();
    if (raw < 1) {
      raf(unmorphLoop);
      return;
    }
    finishClose(morphLift);
  }

  function finishClose(lift: number): void {
    state = "closing";
    mail.style.transition = "none";
    placeMail(lift);
    mail.hidden = false;
    void mail.offsetWidth;
    mail.style.transition = "";
    draw();
    stage.classList.remove(el.openClass);
    delete stage.dataset.open;
    raf(() => {
      mail.style.left = "";
      mail.style.top = "";
    });
    later(
      () => {
        state = "closed";
        mail.classList.remove(el.readClass);
        mail.focus({ preventScroll: true });
      },
      reduce ? 0 : 850,
    );
  }

  // ---------- game ----------
  function make(kind: ObstacleKind | "file-stack", x: number, opt?: "low" | "high"): Obstacle {
    if (kind === "bounce") {
      const d = dims(OBSTACLES.bounce);
      const low = opt === "low" || (opt !== "high" && Math.random() < 0.5);
      return { rows: OBSTACLES.bounce, w: d.w, h: d.h, x, y: low ? GROUND - 4 - d.h : GROUND - 17 - d.h, fly: true };
    }
    // The "big attachment" is one tall document, not two stacked.
    const rows = kind === "file-stack" ? OBSTACLES.tall : OBSTACLES[kind];
    const d = dims(rows);
    return { rows, w: d.w, h: d.h, x, y: GROUND - d.h };
  }

  function lowKind(): ObstacleKind {
    return Math.random() < 0.5 ? "case" : "file";
  }

  // Difficulty tiers: every 1000 points adds a new obstacle pattern and a
  // little more top speed.
  function tierOf(s: number): number {
    return Math.min(4, Math.floor(s / 1000));
  }

  function speedCap(s: number): number {
    let cap = 6.5;
    // Eased in over 300 points.
    for (let k = 1; k <= 4; k++) cap += 0.5 * Math.max(0, Math.min(1, (s - 1000 * k) / 300));
    return cap;
  }

  function spawnGroup(tier: number, x: number): Obstacle[] {
    const r = Math.random();
    if (tier >= 1 && r < 0.16 + 0.04 * tier) {
      // Tier 1+: two low obstacles side by side, cleared with one long jump;
      // from tier 3 sometimes three.
      const a = make(lowKind(), x);
      const b2 = make(lowKind(), a.x + a.w + 3 + Math.floor(Math.random() * 4));
      const group = [a, b2];
      if (tier >= 3 && Math.random() < 0.4) group.push(make("case", b2.x + b2.w + 3));
      return group;
    }
    if (tier >= 2 && r < 0.34 + 0.03 * tier) {
      // Tier 2+: a ground obstacle, then a low bounced mail arriving just after you land.
      const g = make(Math.random() < 0.5 ? "at" : "case", x);
      return [g, make("bounce", g.x + g.w + speed * 38, "low")];
    }
    const fly = 0.22 + 0.04 * tier;
    const stack = 0.35 + 0.1 * tier;
    const r2 = Math.random();
    if (score > 120 && r2 < fly) return [make("bounce", x)];
    if (r2 < 0.42) return [make("case", x)];
    if (r2 < 0.64) return [make(score > 200 && Math.random() < stack ? "file-stack" : "file", x)];
    // Paperclip, leaning about 28 degrees: taller than a document, shorter than the big one.
    if (r2 < 0.82) return [make("clip", x)];
    return [make("at", x)];
  }

  function spawn(): void {
    const tier = tierOf(score);
    const x = W + 4;
    let right = x;
    spawnGroup(tier, x).forEach((o) => {
      obs.push(o);
      right = Math.max(right, o.x + o.w);
    });
    // Gaps tighten a little per tier; the group's own length is added so
    // patterns never overlap the next spawn.
    nextGap = right - x + Math.max(70, speed * 26) * (1 - 0.06 * tier) + Math.random() * (110 - 12 * tier);
  }

  function release(): void {
    held = false;
  }

  function press(): void {
    held = true;
    if (state === "over") {
      reset();
      state = "run";
      el.over.hidden = true;
      last = performance.now();
      raf(loop);
      return;
    }
    if (state === "run" && env) {
      if (env.ground) jump();
      // Pressed a moment too early: remember it and jump on landing.
      else buffered = performance.now();
    }
  }

  function jump(): void {
    if (!env) return;
    buffered = 0;
    env.vy = -5.2;
    env.hold = 0;
    env.ground = false;
    env.k = 0.26; // stretch on take-off
    sound.jump();
    if (!jumped) {
      jumped = true;
      el.hint.classList.add(el.goneClass);
    }
  }

  // Landing dust: a few puffs kicked out from both feet; harder landings kick
  // more, and the ground carries them away.
  function spawnDust(impact: number): void {
    if (impact < 2 || reduce) return;
    const n = impact > 5.5 ? 3 : 2;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < n; i++) {
        dust.push({
          x: s < 0 ? EX + 2 : EX + EW - 3,
          y: GROUND - 1 - Math.random(),
          vx: s * (0.35 + Math.random() * 0.55),
          vy: -(0.12 + Math.random() * 0.28),
          life: 0,
          max: 14 + Math.random() * 8,
          size: Math.random() < 0.5 ? 2 : 1,
        });
      }
    }
  }

  function stepDust(dt: number): void {
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      if (!p) continue;
      p.life += dt;
      if (p.life >= p.max) {
        dust.splice(i, 1);
        continue;
      }
      p.x += (p.vx - speed * 0.55) * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.9, dt);
      p.vy += 0.015 * dt;
      if (p.y > GROUND - 1) p.y = GROUND - 1;
    }
  }

  function drawDust(): void {
    b.fillStyle = C.muted;
    dust.forEach((p) => {
      const f = p.life / p.max;
      b.globalAlpha = 0.6 * (1 - f);
      // Puffs shrink to a single pixel before vanishing.
      const sz = f > 0.55 ? 1 : p.size;
      b.fillRect(Math.round(p.x), Math.round(p.y) - sz + 1, sz, sz);
    });
    b.globalAlpha = 1;
  }

  function hit(o: Obstacle, e: Envelope): boolean {
    const ex = EX + 1;
    const ey = GROUND - EH - e.y + 1;
    const ew = EW - 2;
    const eh = EH - 2;
    if (!(ex < o.x + o.w - 1 && ex + ew > o.x + 1 && ey < o.y + o.h - 1 && ey + eh > o.y + 1)) return false;
    // Boxes overlap: only count it if a drawn pixel of the obstacle is inside
    // the envelope, so the empty corners of the tilted paperclip or the @
    // never kill you.
    const ox = Math.round(o.x);
    const oy = Math.round(o.y);
    const x0 = Math.max(Math.ceil(ex), ox);
    const x1 = Math.min(Math.floor(ex + ew), ox + o.w);
    const y0 = Math.max(Math.ceil(ey), oy);
    const y1 = Math.min(Math.floor(ey + eh), oy + o.h);
    for (let y = y0; y < y1; y++) {
      const row = o.rows[y - oy];
      if (!row) continue;
      for (let x = x0; x < x1; x++) {
        const ch = row.charAt(x - ox);
        if (ch && ch !== " ") return true;
      }
    }
    return false;
  }

  function stepEnvelope(e: Envelope, dt: number, now: number): void {
    if (e.ground) return;
    // Variable jump: while the key is held on the way up, gravity is lighter
    // for up to 12 frames.
    const boost = held && e.vy < 0 && e.hold < 12;
    if (boost) e.hold += dt;
    e.vy += (boost ? 0.22 : 0.5) * dt;
    e.y -= e.vy * dt;
    if (e.y <= 0) {
      spawnDust(e.vy);
      // Squash on impact; a harder landing squashes more.
      e.k = -Math.min(0.32, 0.05 * e.vy);
      e.y = 0;
      e.vy = 0;
      e.ground = true;
      if (buffered && now - buffered <= BUFFER_MS) jump();
      buffered = 0;
    }
  }

  function stepScore(now: number): void {
    // Every 100 points the score freezes on the round number, blinks a few
    // times, and a short chime plays.
    const ms = Math.floor(score / 100);
    if (ms > milestone) {
      milestone = ms;
      if (ms % 10 === 0) {
        // Every 1000: a longer blink and three notes.
        blinkUntil = now + 1350;
        sound.tier();
      } else {
        blinkUntil = now + 900;
        sound.point();
      }
    }
    if (now < blinkUntil) {
      el.score.textContent = pad(milestone * 100);
      el.score.style.visibility = !reduce && Math.floor((blinkUntil - now) / 150) % 2 ? "hidden" : "";
    } else {
      el.score.style.visibility = "";
      el.score.style.color = "";
      el.score.textContent = pad(score);
    }
  }

  function loop(now: number): void {
    if (state !== "run" || !env) return;
    const e = env;
    const dt = Math.min((now - last) / 16.667, 3);
    last = now;
    t += dt;
    stepEnvelope(e, dt, now);
    speed = Math.min(speedCap(score), 3 + score * 0.004);
    score += speed * dt * 0.12;
    stepRope(dt);
    stepDust(dt);
    // Squash and stretch spring back within a few frames.
    e.k *= Math.pow(0.82, dt);
    // The running wave fades in slowly after landing and drops out quickly on
    // take-off, so jumps stay pure physics.
    wave += ((e.ground ? 1 : 0) - wave) * Math.min(1, (e.ground ? 0.06 : 0.35) * dt);
    nextGap -= speed * dt;
    if (nextGap <= 0) spawn();
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i];
      if (!o) continue;
      o.x -= speed * dt * (o.fly ? 1.2 : 1);
      if (o.x + o.w < -4) obs.splice(i, 1);
      else if (hit(o, e)) {
        die();
        return;
      }
    }
    clouds.forEach((c) => {
      c.x -= speed * dt * 0.18;
      if (c.x < -14) {
        c.x = W + Math.random() * 60;
        c.y = 14 + Math.random() * 22;
      }
    });
    const span = (Math.ceil(W / 9) + 1) * 9;
    pebbles.forEach((p) => {
      p.x -= speed * dt;
      if (p.x < -4) p.x += span;
    });
    stepScore(now);
    draw();
    raf(loop);
  }

  // Impact: the frame freezes for a beat (hit-stop), then the scene shakes
  // and settles; input is ignored until it is over.
  function die(): void {
    state = "dying";
    blinkUntil = 0;
    el.score.style.visibility = "";
    el.score.style.color = "";
    el.score.textContent = pad(score);
    sound.hit();
    if (score > best) {
      best = Math.floor(score);
      el.best.textContent = pad(best);
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch {
        // Storage may be blocked; the best score then lasts for this page.
      }
    }
    dieAt = performance.now();
    draw();
    raf(dyingLoop);
  }

  function dyingLoop(now: number): void {
    if (state !== "dying") return;
    const elapsed = now - dieAt;
    if (elapsed >= FREEZE_MS + SHAKE_MS || reduce) {
      shakeX = shakeY = 0;
      state = "over";
      draw();
      el.over.hidden = false;
      return;
    }
    if (elapsed > FREEZE_MS) {
      // In game pixels, fading to zero.
      const amp = 2 * (1 - (elapsed - FREEZE_MS) / SHAKE_MS);
      shakeX = Math.round((Math.random() * 2 - 1) * amp);
      shakeY = Math.round((Math.random() * 2 - 1) * amp * 0.6);
    }
    draw();
    raf(dyingLoop);
  }

  function drawMorph(): void {
    const q = morphP;
    const by = GROUND - EH - Math.round(morphLift);
    sprite(b, C, BODY, EX, by);
    b.fillStyle = C.ink;
    b.globalAlpha = 1 - q; // the logo's inner line and tail fade out
    b.fillRect(EX + 6, by + 6, 2, 3);
    b.fillRect(EX + 6, by + 10, 2, 2);
    b.globalAlpha = q; // the legs fade in
    sprite(b, C, LEGS.idle, EX, by + 10);
    b.globalAlpha = 1;
    const sx = EX + 5;
    const sy = by + 12;
    const tx = EX - 3 - (TRACE - 1) * 2 - 3;
    const ty = by + 4;
    const dx = Math.round(sx + (tx - sx) * q);
    const dy = Math.round(sy + (ty - sy) * q);
    b.fillStyle = C.accent;
    for (let x = EX - 3; x > dx + 2; x -= 2) b.fillRect(x, by + 5, 1, 1);
    if (q < 0.5) {
      b.fillRect(dx + 1, dy, 2, 1);
      b.fillRect(dx, dy + 1, 4, 2);
      b.fillRect(dx + 1, dy + 3, 2, 1);
    } else b.fillRect(dx, dy, 3, 3);
  }

  // The trace: the envelope's past heights drift left and end in the TraceMail dot.
  function drawTrace(): void {
    b.fillStyle = C.accent;
    // While running, a gentle S-curve travels from the root to the tip; it
    // grows along the trace so the root stays put.
    const lastIdx = rope.length - 1;
    let tipX = 0;
    let tipY = 0;
    for (let i = 1; i < rope.length; i++) {
      const p = rope[i];
      if (!p) continue;
      const along = i / lastIdx;
      let yy = p.y + wave * 1.9 * Math.pow(along, 1.2) * Math.sin(t * 0.15 - i * 0.42);
      yy = Math.min(yy, GROUND - 2);
      tipX = Math.round(p.x);
      tipY = Math.round(yy);
      b.fillRect(tipX, tipY, 1, 1);
    }
    b.fillRect(tipX - 1, tipY - 1, 3, 3);
  }

  function drawRunner(e: Envelope): void {
    const ey = GROUND - EH - e.y;
    const tint = state === "over" || state === "dying" ? C.danger : null;
    const legs = !e.ground ? LEGS.jump : Math.floor(t / 5) % 2 ? LEGS.a : LEGS.b;
    const bob = state === "run" && e.ground && Math.floor(t / 5) % 2 ? 1 : 0;
    // Squash and stretch around the feet: the body is redrawn at the new size,
    // so the flap stays a clean V.
    const air = e.ground ? 0 : Math.min(0.09, Math.abs(e.vy) * 0.015);
    const kk = e.k + air;
    const sy = 1 + kk;
    const sx = 1 - kk * 0.9;
    const bw = Math.round(EW * sx);
    const bh = Math.round(10 * sy);
    const bx = Math.round(EX + (EW - bw) / 2);
    const feet = Math.round(ey) + 10;
    drawBody(b, C, bx, feet - bh + bob, bw, bh, tint ?? C.ink);
    sprite(b, C, legs, EX, feet, tint);
  }

  // The bounced mail leaves its own trace: a dotted line streaming out behind
  // it, following its past bobbing, fading out.
  function drawFlyer(o: Obstacle): void {
    const bobAt = (tt: number): number => Math.sin(tt / 5) * 1.6;
    const y0 = o.y + Math.round(bobAt(t));
    b.fillStyle = C.muted;
    const n = 11;
    const shift = Math.floor(t / 2) % 2;
    for (let i = 0; i < n; i++) {
      // Alternating dots that march backwards: reads as motion.
      if ((i + shift) % 2) continue;
      const px = Math.round(o.x + o.w + 1 + i * 1.6);
      const py = Math.round(o.y + 3 + bobAt(t - (i + 1) * 1.4));
      b.globalAlpha = 0.85 * (1 - i / n);
      b.fillRect(px, py, 1, 1);
    }
    b.globalAlpha = 1;
    sprite(b, C, o.rows, o.x, y0);
  }

  function draw(): void {
    b.fillStyle = C.bg;
    b.fillRect(0, 0, W, H);
    if (!env) {
      blit();
      return;
    }
    const p = state === "intro" ? introP : 1;
    // Clouds fade in; the ground line draws in from the left.
    b.globalAlpha = p;
    clouds.forEach((c) => sprite(b, C, OBSTACLES.cloud, c.x, c.y));
    b.globalAlpha = 1;
    const gw = Math.round(W * p);
    b.fillStyle = C.line;
    b.fillRect(0, GROUND, gw, 1);
    pebbles.forEach((pb) => {
      if (pb.x < gw) b.fillRect(Math.round(pb.x), pb.y, pb.w, 1);
    });
    if (state === "morph" || state === "unmorph") {
      if (state === "unmorph") {
        // The obstacles fade with the trace instead of vanishing.
        b.globalAlpha = morphP;
        obs.forEach((o) => sprite(b, C, o.rows, o.x, o.y));
        b.globalAlpha = 1;
      }
      drawMorph();
      blit();
      return;
    }
    if (state !== "run" && state !== "over" && state !== "dying") {
      blit();
      return;
    }
    obs.forEach((o) => (o.fly ? drawFlyer(o) : sprite(b, C, o.rows, o.x, o.y)));
    drawDust();
    drawTrace();
    drawRunner(env);
    blit();
  }

  function blit(): void {
    if (buf.width === 0 || buf.height === 0 || cv.width === 0 || cv.height === 0) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    // Shake moves in whole game pixels so the pixel art stays crisp.
    const u = cv.width / W;
    ctx.drawImage(buf, 0, 0, W, H, shakeX * u, shakeY * u, cv.width, cv.height);
  }

  // ---------- input ----------
  function muteLabel(): void {
    el.mute.innerHTML = iconSvg(sound.muted ? ICON_OFF : ICON_ON);
    el.mute.setAttribute("aria-pressed", sound.muted ? "true" : "false");
    el.mute.setAttribute("aria-label", sound.muted ? el.labels.muteOff : el.labels.muteOn);
  }

  function onMute(): void {
    sound.setMuted(!sound.muted);
    muteLabel();
    // Keep Space for jumping, not for toggling this button again.
    cv.focus({ preventScroll: true });
  }

  function onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    press();
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.code === "Space" || e.code === "ArrowUp") release();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (state !== "run" && state !== "over") return;
    if (e.code === "Escape") {
      close();
      return;
    }
    if (e.code !== "Space" && e.code !== "ArrowUp") return;
    const tag = e.target instanceof HTMLElement ? e.target.tagName : "";
    if (tag === "A" || tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault();
    if (!e.repeat) press();
  }

  // ---------- theme + size ----------
  function retheme(): void {
    C = readPalette(stage);
    if (state !== "run") draw();
  }

  muteLabel();
  el.close.addEventListener("click", close);
  el.mute.addEventListener("click", onMute);
  cv.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", release);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("keydown", onKeyDown);
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", retheme);
  const themeObserver = new MutationObserver(retheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const sizeObserver = new ResizeObserver(fit);
  sizeObserver.observe(cv);
  fit();

  return {
    open,
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
      el.close.removeEventListener("click", close);
      el.mute.removeEventListener("click", onMute);
      cv.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("keydown", onKeyDown);
      scheme.removeEventListener("change", retheme);
      themeObserver.disconnect();
      sizeObserver.disconnect();
      sound.close();
    },
  };
}
