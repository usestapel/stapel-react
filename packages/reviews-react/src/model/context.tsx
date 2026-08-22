import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { ReviewsApi } from "../api/reviewsApi.js";
import type { ReviewsRuntime } from "./runtime.js";

/**
 * The wired ReviewsRuntime shared through React context by
 * `<ReviewsProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<ReviewsRuntime> =
  createModuleContext<ReviewsRuntime>("Reviews");

export const ReviewsRuntimeContext: Context<ReviewsRuntime | null> =
  kit.RuntimeContext;

export const useReviewsRuntime: () => ReviewsRuntime = kit.useRuntime;

export const useReviewsApi: () => ReviewsApi = kit.useApi;

export const useReviewsAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<ReviewsProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<ReviewsRuntime>["Provider"] =
  kit.Provider;
