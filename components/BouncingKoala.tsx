"use client";

import { useEffect, useRef, useState } from "react";

// The koala itself is purely decorative — no click handler, no
// pointer-events, no purpose beyond wandering the screen. Position/
// velocity live in refs and get pushed straight to the DOM each frame
// instead of through React state, so it never triggers a re-render of
// the page around it. The toggle button is the one real, clickable
// control here.
const SIZE = 40; // px, roughly the rendered emoji footprint
const SPEED = 90; // px/sec
const STORAGE_KEY = "koala-visible";

export default function BouncingKoala() {
  const elRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) setVisible(stored === "true");
      } catch {
        // localStorage unavailable — default stays visible
      }
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    const el = elRef.current;
    if (!el) return;

    let x = Math.random() * Math.max(0, window.innerWidth - SIZE);
    let y = Math.random() * Math.max(0, window.innerHeight - SIZE);
    let vx = (Math.random() < 0.5 ? -1 : 1) * SPEED;
    let vy = (Math.random() < 0.5 ? -1 : 1) * SPEED;
    el.style.transform = `translate(${x}px, ${y}px)`;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // stays put, no animation loop at all
    }

    let frameId = requestAnimationFrame(tick);
    let last = performance.now();

    function tick(now: number) {
      const dt = (now - last) / 1000;
      last = now;

      const maxX = window.innerWidth - SIZE;
      const maxY = window.innerHeight - SIZE;

      x += vx * dt;
      y += vy * dt;

      if (x <= 0) {
        x = 0;
        vx = Math.abs(vx);
      } else if (x >= maxX) {
        x = maxX;
        vx = -Math.abs(vx);
      }
      if (y <= 0) {
        y = 0;
        vy = Math.abs(vy);
      } else if (y >= maxY) {
        y = maxY;
        vy = -Math.abs(vy);
      }

      el!.style.transform = `translate(${x}px, ${y}px)`;
      frameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frameId);
  }, [visible]);

  function toggle() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore — just won't persist across reloads
      }
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={visible}
        title={visible ? "Hide the koala" : "Show the koala"}
        className="fixed left-3 top-[80px] z-40 flex h-9 w-9 items-center justify-center rounded-sm border border-border-color bg-surface text-lg opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
      >
        🐨
      </button>
      {visible && (
        <div
          ref={elRef}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-30 select-none text-4xl"
          style={{ willChange: "transform" }}
        >
          🐨
        </div>
      )}
    </>
  );
}
