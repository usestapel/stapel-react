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
 * THIN WebAuthn (MODULE.md "Thin-WebAuthn TODO", the same honest scope the
 * sign-in `PasskeyPanel` follows): the single `navigator.credentials.create()`
 * browser step is NOT performed here unless the host supplies `webauthnCreate`
 * — without it, `awaitingCredential` renders guidance copy instead of silently
 * hanging.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Button, Card, Empty, Flex, Popconfirm, Spin, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { Passkey } from "../../api/types.js";
import { PasskeyRegistration } from "../../headless/Passkey.js";
import type { PasskeyRegistrationBag, WebauthnBinding } from "../../headless/Passkey.js";
import { useRemovePasskey } from "../../model/mutations.js";
import { usePasskeys } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
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
  // awaitingCredential: no webauthnCreate binding was supplied to drive the
  // browser ceremony automatically — thin by design (see module doc).
  return <Typography.Text type="secondary">{t(AUTH_I18N_KEYS.secPasskeysAwaitingCeremony)}</Typography.Text>;
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
  const passkeys = usePasskeys();
  const remove = useRemovePasskey();
  const [adding, setAdding] = useState(false);

  const list = passkeys.data ?? [];

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
      {passkeys.isLoading ? (
        <Spin />
      ) : list.length === 0 && !adding ? (
        <Empty
          image={props.emptyIcon ?? <SecurityEmptyIcon />}
          description={t(AUTH_I18N_KEYS.secPasskeysEmpty)}
        />
      ) : (
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
      )}

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
