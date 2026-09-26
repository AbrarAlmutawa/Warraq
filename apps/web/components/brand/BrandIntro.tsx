"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

/*
 * A short brand opening shown over "/" once per browser session.
 *
 * - Purely presentational: the upload page underneath is already rendered and usable, and the
 *   overlay is aria-hidden with nothing focusable, so screen readers and keyboard users are never
 *   blocked by it.
 * - Holds for a few seconds, then fades out. A click/tap anywhere on it, or any key, dismisses it
 *   immediately (no fade).
 * - Uses its own sessionStorage key, separate from the Warraq journey session (lib/session.ts);
 *   it never reads or writes manuscript state.
 * - Respects prefers-reduced-motion (no movement; instant exit) — see globals.css.
 */

const INTRO_SEEN_KEY = "warraq:intro-seen";
const INTRO_SEEN_EVENT = "warraq:intro-seen-change";

/* Time to comfortably read the logo and slogan before the automatic fade-out. */
const HOLD_MS = 3500;
/* Matches .warraq-intro-leaving in globals.css. */
const EXIT_MS = 350;

/* Same official lockup as components/brand/WarraqLogo.tsx. */
const LOGO_WIDTH = 633;
const LOGO_HEIGHT = 195;

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/* Remembers the intro for this session and removes it (every subscriber re-reads the flag). */
function markSeen(): void {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Storage unavailable: the intro simply shows again next time. Nothing else depends on it.
  }
  window.dispatchEvent(new Event(INTRO_SEEN_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(INTRO_SEEN_EVENT, onChange);
  return () => window.removeEventListener(INTRO_SEEN_EVENT, onChange);
}

/* The server cannot read sessionStorage; it renders the intro and the browser decides after load. */
const getServerSnapshot = () => false;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BrandIntro() {
  const seen = useSyncExternalStore(subscribe, readSeen, getServerSnapshot);
  if (seen) return null;
  return <IntroOverlay />;
}

function IntroOverlay() {
  /* True during the automatic fade-out after the hold. */
  const [leaving, setLeaving] = useState(false);

  // Automatic path: hold, then fade out. Any key dismisses immediately.
  useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const onKeyDown = () => markSeen();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(hold);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // After the fade-out (none with reduced motion), remember it for this session and unmount.
  useEffect(() => {
    if (!leaving) return;
    const done = window.setTimeout(markSeen, prefersReducedMotion() ? 0 : EXIT_MS);
    return () => window.clearTimeout(done);
  }, [leaving]);

  return (
    <div
      aria-hidden="true"
      // The whole overlay is the dismiss area. `click` (not pointerdown) so the same tap is
      // consumed here and never reaches the upload page underneath.
      onClick={markSeen}
      className={`warraq-intro fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-paper px-6 ${
        leaving ? "warraq-intro-leaving" : ""
      }`}
    >
      <div className="warraq-intro-content flex flex-col items-center text-center">
        <Image
          src="/brand/warraq-logo.png"
          alt=""
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          loading="eager"
          draggable={false}
          className="h-[64px] w-auto select-none lg:h-[84px]"
        />
        <span className="warraq-intro-rule mt-8 h-px w-20 bg-terracotta" />
        <p className="mt-6 text-[20px] text-body select-none lg:text-[24px]">
          كل فكرة <span className="mx-1.5 font-bold text-terracotta">..</span> وَرَّاقة
        </p>
      </div>
    </div>
  );
}