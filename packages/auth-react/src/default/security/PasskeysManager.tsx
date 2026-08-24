/**
 * `<PasskeysManager/>` — default skin for the security-settings passkeys
 * screen (owner directive point 5; auth-sa.md §17). List + remove use the
 * pair's existing `usePasskeys`/`useRemovePasskey` hooks; adding one uses the
 * existing `PasskeyRegistration` headless flow. No new backend surface.
 *
 * ## The row is about a CREDENTIAL, not about signing in
 *
 * Owner report, 2026-08-24: this screen showed "a name plus a green LOG IN
 * button" to a person who is, necessarily, already logged in. Two things had
 * gone wrong and both are fixed here:
 *
 *  - the success step of the add-journey reused `auth.ui.submit` for its
 *    dismiss button. That key is the SIGN-IN button's copy — its Russian
 *    translation is literally the word for "log in" — so finishing a passkey
 *    enrolment ended in a green button
 *    offering an action the viewer's state makes meaningless. It says
 *    `auth.sec.passkeys.done` now, which is what the button does;
 *  - the row said only a name and a date with no label. A credential-
 *    management row has to answer *what is this*, *when did it arrive*, *is it
 *    in use*, and *what can I do to it*. It now does: the device name, what
 *    the credential lives in (read from `transports[]`), when it was added,
 *    when it was last used — or, honestly, that it never has been — and the
 *    two actions that exist against the contract.
 *
 * **RENAME IS WRITTEN HERE AND SWITCHED OFF BY THE CONTRACT.** The pair's
 * whole passkey surface today is `GET /passkey/`, `POST /passkey/register/
 * {begin,complete}/` and `DELETE /passkey/{id}/`; `device_name` is writable
 * exactly once, at register-complete. A rename control against that is a
 * button that cannot do its job — the same defect as the LOG IN button one
 * paragraph up — so the affordance is NOT RENDERED rather than rendered
 * greyed out. `PASSKEY_RENAME_SUPPORTED` (src/api/authApi.ts) is a
 * compile-time tripwire on the generated contract: the regen that brings
 * `PATCH /passkey/{id}/` in fails the build at that one constant, it flips to
 * true, and this UI lights up with no further edit.
 *
 * INTERACTION CANON — passkey = direct trigger, NEVER a modal (owner
 * directive 2026-07-17, folded into frontend-guidelines.md §8): the
 * browser's own WebAuthn prompt IS the UI. Clicking "Add a passkey" begins
 * the ceremony immediately (no name-entry dialog gating it first) — the
 * same rule the sign-in surface follows, where clicking "Passkey" now raises
 * the system prompt straight away and shows a sheet only on failure.
 *
 * WEBAUTHN (MODULE.md "WebAuthn binding"):
 * `navigator.credentials.create()` runs on the pair's built-in default
 * binding, so the ceremony works with nothing injected; `webauthnCreate`
 * overrides it. Where the browser has no WebAuthn API at all, "Add" is
 * BLOCKED with its reason printed beside it — the screen already knew that
 * fact, and used to spend it only after the click, from inside a ceremony
 * that could never complete.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Spin,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  useT,
} from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { fontSize } from "@stapel/tokens";
import type { Passkey } from "../../api/types.js";
import { PASSKEY_RENAME_SUPPORTED } from "../../api/authApi.js";
import { PasskeyRegistration } from "../../headless/Passkey.js";
import type { PasskeyRegistrationBag, WebauthnBinding } from "../../headless/Passkey.js";
import { useRemovePasskey, useRenamePasskey } from "../../model/mutations.js";
import { usePasskeys } from "../../model/queries.js";
import { useAuthDateFormat } from "../../model/formatDate.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { isWebauthnSupported } from "../../webauthn.js";
import { SecurityEmptyIcon } from "./icons.js";
import { SecurityList, SecurityListRow } from "./SecurityListRow.js";

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

/**
 * WHAT this credential actually is, from the transports the authenticator
 * reported at registration. It is the one field on the contract that
 * distinguishes "the fingerprint reader in this laptop" from "the USB key in
 * my drawer" from "my phone, over Bluetooth" — three very different answers
 * to "can I use this passkey right now", and until now none of them was on
 * screen. Unknown transports (an authenticator that reported none) get the
 * neutral label rather than a guess.
 */
function kindKeyFor(transports: readonly string[]): string {
  if (transports.includes("internal")) return AUTH_I18N_KEYS.secPasskeysKindDevice;
  if (transports.includes("hybrid")) return AUTH_I18N_KEYS.secPasskeysKindPhone;
  if (
    transports.includes("usb") ||
    transports.includes("nfc") ||
    transports.includes("ble")
  ) {
    return AUTH_I18N_KEYS.secPasskeysKindSecurityKey;
  }
  return AUTH_I18N_KEYS.secPasskeysKindUnknown;
}

/**
 * One stored credential: what it is, when it arrived, whether it is in use,
 * and the actions the contract supports against it. The row shape is the
 * shared `SecurityListRow` — an explicit action slot instead of ad-hoc
 * flex-wrap, which is what produced two different geometries for two
 * identical rows at one phone width (visual pass C5).
 */
function PasskeyRow(props: {
  passkey: Passkey;
  onRemove: () => void;
  onRename: () => void;
}): ReactElement {
  const t = useT();
  const when = useAuthDateFormat();
  const p = props.passkey;
  return (
    <SecurityListRow
      data-testid="passkey-row"
      title={p.device_name}
      badges={<Tag data-testid="passkey-kind">{t(kindKeyFor(p.transports))}</Tag>}
      meta={
        <>
          <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
            {t(AUTH_I18N_KEYS.secPasskeysAddedOn, { date: when.date(p.created_at) })}
          </Typography.Text>
          {/* "Never used" is a real fact about a credential, and a useful one —
              it is how a person spots the key they enrolled and then lost. An
              empty line here would have said the same thing by saying nothing.
              The date is RELATIVE: "last used" is the one field people read as
              a duration, and `toLocaleDateString()` answered it in the
              BROWSER's locale rather than the app's. */}
          <Typography.Text
            type="secondary"
            style={{ fontSize: fontSize.xs.fontSize }}
            data-testid="passkey-last-used"
          >
            {p.last_used_at === null
              ? t(AUTH_I18N_KEYS.secPasskeysNeverUsed)
              : t(AUTH_I18N_KEYS.secPasskeysLastUsed, {
                  date: when.relative(p.last_used_at),
                })}
          </Typography.Text>
        </>
      }
      actions={
        <>
          {PASSKEY_RENAME_SUPPORTED && (
            <Button
              type="text"
              onClick={props.onRename}
              aria-label={t(AUTH_I18N_KEYS.secPasskeysRenameLabel, {
                name: p.device_name,
              })}
              data-analytics="none"
              data-analytics-reason="local-ui-open-rename-passkey"
            >
              {t(AUTH_I18N_KEYS.secPasskeysRename)}
            </Button>
          )}
          {/* `type="text"`, not a red outline: two outlined destructive
              buttons stacked were the loudest elements on a screen whose whole
              purpose is reassurance. The danger weight moves to the confirm,
              where the decision is actually taken. */}
          <Button
            type="text"
            danger
            onClick={props.onRemove}
            aria-label={t(AUTH_I18N_KEYS.secPasskeysRemoveLabel, {
              name: p.device_name,
            })}
            data-analytics="none"
            data-analytics-reason="local-ui-open-remove-passkey-confirm"
          >
            {t(AUTH_I18N_KEYS.secPasskeysRemove)}
          </Button>
        </>
      }
    />
  );
}

/** The add-passkey journey, given the registration bag — a genuine
 * component (not hooks inlined in a render-prop lambda). */
function AddJourney(props: {
  bag: PasskeyRegistrationBag;
  deviceName: string;
  onDone: () => void;
}): ReactElement {
  const t = useT();
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
      <Flex justify="center" role="status" aria-busy="true">
        <Spin />
      </Flex>
    );
  }
  if (s.step === "error") {
    // The message is now the CLASSIFIED one (`toPasskeyFlowError`): dismissed,
    // timed out, insecure origin, or "this authenticator already holds a
    // credential for you" — five sentences where there used to be one shrug.
    return (
      <Flex vertical gap="middle">
        <ErrorAlert thrown={s.error} />
        <Flex justify="end">
          <Button
            onClick={props.onDone}
            data-analytics="none"
            data-analytics-reason="local-ui-dismiss-add-passkey"
          >
            {t(AUTH_I18N_KEYS.secPasskeysDone)}
          </Button>
        </Flex>
      </Flex>
    );
  }
  if (s.step === "registered") {
    return (
      <Flex vertical gap="middle" align="center">
        <Typography.Text>{t(AUTH_I18N_KEYS.secPasskeysAddedSuccess)}</Typography.Text>
        {/* `secPasskeysDone`, NOT `uiSubmit`. `uiSubmit` is the SIGN-IN
            button's copy in every locale, and this button is pressed by
            someone who is already signed in — the exact control the owner
            called nonsense. */}
        <Button
          type="primary"
          onClick={props.onDone}
          data-analytics="none"
          data-analytics-reason="local-ui-dismiss-add-passkey"
        >
          {t(AUTH_I18N_KEYS.secPasskeysDone)}
        </Button>
      </Flex>
    );
  }
  // awaitingCredential: the browser prompt is already up (default binding) —
  // guide the user to it.
  return (
    <Typography.Text>{t(AUTH_I18N_KEYS.secPasskeysAwaitingCeremony)}</Typography.Text>
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

/** Full passkey security screen: list, rename (when the contract has it),
 * remove, add (direct-trigger ceremony — no modal, no name prompt; see the
 * module doc's interaction canon). */
export function PasskeysManager(props: PasskeysManagerProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const passkeys = usePasskeys();
  const remove = useRemovePasskey();
  const rename = useRenamePasskey();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const [renaming, setRenaming] = useState<Passkey | null>(null);
  // A browser with no WebAuthn will never raise a prompt, so "Add" cannot
  // work here. The screen has always known that — it just used to spend the
  // knowledge AFTER the click, inside a ceremony that hangs. The reason is
  // printed beside the button, never in a tooltip: a tooltip on a disabled
  // control is a reason nobody on a touch screen can read.
  //
  // An INJECTED binding overrides the browser one (a native bridge, a webview
  // host, a test), so "this browser has no WebAuthn" says nothing about
  // whether a ceremony can run — the gate has to ask both questions or it
  // switches off the very hosts the injection seam exists for.
  const canAdd = isWebauthnSupported() || props.webauthnCreate !== undefined;
  const addGate = canAdd
    ? actionAvailable()
    : actionBlocked(AUTH_I18N_KEYS.secPasskeysAddUnsupported);

  const state = loadStateFromQuery(passkeys);
  const hasAny = passkeys.data !== undefined && passkeys.data.length > 0;

  return (
    <SkinTheme surface="bare">
      <Card
        title={t(AUTH_I18N_KEYS.secPasskeysTitle)}
        data-testid="passkeys-manager"
        style={{ width: "100%" }}
        extra={
          <GatedButton
            gate={addGate}
            type="primary"
            testId="passkeys-add"
            onClick={() => setAdding(true)}
            {...(adding ? { loading: true } : {})}
            data-analytics="flow"
          >
            {/* "Add another" once there is one — the list right above already
                said what a passkey is, and the generic label reads as though
                the first one had not registered. */}
            {t(
              hasAny
                ? AUTH_I18N_KEYS.secPasskeysAddAnother
                : AUTH_I18N_KEYS.secPasskeysAdd
            )}
          </GatedButton>
        }
      >
        <LoadList
          state={state}
          testId="passkeys"
          onRetry={() => void passkeys.refetch()}
          empty={
            // The add ceremony replaces the empty state while it runs.
            adding ? (
              <Flex justify="center" role="status" aria-busy="true">
                <Spin />
              </Flex>
            ) : (
              <EmptyState
                icon={props.emptyIcon ?? <SecurityEmptyIcon />}
                title={t(AUTH_I18N_KEYS.secPasskeysEmpty)}
                hint={t(AUTH_I18N_KEYS.secPasskeysEmptyHint)}
                // The way out lives IN the empty state. It used to live only
                // in the card header, ~380px away across a dead zone, so the
                // one screen telling a person they had no passkey offered
                // them nothing to press about it (visual pass C7).
                action={
                  <GatedButton
                    gate={addGate}
                    type="primary"
                    testId="passkeys-add-empty"
                    onClick={() => setAdding(true)}
                    data-analytics="flow"
                  >
                    {t(AUTH_I18N_KEYS.secPasskeysAdd)}
                  </GatedButton>
                }
              />
            )
          }
        >
          {(list) => (
            <SecurityList ruleColor={token.colorBorderSecondary}>
              {list.map((p) => (
                <PasskeyRow
                  key={p.id}
                  passkey={p}
                  onRemove={() => setRemoving(p)}
                  onRename={() => setRenaming(p)}
                />
              ))}
            </SecurityList>
          )}
        </LoadList>

        <ErrorAlert thrown={remove.error} />
        <ErrorAlert thrown={rename.error} />

        {adding && (
          <PasskeyRegistration
            {...(props.webauthnCreate !== undefined
              ? { webauthnCreate: props.webauthnCreate }
              : {})}
          >
            {(bag) => (
              <AddJourney
                bag={bag}
                deviceName={inferDeviceName()}
                onDone={() => setAdding(false)}
              />
            )}
          </PasskeyRegistration>
        )}

        {/* ONE confirm for the whole list, keyed by the credential waiting on
            it — not one mounted dialog per row to show at most one. */}
        <SkinConfirm
          open={removing !== null}
          danger
          title={t(AUTH_I18N_KEYS.secPasskeysRemoveConfirmTitle)}
          {...(removing !== null ? { body: removing.device_name } : {})}
          confirmLabel={t(AUTH_I18N_KEYS.secPasskeysRemove)}
          confirming={remove.isPending}
          data-testid="passkey-remove-confirm"
          onConfirm={() => {
            const target = removing;
            if (target === null) return;
            remove.mutate(target.id, { onSettled: () => setRemoving(null) });
          }}
          onCancel={() => setRemoving(null)}
        />

        {PASSKEY_RENAME_SUPPORTED && (
          <SkinDialog
            open={renaming !== null}
            onClose={() => setRenaming(null)}
            title={t(AUTH_I18N_KEYS.secPasskeysRename)}
            dismissLabel={t(AUTH_I18N_KEYS.uiClose)}
            data-testid="passkey-rename-dialog"
          >
            <Form
              layout="vertical"
              initialValues={{ deviceName: renaming?.device_name ?? "" }}
              onFinish={(v: { deviceName?: string }) => {
                const target = renaming;
                if (target === null) return;
                rename.mutate(
                  { id: target.id, deviceName: v.deviceName ?? "" },
                  { onSettled: () => setRenaming(null) }
                );
              }}
            >
              <Form.Item
                name="deviceName"
                label={t(AUTH_I18N_KEYS.secPasskeysRenameField)}
              >
                <Input autoFocus />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={rename.isPending}
                data-analytics="flow"
              >
                {t(AUTH_I18N_KEYS.secPasskeysRenameSave)}
              </Button>
            </Form>
          </SkinDialog>
        )}
      </Card>
    </SkinTheme>
  );
}
