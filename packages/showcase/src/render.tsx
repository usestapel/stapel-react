/**
 * Runtime render helper shared by the generated CSF stories (gen:demos) and the
 * vitest smoke tests: resolve a variant, run its render closure, and apply the
 * demo's provider decorator. The theme frame (data-theme + tokens.css) is the
 * viewer's job (§4.1), not this function's — this only wires the demo's own
 * providers so a single variant renders identically in Ladle and in a test.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { DemoDef, DemoPlayContext } from "./defineDemo.js";

/** All variant ids of a demo, in declaration order. */
export function variantIds(demo: DemoDef): readonly string[] {
  return Object.keys(demo.variants);
}

/**
 * Render one variant of a demo, wrapped in its provider decorator. Throws if
 * the variant id is unknown (a generated story never asks for one that is not
 * declared, so this only fires on a hand-written mistake).
 */
export function renderDemoVariant(demo: DemoDef, variantId: string): ReactElement {
  const variant = demo.variants[variantId];
  if (!variant) {
    throw new Error(
      `demo "${demo.id}" has no variant "${variantId}" (have: ${variantIds(
        demo
      ).join(", ")})`
    );
  }
  const node = variant.render();
  return <>{demo.decorator ? demo.decorator(node) : node}</>;
}

/** Variant ids of a demo that declare a `play` step. */
export function playVariantIds(demo: DemoDef): readonly string[] {
  return variantIds(demo).filter((id) => demo.variants[id]?.play !== undefined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** The helpers a `play` step gets, bound to one canvas. */
export function createPlayContext(canvas: HTMLElement): DemoPlayContext {
  const waitFor = async (predicate: () => boolean, timeoutMs = 4000): Promise<void> => {
    const started = Date.now();
    while (!predicate()) {
      if (Date.now() - started > timeoutMs) {
        throw new Error(`play: condition not met within ${String(timeoutMs)}ms`);
      }
      await sleep(16);
    }
  };
  const find = async (
    selector: string,
    options: { readonly portal?: boolean } = {}
  ): Promise<HTMLElement> => {
    const root: ParentNode = options.portal === true ? canvas.ownerDocument : canvas;
    let found: HTMLElement | null = null;
    await waitFor(() => {
      found = root.querySelector<HTMLElement>(selector);
      return found !== null;
    });
    if (found === null) throw new Error(`play: "${selector}" not found`);
    return found;
  };
  const click = async (selector: string): Promise<void> => {
    let target: HTMLElement | null = null;
    await waitFor(() => {
      target =
        canvas.querySelector<HTMLElement>(selector) ??
        canvas.ownerDocument.querySelector<HTMLElement>(selector);
      return target !== null;
    });
    if (target === null) throw new Error(`play: "${selector}" not found`);
    (target as HTMLElement).click();
    // Let React commit the click's state before the step continues.
    await sleep(0);
  };
  return { canvas, waitFor, find, click };
}

/**
 * Run a variant's `play` step against a mounted canvas (a smoke test's
 * `container`, the stage in a story). Resolves immediately for a variant
 * without one.
 */
export async function runDemoPlay(demo: DemoDef, variantId: string, canvas: HTMLElement): Promise<void> {
  const variant = demo.variants[variantId];
  if (!variant) {
    throw new Error(`demo "${demo.id}" has no variant "${variantId}"`);
  }
  if (variant.play === undefined) return;
  await variant.play(createPlayContext(canvas));
}

/** What the stage stamps while, after, or because of the play step. */
export type DemoPlayStatus = "pending" | "done" | "failed";

export interface DemoStageProps {
  readonly demo: DemoDef;
  readonly variant: string;
}

/**
 * The variant plus its `play` step, for the generated story of a variant
 * that has one. Renders `renderDemoVariant` into a stage element stamped
 * `data-stapel-demo-stage` and `data-stapel-play="pending"`, runs the step
 * after mount, then stamps `done` — or `failed` with the message in
 * `data-stapel-play-error` and the error rethrown to the console, where the
 * shot harness records it as the story's defect.
 */
export function DemoStage(props: DemoStageProps): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<DemoPlayStatus>("pending");
  const [error, setError] = useState<string | undefined>(undefined);
  const { demo, variant } = props;
  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    if (canvas === null) return undefined;
    runDemoPlay(demo, variant, canvas).then(
      () => {
        if (!cancelled) setStatus("done");
      },
      (reason: unknown) => {
        if (cancelled) return;
        const message = reason instanceof Error ? reason.message : String(reason);
        setError(message);
        setStatus("failed");
        console.error(`demo "${demo.id}" variant "${variant}": play failed — ${message}`);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [demo, variant]);
  return (
    <div
      ref={ref}
      data-stapel-demo-stage=""
      data-stapel-play={status}
      {...(error !== undefined ? { "data-stapel-play-error": error } : {})}
    >
      {renderDemoVariant(demo, variant)}
    </div>
  );
}
