"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { CaretMode } from "@/lib/useTypewriter";

type Props = {
  text: string;
  /** How many characters are currently visible. */
  revealed: number;
  caret: CaretMode;
};

type CaretBox = {
  x: number;
  y: number;
  h: number;
  w: number;
  /** True when the caret changed line — it must not slide diagonally. */
  jumped: boolean;
};

/**
 * Every character is laid out from the first frame and revealed with opacity,
 * never appended to a growing string. Appending would make the headline grow
 * from zero to two lines and shove everything below it down the page on every
 * keystroke; this way the box is final before the first character lands.
 *
 * Splitting text into spans does cost kerning across the span boundaries, so
 * once the caret is gone the spans are replaced by a plain text node — the
 * state people actually spend their time looking at gets perfect typography.
 */
export function TypedText({ text, revealed, caret }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const spansRef = useRef<(HTMLSpanElement | null)[]>([]);
  const lastTop = useRef(-999);
  const [box, setBox] = useState<CaretBox | null>(null);

  const settled = caret === "off" && revealed >= text.length;

  useEffect(() => {
    if (settled || caret === "off") return;
    const host = hostRef.current;
    const afterBreak = revealed > 0 && text[revealed - 1] === "\n";
    const index = afterBreak
      ? Math.min(revealed, text.length - 1)
      : Math.max(0, revealed - 1);
    const span = spansRef.current[index];
    if (!host || !span) return;

    const r = span.getBoundingClientRect();
    const hb = host.getBoundingClientRect();
    if (!r.height) return;

    const y = r.top - hb.top + r.height * 0.14;
    const jumped = Math.abs(y - lastTop.current) > 2;
    lastTop.current = y;

    setBox({
      x: (revealed === 0 || afterBreak ? r.left : r.right) - hb.left,
      y,
      h: r.height * 0.74,
      w: Math.max(2, Math.round(r.height * 0.045)),
      jumped,
    });
  }, [revealed, caret, settled, text]);

  if (settled) {
    return (
      <>
        {text.split("\n").map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </>
    );
  }

  return (
    <span ref={hostRef} data-typed className="relative block">
      {Array.from(text).map((ch, i) => (
        ch === "\n" ? (
          <br key={i} />
        ) : (
        <span
          // Index keys are correct here: this list is a fixed split of one
          // immutable string, so positions never move.
          key={i}
          ref={(el) => {
            spansRef.current[i] = el;
          }}
          className="transition-opacity duration-[90ms] ease-out"
          style={{ opacity: i < revealed ? 1 : 0 }}
        >
          {ch}
        </span>
        )
      ))}

      {caret !== "off" && box && (
        <i
          data-caret
          aria-hidden
          className={`pointer-events-none absolute rounded-[1px] bg-ink ${
            caret === "blink" ? "animate-caret-soft" : ""
          }`}
          style={{
            left: box.x,
            top: box.y,
            height: box.h,
            width: box.w,
            opacity: caret === "fade" ? 0 : 1,
            transition: box.jumped
              ? "none"
              : caret === "fade"
                ? "opacity 900ms cubic-bezier(.22, 1, .36, 1)"
                : "left 70ms linear, opacity 450ms ease",
          }}
        />
      )}
    </span>
  );
}
