/**
 * The MOUNTED half of the variant-distinctness guard (frontend-guardrails §4.2,
 * visual pass C-SAMESHOT / BLANK_RENDER).
 *
 * {@link assertVariantsRenderDistinctly} compares the FIRST frame: no effects,
 * no microtasks, no refetch. That is the frame a seeded demo gets right, and it
 * is not the frame anybody looks at. The showcase mounts, React runs the
 * effects, the query client sees a seeded entry it considers stale (`staleTime:
 * 0`, or a `refetchQueries` that ignores it), refetches, and the demo's
 * catch-all mock answers `200 {}` — so the state the variant is NAMED for is
 * replaced by an error card or an empty card, in every variant at once.
 *
 * Two pairs found this independently: three `chat.thread` variants settled on
 * the error card and three inbox variants on the empty card while the static
 * guard stayed green (the seeds were real, the first frame was correct, and the
 * screen a person saw was neither); forms-react shipped `forms-list`,
 * `responses` and `public-form` photographing a blank page the same way. This
 * lifts that local assertion into the shared format so no pair has to rediscover
 * it, and asks three questions the static pass cannot:
 *
 *   (a) no variant settles on an error/empty arm unless it DECLARED one
 *       (`step: "error"` — a demo of the error state is legitimate; a demo that
 *       fell into it is the defect),
 *   (b) the variants are still pairwise distinct after the dust settles,
 *   (c) nothing reached `console.error` while it settled — a React warning, a
 *       failed `play`, an unhandled rejection in a mock.
 *
 * The renderer is INJECTED (`render` from @testing-library/react in a pair's
 * vitest, a real DOM in a shot runner), so this package still pulls in no
 * react-dom and stays viewer-agnostic.
 */
import { act } from "react";
import type { ReactElement } from "react";
import type { DemoDef, DemoVariant } from "./defineDemo.js";
import { renderDemoVariant, runDemoPlay, variantIds } from "./render.js";

/** A variant mounted into a live DOM: where it painted, and how to take it down. */
export interface MountedVariant {
  /** The element the variant rendered into (RTL's `view.container`). */
  readonly container: HTMLElement;
  /** Unmount and detach — called for every variant, including a failing one. */
  readonly unmount: () => void;
}

/** Mounts one variant element into a live DOM (e.g. RTL's `render`). */
export type VariantMounter = (element: ReactElement) => MountedVariant;

/** Waits until a mounted variant has stopped changing (see {@link SettleOptions.settle}). */
export type VariantSettler = (mounted: MountedVariant) => Promise<void>;

/** Which designed dead-end a variant came to rest on. */
export type VariantArm = "error" | "empty";

/**
 * How an arm is recognised in the DOM. These are the substrate's own stamps
 * (`@stapel/tokens-antd/skin`: `ErrorAlert` → `data-stapel-error`, `EmptyState`
 * → `data-stapel-empty`) plus the ARIA role a hand-rolled error card carries,
 * so a pair that has not migrated yet is still caught.
 */
const ARM_SELECTORS: Readonly<Record<VariantArm, readonly string[]>> = {
  error: ['[data-stapel-error]', '[role="alert"]', '[data-stapel-play="failed"]'],
  empty: ['[data-stapel-empty]'],
};

/**
 * Words in a variant's declared `step` (or, failing that, its id) that say
 * "this variant documents that arm on purpose". Substring match, lowercased:
 * `step: "load-failed"`, `step: "empty"`, a variant id of `no-results`.
 */
const ARM_WORDS: Readonly<Record<VariantArm, readonly string[]>> = {
  error: [
    "error",
    "fail",
    "denied",
    "forbidden",
    "unauthorized",
    "offline",
    "unavailable",
    "expired",
    "invalid",
    "rejected",
    "timeout",
    "rate-limit",
  ],
  empty: ["empty", "no-", "none", "blank", "zero", "nothing", "first-run"],
};

const ARMS: readonly VariantArm[] = ["error", "empty"];

/** One variant, after it stopped moving. */
export interface SettledVariant {
  readonly id: string;
  /** `container.innerHTML` once settled — the picture a shot runner keeps. */
  readonly markup: string;
  /** The arms present in that picture (empty for a variant that shows its state). */
  readonly arms: readonly VariantArm[];
  /** The arms this variant is allowed to land on, from its `step`/id. */
  readonly declaredArms: readonly VariantArm[];
  /** Everything that reached `console.error` between mount and settled. */
  readonly consoleErrors: readonly string[];
}

/** Options for {@link settleVariants} / {@link assertVariantsSettleDistinctly}. */
export interface SettleOptions {
  /** Mount a variant element into a live DOM. Required — this package owns no renderer. */
  readonly render: VariantMounter;
  /**
   * Wait for the mount's own async work. Default: two macrotask turns inside
   * React's `act`, which is one turn for the refetch a mount effect starts and
   * one for the render its answer causes. Pass a poll-until-quiescent settler
   * when a demo's mock has a deliberate delay.
   *
   * A variant with a `play` step gets: settle → `play` → settle, so the state
   * the step reaches is what gets compared (unlike the static guard, which
   * skips played variants because their FIRST frame is legitimately a
   * sibling's).
   */
  readonly settle?: VariantSettler;
}

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.stack ?? arg.message;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

interface ActEnvironment {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
}

/** Run `body` with React's act environment on, restoring whatever was there. */
async function withActEnvironment<T>(body: () => Promise<T>): Promise<T> {
  const scope = globalThis as unknown as ActEnvironment;
  const previous = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    return await body();
  } finally {
    if (previous === undefined) delete scope.IS_REACT_ACT_ENVIRONMENT;
    else scope.IS_REACT_ACT_ENVIRONMENT = previous;
  }
}

/** One macrotask turn, flushed through React. */
async function actTick(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

async function defaultSettle(): Promise<void> {
  await actTick();
  await actTick();
}

function armsInDom(container: HTMLElement): readonly VariantArm[] {
  const found: VariantArm[] = [];
  if (container.innerHTML.trim() === "") return ["empty"];
  for (const arm of ARMS) {
    const selectors = ARM_SELECTORS[arm];
    if (selectors.some((selector) => container.querySelector(selector) !== null)) {
      found.push(arm);
    }
  }
  return found;
}

function declaredArmsOf(variant: DemoVariant | undefined, variantId: string): readonly VariantArm[] {
  const declaration = (variant?.step ?? variantId).toLowerCase();
  return ARMS.filter((arm) => ARM_WORDS[arm].some((word) => declaration.includes(word)));
}

/**
 * Mount every variant of `demo`, let it settle, and report what it came to rest
 * on. Variants are mounted one at a time and unmounted before the next, so a
 * demo's mock harness sees the same lifecycle a viewer gives it.
 */
export async function settleVariants(
  demo: DemoDef,
  options: SettleOptions
): Promise<readonly SettledVariant[]> {
  const settle = options.settle ?? defaultSettle;
  return withActEnvironment(async () => {
    const results: SettledVariant[] = [];
    for (const id of variantIds(demo)) {
      const consoleErrors: string[] = [];
      const originalConsoleError = console.error;
      console.error = (...args: readonly unknown[]): void => {
        consoleErrors.push(args.map(formatConsoleArg).join(" "));
      };
      let mounted: MountedVariant | undefined;
      try {
        mounted = options.render(renderDemoVariant(demo, id));
        await settle(mounted);
        if (demo.variants[id]?.play !== undefined) {
          // Inside `act`: the step clicks things, and a state update it causes
          // outside an act scope is a `console.error` of React's own — which
          // (c) would then report as the demo's defect.
          const canvas = mounted.container;
          await act(async () => {
            await runDemoPlay(demo, id, canvas);
          });
          await settle(mounted);
        }
        results.push({
          id,
          markup: mounted.container.innerHTML,
          arms: armsInDom(mounted.container),
          declaredArms: declaredArmsOf(demo.variants[id], id),
          consoleErrors: [...consoleErrors],
        });
      } finally {
        console.error = originalConsoleError;
        mounted?.unmount();
      }
    }
    return results;
  });
}

function describeUndeclaredArms(settled: readonly SettledVariant[]): string | undefined {
  const offenders = settled.filter((entry) =>
    entry.arms.some((arm) => !entry.declaredArms.includes(arm))
  );
  if (offenders.length === 0) return undefined;
  const detail = offenders
    .map((entry) => {
      const arms = entry.arms.filter((arm) => !entry.declaredArms.includes(arm)).join(", ");
      return `    ${entry.id} settled on: ${arms}`;
    })
    .join("\n");
  return (
    `  variants fell into an arm they never declared:\n${detail}\n` +
    `  The seed reached the first frame and was then refetched over — a mount\n` +
    `  refetch (staleTime 0, refetchQueries) answered by a catch-all mock. Make\n` +
    `  the demo's handlers answer what its seed holds and pin the query; or, if\n` +
    `  this state is the point of the variant, declare it (\`step: "error"\`).`
  );
}

function describeCollapsedVariants(settled: readonly SettledVariant[]): string | undefined {
  const byMarkup = new Map<string, string[]>();
  for (const entry of settled) {
    const bucket = byMarkup.get(entry.markup);
    if (bucket) bucket.push(entry.id);
    else byMarkup.set(entry.markup, [entry.id]);
  }
  const collisions = [...byMarkup.values()].filter((ids) => ids.length > 1);
  if (collisions.length === 0) return undefined;
  return (
    `  variants settle on identical DOM once mounted:\n` +
    collisions.map((ids) => `    ${ids.join(" == ")}`).join("\n") +
    `\n  Their first frames differ, so the seeds are real; something after mount\n` +
    `  overwrote them with one shared state.`
  );
}

function describeConsoleErrors(settled: readonly SettledVariant[]): string | undefined {
  const noisy = settled.filter((entry) => entry.consoleErrors.length > 0);
  if (noisy.length === 0) return undefined;
  const detail = noisy
    .map((entry) => `    ${entry.id}: ${entry.consoleErrors[0] ?? ""}`)
    .join("\n");
  return (
    `  console.error while settling — the viewer logs this on every visit:\n${detail}\n` +
    `  A React warning, a failed \`play\` step, or a rejected mock request.`
  );
}

/**
 * Throw unless every variant of `demo` is still ITSELF once mounted and settled.
 *
 * Call it beside {@link assertVariantsRenderDistinctly} in the pair's demo smoke
 * test: the static pass catches a variant that was never seeded, this one
 * catches a variant whose seed was overwritten after frame one.
 */
export async function assertVariantsSettleDistinctly(
  demo: DemoDef,
  options: SettleOptions
): Promise<void> {
  const settled = await settleVariants(demo, options);
  const problems = [
    describeUndeclaredArms(settled),
    describeCollapsedVariants(settled),
    describeConsoleErrors(settled),
  ].filter((problem): problem is string => problem !== undefined);
  if (problems.length === 0) return;
  throw new Error(
    `demo "${demo.id}": the mounted variants are not what the demo declares —\n` +
      `  the static first frame was correct and the settled screen is not:\n` +
      problems.join("\n")
  );
}
