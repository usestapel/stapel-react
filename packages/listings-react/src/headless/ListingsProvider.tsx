import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { ListingsRuntime } from "../model/runtime.js";

/**
 * Renderless provider — puts one wired {@link ListingsRuntime} in context for
 * every hook and headless component in the pair. Bring your own visual shell.
 *
 * ```tsx
 * <ListingsProvider runtime={createListingsRuntime({ baseUrl: "/listings/api/v1/" })}>
 *   <YourShopWindow />
 * </ListingsProvider>
 * ```
 */
export function ListingsProvider(props: {
  runtime: ListingsRuntime;
  children: ReactNode;
}): ReactElement {
  return <ModuleProvider runtime={props.runtime}>{props.children}</ModuleProvider>;
}
