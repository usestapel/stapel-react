/**
 * `<SellerPage/>` — a public seller page that is a PERSON with sections, not
 * one filtered list.
 *
 * The composition walk's §30(a) finding, in its own words: `/u/<id>` was
 * "functionally a pre-filtered search results page scoped to one seller". The
 * identity block closed the first half of that — there is a name, a face and
 * a tenure over the grid now. This closes the second: the reference's seller
 * page is three sections (overview / listings / reviews) and ours had exactly
 * one, so a buyer who wanted to read what other buyers said had nowhere to go
 * and a seller who wrote an "about" had nowhere for it to appear.
 *
 * ── What this component is, and what it deliberately is not ───────────────
 *
 * It is the seller page's SKELETON: the identity above, the section bar, and
 * the section bodies under it. Every body is a `ReactNode` the host hands in,
 * because the three sections belong to three different pairs — the inventory
 * is `@stapel/search-react` or `@stapel/listings-react`, the reviews are
 * `@stapel/reviews-react`'s `<ReviewsPanel>`, and the introduction is
 * whatever the deployment has to say. A component that reached for those
 * itself would make this pair depend on three others to draw a tab strip.
 *
 * It is NOT a router. `activeTab` / `onTabChange` is the same contract
 * `<PublicProfilePage userId>` uses: this pair carries no router, so the
 * host binds the URL and this draws what the host says is showing. The
 * router's half is data, not skin — {@link resolveSellerTab} and
 * {@link sellerTabPath} in the main entry, so a route file never imports antd
 * to decide what `/u/<id>/reviews` means.
 *
 * ── Uncontrolled is a real mode, not a fallback ───────────────────────────
 *
 * A host with no router (a demo, a drawer, a preview) passes no `activeTab`
 * and the component keeps the section in state. A host WITH a router passes
 * one and gets it back through `onTabChange`. Both work, and the second never
 * silently becomes the first: when `activeTab` is given it wins on every
 * render, so a host that forgets to write the URL sees a tab that does not
 * move rather than a page whose address lies about what is on screen.
 *
 * ── Keyboard ──────────────────────────────────────────────────────────────
 *
 * antd's `Tabs` is the fleet's tab strip (`listings-react`'s `MyListingsPane`,
 * `drive-react`'s `DriveScreen`) and it carries the ARIA tab pattern —
 * `role="tablist"` with one stop in the tab order, arrow keys between tabs,
 * `Home`/`End` to the ends, `aria-selected` and `aria-controls` on each tab.
 * `test/sellerPage.test.tsx` asserts the arrow-key walk rather than trusting
 * it, because "we used the accessible library" is exactly the kind of green
 * that proves nothing.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Flex, Tabs } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  SELLER_TAB,
  resolveSellerTab,
} from "../model/sellerTabs.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

/** The word this pair ships for each of the three named sections. A host's
 * own `label` always wins; a section key this pair has no word for renders
 * the key, which is the honest bottom of the fleet's label ladder. */
const TAB_LABEL_KEY: Readonly<Record<string, string>> = {
  [SELLER_TAB.overview]: PROFILES_I18N_KEYS.sellerTabOverview,
  [SELLER_TAB.listings]: PROFILES_I18N_KEYS.sellerTabListings,
  [SELLER_TAB.reviews]: PROFILES_I18N_KEYS.sellerTabReviews,
};

/** The word on a tab: this pair's, for a section it named, and otherwise the
 * key itself — the honest bottom of the fleet's label ladder, the same rule
 * `sellerTypeLabel` follows. */
function tabLabel(t: (key: string) => string, key: string): string {
  const i18nKey = TAB_LABEL_KEY[key];
  return i18nKey === undefined ? key : t(i18nKey);
}

/** One section of a seller page. */
export interface SellerPageTab {
  /** The section's key — the value that travels in the URL. `SELLER_TAB`'s
   * three are the named ones; a deployment with a fourth section passes its
   * own string and supplies its own `label`. */
  readonly key: string;
  /** The word on the tab. Omitted, this pair's word for a named section. */
  readonly label?: ReactNode;
  /** What the section shows. Mounted when the section is first opened and
   * kept mounted after — a buyer flipping back to the inventory must not pay
   * for the search again. */
  readonly content: ReactNode;
  /** Switch the section off while keeping its place — e.g. a reviews tab on
   * a deployment that has not enabled reviews. */
  readonly disabled?: boolean;
}

export interface SellerPageProps {
  /**
   * WHO THIS IS — drawn above the sections, unchanged by them.
   *
   * A `ReactNode` rather than a `userId`, because the seller's header is a
   * composite on every real storefront: this pair's profile read gives the
   * name, the avatar and the tenure, `@stapel/reviews-react`'s owner roll-up
   * gives the rating, and the listing count comes off the host's own search.
   * `<PublicProfilePage userId>` is the ready-made one for a host that has no
   * composite of its own.
   */
  readonly identity: ReactNode;
  /** The sections, in the order they are drawn. */
  readonly tabs: readonly SellerPageTab[];
  /** The section showing, read off the URL by the host. Omitted, the
   * component keeps the section itself — see the header. */
  readonly activeTab?: string;
  /** Which section an uncontrolled page opens on. Defaults to
   * `SELLER_DEFAULT_TAB` (the inventory) when the page has it. */
  readonly defaultTab?: string;
  /** A section was chosen. A routed host writes the URL here; the key is
   * always one of `tabs`. */
  onTabChange?(key: string): void;
  /** Pin a side; omitted, the skin follows the document's LIVE `data-theme`. */
  readonly mode?: ThemeMode;
  /** The page's `data-testid`. */
  readonly testId?: string;
}

export function SellerPage(props: SellerPageProps): ReactElement {
  const t = useT();
  const keys = props.tabs.map((tab) => tab.key);
  // The uncontrolled section. Seeded through the same resolver the controlled
  // arm uses, so a `defaultTab` naming a section this page does not have lands
  // on the fallback instead of selecting nothing.
  const [ownTab, setOwnTab] = useState(() =>
    resolveSellerTab(props.defaultTab, keys)
  );
  const active = resolveSellerTab(
    props.activeTab !== undefined ? props.activeTab : ownTab,
    keys
  );
  const testId = props.testId ?? "seller-page";

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      data-testid={testId}
    >
      <Flex vertical gap={spacing[5]}>
        {/* The identity is OUTSIDE the tab strip on purpose: it is the one
            thing every section is about, and a name that disappeared when a
            buyer opened the reviews would be the §30(a) defect wearing a tab
            bar. */}
        {props.identity}
        <Tabs
          activeKey={active}
          data-testid={`${testId}-tabs`}
          onChange={(key) => {
            // Both arms always. A controlled host's `activeTab` wins on the
            // next render anyway, so keeping the internal value in step costs
            // nothing and means a host that switches between the two modes
            // never lands on a stale section.
            setOwnTab(key);
            props.onTabChange?.(key);
          }}
          items={props.tabs.map((tab) => ({
            key: tab.key,
            label: tab.label ?? tabLabel(t, tab.key),
            ...(tab.disabled !== undefined ? { disabled: tab.disabled } : {}),
            children: (
              <div data-testid={`${testId}-section-${tab.key}`}>
                {tab.content}
              </div>
            ),
          }))}
        />
      </Flex>
    </SkinTheme>
  );
}
