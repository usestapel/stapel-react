/**
 * `<AuditTrailPane/>` — the workspace's membership history (GET
 * `{ws}/audit`), the record nothing kept before stapel-workspaces 0.24: who
 * let this person in, who took them out, and when.
 *
 * Three things this screen refuses to do, all of them things a log viewer
 * does and a product must not:
 *
 *  - **No raw enum.** `member_role_changed` is a vocabulary term, not a
 *    sentence. The closed `AuditAction` vocabulary has a label per value; a
 *    value from a newer backend falls back to the key title-cased, never to a
 *    dotted i18n key and never to the raw snake_case token.
 *  - **No ISO timestamps.** "3 days ago (23 Sept 2026, 09:00)" — the relative
 *    reading a person wants and the absolute one a support agent quotes, in
 *    the reader's own calendar.
 *  - **No ids on the glass.** An actor the journal has no name for is "the
 *    system", which is what an actorless line actually means (a sweep, an
 *    expiry), rather than a truncated UUID.
 *
 * The read is gated server-side on `members.view`: every role that may see
 * who is in the room may see how they got there.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Card, Flex, Select, Typography, theme as antdTheme } from "antd";
import { loadStateFromQuery, mapLoad, useI18n, useT } from "@stapel/core";
import {
  EmptyState,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { useAudit } from "../model/queries.js";
import { titleCaseKey, useWorkspaceFormat } from "../model/format.js";
import type { AuditEvent, AuditParams } from "../api/types.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";
import { AnchorPager, Muted, PersonLine, StatusTag } from "./parts.js";

export interface AuditTrailPaneProps {
  workspaceId: string;
}

/**
 * The CLOSED action vocabulary (`models.AuditAction`), in lifecycle order —
 * an invitation, then what became of it, then what became of the membership,
 * then the end of the workspace. The filter offers exactly these because the
 * server matches nothing for a value outside them, and a filter that silently
 * does not apply is worse than an empty page.
 */
const ACTIONS: readonly string[] = [
  "invitation_created",
  "invitation_accepted",
  "invitation_declined",
  "invitation_revoked",
  "account_created_by_invitation",
  "member_joined",
  "member_provisioned",
  "member_role_changed",
  "member_suspended",
  "member_unsuspended",
  "member_removed",
  "deleted",
];

interface Walk {
  readonly anchor: string | undefined;
  readonly direction: "next" | "prev" | undefined;
  readonly index: number;
}

const FIRST_PAGE: Walk = { anchor: undefined, direction: undefined, index: 1 };

/** The tone a line reads in: a removal is not the same news as a join. */
function toneFor(action: string): "neutral" | "success" | "warning" | "danger" {
  if (action === "member_removed" || action === "deleted") return "danger";
  if (action === "member_suspended" || action === "invitation_revoked") return "warning";
  if (
    action === "member_joined" ||
    action === "invitation_accepted" ||
    action === "member_unsuspended"
  ) {
    return "success";
  }
  return "neutral";
}

export function AuditTrailPane(props: AuditTrailPaneProps): ReactElement {
  const t = useT();
  const i18n = useI18n();
  const [action, setAction] = useState<string | null>(null);
  const [walk, setWalk] = useState<Walk>(FIRST_PAGE);

  const params: AuditParams = {
    ...(action !== null ? { action } : {}),
    ...(walk.anchor !== undefined ? { anchor: walk.anchor } : {}),
    ...(walk.direction !== undefined ? { direction: walk.direction } : {}),
  };
  const query = useAudit(props.workspaceId, params);
  const page = query.data ?? null;

  // Raw bundle lookup, not `t()`: `t` falls back to the key itself, and a
  // dotted i18n key is the one thing this must never print. Same contract as
  // RoleSelect's `labelFor`.
  const bundle = i18n.getBundle();
  const labelForAction = (value: string): string =>
    bundle[`workspaces.audit.action.${value}`] ?? titleCaseKey(value);

  return (
    <SkinTheme data-testid="audit-trail">
      <Card>
        <Flex vertical gap={spacing["1"]}>
          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
            {t(WORKSPACES_I18N_KEYS.auditTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(WORKSPACES_I18N_KEYS.auditSubtitle)}
          </Typography.Text>
        </Flex>

        <Flex gap={spacing["2"]} align="center" style={{ marginTop: spacing["4"] }} wrap>
          <Muted>{t(WORKSPACES_I18N_KEYS.auditFilterLabel)}</Muted>
          <Select<string>
            value={action ?? ""}
            onChange={(next) => {
              // A new filter is a new walk: the anchor belongs to the old one.
              setAction(next === "" ? null : next);
              setWalk(FIRST_PAGE);
            }}
            aria-label={t(WORKSPACES_I18N_KEYS.auditFilterLabel)}
            style={{ flex: "1 1 14rem", maxWidth: "20rem" }}
            data-testid="audit-filter"
            options={[
              { value: "", label: t(WORKSPACES_I18N_KEYS.auditFilterAll) },
              ...ACTIONS.map((value) => ({ value, label: labelForAction(value) })),
            ]}
          />
        </Flex>

        <div style={{ marginTop: spacing["4"] }}>
          <LoadList
            state={mapLoad(loadStateFromQuery(query), (loaded) => loaded.items)}
            testId="audit-list"
            onRetry={() => {
              void query.refetch();
            }}
            empty={
              <EmptyState
                title={t(WORKSPACES_I18N_KEYS.auditEmpty)}
                testId="audit-list-empty"
              />
            }
          >
            {(events) => (
              <div role="list" data-testid="audit-rows">
                {events.map((event) => (
                  <AuditRow key={event.id} event={event} label={labelForAction(event.action)} />
                ))}
              </div>
            )}
          </LoadList>
        </div>

        {page !== null && (
          <AnchorPager
            hasPrev={page.has_prev}
            hasNext={page.has_next}
            prevLabel={t(WORKSPACES_I18N_KEYS.pagerPrev)}
            nextLabel={t(WORKSPACES_I18N_KEYS.pagerNext)}
            position={t(WORKSPACES_I18N_KEYS.pagerPosition, { page: walk.index })}
            testId="audit-pager"
            onPrev={() =>
              setWalk({
                anchor: page.prev_anchor ?? undefined,
                direction: "prev",
                index: Math.max(1, walk.index - 1),
              })
            }
            onNext={() =>
              setWalk({
                anchor: page.next_anchor ?? undefined,
                direction: "next",
                index: walk.index + 1,
              })
            }
          />
        )}
      </Card>
    </SkinTheme>
  );
}

function AuditRow(props: {
  readonly event: AuditEvent;
  readonly label: string;
}): ReactElement {
  const t = useT();
  const format = useWorkspaceFormat();
  const { token } = antdTheme.useToken();
  const { event } = props;
  const actor = event.actor_display_name?.trim();

  return (
    <div
      role="listitem"
      data-testid={`audit-row-${event.id}`}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: spacing["3"],
        paddingTop: spacing["3"],
        paddingBottom: spacing["3"],
        borderBottom: `1px solid ${token.colorSplit}`,
      }}
    >
      <PersonLine
        name={event.subject_display_name ?? null}
        email={event.subject_email ?? null}
        tags={
          <StatusTag tone={toneFor(event.action)} testId={`audit-action-${event.id}`}>
            {props.label}
          </StatusTag>
        }
        caption={
          <>
            {t(WORKSPACES_I18N_KEYS.auditBy, {
              actor:
                actor !== undefined && actor !== ""
                  ? actor
                  : t(WORKSPACES_I18N_KEYS.auditActorUnknown),
            })}
            {event.role !== null && event.role !== undefined && event.role !== "" && (
              <> · {t(WORKSPACES_I18N_KEYS.auditRoleLine, { role: event.role })}</>
            )}
          </>
        }
      />
      <Muted testId={`audit-when-${event.id}`}>{format.timestamp(event.created_at)}</Muted>
    </div>
  );
}
