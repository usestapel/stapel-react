/**
 * `<PrivacyRequestPane>` — the PUBLIC data-protection request page, the one
 * screen in this pair a stranger can reach.
 *
 * ── Why it is its own component and not a prop ────────────────────────────
 *
 * `<DsarForm variant="anonymous"/>` has existed since 0.1.0 and had no page.
 * The nav contract mounts a named export with NO props (`component.export` in
 * `nav/manifest.ts`), so a form that only exists behind `variant="anonymous"`
 * is a form the scaffold cannot route to — which is how a legally required
 * intake ended up documented as "a host responsibility" with no route, no
 * example and no story. This is that route's component: prop-free by default,
 * and the thing `public.privacy-request` points at.
 *
 * ── It is a page, not a card ──────────────────────────────────────────────
 *
 * `surface="base"` (the layout background, not a raised card) because nothing
 * else is on this screen and it is very likely rendered outside the app shell
 * — a person who arrives here has no session, no menu and no chrome. It says
 * who it is for in the first line, since the visitor did not navigate here
 * from an account settings page and may have arrived from a privacy policy
 * link.
 *
 * ── The captcha is a SLOT, not a dependency ───────────────────────────────
 *
 * `POST /dsar` is `AllowAny` and requires a captcha token whenever the
 * deployment has a captcha backend configured. This package ships no captcha
 * and cannot know the provider, so the host renders its own challenge widget
 * into `captcha` and hands the token it produces to `captchaToken`. An
 * unfilled slot is a `SlotPlaceholder` — visible in a dev build, nothing in
 * production — so a deployment that HAS a captcha backend and forgot to wire
 * the widget finds out while building the page instead of when every public
 * submission starts answering `error.400.captcha_required`.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { SlotPlaceholder, useT } from "@stapel/core";
import type { DsarKind } from "../api/types.js";
import { GDPR_I18N_KEYS } from "../i18n/keys.js";
import { DsarForm } from "./DsarForm.js";
import type { ThemeModeProp } from "./types.js";

export interface PrivacyRequestPaneProps extends ThemeModeProp {
  /**
   * The host's captcha challenge widget. Rendered above the form; whatever it
   * produces is passed back through {@link PrivacyRequestPaneProps.captchaToken}.
   */
  readonly captcha?: ReactNode;
  /** The token that widget produced. Absent is legal — a deployment with no
   * captcha backend leaves the form open, and a client that required a token
   * would break that configuration. */
  readonly captchaToken?: string;
  /** Preselected kind, e.g. a "delete my data" link in a privacy policy. */
  readonly defaultKind?: DsarKind;
}

export function PrivacyRequestPane(
  props: PrivacyRequestPaneProps
): ReactElement {
  const t = useT();
  const { mode, captcha, captchaToken, defaultKind } = props;
  const modeProp = mode !== undefined ? { mode } : {};
  return (
    <SkinTheme {...modeProp} surface="base">
      <Flex vertical gap={spacing[4]} data-testid="gdpr-privacy-request">
        <Flex vertical gap={spacing[1]}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {t(GDPR_I18N_KEYS.publicHeading)}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t(GDPR_I18N_KEYS.publicExplain)}
          </Typography.Paragraph>
        </Flex>
        {captcha ?? <SlotPlaceholder name="captcha" />}
        <DsarForm
          variant="anonymous"
          {...modeProp}
          {...(captchaToken !== undefined ? { captchaToken } : {})}
          {...(defaultKind !== undefined ? { defaultKind } : {})}
        />
      </Flex>
    </SkinTheme>
  );
}
