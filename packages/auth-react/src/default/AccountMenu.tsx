/**
 * `<AccountMenu/>` — the account control at the trailing edge of a top bar.
 *
 * It is the pair's `auth.account_menu` embed (`src/nav/manifest.ts`): a shell
 * mounts it in `topbar.end` with no props of its own, and the scaffold passes
 * `onOpen` when the project routes the account section the embed `opens`.
 *
 * What it shows is read from the session, never fetched: the identity line is
 * the signed-in user's e-mail, else phone, else username — the handle the
 * person signed in with, so they can tell which account this tab is in.
 *
 * Signed out it renders NOTHING. The embed is declared `member`, so a correct
 * container never mounts it outside the gated shell; drawing a sign-in button
 * here instead would duplicate the login route's job inside a header.
 *
 * "Account" appears only when `onOpen` is given: an item that goes nowhere is
 * worse than a shorter menu. "Sign out" is always there — it is the one action
 * every account control must offer, and it needs no route.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Avatar, Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { useAuthSessionState } from "../model/context.js";
import { useLogout } from "../model/mutations.js";
import type { StapelUser } from "../api/types.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";

export interface AccountMenuProps {
  /** Open the account section. Without it the menu offers sign-out only. */
  readonly onOpen?: (() => void) | undefined;
  /** Called once the sign-out request settled (either way). A gated shell redirects on its own; this is for a host that
   * wants to land somewhere specific. */
  readonly onSignedOut?: (() => void) | undefined;
  /** Start with the menu open (a demo showing its items). */
  readonly defaultOpen?: boolean;
  /** Pin the theme side (a demo showing both). Defaults to the live mode. */
  readonly mode?: "light" | "dark";
}

/** The handle a person recognises their account by. */
export function accountIdentity(user: StapelUser): string {
  return user.email ?? user.phone ?? user.username;
}

export function AccountMenu(props: AccountMenuProps): ReactElement | null {
  const { user, status } = useAuthSessionState();
  if (status !== "authenticated" || user === null) return null;
  return (
    // `surface="bare"`: the bar is the host's; the wrapper brings the 44px
    // phone control floor, as for every top-bar control in the fleet.
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="bare"
      style={{ display: "inline-flex" }}
    >
      <AccountMenuControl {...props} identity={accountIdentity(user)} />
    </SkinTheme>
  );
}

const ITEM_IDENTITY = "identity";
const ITEM_OPEN = "open";
const ITEM_SIGN_OUT = "sign-out";

function AccountMenuControl(
  props: AccountMenuProps & { readonly identity: string }
): ReactElement {
  const t = useT();
  const logout = useLogout();
  const [open, setOpen] = useState(props.defaultOpen === true);
  const { onOpen, onSignedOut } = props;

  const items: MenuProps["items"] = [
    {
      key: ITEM_IDENTITY,
      label: props.identity,
      disabled: true,
      // An identity line, not an action: it says which account this is.
      title: props.identity,
    },
    { type: "divider" },
    ...(onOpen !== undefined
      ? [{ key: ITEM_OPEN, label: t(AUTH_I18N_KEYS.accountMenuOpen) }]
      : []),
    {
      key: ITEM_SIGN_OUT,
      label: t(AUTH_I18N_KEYS.accountMenuSignOut),
      disabled: logout.isPending,
      danger: true,
    },
  ];

  const onClick: MenuProps["onClick"] = ({ key }) => {
    setOpen(false);
    if (key === ITEM_OPEN) {
      onOpen?.();
      return;
    }
    if (key === ITEM_SIGN_OUT) {
      // `mutateAsync`, not `mutate`'s per-call callbacks: the session clears
      // before the request settles, this menu unmounts with it, and React
      // Query drops per-call callbacks of an unmounted observer.
      const done = (): void => onSignedOut?.();
      void logout.mutateAsync().then(done, done);
    }
  };

  return (
    <Dropdown
      trigger={["click"]}
      open={open}
      onOpenChange={setOpen}
      menu={{ items, onClick }}
      placement="bottomRight"
    >
      <Button
        type="text"
        shape="circle"
        aria-label={t(AUTH_I18N_KEYS.accountMenuLabelNamed, { name: props.identity })}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="account-menu"
        data-analytics="none"
        data-analytics-reason="opens a menu — its items are navigation and sign-out, which the host wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      >
        <Avatar size="small" aria-hidden="true">
          {props.identity.slice(0, 1).toUpperCase()}
        </Avatar>
      </Button>
    </Dropdown>
  );
}
