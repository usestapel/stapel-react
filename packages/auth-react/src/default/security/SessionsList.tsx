/**
 * `<SessionsList/>` — default skin for the security-settings sessions screen
 * (owner directive point 5; auth-sa.md §12). Built entirely on the pair's
 * EXISTING query/mutation hooks (`useSessions`, `useRevokeSession`,
 * `useRevokeOtherSessions`, `useConfirmSession`) — no new backend surface.
 * UX shape (device row, "this device"/"suspicious" badges, per-row revoke,
 * "sign out everyone else" with a confirm) matches the common security-
 * settings pattern; this is an original implementation, not copied from any
 * reference. Manual `Flex`/`Divider` layout rather than antd's `List` — that
 * component is deprecated as of antd 6.5.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Badge, Button, Divider, Empty, Flex, Popconfirm, Spin, Tag, Typography } from "antd";
import { useT } from "@stapel/core";
import type { AuthSession } from "../../api/types.js";
import {
  useConfirmSession,
  useRevokeOtherSessions,
  useRevokeSession,
} from "../../model/mutations.js";
import { useSessions } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityEmptyIcon } from "./icons.js";

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (Number.isNaN(diffMs)) return iso;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

/** One session row: device identity + this-device/suspicious badges + actions. */
function SessionRow(props: {
  session: AuthSession;
  onConfirmMe: () => void;
  onRevoke: () => void;
  revoking: boolean;
}): ReactElement {
  const t = useT();
  const s = props.session;
  return (
    <Flex justify="space-between" align="flex-start" gap="middle" style={{ width: "100%" }}>
      <Flex vertical gap={2}>
        <Flex gap="small" align="center">
          <Typography.Text strong>{s.device_name}</Typography.Text>
          {s.is_current && <Tag color="blue">{t(AUTH_I18N_KEYS.sessionThisDevice)}</Tag>}
          {s.is_suspicious && (
            <Badge status="warning" text={t(AUTH_I18N_KEYS.sessionSuspicious)} />
          )}
        </Flex>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {s.device_details ? `${s.device_details} — ` : ""}
          {s.ip_address ? `${s.ip_address} — ` : ""}
          {t(AUTH_I18N_KEYS.secSessionsLastUsed, { when: formatRelative(s.last_used_at) })}
        </Typography.Text>
      </Flex>
      {!s.is_current && (
        <Flex gap="small" flex="none">
          {s.is_suspicious && (
            <Button type="link" onClick={props.onConfirmMe} data-analytics="flow">
              {t(AUTH_I18N_KEYS.secSessionsConfirmMe)}
            </Button>
          )}
          <Popconfirm
            title={t(AUTH_I18N_KEYS.secSessionsSignOutConfirmTitle)}
            onConfirm={props.onRevoke}
            okText={t(AUTH_I18N_KEYS.secSessionsSignOut)}
            okButtonProps={{ danger: true, loading: props.revoking }}
          >
            <Button type="link" danger data-analytics="flow">
              {t(AUTH_I18N_KEYS.secSessionsSignOut)}
            </Button>
          </Popconfirm>
        </Flex>
      )}
    </Flex>
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
  const sessions = useSessions();
  const revokeOne = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const confirmMe = useConfirmSession();
  const [pendingRevokeAll, setPendingRevokeAll] = useState(false);

  const list = sessions.data ?? [];
  const otherCount = list.filter((s) => !s.is_current).length;

  return (
    <Flex vertical gap="middle" style={{ width: "100%" }} data-testid="sessions-list">
      <Flex justify="space-between" align="flex-start" gap="middle">
        <div>
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            {t(AUTH_I18N_KEYS.secSessionsTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(AUTH_I18N_KEYS.secSessionsSubtitle)}
          </Typography.Text>
        </div>
        {otherCount > 0 && (
          <Popconfirm
            title={t(AUTH_I18N_KEYS.secSessionsSignOutAllConfirmTitle)}
            open={pendingRevokeAll}
            onOpenChange={setPendingRevokeAll}
            onConfirm={() => revokeOthers.mutate()}
            okText={t(AUTH_I18N_KEYS.secSessionsSignOutAll)}
            okButtonProps={{ danger: true, loading: revokeOthers.isPending }}
          >
            <Button danger data-analytics="flow">
              {t(AUTH_I18N_KEYS.secSessionsSignOutAll)}
            </Button>
          </Popconfirm>
        )}
      </Flex>

      {sessions.isLoading ? (
        <Spin />
      ) : sessions.isError ? (
        <Alert type="error" showIcon message={sessions.error.message} />
      ) : list.length === 0 ? (
        <Empty
          image={props.emptyIcon ?? <SecurityEmptyIcon />}
          description={t(AUTH_I18N_KEYS.secSessionsEmpty)}
        />
      ) : (
        <Flex vertical>
          {list.map((s, i) => (
            <div key={s.id}>
              {i > 0 && <Divider style={{ margin: "8px 0" }} />}
              <SessionRow
                session={s}
                onConfirmMe={() => confirmMe.mutate(s.id)}
                onRevoke={() => revokeOne.mutate(s.id)}
                revoking={revokeOne.isPending && revokeOne.variables === s.id}
              />
            </div>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
