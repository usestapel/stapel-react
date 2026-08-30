import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { VocabulariesRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link VocabulariesRuntime} to every vocabularies hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createVocabulariesRuntime({ baseUrl: "/vocabularies/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <VocabulariesProvider runtime={runtime}>{app}</VocabulariesProvider>
 * ```
 */
export const VocabulariesProvider: (props: {
  runtime: VocabulariesRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
