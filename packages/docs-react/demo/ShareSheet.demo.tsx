/**
 * The share axis, headless. Unlike every other demo in this package, this one
 * does NOT render `src/default/` — the pair deliberately ships no share SKIN:
 * the product sheet is `@stapel/drive-react/default`'s, and a second one here
 * would be the duplicated-surface defect that package exists to avoid. What is
 * drawn below is the BAG, in plain markup, so the states a skin must handle
 * (a suspended row, a refused capability, a refused mint) are visible.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { DOCS_SHARE_ERROR_CODES, ShareSheet } from "../src/index.js";
import type { ShareSheetBag } from "../src/index.js";
import { DOCS_I18N_KEYS } from "../src/i18n/keys.js";
import { DocsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DOC_NOTES,
  GRANT_REF,
  GRANT_SUSPENDED,
  GRANT_USER,
  LINK_ACTIVE,
  LINK_REDEEMED,
  LINK_SUSPENDED,
} from "./fixtures.js";

const BOTH: DemoHandlers = {
  "/access": [GRANT_USER, GRANT_REF],
  "/links": [LINK_ACTIVE, LINK_REDEEMED],
};

const LINKS_ONLY: DemoHandlers = {
  // 403 on the whitelist listing IS the capability answer: this caller may
  // mint links but may not administer the people list.
  "/access": [403, { localizable_error: "error.403.forbidden" }],
  "/links": [LINK_ACTIVE],
};

const SUSPENDED: DemoHandlers = {
  "/access": [GRANT_SUSPENDED],
  "/links": [LINK_SUSPENDED],
};

const MINT_REFUSED: DemoHandlers = {
  "/access": [],
  "GET /links": [],
  // The mint is refused for asking above LINK.MAX_LEVEL. The listing still
  // works — which is the whole point of routing by method here.
  "POST /links": [400, { localizable_error: "error.400.docs_share_level" }],
};

/** Plain rendering of the bag — the states, named, with nothing invented. */
function Sheet(props: { bag: ShareSheetBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  return (
    <section data-testid="docs-share-sheet">
      <h3>{t(DOCS_I18N_KEYS.shareTitle)}</h3>

      <h4>{t(DOCS_I18N_KEYS.sharePeopleSection)}</h4>
      {!bag.canGrantAccess && <p>{t(DOCS_I18N_KEYS.shareUnavailable)}</p>}
      {bag.canGrantAccess && bag.grants.status === "loading" && (
        <p>{t(DOCS_I18N_KEYS.shareLoading)}</p>
      )}
      {bag.grants.status === "ready" && bag.grants.data.length === 0 && (
        <p>{t(DOCS_I18N_KEYS.sharePeopleEmpty)}</p>
      )}
      {bag.grants.status === "ready" && (
        <ul>
          {bag.grants.data.map((grant) => (
            <li key={grant.id} data-docs-grant-suspended={String(grant.suspended === true)}>
              {grant.subject}
              {" · "}
              {t(
                grant.level === "edit"
                  ? DOCS_I18N_KEYS.shareLevelEdit
                  : DOCS_I18N_KEYS.shareLevelView
              )}
              {grant.suspended === true && ` · ${t(DOCS_I18N_KEYS.shareSuspended)}`}
              <button
                type="button"
                data-analytics="none"
                data-analytics-reason="headless demo; the host wraps its own share UI with tracked()"
                onClick={() => {
                  bag.revokeGrant(grant.id);
                }}
              >
                {t(DOCS_I18N_KEYS.shareRemovePerson)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4>{t(DOCS_I18N_KEYS.shareLinksSection)}</h4>
      {!bag.canMintLinks && <p>{t(DOCS_I18N_KEYS.shareUnavailable)}</p>}
      {bag.links.status === "ready" && bag.links.data.length === 0 && (
        <p>{t(DOCS_I18N_KEYS.shareLinksEmpty)}</p>
      )}
      {bag.links.status === "ready" && (
        <ul>
          {bag.links.data.map((link) => (
            <li key={link.id} data-docs-link-suspended={String(link.suspended === true)}>
              {link.token}
              {" · "}
              {t(
                link.first_redeemed_at === null || link.first_redeemed_at === undefined
                  ? DOCS_I18N_KEYS.shareNeverOpened
                  : DOCS_I18N_KEYS.shareFirstOpened
              )}
              {link.suspended === true && ` · ${t(DOCS_I18N_KEYS.shareSuspended)}`}
            </li>
          ))}
        </ul>
      )}
      {bag.linksSuspended && <p>{t(DOCS_I18N_KEYS.shareSuspendedHint)}</p>}
      <button
        type="button"
        data-testid="docs-share-mint"
        data-analytics="none"
        data-analytics-reason="headless demo; the host wraps its own share UI with tracked()"
        onClick={() => {
          bag.mintLink("edit");
        }}
      >
        {t(DOCS_I18N_KEYS.shareMintLink)}
      </button>
      {bag.levelRefused && <p>{t(DOCS_SHARE_ERROR_CODES.level)}</p>}
      {bag.modeDisabled && <p>{t(DOCS_SHARE_ERROR_CODES.modeDisabled)}</p>}
    </section>
  );
}

function Demo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <ShareSheet documentId={DOC_NOTES.id}>
        {(bag) => <Sheet bag={bag} />}
      </ShareSheet>
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.share-sheet",
  title: "Share sheet (headless)",
  description:
    "The two halves of the share axis in one bag: the whitelist and the bearer links, each with its own capability answer and its own suspended-by-configuration state. Two properties survive re-skinning. A 403 on a listing IS the capability — both endpoints are the gates, so the pair never invents a second source for 'may this person share'. And a suspended row is SHOWN, never filtered: the kill switch is a display state, and an operator who cannot see an inert grant believes it was revoked.",
  component: ShareSheet,
  variants: {
    default: {
      viewport: "phone",
      step: "people+links",
      description:
        "Both halves live: two grants (one a user, one a resolver-backed group reference) and two links, one of which somebody has already opened.",
      render: () => <Demo handlers={BOTH} />,
    },
    linksOnly: {
      viewport: "phone",
      step: "links-only",
      description:
        "The whitelist listing answered 403 — this caller may mint links but may not administer people. The section is absent, not a dead form whose every submit is refused.",
      render: () => <Demo handlers={LINKS_ONLY} />,
    },
    suspended: {
      viewport: "phone",
      step: "suspended",
      description:
        "Both modes are switched off for this deployment. The rows stay listed and say so — hiding them would tell the admin the access was revoked, and re-enabling the mode would then restore access nobody expected.",
      render: () => <Demo handlers={SUSPENDED} />,
    },
    mintRefused: {
      viewport: "phone",
      step: "mint-refused",
      description:
        "The mint asked for `edit` and the deployment caps links at `view`: the refusal is rendered by its own code rather than as 'something went wrong', because the remedy — mint one level lower — is specific to it. The cap itself cannot be known before the attempt; stapel-docs 0.6.1 publishes no endpoint that states LINK.MAX_LEVEL.",
      render: () => <Demo handlers={MINT_REFUSED} />,
    },
  },
});
