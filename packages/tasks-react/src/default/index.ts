/**
 * `@stapel/tasks-react/default` — the pair's default AntD skin (§54: a pair ships a
 * FEATURE, not only a bag). A separate entry point, so a host that brings its
 * own visuals never pulls `antd` or the token bridge into its bundle;
 * importing this subpath is the opt-in.
 *
 * ```tsx
 * import { TasksPanel } from "@stapel/tasks-react/default";
 * // under the pair's <TasksProvider> + core's <I18nProvider>:
 * <TasksPanel />
 * ```
 */
export { TasksPanel } from "./TasksPanel.js";
export type { TasksPanelProps } from "./TasksPanel.js";
export type { ThemeModeProp } from "./types.js";
