"use client";

// The envelope above a locked section, and what it hides. Closed, it is a
// small button with a badge; the game's code (game/engine.ts) is fetched
// only on the first click, then runs outside React on the elements below.
// Visitors only: the owner's coming-later pages do not render it.
import { useEffect, useRef } from "react";

import { strings } from "@/lib/strings";

import { openAudio } from "./audio";
import type { GameController } from "./game/engine";
import styles from "./MailEasterEgg.module.css";
import { LOGO, readPalette, sprite } from "./pixels";

const text = strings.locked.game;
const SPRITE_W = 14;
const SPRITE_H = 16;

// The crown before the best score, a 9x7 pixel grid.
const CROWN =
  "M0 0h1v1h-1zM4 0h1v1h-1zM8 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM7 1h1v1h-1zM8 1h1v1h-1zM0 2h9v3h-9zM0 6h9v1h-9z";

// The close cross, a 7x7 pixel grid.
const CROSS = [0, 1, 2, 3, 2, 1, 0];

function drawEnvelope(canvas: HTMLCanvasElement, host: HTMLElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
  sprite(ctx, readPalette(host), LOGO, 0, 0);
}

export function MailEasterEgg() {
  const stage = useRef<HTMLDivElement>(null);
  const mail = useRef<HTMLButtonElement>(null);
  const envelope = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const score = useRef<HTMLElement>(null);
  const best = useRef<HTMLSpanElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const mute = useRef<HTMLButtonElement>(null);
  const game = useRef<GameController | null>(null);

  // The closed envelope follows the theme like the game does.
  useEffect(() => {
    const redraw = (): void => {
      if (envelope.current && stage.current) drawEnvelope(envelope.current, stage.current);
    };
    redraw();
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", redraw);
    const observer = new MutationObserver(redraw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      scheme.removeEventListener("change", redraw);
      observer.disconnect();
      game.current?.destroy();
      game.current = null;
    };
  }, []);

  async function openGame(): Promise<void> {
    if (!game.current) {
      // Inside the click, before the game's code loads (see audio.ts).
      const audio = openAudio();
      const { createGame } = await import("./game/engine");
      const [st, ma, cv, sc, be, ov, hi, cl, mu] = [
        stage.current,
        mail.current,
        canvas.current,
        score.current,
        best.current,
        over.current,
        hint.current,
        close.current,
        mute.current,
      ];
      if (!st || !ma || !cv || !sc || !be || !ov || !hi || !cl || !mu) return;
      game.current = createGame({
        stage: st,
        openClass: styles.open ?? "",
        mail: ma,
        readClass: styles.read ?? "",
        canvas: cv,
        score: sc,
        best: be,
        over: ov,
        hint: hi,
        goneClass: styles.gone ?? "",
        close: cl,
        mute: mu,
        labels: { muteOn: text.muteOn, muteOff: text.muteOff },
      }, audio);
    }
    game.current.open();
  }

  return (
    <div className={styles.stage} ref={stage}>
      <canvas ref={canvas} className={styles.game} tabIndex={-1} aria-label={text.canvas} />
      <button
        type="button"
        ref={mail}
        className={styles.mail}
        aria-label={text.mail}
        onClick={() => void openGame()}
      >
        <span className={styles.ring}>
          <canvas ref={envelope} width={SPRITE_W} height={SPRITE_H} />
          <span className={styles.badge} aria-hidden="true">
            1
          </span>
        </span>
      </button>
      <div className={`${styles.ui} ${styles.hud}`} aria-hidden="true">
        <span className={styles.best}>
          <svg width="18" height="14" viewBox="0 0 9 7" fill="currentColor" aria-hidden="true">
            <path d={CROWN} />
          </svg>
          <span ref={best}>00000</span>
        </span>
        <b ref={score}>00000</b>
      </div>
      <button
        type="button"
        ref={close}
        className={`${styles.ui} ${styles.hit} ${styles.control} ${styles.closeButton}`}
        aria-label={text.close}
      >
        <svg width="14" height="14" viewBox="0 0 7 7" fill="currentColor" aria-hidden="true">
          {CROSS.map((x, y) => (
            <g key={y}>
              <rect x={x} y={y} width="1" height="1" />
              {x !== 6 - x ? <rect x={6 - x} y={y} width="1" height="1" /> : null}
            </g>
          ))}
        </svg>
      </button>
      <button
        type="button"
        ref={mute}
        className={`${styles.ui} ${styles.hit} ${styles.control} ${styles.mute}`}
        aria-pressed="false"
        aria-label={text.muteOn}
      />
      <div ref={hint} className={`${styles.ui} ${styles.hint}`}>
        {text.hint}
      </div>
      <div ref={over} className={styles.over} hidden>
        <strong>{text.over}</strong>
        <span>{text.restart}</span>
      </div>
    </div>
  );
}
