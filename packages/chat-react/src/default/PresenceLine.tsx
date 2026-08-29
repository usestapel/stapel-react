/**
 * "Online" / "Last seen 5 minutes ago" — under the counterparty's name.
 *
 * ── What it replaced ──────────────────────────────────────────────────────
 *
 * A tag reading "Live" that was on whenever THIS browser's socket was up.
 * It sat beside the seller's name and every reader took it to mean the seller
 * was there. It never meant that. This line means exactly that, and nothing
 * else: it reads `participants[].online` / `.last_seen_at` — server-side facts
 * about that person's own connections (stapel-chat 0.7.0) — kept live by
 * `chat.presence.changed`. It takes no transport argument and cannot be built
 * from one.
 *
 * ── Why only for a single counterparty ────────────────────────────────────
 *
 * "Online" names a person. In a group of four it names nobody, and a header
 * that reduced four people to one adjective would be back to stating
 * something it cannot know. So the line renders for a 1:1 thread and is
 * absent otherwise — absent, not a placeholder: there is no fact to show.
 *
 * ── Why the relative time comes from core ─────────────────────────────────
 *
 * `useFormat().relative()` is the fleet's one relative-time ladder
 * (`Intl.RelativeTimeFormat`, `numeric: "auto"`, under a minute reads as
 * "now"). A second ladder here would drift from every other surface and would
 * need a translation per unit per locale in this catalogue. The catalogue
 * holds one sentence with a `{when}` hole; `Intl` fills it in the reader's
 * own language.
 */
import type { ReactElement } from "react";
import { Typography } from "antd";
import { useFormat, useT } from "@stapel/core";
import type { Conversation } from "../api/types.js";
import { participantPresence } from "../model/presence.js";
import { counterpartyIds } from "./people.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

export interface PresenceLineProps {
  readonly conversation: Conversation | undefined;
  readonly viewerId: string | null;
}

/**
 * The other party's presence, or nothing.
 *
 * `null` when there is no single other party (no conversation yet, a group, a
 * support queue) — every case where the sentence would be about nobody in
 * particular.
 */
export function PresenceLine(props: PresenceLineProps): ReactElement | null {
  const t = useT();
  const format = useFormat();
  const { conversation, viewerId } = props;
  if (conversation === undefined) return null;

  const others = counterpartyIds(conversation, viewerId);
  if (others.length !== 1) return null;
  const counterpartyId = others[0] ?? null;
  const presence = participantPresence(conversation, counterpartyId);

  // Offline with no last-seen: this deployment has never seen them connect.
  // "Offline" is the whole truth available, and it is said plainly rather
  // than dressed as a timestamp nobody has.
  const relative =
    presence.lastSeenAt === null ? null : format.relative(presence.lastSeenAt);
  const label = presence.online
    ? t(CHAT_I18N_KEYS.presenceOnline)
    : relative === null
      ? t(CHAT_I18N_KEYS.presenceUnknown)
      : t(CHAT_I18N_KEYS.presenceLastSeen, { when: relative });

  return (
    <Typography.Text
      type="secondary"
      data-testid="chat-presence"
      data-online={presence.online ? "true" : "false"}
      style={{ fontSize: "0.85em" }}
    >
      {label}
    </Typography.Text>
  );
}
