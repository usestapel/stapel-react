import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { GeoRuntime } from "../model/runtime.js";

/**
 * Mount once, above anything from this pair. Supplies the wired runtime
 * (client + analytics seam) the hooks read.
 *
 * Nothing here requires a session: `map/config` is public and the map renders
 * for a signed-out visitor. See `model/availability.ts` for what does need
 * one, and what happens when it is missing.
 */
export function GeoProvider(props: {
  readonly runtime: GeoRuntime;
  readonly children: ReactNode;
}): ReactElement {
  return <ModuleProvider runtime={props.runtime}>{props.children}</ModuleProvider>;
}
