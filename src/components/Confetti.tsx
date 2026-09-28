"use client";

import { useEffect } from "react";
import confetti, { Options } from "canvas-confetti";
import { pickCelebrationIndex } from "@/lib/celebration";

const BRAND_COLORS = ["#FFCC34", "#1B2A4A", "#FFE08A"];
const BASE: Options = { colors: BRAND_COLORS, disableForReducedMotion: true };

const random = (min: number, max: number) => Math.random() * (max - min) + min;

/** Each celebration starts its animation and returns a function that stops it. */
type Celebration = () => () => void;

function everyFrame(durationMs: number, frame: () => void): () => void {
  const end = Date.now() + durationMs;
  let id = 0;
  const tick = () => {
    frame();
    if (Date.now() < end) id = requestAnimationFrame(tick);
  };
  tick();
  return () => cancelAnimationFrame(id);
}

function everyInterval(intervalMs: number, durationMs: number, burst: () => void): () => void {
  burst();
  const interval = setInterval(burst, intervalMs);
  const timeout = setTimeout(() => clearInterval(interval), durationMs);
  return () => {
    clearInterval(interval);
    clearTimeout(timeout);
  };
}

// Streams of confetti from both bottom corners.
const sideCannons: Celebration = () =>
  everyFrame(2000, () => {
    confetti({ ...BASE, particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
    confetti({ ...BASE, particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
  });

// Round bursts going off at random spots across the top of the screen.
const fireworks: Celebration = () =>
  everyInterval(250, 2500, () =>
    confetti({
      ...BASE,
      particleCount: 40,
      spread: 360,
      startVelocity: 30,
      ticks: 60,
      gravity: 0.8,
      origin: { x: random(0.1, 0.9), y: random(0.1, 0.5) },
    })
  );

// Popcorn popping up from the bottom of the screen.
const popcorn: Celebration = () => {
  const kernel = confetti.shapeFromText({ text: "🍿", scalar: 2 });
  return everyInterval(200, 2000, () =>
    confetti({
      ...BASE,
      shapes: [kernel],
      scalar: 2,
      flat: true,
      particleCount: 5,
      angle: 90,
      spread: 70,
      startVelocity: 55,
      gravity: 1.2,
      origin: { x: random(0.2, 0.8), y: 1 },
    })
  );
};

// A few quick waves of gold stars from the middle of the screen.
const starburst: Celebration = () => {
  const burst = (particleCount: number, scalar: number) =>
    confetti({
      ...BASE,
      colors: ["#FFCC34", "#F5B800", "#FFE08A"],
      shapes: ["star"],
      particleCount,
      scalar,
      spread: 360,
      startVelocity: 30,
      gravity: 0,
      decay: 0.94,
      ticks: 60,
      origin: { x: 0.5, y: 0.45 },
    });
  const timeouts = [0, 150, 300].map((delay) =>
    setTimeout(() => {
      burst(40, 1.2);
      burst(15, 0.75);
    }, delay)
  );
  return () => timeouts.forEach(clearTimeout);
};

// Confetti gently drifting down from the top of the screen.
const confettiRain: Celebration = () =>
  everyFrame(2500, () =>
    confetti({
      ...BASE,
      particleCount: 2,
      startVelocity: 0,
      ticks: 300,
      gravity: 0.6,
      drift: random(-0.4, 0.4),
      scalar: random(0.8, 1.2),
      origin: { x: Math.random(), y: -0.1 },
    })
  );

const CELEBRATIONS: Celebration[] = [sideCannons, fireworks, popcorn, starburst, confettiRain];

/**
 * Plays one of several consensus celebrations. Pass the same `seed` on every
 * client (e.g. ticket id + round) so everyone sees the same animation.
 */
export function Confetti({ seed }: { seed: string }) {
  useEffect(() => {
    const celebrate = CELEBRATIONS[pickCelebrationIndex(seed, CELEBRATIONS.length)];
    return celebrate();
  }, [seed]);

  return null;
}
