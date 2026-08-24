/**
 * `<OAuthLinks/>` — default skin for the security-settings connected-accounts
 * screen (owner directive point 5). Built against stapel-auth's `/oauth/links/`
 * trio as seen in the sibling checkout's WORK-IN-PROGRESS 0.6.0 contract work
 * (uncommitted there as of this writing — confirmed absent from
 * contract-pins.json's pinned `stapel-auth` ref, so `LinkedOAuthAccount` etc.
 * in api/types.ts are hand-transcribed, NOT generated, per that file's doc):
 *
 *  - **Read**: `useOAuthLinks()` (`GET /oauth/links/`), plus the provider
 *    catalog from the EXISTING `useCapabilities()` query.
 *  - **Unlink**: `useUnlinkOAuth()` (`DELETE /oauth/links/{provider}/`).
 *  - **Link** is additionally THIN by necessity, same boundary as WebAuthn's
 *    `webauthnCreate`/`webauthnGet`: `POST /oauth/links/` wants a provider
 *    `access_token` obtained by running that provider's OAuth SDK/popup in
 *    the browser — a host-specific integration this pair cannot perform
 *    itself. Supply `getAccessToken(providerId)`; without it, "Connect" is
 *    disabled and the reason is printed beside it (`useActionGate`) — a
 *    disabled button receives no pointer events, so a tooltip on it is a
 *    reason no keyboard or touch user can reach.
 *
 * All three calls will 404 against the currently-pinned stapel-auth release —
 * this component is ready for the day the pin bumps to a commit that has
 * them, not a claim that it works against today's released contract.
 */
import { spacing, fontSize } from "@stapel/tokens";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Avatar, Button, Card, Empty, Flex, Popconfirm, Spin, Tag, Typography } from "antd";
import { ErrorAlert } from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  bothLoaded,
  loadStateFromQuery,
  mapLoad,
  matchList,
  useActionGate,
  useErrorDisplay,
  useFormatFlowError,
  useT,
} from "@stapel/core";
import type { Capabilities, LinkedOAuthAccount } from "../../api/types.js";
import { useLinkOAuth, useUnlinkOAuth } from "../../model/mutations.js";
import { useCapabilities, useOAuthLinks } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityEmptyIcon } from "./icons.js";

export interface OAuthLinksProps {
  /** Runs the provider's OAuth SDK/popup and resolves the resulting
   * `access_token` — see the module doc. Omit to disable "Connect". */
  readonly getAccessToken?: (providerId: string) => Promise<string>;
  /** Override the empty-state glyph (canon default: a plain shield outline,
   * matching the `icon_svg` auth-contract's aesthetic — see `./icons.tsx`). */
  readonly emptyIcon?: ReactNode;
}

type OAuthProvider = Capabilities["registration"]["oauth"][number];

/** Full connected-accounts screen: real read + unlink; link needs `getAccessToken`. */
export function OAuthLinks(props: OAuthLinksProps): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const errorDisplay = useErrorDisplay(AUTH_I18N_KEYS.unknownError);
  const caps = useCapabilities();
  const links = useOAuthLinks();
  const link = useLinkOAuth();
  const unlink = useUnlinkOAuth();
  const [pending, setPending] = useState<string | null>(null);

  // Both reads or nothing: a provider row rendered without its links answer
  // would show "not connected" for an account that IS connected, which is the
  // same lie as an empty list standing in for a failed one.
  const rows = mapLoad(
    bothLoaded(
      mapLoad(loadStateFromQuery(caps), (c) => c.registration.oauth),
      loadStateFromQuery(links)
    ),
    ([providers, linked]): readonly { provider: OAuthProvider; link: LinkedOAuthAccount | undefined }[] =>
      providers.map((provider) => ({
        provider,
        link: linked.find((l) => l.provider === provider.id),
      }))
  );

  // "Connect" needs a host-supplied token getter; when there is none the
  // button is off AND says so in text next to it — a disabled button gets no
  // pointer events, so a tooltip would be a reason nobody can read.
  const connectGate = useActionGate(
    props.getAccessToken ? actionAvailable() : actionBlocked(AUTH_I18N_KEYS.secOauthLinkUnavailable)
  );

  async function handleConnect(providerId: string): Promise<void> {
    if (!props.getAccessToken) return;
    setPending(providerId);
    try {
      const accessToken = await props.getAccessToken(providerId);
      link.mutate(
        { provider: providerId, accessToken },
        { onSettled: () => setPending(null) }
      );
    } catch {
      setPending(null);
    }
  }

  return (
    <Card title={t(AUTH_I18N_KEYS.secOauthTitle)} data-testid="oauth-links" style={{ width: "100%" }}>
      {matchList(rows, {
        loading: () => <Spin />,
        failed: (error) => (
          <ErrorAlert
            error={errorDisplay(error)}
            onRetry={() => {
              void caps.refetch();
              void links.refetch();
            }}
          />
        ),
        empty: () => (
          <Empty
            image={props.emptyIcon ?? <SecurityEmptyIcon />}
            description={t(AUTH_I18N_KEYS.secOauthEmpty)}
          />
        ),
        ready: (list) => (
          <Flex vertical gap="middle">
            {list.map(({ provider: p, link: linked }) => (
              <Flex key={p.id} justify="space-between" align="center">
                <Flex gap="small" align="center">
                  <Avatar size="small">{p.name.slice(0, 1).toUpperCase()}</Avatar>
                  <Typography.Text strong>{p.name}</Typography.Text>
                  {linked && <Tag color="green">{t(AUTH_I18N_KEYS.secOauthLinked)}</Tag>}
                </Flex>
                {linked ? (
                  <Popconfirm
                    title={t(AUTH_I18N_KEYS.secOauthUnlinkConfirmTitle)}
                    onConfirm={() => unlink.mutate(p.id)}
                    okText={t(AUTH_I18N_KEYS.secOauthUnlink)}
                    okButtonProps={{
                      danger: true,
                      loading: unlink.isPending && unlink.variables === p.id,
                    }}
                  >
                    <Button type="link" danger data-analytics="flow">
                      {t(AUTH_I18N_KEYS.secOauthUnlink)}
                    </Button>
                  </Popconfirm>
                ) : (
                  <Flex vertical align="flex-end" gap={spacing[1]}>
                    <Button
                      disabled={connectGate.disabled}
                      loading={pending === p.id}
                      onClick={() => void handleConnect(p.id)}
                      data-analytics="flow"
                    >
                      {t(AUTH_I18N_KEYS.secOauthLink)}
                    </Button>
                    {connectGate.reason && (
                      <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
                        {connectGate.reason}
                      </Typography.Text>
                    )}
                  </Flex>
                )}
              </Flex>
            ))}
          </Flex>
        ),
      })}

      {link.isError && <Alert type="error" showIcon message={formatError({
        code: link.error.code,
        params: link.error.params,
        status: link.error.status,
        message: link.error.message,
        language: link.error.language,
      })} />}
      {unlink.isError && <Alert type="error" showIcon message={formatError({
        code: unlink.error.code,
        params: unlink.error.params,
        status: unlink.error.status,
        message: unlink.error.message,
        language: unlink.error.language,
      })} />}
    </Card>
  );
}
