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

  it("staleness guard: a newer transition drops a late run result (R1)", async () => {
    const machine = createFlowMachine<S>({ id: "t", initial: { step: "idle" } });
    let release!: (v: number) => void;
    const task = (): Promise<number> =>
      new Promise<number>((res) => {
        release = res;
      });

    const pending = machine.run({ step: "pending" }, task, {
      resolve: (v) => ({ step: "done", value: v }),
      reject: () => ({ step: "failed", reason: "x" }),
    });
    expect(machine.getState().step).toBe("pending");

    // A newer transition happens while the task is in flight.
    machine.to({ step: "idle" });
    expect(machine.getState()).toEqual({ step: "idle" });

    // The stale task now resolves — it must NOT clobber the newer state.
    release(99);
    await pending;
    expect(machine.getState()).toEqual({ step: "idle" });
  });

  it("R2: a re-entrant to() from a subscriber during the pending notification still marks the run stale", async () => {
    const machine = createFlowMachine<S>({ id: "t", initial: { step: "idle" } });
    // A subscriber that reacts to entering "pending" by synchronously
    // cancelling — e.g. a guard that aborts flows while offline/unmounting.
    machine.subscribe(() => {
      if (machine.getState().step === "pending") machine.to({ step: "idle" });
    });

    let release!: (v: number) => void;
    const pending = machine.run(
      { step: "pending" },
      () => new Promise<number>((res) => (release = res)),
      {
        resolve: (v) => ({ step: "done", value: v }),
        reject: () => ({ step: "failed", reason: "x" }),
      }
    );
    // The re-entrant transition already displaced "pending".
    expect(machine.getState()).toEqual({ step: "idle" });

    release(99);
    await pending;
    // The run's epoch must be the PENDING transition's epoch, not the
    // re-entrant listener's — the late result may not clobber "idle".
    expect(machine.getState()).toEqual({ step: "idle" });
  });

  it("concurrent runs: the newer run's pending displaces the older; only the newer result lands", async () => {
    const machine = createFlowMachine<S>({ id: "t", initial: { step: "idle" } });
    let releaseA!: (v: number) => void;
    let releaseB!: (v: number) => void;

    const runA = machine.run(
      { step: "pending" },
      () => new Promise<number>((res) => (releaseA = res)),
      {
        resolve: (v) => ({ step: "done", value: v }),
        reject: () => ({ step: "failed", reason: "a" }),
      }
    );
    const runB = machine.run(
      { step: "pending" },
      () => new Promise<number>((res) => (releaseB = res)),
      {
        resolve: (v) => ({ step: "done", value: v }),
        reject: () => ({ step: "failed", reason: "b" }),
      }
    );

    // The OLDER task settles late — its result must be dropped.
    releaseA(1);
    await runA;
    expect(machine.getState()).toEqual({ step: "pending" });

    releaseB(2);
    await runB;
    expect(machine.getState()).toEqual({ step: "done", value: 2 });
  });

  it("a throwing resolve mapper is a loud programming error — not folded into the reject state", async () => {
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
      id: "t",
      initial: { step: "idle" },
      analytics,
    });

    await expect(
      machine.run({ step: "pending" }, () => Promise.resolve(1), {
        resolve: () => {
          throw new Error("mapper boom");
        },
        reject: () => ({ step: "failed", reason: "task" }),
      })
    ).rejects.toThrow("mapper boom");

    // The task SUCCEEDED: no reject state, no spurious `failed` emit.
    expect(machine.getState().step).not.toBe("failed");
    const phases = track.mock.calls
      .filter((c) => c[0] === "flow.t.pending")
      .map((c) => (c[1] as { phase: string }).phase);
    expect(phases).toContain("completed");
    expect(phases).not.toContain("failed");
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
