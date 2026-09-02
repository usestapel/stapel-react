import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { DriveApi } from "../api/driveApi.js";
import type { DriveRuntime } from "./runtime.js";

/**
 * The wired DriveRuntime shared through React context by `<DriveProvider>`.
 * One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 *
 * `<DriveProvider>` goes INSIDE `<DocsProvider>`: every drive surface reads
 * folders, documents and breadcrumbs through `@stapel/docs-react`'s hooks and
 * adds only the five new reads through this one. A drive hook mounted without
 * the docs provider fails in docs-react's own `useDocsRuntime`, with that
 * pair's message — the honest place for it, and the reason this pair does not
 * re-wrap the docs context.
 */
const kit: ModuleContextKit<DriveRuntime> =
  createModuleContext<DriveRuntime>("Drive");

export const DriveRuntimeContext: Context<DriveRuntime | null> =
  kit.RuntimeContext;

export const useDriveRuntime: () => DriveRuntime = kit.useRuntime;

export const useDriveApi: () => DriveApi = kit.useApi;

export const useDriveAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<DriveProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<DriveRuntime>["Provider"] =
  kit.Provider;
