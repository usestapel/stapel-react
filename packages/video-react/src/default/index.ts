/**
 * `@stapel/video-react/default` — the antd skin over the headless pair.
 *
 * A separate entry point (the convention every pair's `/default` follows) so a
 * host rendering its own screens never pulls `antd` into its bundle. The main
 * entry has no visual opinion at all and no import path from it reaches this
 * directory — size-limit and the bundle-purity test are the teeth on that.
 *
 * ```tsx
 * import { createVideoRuntime, VideoProvider } from "@stapel/video-react";
 * import { RoomsPane, ScopeUsagePane } from "@stapel/video-react/default";
 * ```
 *
 * Two screens the navigation manifest mounts:
 *
 * - `<RoomsPane>` (`video.rooms`) — the meeting client: open a room or enter a
 *   code, then the room, its lobby and the call.
 * - `<ScopeUsagePane>` (`admin.usage`) — the workspace-admin call-time report.
 *
 * The parts each is built from are exported too, for a host that composes its
 * own screen: `<JoinGate>`, `<LobbyPanel>`, `<ParticipantsList>`,
 * `<CallStage>`, `<MeetingPane>`, `<ScopeUsageTable>`.
 *
 * The theme wrapper and the error alert are NOT here any more: both are the
 * shared substrate's (`SkinTheme` / `ErrorAlert` from
 * `@stapel/tokens-antd/skin`), which is where the reactive-theme fix and the
 * retry/dismiss copy live once for the fleet instead of fifteen times.
 */
export { RoomsPane } from "./RoomsPane.js";
export type { RoomsPaneProps } from "./RoomsPane.js";
export { MeetingPane } from "./MeetingPane.js";
export type { MeetingPaneProps, CallStageSlotContext } from "./MeetingPane.js";
export { JoinGate } from "./JoinGate.js";
export type { JoinGateProps } from "./JoinGate.js";
export { LobbyPanel } from "./LobbyPanel.js";
export type { LobbyPanelProps } from "./LobbyPanel.js";
export { ParticipantsList } from "./ParticipantsList.js";
export type { ParticipantsListProps } from "./ParticipantsList.js";
export { CallStage, LIVEKIT_PEER } from "./CallStage.js";
export type {
  CallStageProps,
  CallStageState,
  CallPeerLoader,
  CallRoomLike,
} from "./CallStage.js";
export { ScopeUsagePane } from "./ScopeUsagePane.js";
export type { ScopeUsagePaneProps } from "./ScopeUsagePane.js";
export { ScopeUsageTable } from "./ScopeUsageTable.js";
export type { ScopeUsageTableProps } from "./ScopeUsageTable.js";
export type { ThemeModeProp } from "./types.js";
