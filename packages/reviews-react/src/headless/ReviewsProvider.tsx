import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { ReviewsRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link ReviewsRuntime} to every reviews hook and headless
 * component below it. Bring your own visual shell — this component renders
 * nothing of its own. (Core's `createModuleContext` provider, bound to this
 * pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createReviewsRuntime({ baseUrl: "/reviews/api/v1" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <ReviewsProvider runtime={runtime}>{app}</ReviewsProvider>
 * ```
 */
export const ReviewsProvider: (props: {
  runtime: ReviewsRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
