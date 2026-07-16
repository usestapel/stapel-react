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
 *    disabled with an explanatory tooltip instead of silently doing nothing.
 *
 * All three calls will 404 against the currently-pinned stapel-auth release —
 * this component is ready for the day the pin bumps to a commit that has
 * them, not a claim that it works against today's released contract.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Avatar, Button, Empty, Flex, Popconfirm, Tag, Tooltip, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import { useLinkOAuth, useUnlinkOAuth } from "../../model/mutations.js";
import { useCapabilities, useOAuthLinks } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";

export interface OAuthLinksProps {
  /** Runs the provider's OAuth SDK/popup and resolves the resulting
   * `access_token` — see the module doc. Omit to disable "Connect". */
  readonly getAccessToken?: (providerId: string) => Promise<string>;
}

/** Full connected-accounts screen: real read + unlink; link needs `getAccessToken`. */
export function OAuthLinks(props: OAuthLinksProps): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const caps = useCapabilities();
  const links = useOAuthLinks();
  const link = useLinkOAuth();
  const unlink = useUnlinkOAuth();
  const [pending, setPending] = useState<string | null>(null);

  const providers = caps.data?.registration.oauth ?? [];
  const linkedByProvider = new Map((links.data ?? []).map((l) => [l.provider, l]));

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
    <Flex vertical gap="middle" style={{ width: "100%" }} data-testid="oauth-links">
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t(AUTH_I18N_KEYS.secOauthTitle)}
      </Typography.Title>

      {providers.length === 0 ? (
        <Empty description={t(AUTH_I18N_KEYS.secOauthEmpty)} />
      ) : (
        <Flex vertical gap="middle">
          {providers.map((p) => {
            const linked = linkedByProvider.get(p.id);
            const connectButton = (
              <Button
                disabled={!props.getAccessToken}
                loading={pending === p.id}
                onClick={() => void handleConnect(p.id)}
                data-analytics="flow"
              >
                {t(AUTH_I18N_KEYS.secOauthLink)}
              </Button>
            );
            return (
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
                ) : props.getAccessToken ? (
                  connectButton
                ) : (
                  <Tooltip title={t(AUTH_I18N_KEYS.secOauthLinkUnavailable)}>
                    <span>{connectButton}</span>
                  </Tooltip>
                )}
              </Flex>
            );
          })}
        </Flex>
      )}

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
    </Flex>
  );
}
