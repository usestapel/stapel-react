/**
 * `<SiteLegalFooter/>` — the legal line of whichever brand this HOST is.
 *
 * The company that operates northgate.test is not the company that operates
 * southgate.test, and the support mailbox differs too. Both facts arrive on the
 * wire in `brand.legal` (multibrand spec §3.1), so the footer that states
 * them is a reader of `useSite()`, not a literal in the container.
 *
 * WHICH keys `brand.legal` may carry is open (a deployment adding an OGRN
 * line must not need a library release), so this renders the four the fleet
 * ships — `company`, `support_email`, `privacy_url`, `terms_url` — and
 * ignores the rest rather than guessing a label for a key it has never seen.
 * The `children` slot is where a host puts its own footer nodes (the ranking
 * disclosure, an app-store badge) beside them.
 *
 * The three link WORDS are the shell's own copy (`shell.legal.*`); every
 * other string on this line comes off the wire. That split is deliberate: a
 * translation belongs to whoever can translate it, and the shell cannot
 * translate a company name.
 */
import type { ReactElement, ReactNode } from "react";
import { theme } from "antd";
import { useSite, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import { SHELL_I18N_KEYS } from "../i18n/keys.js";

export interface SiteLegalFooterProps {
  /** The host's own footer nodes, rendered after the legal line. */
  readonly children?: ReactNode;
}

/** The current host's legal line: company, support mailbox, privacy, terms. */
export function SiteLegalFooter(props: SiteLegalFooterProps): ReactElement | null {
  const site = useSite();
  const t = useT();
  const { token } = theme.useToken();
  const legal = site.brand?.legal ?? {};

  const company = legal.company;
  const supportEmail = legal.support_email;
  const privacyUrl = legal.privacy_url;
  const termsUrl = legal.terms_url;

  const hasLegal =
    company !== undefined ||
    supportEmail !== undefined ||
    privacyUrl !== undefined ||
    termsUrl !== undefined;
  // Nothing to state and nothing to add: no empty rule across the bottom of
  // the page.
  if (!hasLegal && props.children === undefined) return null;

  return (
    <div
      data-testid="site-legal-footer"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: `${String(spacing[2])}px ${String(spacing[4])}px`,
        color: token.colorTextSecondary,
        fontSize: token.fontSizeSM,
      }}
    >
      {company !== undefined && <span data-testid="site-legal-company">{company}</span>}
      {supportEmail !== undefined && (
        <span>
          {t(SHELL_I18N_KEYS.legalSupport)}:{" "}
          {/* The address itself is the link text: a footer is also where a
              person copies it, and "Support" alone hides it behind a mailto:
              that only opens in a mail client they may not have. */}
          <a href={`mailto:${supportEmail}`} data-testid="site-legal-support">
            {supportEmail}
          </a>
        </span>
      )}
      {privacyUrl !== undefined && (
        <a href={privacyUrl} data-testid="site-legal-privacy">
          {t(SHELL_I18N_KEYS.legalPrivacy)}
        </a>
      )}
      {termsUrl !== undefined && (
        <a href={termsUrl} data-testid="site-legal-terms">
          {t(SHELL_I18N_KEYS.legalTerms)}
        </a>
      )}
      {props.children}
    </div>
  );
}
