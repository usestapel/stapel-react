import { describe, expect, it, vi } from "vitest";
import { createFlowMachine } from "../src/flows/createFlowMachine.js";

type S =
  | { readonly step: "idle" }
  | { readonly step: "pending" }
  | { readonly step: "done"; readonly value: number }
  | { readonly step: "failed"; readonly reason: string };

describe("createFlowMachine (the reusable primitive)", () => {
  it("transitions and notifies subscribers", () => {
    const machine = createFlowMachine<S>({ id: "t", initial: { step: "idle" } });
    const listener = vi.fn();
    const unsub = machine.subscribe(listener);
    machine.to({ step: "done", value: 1 });
    expect(machine.getState()).toEqual({ step: "done", value: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    machine.to({ step: "idle" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("run() parks in pending then resolves; never throws on rejection", async () => {
    const machine = createFlowMachine<S>({ id: "t", initial: { step: "idle" } });
    const seen: string[] = [];
    machine.subscribe(() => seen.push(machine.getState().step));

    await machine.run({ step: "pending" }, () => Promise.resolve(42), {
      resolve: (v) => ({ step: "done", value: v }),
      reject: () => ({ step: "failed", reason: "x" }),
    });
    expect(seen).toEqual(["pending", "done"]);
    expect(machine.getState()).toEqual({ step: "done", value: 42 });

    await expect(
      machine.run({ step: "pending" }, () => Promise.reject(new Error("boom")), {
        resolve: (v) => ({ step: "done", value: v as number }),
        reject: (e) => ({ step: "failed", reason: (e as Error).message }),
      })
    ).resolves.toBeUndefined();
    expect(machine.getState()).toEqual({ step: "failed", reason: "boom" });
  });

  it("auto-instruments started/completed/failed analytics", async () => {
    const track = vi.fn();
    const analytics = {
      track,
      identify: vi.fn(),
      page: vi.fn(),
      flush: vi.fn(),
      setConsent: vi.fn(),
      getConsent: () => "granted" as const,
      register: vi.fn(),
      unregister: vi.fn(),
    };
    const machine = createFlowMachine<S>({
      id: "job",
      initial: { step: "idle" },
      analytics,
    });
    await machine.run({ step: "pending" }, () => Promise.resolve(1), {
      resolve: (v) => ({ step: "done", value: v }),
      reject: () => ({ step: "failed", reason: "" }),
    });
    const calls = track.mock.calls.map((c) => [c[0], (c[1] as { phase: string }).phase]);
    expect(calls).toContainEqual(["flow.job.pending", "started"]);
    expect(calls).toContainEqual(["flow.job.pending", "completed"]);
    expect(calls).toContainEqual(["flow.job.done", "started"]);
  });
});
