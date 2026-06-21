import { simulateRisk, type RiskSimRequest, type RiskSimResponse } from "@/lib/domain/risk-sim";

/**
 * Risk Studio Web Worker entry. Keeps the (potentially 10k-path) Monte-Carlo off
 * the main thread. The heavy work lives in the pure, Vitest-tested `simulateRisk`;
 * this file is only the message-protocol shell. Wired into the UI in a later slice
 * via `new Worker(new URL("@/workers/risk-sim.worker.ts", import.meta.url))`.
 *
 * `self` is typed through the DOM `Worker` interface so the file compiles under the
 * app's `dom` lib without pulling in the conflicting `webworker` lib.
 */
const ctx = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<RiskSimRequest>) => {
  const { id, input } = event.data;
  const response: RiskSimResponse = { type: "risk-sim/result", id, output: simulateRisk(input) };
  ctx.postMessage(response);
};
