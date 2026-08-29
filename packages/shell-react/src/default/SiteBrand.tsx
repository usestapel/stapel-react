/**
 * `<SiteBrand/>` — the wordmark of whichever brand this HOST is, read off
 * `@stapel/core`'s `useSite()` rather than baked into the container.
 *
 * A storefront that serves two domains from one image (multibrand spec, frontend decision)
 * used to hand `<PublicShell brand={…}/>` a literal: a `<title>` from
 * `index.html`, a wordmark from `src/meta.ts`, an i18n key called
 * `storefront.brand`. All three are build-time facts, and a second domain
 * makes every one of them wrong on half the traffic. This component is the
 * same slot filled from the runtime answer instead — logo, name, and the
 * link home, which is the whole of what a brand slot is.
 *
 * The image is `alt=""` on purpose: the brand's name is rendered as text
 * right beside it, so a non-empty alt would make a screen reader say the
 * name twice. A brand with no `logo` is a text wordmark, which is exactly
 * what `southgate` shipped as before this existed.
 */
import type { ReactElement, ReactNode } from "react";
import { theme } from "antd";
import { Link } from "react-router";
import { useSite } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import { fontWeight, spacing } from "@stapel/tokens-antd";

/** How tall the logo is allowed to be inside a `PublicShell` header row. */
const LOGO_HEIGHT = spacing[5];

export interface SiteBrandProps {
  /**
   * The host's `<Link>` (core's router-agnostic {@link LinkComponent} seam).
   * Omitted, the react-router `<Link>` this entry point already depends on is
   * used — `@stapel/shell-react/default` IS the react-router skin, so a
   * default that navigates inside the SPA is the honest one. The prop exists
   * for a host on another router that still wants this chrome.
   */
  readonly linkComponent?: LinkComponent;
  /** Where the wordmark leads. Default `/`. */
  readonly homeHref?: string;
}

/** The brand of the current host: logo, name, and a link home. */
export function SiteBrand(props: SiteBrandProps): ReactElement | null {
  const site = useSite();
  const { token } = theme.useToken();
  const brand = site.brand;
  // No registry, no brand — and an empty link where the wordmark goes is a
  // click target that says nothing. The host's own `brand` slot (or nothing)
  // is the right answer there; see `<PublicShell/>`, which does not render
  // this component at all in that case.
  if (brand === null) return null;

  const homeHref = props.homeHref ?? "/";
  const content: ReactNode = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing[2],
        minWidth: 0,
        color: token.colorText,
      }}
    >
      {brand.logo !== "" && (
        <img
          src={brand.logo}
          alt=""
          data-testid="site-brand-logo"
          style={{ height: LOGO_HEIGHT, width: "auto", display: "block" }}
        />
      )}
      <span
        style={{
          fontWeight: fontWeight.semibold,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {brand.name}
      </span>
    </span>
  );

  const HostLink = props.linkComponent;
  if (HostLink !== undefined) {
    return (
      <HostLink href={homeHref} data-testid="site-brand">
        {content}
      </HostLink>
    );
  }
  return (
    <Link to={homeHref} data-testid="site-brand">
      {content}
    </Link>
  );
}
