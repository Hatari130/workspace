"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TypeStep = {
  text: string;
  /** Base ms per character, before jitter. */
  base: number;
  /** How long the caret blinks before this line starts. */
  leadIn: number;
  /** How long it blinks after the line finishes. */
  tail: number;
};

export type CaretMode = "off" | "blink" | "solid" | "fade";

type Snapshot = {
  counts: number[];
  caretStep: number;
  caretMode: CaretMode;
};

/**
 * Human rhythm. Absolute speed is what most typewriter effects get wrong, but
 * it matters less than the shape of the delays: jitter on every keystroke, a
 * beat after a comma, a longer one after a full stop, a fraction more for a
 * space or a capital (the hand is reaching for shift). Constant intervals are
 * what read as "machine", not the speed itself.
 */
function gap(base: number, ch: string, prev: string) {
  let d = base * (0.72 + Math.random() * 0.72);
  if (prev === ",") d += 210;
  if (prev === "." || prev === "!" || prev === "?") d += 330;
  if (ch === "\n") return d + 240;
  if (ch === " ") d += 45;
  if (ch >= "A" && ch <= "Z") d += 28;
  return d;
}

/**
 * The whole timeline is computed once, up front, and then played by a single
 * rAF loop. Nested setTimeouts would drift, can't be jumped to the end, and
 * fall apart when the tab is backgrounded; a timeline can be skipped to its
 * last frame in one assignment, which is exactly what an impatient visitor
 * needs.
 */
export function useTypewriter(steps: TypeStep[]) {
  const stepsRef = useRef(steps);
  const [snap, setSnap] = useState<Snapshot>(() => ({
    counts: steps.map(() => 0),
    caretStep: 0,
    caretMode: "off",
  }));
  const [revealed, setRevealed] = useState(false);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const list = stepsRef.current;
    let cancelled = false;
    let raf = 0;

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      setSnap({
        counts: list.map((s) => s.text.length),
        caretStep: -1,
        caretMode: "off",
      });
      setRevealed(true);
    };
    finishRef.current = finish;

    // Respect the OS preference, but make the reason discoverable: silently
    // showing static text is indistinguishable from a broken animation.
    const prefersReduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const forced =
      typeof window !== "undefined" &&
      /[?&]type=force\b/.test(window.location.search);

    (window as unknown as { __hero?: unknown }).__hero = {
      prefersReducedMotion: prefersReduce,
      forced,
      mode: prefersReduce && !forced ? "skipped (reduced motion)" : "typewriter",
    };

    if (prefersReduce && !forced) {
      finish();
      return;
    }

    // ---- lay out the timeline; each frame carries complete state ----
    const frames: { at: number; snap: Snapshot }[] = [];
    const counts = list.map(() => 0);
    let t = 0;
    const push = (caretStep: number, caretMode: CaretMode) =>
      frames.push({ at: t, snap: { counts: counts.slice(), caretStep, caretMode } });

    list.forEach((step, si) => {
      push(si, "blink"); // caret arrives and breathes
      t += step.leadIn;
      push(si, "solid"); // stops blinking while the keys are moving
      for (let c = 0; c < step.text.length; c++) {
        t += gap(step.base, step.text[c], c > 0 ? step.text[c - 1] : "");
        counts[si] = c + 1;
        push(si, "solid");
      }
      t += 120;
      push(si, "blink");
      t += step.tail;
    });

    push(list.length - 1, "fade");
    t += 260;
    const revealAt = t; // the rest of the column starts arriving here, while
    t += 660; // the caret is still finishing its fade — they overlap
    push(-1, "off");
    const total = t + 120;

    let startTime = 0;
    let cursor = 0;
    let didReveal = false;

    const loop = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startTime;

      let due: Snapshot | null = null;
      while (cursor < frames.length && frames[cursor].at <= elapsed) {
        due = frames[cursor++].snap;
      }
      if (due) setSnap(due);

      if (!didReveal && elapsed >= revealAt) {
        didReveal = true;
        setRevealed(true);
      }
      if (elapsed < total) raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame((now) => {
      startTime = now;
      loop(now);
    });

    // Calm is not the same thing as making people wait — but only a deliberate
    // gesture counts. `wheel` and `touchstart` used to be in here, which was a
    // bug: scrolling is the first thing most visitors do, and a trackpad emits
    // `wheel` on the lightest touch, so the intro would jump to its end when
    // nobody asked it to — indistinguishable from having no animation at all.
    const events = ["pointerdown", "keydown"] as const;
    const onSkip = () => finish();
    events.forEach((e) =>
      window.addEventListener(e, onSkip, { once: true, passive: true }),
    );

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      events.forEach((e) => window.removeEventListener(e, onSkip));
    };
  }, []);

  const skip = useCallback(() => finishRef.current(), []);

  return {
    counts: snap.counts,
    caretStep: snap.caretStep,
    caretMode: snap.caretMode,
    revealed,
    skip,
  };
}
