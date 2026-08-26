/**
 * `@stapel/realtime/react` — the React surface: one provider, two hooks.
 *
 * Everything socket-shaped lives in the framework-free entry; this subpath adds
 * only the wiring a component needs, so a pair that never opens a socket never
 * loads it. `@stapel/core` is touched HERE and nowhere else — that is where the
 * host's `SessionManager` is adopted for the 4401 path.
 */
export {
  RealtimeProvider,
  sessionSeam,
  useOptionalRealtimeClient,
  useRealtimeClient,
} from "./RealtimeProvider.js";
export type { RealtimeProviderProps } from "./RealtimeProvider.js";
export { useStream } from "./useStream.js";
export type {
  NoProviderStatus,
  UseStreamOptions,
  UseStreamOptionalResult,
  UseStreamResult,
} from "./useStream.js";
export { useRealtimeState } from "./useRealtimeState.js";
/**
 * The shapes a skin types its props with. They live in the framework-free
 * entry; they are re-exported here so a component that only imports
 * `@stapel/realtime/react` can name what it renders.
 */
export type {
  RealtimeDegradation,
  RealtimeDegradationThresholds,
  RealtimeState,
  RealtimeStreamStatus,
} from "../client.js";
