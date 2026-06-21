"use client";

import * as React from "react";

import {
  simulateRisk,
  type RiskSimInput,
  type RiskSimOutput,
  type RiskSimRequest,
  type RiskSimResponse,
} from "@/lib/domain/risk-sim";

/**
 * Run the seeded Monte-Carlo for an input, preferring the Web Worker (so a 10k-path
 * run never blocks the UI) and falling back to a synchronous `simulateRisk` call
 * when workers are unavailable. The pure engine is identical either way, so the
 * result is the same; only where it runs differs. Re-runs are keyed on a stable
 * serialization of the input, so dragging unrelated UI does not re-simulate.
 */
export function useRiskSim(input: RiskSimInput | null): { output: RiskSimOutput | null; busy: boolean } {
  const [output, setOutput] = React.useState<RiskSimOutput | null>(null);
  const [busy, setBusy] = React.useState(false);
  const workerRef = React.useRef<Worker | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") return;
    try {
      workerRef.current = new Worker(new URL("../../workers/risk-sim.worker.ts", import.meta.url), { type: "module" });
    } catch {
      workerRef.current = null;
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const inputKey = input ? JSON.stringify(input) : null;

  React.useEffect(() => {
    let cancelled = false;
    const worker = workerRef.current;
    let onMessage: ((event: MessageEvent<RiskSimResponse>) => void) | null = null;

    // All state updates run inside this deferred callback (never synchronously in
    // the effect body) to avoid cascading renders, matching the app's async-effect
    // convention. The small delay also lets the "busy" state paint first.
    const handle = window.setTimeout(() => {
      if (cancelled) return;
      if (!input) {
        setOutput(null);
        setBusy(false);
        return;
      }
      setBusy(true);
      const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

      if (worker) {
        onMessage = (event: MessageEvent<RiskSimResponse>) => {
          if (event.data?.id !== id) return;
          worker.removeEventListener("message", onMessage!);
          if (cancelled) return;
          setOutput(event.data.output);
          setBusy(false);
        };
        worker.addEventListener("message", onMessage);
        worker.postMessage({ type: "risk-sim/run", id, input } satisfies RiskSimRequest);
        return;
      }

      setOutput(simulateRisk(input));
      setBusy(false);
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      if (worker && onMessage) worker.removeEventListener("message", onMessage);
    };
    // inputKey is the stable identity of `input`; re-run only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  return { output, busy };
}
