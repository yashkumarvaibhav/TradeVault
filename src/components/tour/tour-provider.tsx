"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Compass, HelpCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { markTourSeenAction } from "@/app/tour/actions";
import { Button } from "@/components/ui/button";
import { SCREEN_TOURS, tourKeyForPath, type ScreenTour, type TourStep } from "@/components/tour/tour-registry";

type Phase = "idle" | "card" | "spotlight";

/** Cookie that disables all tours (e2e seam; also a harmless opt-out if a user ever sets it). */
const SUPPRESS_COOKIE = "tv_tours_off=1";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial read of an external media query, then subscribed below
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Drives the per-screen onboarding tour: on first visit to a screen it shows a non-modal welcome
 * card; the card can launch a modal, guided spotlight walkthrough. "Seen" state is server-persisted
 * per account, so each screen nudges at most once (existing users included), and a floating help
 * button replays the current screen's walkthrough anytime.
 *
 * The welcome card is deliberately non-modal so it never traps focus or blocks the page; only the
 * spotlight (which the user opts into) is a modal overlay.
 */
export function TourProvider({ seen, children }: { seen: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const tourKey = tourKeyForPath(pathname);
  const tour: ScreenTour | null = tourKey ? SCREEN_TOURS[tourKey] ?? null : null;

  const [seenKeys, setSeenKeys] = React.useState<Set<string>>(() => new Set(seen));
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [mounted, setMounted] = React.useState(false);
  const [suppressed, setSuppressed] = React.useState(false);

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client-only init (mount flag + suppress cookie) */
    setMounted(true);
    setSuppressed(typeof document !== "undefined" && document.cookie.includes(SUPPRESS_COOKIE));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Derive this screen's tour phase from navigation (external state). Only pathname is a dependency
  // so that marking a tour seen does not retrigger the welcome card on the same screen.
  React.useEffect(() => {
    const off = typeof document !== "undefined" && document.cookie.includes(SUPPRESS_COOKIE);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase(!off && tour && !seenKeys.has(tour.key) ? "card" : "idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const markSeen = React.useCallback((key: string, status: "completed" | "dismissed") => {
    setSeenKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    void markTourSeenAction(key, status);
  }, []);

  const dismissCard = React.useCallback(() => {
    if (tour) markSeen(tour.key, "dismissed");
    setPhase("idle");
  }, [tour, markSeen]);

  const startSpotlight = React.useCallback(() => setPhase("spotlight"), []);

  const finishSpotlight = React.useCallback(() => {
    if (tour) markSeen(tour.key, "completed");
    setPhase("idle");
  }, [tour, markSeen]);

  const showOverlays = mounted && tour && !suppressed;

  return (
    <>
      {children}

      {showOverlays && phase === "card"
        ? createPortal(
            <div
              role="region"
              aria-label={`${tour.title} — guided tour available`}
              className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-md rounded-lg border border-line-strong bg-raised p-4 shadow-[var(--shadow)] sm:inset-x-auto sm:bottom-4 sm:right-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Compass className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-lg leading-snug text-ink">{tour.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-body">{tour.intro}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="compact" onClick={startSpotlight}>Show me around</Button>
                    <Button size="compact" variant="ghost" onClick={dismissCard}>Maybe later</Button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissCard}
                  aria-label="Dismiss tour"
                  className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showOverlays && phase === "spotlight"
        ? createPortal(<Spotlight key={tour.key} tour={tour} onClose={finishSpotlight} />, document.body)
        : null}

      {/* Floating replay button: only when the current screen has a tour and nothing is open. */}
      {showOverlays && phase === "idle"
        ? createPortal(
            <button
              type="button"
              onClick={startSpotlight}
              aria-label={`Show the guided tour for ${tour.title}`}
              className="fixed bottom-4 right-4 z-[55] flex size-11 items-center justify-center rounded-full border border-line bg-raised text-muted shadow-[var(--shadow)] transition-colors hover:border-line-strong hover:bg-accent-soft hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <HelpCircle className="size-5" aria-hidden="true" />
            </button>,
            document.body,
          )
        : null}
    </>
  );
}

function Spotlight({ tour, onClose }: { tour: ScreenTour; onClose: () => void }) {
  const steps = tour.steps;
  const [index, setIndex] = React.useState(0);
  const step: TourStep = steps[index];
  const isLast = index === steps.length - 1;
  const reduceMotion = usePrefersReducedMotion();

  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const goNext = React.useCallback(() => {
    setIndex((i) => {
      if (i < steps.length - 1) return i + 1;
      onClose();
      return i;
    });
  }, [steps.length, onClose]);
  const goPrev = React.useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Measure (and keep measuring) the spotlighted target for the current step.
  React.useLayoutEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    if (el) el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });

    function measure() {
      const node = step.target ? document.querySelector<HTMLElement>(step.target) : null;
      const r = node?.getBoundingClientRect();
      setRect(r && r.width > 0 && r.height > 0 ? r : null);
    }
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [index, step.target, reduceMotion]);

  // Position the popover relative to the target (or center it when there is no target).
  React.useLayoutEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 12;
    const gap = 12;
    const pw = popoverRef.current?.offsetWidth ?? 320;
    const ph = popoverRef.current?.offsetHeight ?? 180;

    if (!rect) {
      setPos({ top: Math.max(pad, vh / 2 - ph / 2), left: Math.max(pad, vw / 2 - pw / 2) });
      return;
    }
    const fitsBelow = rect.bottom + gap + ph <= vh - pad;
    const top = fitsBelow ? rect.bottom + gap : Math.max(pad, rect.top - gap - ph);
    const left = Math.min(Math.max(pad, rect.left), vw - pw - pad);
    setPos({ top, left });
  }, [rect, index]);

  // Focus management + keyboard controls (Esc closes, arrows navigate, Tab is trapped).
  React.useEffect(() => {
    const node = popoverRef.current;
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Tab" && node) {
        const focusables = Array.from(node.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [index, goNext, goPrev, onClose]);

  const transition = reduceMotion ? undefined : "top 0.18s ease, left 0.18s ease, width 0.18s ease, height 0.18s ease";

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Click-catcher: blocks interaction with the page behind the tour. */}
      <div className="absolute inset-0" aria-hidden="true" />

      {/* Spotlight cutout (box-shadow dims everything except the target) or a flat scrim. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(17, 24, 28, 0.55)",
            outline: "2px solid var(--accent)",
            outlineOffset: "2px",
            transition,
          }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "rgba(17, 24, 28, 0.55)" }} />
      )}

      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-body"
        className="fixed w-[320px] max-w-[calc(100vw-24px)] rounded-lg border border-line bg-raised p-4 shadow-[var(--shadow)]"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Skip tour"
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{tour.title}</p>
        <h2 id="tour-step-title" className="mt-1 pr-6 font-serif text-lg leading-snug text-ink">{step.title}</h2>
        <p id="tour-step-body" className="mt-2 text-sm leading-relaxed text-body">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted tnum" aria-hidden="true">{index + 1} / {steps.length}</span>
          <div className="flex items-center gap-2">
            {index > 0 ? (
              <Button variant="ghost" size="compact" onClick={goPrev}>Back</Button>
            ) : null}
            <Button size="compact" onClick={goNext} data-autofocus>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
