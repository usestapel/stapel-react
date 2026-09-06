/**
 * `<ShareAction>` — "share", the verb the storefront did not have.
 *
 * Measured by the owner on the live deployment (2026-09-06): **no share
 * control anywhere in the product.** Not a badly placed one, not one behind a
 * menu — none. The only way to send somebody a listing was the address bar,
 * which on a phone is the hardest thing on the screen to reach and which
 * carries the SERP's query string, the page anchor and whatever tracking
 * parameters the visitor arrived with.
 *
 * ── One control, two renderings, and the DEVICE picks ─────────────────────
 *
 * Where `navigator.share` exists — which is every phone and almost no desktop
 * — the press opens the PLATFORM's own sheet: the person's own apps, in their
 * own order, including the ones we have never heard of. A library that drew
 * its own list of four networks on a phone would be offering a worse version
 * of something the operating system already does better.
 *
 * Where it does not, the press opens a small menu: copy the link, and the
 * three networks a Russian-speaking marketplace actually receives traffic
 * from. This is the DESKTOP rendering, not a fallback for old browsers, which
 * is why it is built rather than apologised for.
 *
 * ── The menu is a Popover, and that is an exception with an argument ──────
 *
 * `stapel/no-tooltip-in-skin` bans `Popover` because of what a hover-triggered
 * one does: it hides text a touch device can never reveal, and it anchors that
 * text to a disabled control that swallows the events it needs. Neither
 * applies here and both are structurally impossible:
 *
 *  - the trigger is `"click"` ONLY — no hover arm at all, so a thumb and a
 *    cursor reach it by exactly the same gesture;
 *  - the anchor is a live, enabled, focusable button;
 *  - nothing is EXPLAINED in the overlay. It holds four controls. A menu is
 *    the shape this content has had since menus existed, and the alternative
 *    — four buttons standing permanently beside the title — is the "24 copies
 *    of one sentence" defect that `GateReasonPopover` was written to end,
 *    wearing a different hat.
 *
 * ── The word disappears on a phone; the NAME never does ───────────────────
 *
 * `aria-label` carries the verb in every arm and at every width. What the
 * media query drops is the painted word beside the glyph, because at 390px
 * the action row shares a line with a heart and a price. A screen reader
 * announces the same verb on both.
 *
 * ── Every outbound link is `noopener noreferrer` ──────────────────────────
 *
 * `target="_blank"` without `rel="noopener"` hands the opened page a live
 * `window.opener` handle to the storefront's tab, which is a one-line
 * navigation hijack; `noreferrer` keeps the visitor's exact listing URL out of
 * the network's referer log. Both, on all three, without exception.
 */
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Flex, Typography } from "antd";
// eslint-disable-next-line stapel/no-tooltip-in-skin -- a MENU, not a hover explanation: trigger is click-only (a thumb and a cursor use one gesture), the anchor is a live enabled button, and the overlay holds four controls rather than a sentence. See this file's header.
import { Popover } from "antd";
import { SkinButton as Button, ErrorAlert } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useShare } from "../headless/Share.js";
import type { ShareChannel, ShareNetwork } from "../headless/Share.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import {
  LISTING_ACTIONS_STYLE_HREF,
  LISTING_ACTION_CLASS,
  LISTING_ACTION_LABEL_CLASS,
  actionRowCss,
} from "./actionRow.js";
import { LinkIcon, ShareIcon } from "./icons.js";
import { useNotice } from "./notice.js";

/** Which sentence names each network row. */
const NETWORK_LABEL: Readonly<Record<ShareNetwork, string>> = {
  telegram: LISTINGS_I18N_KEYS.shareTelegram,
  whatsapp: LISTINGS_I18N_KEYS.shareWhatsapp,
  vk: LISTINGS_I18N_KEYS.shareVk,
};

export interface ShareActionProps {
  /**
   * The listing's CANONICAL address — the route the container built, absolute
   * or a path. Given, it is what every arm shares and `window.location` is
   * never consulted; see `useShare` for why that distinction is the whole
   * point of the prop.
   */
  readonly url?: string;
  /** The listing's title: the platform sheet's heading and the networks'
   * text. */
  readonly title?: string;
  /** A line under the title in the platform sheet — the price, typically. */
  readonly text?: string;
  /** Analytics, once per completed share. `"native"` never names the app the
   * person chose, because the platform sheet does not tell the page. */
  readonly onShared?: (channel: ShareChannel) => void;
  /** This surface's own test id, so a screen holding a card and a listing
   * page hands a test one element per name. Default `listings-share`. */
  readonly testId?: string;
  /**
   * `"circle"` for the glyph pinned to the corner of a photograph (no room
   * for a word, and the heart beside it is a circle); `"default"` (the
   * default) draws the word beside the glyph wherever the viewport has room
   * for it.
   */
  readonly shape?: "default" | "circle";
  readonly style?: CSSProperties;
}

export function ShareAction(props: ShareActionProps): ReactElement {
  const t = useT();
  const testId = props.testId ?? "listings-share";
  const [open, setOpen] = useState(false);
  const share = useShare({
    url: props.url,
    title: props.title,
    text: props.text,
    ...(props.onShared !== undefined ? { onShared: props.onShared } : {}),
  });
  const label = t(LISTINGS_I18N_KEYS.shareAction);
  const circle = props.shape === "circle";
  const notice = useNotice();
  const copied = share.copied;

  // The toast, and it is the AMPLIFIER of the sentence already standing in
  // the menu — never the only copy of it. See `notice.ts`.
  useEffect(() => {
    if (copied) notice(t(LISTINGS_I18N_KEYS.shareCopied));
  }, [copied, notice, t]);

  const onNetwork = useCallback(
    (channel: ShareNetwork): void => {
      share.report(channel);
      setOpen(false);
    },
    [share]
  );

  /**
   * The button itself.
   *
   * In the MENU arm it carries no `onClick` of its own: the `Popover` clones
   * its own click handler onto this child, and a second handler toggling the
   * same controlled state would open the menu and close it again inside one
   * gesture — the defect `GateReasonPopover` documents at length, reached
   * from the other direction.
   */
  const trigger = (
    <Button
      {...(circle ? { shape: "circle" as const } : {})}
      className={LISTING_ACTION_CLASS}
      aria-label={label}
      data-testid={testId}
      // WHICH ARM IS ON SCREEN, published rather than inferred. A walker
      // reading a live phone has no other way to tell a native sheet (which
      // opens outside the page and leaves no DOM behind) from a menu that
      // failed to open.
      data-share-mode={share.native ? "native" : "menu"}
      data-analytics="none"
      data-analytics-reason="business action — host app wraps with its own tracked()"
      icon={<ShareIcon />}
      {...(props.style !== undefined ? { style: props.style } : {})}
      {...(share.native ? { onClick: share.shareNatively } : {})}
    >
      {circle ? null : (
        <span className={LISTING_ACTION_LABEL_CLASS}>{label}</span>
      )}
    </Button>
  );

  const sheet = (
    <>
      <style href={LISTING_ACTIONS_STYLE_HREF} precedence="default">
        {actionRowCss()}
      </style>
      {trigger}
    </>
  );

  // The platform's own sheet: no overlay of ours, nothing to lay out.
  if (share.native) return sheet;

  const menu = (
    <Flex vertical gap={spacing[1]} data-testid={`${testId}-menu`}>
      <Button
        type="text"
        className={LISTING_ACTION_CLASS}
        icon={<LinkIcon />}
        data-testid={`${testId}-copy`}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
        onClick={share.copy}
      >
        {t(LISTINGS_I18N_KEYS.shareCopy)}
      </Button>

      {/* THE CONFIRMATION LIVES HERE, and the toast is the amplifier.
          A toast is transient and can land under a thumb; this sentence
          stands in the menu the person is looking at. `aria-live` because it
          appears without anything else changing that a screen reader would
          otherwise report. */}
      {share.copied ? (
        <Typography.Text
          type="success"
          aria-live="polite"
          data-testid={`${testId}-copied`}
        >
          {t(LISTINGS_I18N_KEYS.shareCopied)}
        </Typography.Text>
      ) : null}

      {/* A clipboard that refused — no permission, an insecure origin, a
          browser without the API. A person who pressed "copy" and pastes
          nothing has to be told the press did not work. */}
      {share.copyFailed ? (
        <ErrorAlert
          testId={`${testId}-copy-error`}
          message={t(LISTINGS_I18N_KEYS.shareCopyFailed)}
          variant="inline"
        />
      ) : null}

      {share.links.map((link) => (
        <a
          key={link.channel}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={LISTING_ACTION_CLASS}
          data-testid={`${testId}-${link.channel}`}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
          onClick={() => {
            onNetwork(link.channel);
          }}
        >
          {t(NETWORK_LABEL[link.channel])}
        </a>
      ))}
    </Flex>
  );

  return (
    <>
      <style href={LISTING_ACTIONS_STYLE_HREF} precedence="default">
        {actionRowCss()}
      </style>
      {/* eslint-disable-next-line stapel/no-tooltip-in-skin -- see the header: click-only trigger, live anchor, four controls in the overlay rather than an explanation */}
      <Popover
        trigger={["click"]}
        open={open}
        onOpenChange={setOpen}
        content={menu}
        data-testid={`${testId}-popover`}
      >
        {trigger}
      </Popover>
    </>
  );
}
