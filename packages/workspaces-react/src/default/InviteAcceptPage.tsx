/**
 * `<InviteAcceptPage/>` — the default `/invite/{token}` route component
 * (org-program §B4): every state of the `InviteAcceptFlow` headless journey
 * rendered with antd, with the two HOST SLOTS the pair cannot own:
 *
 *  - `renderLoginPanel` — the sign-in surface for a registered invitee
 *    without a session (drop auth-react's `<AuthPanel/>` in; call
 *    `onLoggedIn(email)` — or simply let the `sessionEmail` prop update,
 *    the flow re-routes on it automatically).
 *  - `renderInitialSetup` — the basic-data step for a freshly created
 *    account (drop profiles-react's `InitialSetupPrompt`/`InitialSetupModal`
 *    in; call `onDone()`). Omitted → the step auto-skips.
 *
 * THE GRANT SEAM (§B4): for a NEW user the flow mints a login grant and this
 * page hands it to YOUR `onLoginGrant(grantToken)` — wire it to auth-react's
 * `api.exchangeLoginGrant(grantToken)` + `session.adopt(...)`. When your
 * callback's promise resolves the page advances the flow automatically
 * (`grantExchanged`); a rejection shows a retry. The pairs stay decoupled:
 * this package never imports auth-react.
 *
 * Like the pair's other default skins (MembersManager/WorkspaceSettings),
 * theming comes from the host's antd ConfigProvider — this is a route BODY,
 * not a self-themed shell.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Button, Card, Flex, Result, Spin, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import { InviteAcceptFlow } from "../headless/InviteAcceptFlow.js";
import type { InviteAcceptFlowBag } from "../headless/InviteAcceptFlow.js";
import type { InvitationPreview, Member } from "../api/types.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";

export interface InviteAcceptPageProps {
  /** The invite token from the route — a bearer secret, never log it. */
  readonly token: string;
  /** The signed-in account's email, or null/undefined when no session
   * (e.g. auth-react's `useAuthSessionState().user?.email ?? null`). */
  readonly sessionEmail?: string | null;
  /**
   * Exchange the login grant at auth (the §B4 seam — see the module doc).
   * Resolve = signed in (the page advances); reject = retry offered.
   */
  readonly onLoginGrant?: (grantToken: string) => void | Promise<void>;
  /** Login slot for `loginRequired` (registered invitee, no session). */
  readonly renderLoginPanel?: (ctx: {
    onLoggedIn: (email: string) => void;
  }) => ReactNode;
  /** Basic-data slot for `basicData` (fresh account). Omitted → auto-skip. */
  readonly renderInitialSetup?: (ctx: { onDone: () => void }) => ReactNode;
  /** Wrong-account CTA (sign out / switch). Omitted → CTA hidden. */
  readonly onSwitchAccount?: () => void;
  readonly onAccepted?: (member: Member) => void;
  readonly onDeclined?: () => void;
}

export function InviteAcceptPage(props: InviteAcceptPageProps): ReactElement {
  return (
    <InviteAcceptFlow
      token={props.token}
      sessionEmail={props.sessionEmail ?? null}
      {...(props.onAccepted !== undefined ? { onAccepted: props.onAccepted } : {})}
      {...(props.onDeclined !== undefined ? { onDeclined: props.onDeclined } : {})}
    >
      {(bag) => (
        <PageBody
          bag={bag}
          sessionEmail={props.sessionEmail ?? null}
          {...(props.onLoginGrant !== undefined
            ? { onLoginGrant: props.onLoginGrant }
            : {})}
          {...(props.renderLoginPanel !== undefined
            ? { renderLoginPanel: props.renderLoginPanel }
            : {})}
          {...(props.renderInitialSetup !== undefined
            ? { renderInitialSetup: props.renderInitialSetup }
            : {})}
          {...(props.onSwitchAccount !== undefined
            ? { onSwitchAccount: props.onSwitchAccount }
            : {})}
        />
      )}
    </InviteAcceptFlow>
  );
}

const UNAVAILABLE_KEY: Record<string, string> = {
  expired: WORKSPACES_I18N_KEYS.inviteUnavailableExpired,
  revoked: WORKSPACES_I18N_KEYS.inviteUnavailableRevoked,
  accepted: WORKSPACES_I18N_KEYS.inviteUnavailableAccepted,
  declined: WORKSPACES_I18N_KEYS.inviteUnavailableDeclined,
};

function InviteHeader(props: { preview: InvitationPreview }): ReactElement {
  const t = useT();
  return (
    <Flex vertical gap={4}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {t(WORKSPACES_I18N_KEYS.inviteAcceptTitle, {
          workspace: props.preview.workspace_name,
        })}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t(WORKSPACES_I18N_KEYS.inviteRoleLine, { role: props.preview.role })}
      </Typography.Text>
      <Typography.Text type="secondary">
        {t(WORKSPACES_I18N_KEYS.inviteEmailLine, {
          email: props.preview.email_masked,
        })}
      </Typography.Text>
    </Flex>
  );
}

/** A real component (not hooks in the render-prop lambda) — owns the
 * grant-exchange effect below. */
function PageBody(props: {
  bag: InviteAcceptFlowBag;
  sessionEmail: string | null;
  onLoginGrant?: (grantToken: string) => void | Promise<void>;
  renderLoginPanel?: (ctx: { onLoggedIn: (email: string) => void }) => ReactNode;
  renderInitialSetup?: (ctx: { onDone: () => void }) => ReactNode;
  onSwitchAccount?: () => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const { bag } = props;
  const s = bag.state;

  // ── the grant seam: run the host's exchange when the grant is issued ──────
  const { onLoginGrant, renderInitialSetup } = props;
  const grantToken = s.step === "grantIssued" ? s.grantToken : null;
  const [exchangeFailed, setExchangeFailed] = useState(false);
  const exchangedRef = useRef<string | null>(null);
  useEffect(() => {
    if (grantToken === null || onLoginGrant === undefined) return;
    if (exchangedRef.current === grantToken) return; // once per grant
    exchangedRef.current = grantToken;
    setExchangeFailed(false);
    void (async () => {
      try {
        await onLoginGrant(grantToken);
        bag.grantExchanged();
      } catch {
        // The grant is single-use server-side but un-consumed on a network
        // fault; retry re-runs the host callback with the SAME token.
        exchangedRef.current = null;
        setExchangeFailed(true);
      }
    })();
  }, [grantToken, onLoginGrant, bag]);

  // ── basic-data auto-skip when the host provides no slot ───────────────────
  useEffect(() => {
    if (s.step === "basicData" && renderInitialSetup === undefined) {
      bag.completeBasicData();
    }
  }, [s.step, renderInitialSetup, bag]);

  switch (s.step) {
    case "idle":
    case "loadingPreview":
      return (
        <Card data-testid="invite-accept-page">
          <Flex vertical align="center" gap="middle">
            <Typography.Text type="secondary">
              {t(WORKSPACES_I18N_KEYS.inviteLoading)}
            </Typography.Text>
            <Spin />
          </Flex>
        </Card>
      );

    case "previewError":
      return (
        <Card data-testid="invite-accept-page">
          <Alert type="error" showIcon message={formatError(s.error)} />
        </Card>
      );

    case "unavailable":
      return (
        <Card data-testid="invite-accept-page">
          <Result
            status="info"
            title={s.preview.workspace_name}
            subTitle={t(
              UNAVAILABLE_KEY[s.status] ??
                WORKSPACES_I18N_KEYS.inviteUnavailableRevoked
            )}
          />
        </Card>
      );

    case "wrongAccount":
      return (
        <Card data-testid="invite-accept-page">
          <Flex vertical gap="middle">
            <InviteHeader preview={s.preview} />
            <Alert
              type="warning"
              showIcon
              message={t(WORKSPACES_I18N_KEYS.inviteWrongAccount)}
              description={t(WORKSPACES_I18N_KEYS.inviteWrongAccountHint, {
                email: props.sessionEmail ?? "",
                invited: s.preview.email_masked,
              })}
            />
            {props.onSwitchAccount && (
              <Button onClick={props.onSwitchAccount} data-analytics="flow">
                {t(WORKSPACES_I18N_KEYS.inviteSwitchAccountCta)}
              </Button>
            )}
          </Flex>
        </Card>
      );

    case "loginRequired":
      return (
        <Card data-testid="invite-accept-page">
          <Flex vertical gap="middle">
            <InviteHeader preview={s.preview} />
            <Typography.Text strong>
              {t(WORKSPACES_I18N_KEYS.inviteLoginTitle)}
            </Typography.Text>
            {props.renderLoginPanel?.({
              onLoggedIn: (email) => bag.sessionEstablished(email),
            })}
          </Flex>
        </Card>
      );

    case "newUser":
    case "claiming":
    case "claimError":
      return (
        <Card data-testid="invite-accept-page">
          <Flex vertical gap="middle">
            <InviteHeader preview={s.preview} />
            <Typography.Text type="secondary">
              {t(WORKSPACES_I18N_KEYS.inviteNewUserHint, {
                email: s.preview.email_masked,
              })}
            </Typography.Text>
            {s.step === "claimError" && (
              <Alert type="error" showIcon message={formatError(s.error)} />
            )}
            <Button
              type="primary"
              loading={s.step === "claiming"}
              onClick={() => bag.claim()}
              data-analytics="flow"
            >
              {t(
                s.step === "claiming"
                  ? WORKSPACES_I18N_KEYS.inviteClaiming
                  : WORKSPACES_I18N_KEYS.inviteCreateAccountCta
              )}
            </Button>
          </Flex>
        </Card>
      );

    case "grantIssued":
      return (
        <Card data-testid="invite-accept-page">
          <Flex vertical align="center" gap="middle">
            {exchangeFailed ? (
              <>
                <Alert
                  type="error"
                  showIcon
                  message={t(WORKSPACES_I18N_KEYS.inviteExchangeFailed)}
                />
                <Button
                  type="primary"
                  onClick={() => {
                    // Re-arm the effect for the same grant token.
                    exchangedRef.current = null;
                    setExchangeFailed(false);
                  }}
                  data-analytics="flow"
                >
                  {t(WORKSPACES_I18N_KEYS.inviteRetryCta)}
                </Button>
              </>
            ) : (
              <>
                <Typography.Text type="secondary">
                  {t(WORKSPACES_I18N_KEYS.inviteExchanging)}
                </Typography.Text>
                <Spin />
              </>
            )}
          </Flex>
        </Card>
      );

    case "basicData":
      return (
        <Card data-testid="invite-accept-page">
          <Flex vertical gap="middle">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t(WORKSPACES_I18N_KEYS.inviteBasicDataTitle)}
            </Typography.Title>
            {renderInitialSetup ? (
              renderInitialSetup({ onDone: () => bag.completeBasicData() })
            ) : (
              <Spin />
            )}
          </Flex>
        </Card>
      );

    case "acceptPrompt":
    case "accepting":
    case "declining":
    case "acceptError":
      return (
        <Card data-testid="invite-accept-page">
          <Flex vertical gap="middle">
            <InviteHeader preview={s.preview} />
            {s.step === "acceptError" && (
              <Alert type="error" showIcon message={formatError(s.error)} />
            )}
            <Flex gap="small">
              <Button
                type="primary"
                loading={s.step === "accepting"}
                disabled={s.step === "declining"}
                onClick={() => bag.accept()}
                data-analytics="flow"
              >
                {t(WORKSPACES_I18N_KEYS.inviteJoinCta)}
              </Button>
              <Button
                danger
                loading={s.step === "declining"}
                disabled={s.step === "accepting"}
                onClick={() => bag.decline()}
                data-analytics="flow"
              >
                {t(WORKSPACES_I18N_KEYS.inviteDeclineCta)}
              </Button>
            </Flex>
          </Flex>
        </Card>
      );

    case "accepted":
      return (
        <Card data-testid="invite-accept-page">
          <Result
            status="success"
            title={t(WORKSPACES_I18N_KEYS.inviteAccepted, {
              workspace: s.preview.workspace_name,
            })}
          />
        </Card>
      );

    case "declined":
      return (
        <Card data-testid="invite-accept-page">
          <Result
            status="info"
            title={s.preview.workspace_name}
            subTitle={t(WORKSPACES_I18N_KEYS.inviteDeclined)}
          />
        </Card>
      );
  }
}
