import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { DriveRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link DriveRuntime} to every drive hook and headless
 * component below it. Renders nothing of its own.
 *
 * It goes INSIDE `<DocsProvider>` — the drive surfaces read rows, content and
 * breadcrumbs through `@stapel/docs-react` and add only the five new reads
 * here:
 *
 * ```tsx
 * const docs = createDocsRuntime({ baseUrl: "/docs/api/v1/" });
 * const drive = createDriveRuntime({ baseUrl: "/docs/api/v1/" });
 * <DocsProvider runtime={docs}>
 *   <DriveProvider runtime={drive}>{app}</DriveProvider>
 * </DocsProvider>
 * ```
 */
export const DriveProvider: (props: {
  runtime: DriveRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
