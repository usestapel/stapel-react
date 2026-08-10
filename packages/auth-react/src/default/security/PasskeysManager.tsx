/**
 * `<PasskeysManager/>` — default skin for the security-settings passkeys
 * screen (owner directive point 5; auth-sa.md §17). List + remove use the
 * pair's existing `usePasskeys`/`useRemovePasskey` hooks; adding one uses the
 * existing `PasskeyRegistration` headless flow. No new backend surface.
 *
 * INTERACTION CANON — passkey = direct trigger, NEVER a modal (owner
 * directive 2026-07-17, folded into frontend-guidelines.md §8): the
 * browser's own WebAuthn prompt IS the UI. Clicking "Add a passkey" begins
 * the ceremony immediately (no name-entry dialog gating it first) — the
 * same rule the sign-in `PasskeyPanel` already follows
 * (`bag.begin()` straight off the button click). A generic device name is
 * inferred from the user agent; renaming is a follow-up, not a blocker.
 *
 * WEBAUTHN (MODULE.md "WebAuthn binding", the same contract the sign-in
 * `PasskeyPanel` follows): `navigator.credentials.create()` runs on the
 * pair's built-in default binding, so the ceremony works with nothing
 * injected; `webauthnCreate` overrides it. Where the browser has no WebAuthn
 * API at all, `awaitingCredential` renders the honest "can't use passkeys
 * here" copy instead of guidance for a prompt that will never appear.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Button, Card, Empty, Flex, Popconfirm, Spin, Typography } from "antd";
import {
  loadStateFromQuery,
  matchList,
  useErrorDisplay,
  useFormatFlowError,
  useT,
} from "@stapel/core";
import type { Passkey } from "../../api/types.js";
import { PasskeyRegistration } from "../../headless/Passkey.js";
import type { PasskeyRegistrationBag, WebauthnBinding } from "../../headless/Passkey.js";
import { useRemovePasskey } from "../../model/mutations.js";
import { usePasskeys } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { isWebauthnSupported } from "../../webauthn.js";
import { ErrorAlert } from "../ErrorAlert.js";
import { SecurityEmptyIcon } from "./icons.js";

/** A generic device name inferred from the user agent — good enough for a
 * first-pass label; the ceremony is never gated on the user typing one. */
function inferDeviceName(): string {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android device";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Passkey";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

/** One passkey row: name + created/last-used + remove. */
function PasskeyRow(props: { passkey: Passkey; onRemove: () => void; removing: boolean }): ReactElement {
  const t = useT();
  const p = props.passkey;
  return (
    <Flex justify="space-between" align="center" style={{ width: "100%" }}>
      <Flex vertical gap={2}>
        <Typography.Text strong>{p.device_name}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(p.created_at)}
        </Typography.Text>
      </Flex>
      <Popconfirm
        title={t(AUTH_I18N_KEYS.secPasskeysRemoveConfirmTitle)}
        onConfirm={props.onRemove}
        okText={t(AUTH_I18N_KEYS.secPasskeysRemove)}
        okButtonProps={{ danger: true, loading: props.removing }}
      >
        <Button type="link" danger data-analytics="flow">
          {t(AUTH_I18N_KEYS.secPasskeysRemove)}
        </Button>
      </Popconfirm>
    </Flex>
  );
}

/** The add-passkey dialog's body, given the registration bag — a genuine
 * component (not hooks inlined in a render-prop lambda). */
function AddJourney(props: {
  bag: PasskeyRegistrationBag;
  deviceName: string;
  onDone: () => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const { bag, deviceName } = props;
  const s = bag.state;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    bag.begin(deviceName);
  }, [bag, deviceName]);

  if (s.step === "idle" || s.step === "beginning" || s.step === "completing") {
    return (
      <Flex justify="center">
        <Spin />
      </Flex>
    );
  }
  if (s.step === "error") {
    return <Alert type="error" showIcon message={formatError(s.error)} />;
  }
  if (s.step === "registered") {
    return (
      <Flex vertical gap="middle" align="center">
        <Typography.Text>{t(AUTH_I18N_KEYS.secPasskeysAddedSuccess)}</Typography.Text>
        <Button type="primary" onClick={props.onDone} data-analytics="flow">
          {t(AUTH_I18N_KEYS.uiSubmit)}
        </Button>
      </Flex>
    );
  }
  // awaitingCredential: normally the browser prompt is already up (default
  // binding) — guide the user to it. With no WebAuthn API in this browser
  // nothing will ever appear, so say THAT instead of waiting on a ghost.
  return (
    <Typography.Text type="secondary">
      {t(
        isWebauthnSupported()
          ? AUTH_I18N_KEYS.secPasskeysAwaitingCeremony
          : AUTH_I18N_KEYS.passkeyUnsupported
      )}
    </Typography.Text>
  );
}

export interface PasskeysManagerProps {
  /** Drives the `navigator.credentials.create()` ceremony automatically when
   * supplied (thin by design otherwise — see module doc). */
  readonly webauthnCreate?: WebauthnBinding;
  /** Override the empty-state glyph (canon default: a plain shield outline,
   * matching the `icon_svg` auth-contract's aesthetic — see `./icons.tsx`). */
  readonly emptyIcon?: ReactNode;
}

/** Full passkey security screen: list, remove, add (direct-trigger ceremony
 * — no modal, no name prompt; see the module doc's interaction canon). */
export function PasskeysManager(props: PasskeysManagerProps): ReactElement {
  const t = useT();
  // A failed passkey read must never read as "you have no passkeys" — on a
  // security screen that sentence invites the user to add a passkey they
  // already have, or to conclude their account is less protected than it is.
  const errorDisplay = useErrorDisplay(AUTH_I18N_KEYS.unknownError);
  const passkeys = usePasskeys();
  const remove = useRemovePasskey();
  const [adding, setAdding] = useState(false);

  const state = loadStateFromQuery(passkeys);

  return (
    <Card
      title={t(AUTH_I18N_KEYS.secPasskeysTitle)}
      data-testid="passkeys-manager"
      style={{ width: "100%" }}
      extra={
        <Button
          type="primary"
          disabled={adding}
          onClick={() => setAdding(true)}
          data-analytics="flow"
        >
          {t(AUTH_I18N_KEYS.secPasskeysAdd)}
        </Button>
      }
    >
      {matchList(state, {
        loading: () => <Spin />,
        failed: (error) => (
          <ErrorAlert error={errorDisplay(error)} onRetry={() => void passkeys.refetch()} />
        ),
        // The add ceremony below replaces the empty state while it runs.
        empty: () =>
          adding ? null : (
            <Empty
              image={props.emptyIcon ?? <SecurityEmptyIcon />}
              description={t(AUTH_I18N_KEYS.secPasskeysEmpty)}
            />
          ),
        ready: (list) => (
          <Flex vertical gap="middle">
            {list.map((p) => (
              <PasskeyRow
                key={p.id}
                passkey={p}
                onRemove={() => remove.mutate(p.id)}
                removing={remove.isPending && remove.variables === p.id}
              />
            ))}
          </Flex>
        ),
      })}

      {adding && (
        <PasskeyRegistration {...(props.webauthnCreate !== undefined ? { webauthnCreate: props.webauthnCreate } : {})}>
          {(bag) => (
            <AddJourney bag={bag} deviceName={inferDeviceName()} onDone={() => setAdding(false)} />
          )}
        </PasskeyRegistration>
      )}
    </Card>
  );
}
