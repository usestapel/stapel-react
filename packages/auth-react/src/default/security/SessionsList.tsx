/**
 * `<SessionsList/>` — default skin for the security-settings sessions screen
 * (owner directive point 5; auth-sa.md §12). Built entirely on the pair's
 * EXISTING query/mutation hooks (`useSessions`, `useRevokeSession`,
 * `useRevokeOtherSessions`, `useConfirmSession`) — no new backend surface.
 *
 * Rows use the shared `SecurityListRow` (an explicit action slot + a container
 * query) rather than a wrapping space-between flex: the ad-hoc version put the
 * action in a different place on each row at the same phone width, because
 * `wrap` tips per row instead of switching per list.
 *
 * Confirmations are `SkinConfirm`, not `Popconfirm`. A popover anchored to a
 * small link button is a desktop shape — on a phone it can render off-viewport
 * and its OK/Cancel targets fall under the touch minimum, and this particular
 * OK ends someone's session.
 */
import { fontSize } from "@stapel/tokens";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Badge, Button, Card, Flex, Tag, Typography, theme as antdTheme } from "antd";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { loadStateFromQuery, matchLoad, useT } from "@stapel/core";
import type { AuthSession } from "../../api/types.js";
import {
  useConfirmSession,
  useRevokeOtherSessions,
  useRevokeSession,
} from "../../model/mutations.js";
import { useSessions } from "../../model/queries.js";
import { useAuthDateFormat } from "../../model/formatDate.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityEmptyIcon } from "./icons.js";
import { SecurityList, SecurityListRow } from "./SecurityListRow.js";

/** One session row: device identity + this-device/suspicious badges + actions. */
function SessionRow(props: {
  session: AuthSession;
  onConfirmMe: () => void;
  onRevoke: () => void;
}): ReactElement {
  const t = useT();
  const when = useAuthDateFormat();
  const s = props.session;
  const detail = [
    s.device_details,
    s.ip_address,
    t(AUTH_I18N_KEYS.secSessionsLastUsed, { when: when.relative(s.last_used_at) }),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" — ");
  return (
    <SecurityListRow
      data-testid="session-row"
      title={s.device_name}
      badges={
        <>
          {s.is_current && <Tag color="blue">{t(AUTH_I18N_KEYS.sessionThisDevice)}</Tag>}
          {s.is_suspicious && (
            <Badge status="warning" text={t(AUTH_I18N_KEYS.sessionSuspicious)} />
          )}
        </>
      }
      meta={
        <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
          {detail}
        </Typography.Text>
      }
      {...(s.is_current
        ? {}
        : {
            actions: (
              <>
                {s.is_suspicious && (
                  <Button type="link" onClick={props.onConfirmMe} data-analytics="flow">
                    {t(AUTH_I18N_KEYS.secSessionsConfirmMe)}
                  </Button>
                )}
                {/* `type="text"`: on a screen whose purpose is reassurance, a
                    row of red outlined buttons is the loudest thing present.
                    The danger weight belongs on the confirm, where the
                    decision is actually taken. */}
                <Button
                  type="text"
                  danger
                  onClick={props.onRevoke}
                  data-analytics="none"
                  data-analytics-reason="local-ui-open-revoke-session-confirm"
                >
                  {t(AUTH_I18N_KEYS.secSessionsSignOut)}
                </Button>
              </>
            ),
          })}
    />
  );
}

export interface SessionsListProps {
  /** Override the empty-state glyph (canon default: a plain shield outline,
   * matching the `icon_svg` auth-contract's aesthetic — see `./icons.tsx`). */
  readonly emptyIcon?: ReactNode;
}

/** Full device-CRUD security screen: list, per-device revoke, revoke-others. */
export function SessionsList(props: SessionsListProps = {}): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const sessions = useSessions();
  const revokeOne = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const confirmMe = useConfirmSession();
  const [pendingRevokeAll, setPendingRevokeAll] = useState(false);
  // ONE confirm for the whole list, keyed by the row waiting on it — not one
  // dialog per row, which is N mounted dialogs to show at most one.
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  const state = loadStateFromQuery(sessions);
  // The bulk action needs to know there IS another device, so it is decided
  // per load state rather than off a count: on a failed read the card body
  // states the failure, and offering "sign out everyone else" over a list
  // nobody could read would be an action taken in the dark.
  const signOutOthers = matchLoad(state, {
    loading: () => null,
    failed: () => null,
    ready: (rows) =>
      rows.some((s) => !s.is_current) ? (
        <Button
          danger
          onClick={() => setPendingRevokeAll(true)}
          data-analytics="none"
          data-analytics-reason="local-ui-open-revoke-all-confirm"
        >
          {t(AUTH_I18N_KEYS.secSessionsSignOutAll)}
        </Button>
      ) : null,
  });

  return (
    <SkinTheme surface="bare">
      <Card
        title={t(AUTH_I18N_KEYS.secSessionsTitle)}
        data-testid="sessions-list"
        style={{ width: "100%" }}
        extra={signOutOthers}
      >
        <Flex vertical gap="middle" style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            {t(AUTH_I18N_KEYS.secSessionsSubtitle)}
          </Typography.Text>

          <LoadList
            state={state}
            testId="sessions"
            onRetry={() => void sessions.refetch()}
            empty={
              <EmptyState
                icon={props.emptyIcon ?? <SecurityEmptyIcon />}
                title={t(AUTH_I18N_KEYS.secSessionsEmpty)}
                hint={t(AUTH_I18N_KEYS.secSessionsEmptyHint)}
              />
            }
          >
            {(list) => (
              <SecurityList ruleColor={token.colorBorderSecondary}>
                {list.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    onConfirmMe={() => confirmMe.mutate(s.id)}
                    onRevoke={() => setPendingRevokeId(s.id)}
                  />
                ))}
              </SecurityList>
            )}
          </LoadList>

          <ErrorAlert thrown={revokeOne.error} />
          <ErrorAlert thrown={revokeOthers.error} />
        </Flex>

        <SkinConfirm
          open={pendingRevokeId !== null}
          danger
          title={t(AUTH_I18N_KEYS.secSessionsSignOutConfirmTitle)}
          confirmLabel={t(AUTH_I18N_KEYS.secSessionsSignOut)}
          confirming={revokeOne.isPending}
          data-testid="session-revoke-confirm"
          onConfirm={() => {
            const id = pendingRevokeId;
            if (id === null) return;
            revokeOne.mutate(id, { onSettled: () => setPendingRevokeId(null) });
          }}
          onCancel={() => setPendingRevokeId(null)}
        />
        <SkinConfirm
          open={pendingRevokeAll}
          danger
          title={t(AUTH_I18N_KEYS.secSessionsSignOutAllConfirmTitle)}
          confirmLabel={t(AUTH_I18N_KEYS.secSessionsSignOutAll)}
          confirming={revokeOthers.isPending}
          data-testid="sessions-revoke-all-confirm"
          onConfirm={() =>
            revokeOthers.mutate(undefined, {
              onSettled: () => setPendingRevokeAll(false),
            })
          }
          onCancel={() => setPendingRevokeAll(false)}
        />
      </Card>
    </SkinTheme>
  );
}
