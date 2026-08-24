/**
 * `<ConnectionsPage/>` — the caller's own social graph as ONE screen:
 * followers, following, and blocked, behind a single control.
 *
 * This is the page the nav manifest mounts (`profiles.connections`). Before
 * it, nine of stapel-profiles' sixteen operations — every follow, block,
 * relationship and connection-list endpoint — reached no rendered control at
 * all: a host installing `@stapel/profiles-react` got a settings page and
 * nothing else (§83 — the backend shipped, the feature did not).
 *
 * The three lists are ONE control, not three tabs each fetching in the
 * background: the headless `ConnectionList` keeps the other two queries
 * dormant (`enabled: false`), so switching is a fetch and staying is free.
 *
 * `surface="base"` on the theme root: this is a full-page screen, so it paints
 * `colorBgLayout` rather than a card's `colorBgContainer` — the phone-dark
 * white band the visual pass found at the bottom of every shot in this group
 * is that decision being skipped.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Segmented, Typography } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { ConnectionKind } from "../headless/ConnectionList.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { ConnectionList } from "./ConnectionList.js";

/** The page's own comfortable measure. A length in `rem`, so it scales with
 * the root type rather than pinning a pixel width. */
export const CONNECTIONS_MAX_WIDTH = "60rem";

const KINDS: readonly ConnectionKind[] = ["followers", "following", "blocked"];

const KIND_LABEL: Readonly<Record<ConnectionKind, string>> = {
  followers: PROFILES_I18N_KEYS.listFollowers,
  following: PROFILES_I18N_KEYS.listFollowing,
  blocked: PROFILES_I18N_KEYS.listBlocked,
};

export interface ConnectionsPageProps {
  /** Pin a side; omitted, the skin follows the document's LIVE `data-theme`
   * through `SkinTheme` (never a hardcoded `"light"`). */
  readonly mode?: ThemeMode;
  /** Which list to open on. Default `followers`. */
  readonly initialKind?: ConnectionKind;
  /** The caller's own id — marks their own row and suppresses a follow
   * control aimed at themselves. */
  readonly selfUserId?: string;
  /** A host with a router passes navigation to its public-profile route. */
  onOpenProfile?(userId: string): void;
}

export function ConnectionsPage(props: ConnectionsPageProps): ReactElement {
  const t = useT();
  const [kind, setKind] = useState<ConnectionKind>(
    props.initialKind ?? "followers"
  );

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      data-testid="connections-page"
    >
      <Flex
        vertical
        gap={spacing[5]}
        style={{ width: "100%", maxWidth: CONNECTIONS_MAX_WIDTH }}
      >
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            {t(PROFILES_I18N_KEYS.connectionsTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(PROFILES_I18N_KEYS.connectionsSubtitle)}
          </Typography.Text>
        </div>

        <Segmented<ConnectionKind>
          value={kind}
          onChange={setKind}
          // `block` is what makes the three choices full-width and thumb-sized
          // in a narrow container; the 44px control height comes from
          // SkinTheme on a phone, not from a literal here.
          block
          aria-label={t(PROFILES_I18N_KEYS.connectionsKindLabel)}
          options={KINDS.map((k) => ({ value: k, label: t(KIND_LABEL[k]) }))}
          data-testid="connections-kind"
        />

        <ConnectionList
          // Remounting per kind is deliberate: a list is a different list, so
          // its scroll position, its skeleton and its empty state all start
          // clean rather than inheriting the previous one's.
          key={kind}
          kind={kind}
          showHeading={false}
          {...(props.selfUserId !== undefined
            ? { selfUserId: props.selfUserId }
            : {})}
          {...(props.onOpenProfile ? { onOpenProfile: props.onOpenProfile } : {})}
        />
      </Flex>
    </SkinTheme>
  );
}
