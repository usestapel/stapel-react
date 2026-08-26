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
 *    blocked and the reason is printed beside it (`GatedButton`) — a disabled
 *    button receives no pointer events, so a tooltip on it is a reason no
 *    keyboard or touch user can reach.
 *
 * All three calls will 404 against the currently-pinned stapel-auth release —
 * this component is ready for the day the pin bumps to a commit that has
 * them, not a claim that it works against today's released contract.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Avatar, Button, Card, Flex, Skeleton, Tag, Typography } from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  bothLoaded,
  loadStateFromQuery,
  mapLoad,
  matchList,
  useErrorDisplay,
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
  const errorDisplay = useErrorDisplay(AUTH_I18N_KEYS.unknownError);
  const caps = useCapabilities();
  const links = useOAuthLinks();
  const link = useLinkOAuth();
  const unlink = useUnlinkOAuth();
  const [pending, setPending] = useState<string | null>(null);
  // ONE confirm for the whole list, keyed by the provider waiting on it.
  const [unlinking, setUnlinking] = useState<OAuthProvider | null>(null);

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
  const connectGate = props.getAccessToken
    ? actionAvailable()
    : actionBlocked(AUTH_I18N_KEYS.secOauthLinkUnavailable);

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
    <SkinTheme surface="bare">
      <Card
        title={t(AUTH_I18N_KEYS.secOauthTitle)}
        data-testid="oauth-links"
        style={{ width: "100%" }}
      >
      {matchList(rows, {
        loading: () => (
          <div role="status" aria-busy="true" data-testid="oauth-loading">
            <Skeleton active />
          </div>
        ),
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
          <EmptyState
            icon={props.emptyIcon ?? <SecurityEmptyIcon />}
            title={t(AUTH_I18N_KEYS.secOauthEmpty)}
            hint={t(AUTH_I18N_KEYS.secOauthEmptyHint)}
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
                  /* `type="text"`, not a red outline: the danger weight lives
                     on the confirm, where the decision is taken. */
                  <Button
                    type="text"
                    danger
                    onClick={() => setUnlinking(p)}
                    aria-label={t(AUTH_I18N_KEYS.secOauthUnlinkLabel, { name: p.name })}
                    data-analytics="none"
                    data-analytics-reason="local-ui-open-unlink-confirm"
                  >
                    {t(AUTH_I18N_KEYS.secOauthUnlink)}
                  </Button>
                ) : (
                  <GatedButton
                    gate={connectGate}
                    testId={`oauth-connect-${p.id}`}
                    {...(pending === p.id ? { loading: true } : {})}
                    onClick={() => void handleConnect(p.id)}
                    data-analytics="flow"
                  >
                    {t(AUTH_I18N_KEYS.secOauthLink)}
                  </GatedButton>
                )}
              </Flex>
            ))}
          </Flex>
        ),
      })}

      <ErrorAlert thrown={link.error} />
      <ErrorAlert thrown={unlink.error} />

      {/* A popover anchored to a small link button is a desktop shape; this
          OK disconnects a sign-in route the person may be relying on. */}
      <SkinConfirm
        open={unlinking !== null}
        danger
        title={t(AUTH_I18N_KEYS.secOauthUnlinkConfirmTitle)}
        {...(unlinking !== null ? { body: unlinking.name } : {})}
        confirmLabel={t(AUTH_I18N_KEYS.secOauthUnlink)}
        confirming={unlink.isPending}
        data-testid="oauth-unlink-confirm"
        onConfirm={() => {
          const target = unlinking;
          if (target === null) return;
          unlink.mutate(target.id, { onSettled: () => setUnlinking(null) });
        }}
        onCancel={() => setUnlinking(null)}
      />
      </Card>
    </SkinTheme>
  );
}
