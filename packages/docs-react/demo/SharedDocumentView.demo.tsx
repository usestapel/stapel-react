/**
 * The bearer's page, headless. The ROUTE is host composition — its URL shape
 * and its chrome are a customer's decision — so this package ships the seam
 * and draws it here in plain markup rather than shipping a page nobody asked
 * for.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { SharedDocumentView } from "../src/index.js";
import type { SharedDocumentViewBag } from "../src/index.js";
import { DOCS_I18N_KEYS } from "../src/i18n/keys.js";
import { DocsDemoHarness, textBody } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { MARKDOWN_BODY, SHARED_NOTES } from "./fixtures.js";

const TOKEN = "0xk3nEXAMPLEtoken";

const LIVE: DemoHandlers = {
  [`/shared/${TOKEN}/content`]: textBody(MARKDOWN_BODY, 7, "text/markdown"),
  [`/shared/${TOKEN}`]: SHARED_NOTES,
};

/** Expired, revoked and never-existed all answer 404 on purpose. */
const DEAD: DemoHandlers = {
  [`/shared/${TOKEN}`]: [404, { localizable_error: "error.404.docs_document_not_found" }],
};

const SIGN_IN: DemoHandlers = {
  [`/shared/${TOKEN}`]: [401, { localizable_error: "error.401.docs_share_auth_required" }],
};

function View(props: { bag: SharedDocumentViewBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  if (bag.authRequired) return <p>{t(DOCS_I18N_KEYS.sharedAuthRequired)}</p>;
  if (bag.notFound) {
    return (
      <section data-testid="docs-shared-dead">
        <p>{t(DOCS_I18N_KEYS.sharedNotFound)}</p>
        <p>{t(DOCS_I18N_KEYS.sharedNotFoundHint)}</p>
      </section>
    );
  }
  if (bag.state.status === "loading") {
    return <p>{t(DOCS_I18N_KEYS.sharedLoading)}</p>;
  }
  if (bag.state.status === "failed") {
    return <p>{t(DOCS_I18N_KEYS.sharedNotFound)}</p>;
  }
  return (
    <article data-testid="docs-shared-view">
      <h3>{bag.state.data.title}</h3>
      <p>{t(DOCS_I18N_KEYS.sharedReadOnly)}</p>
      {bag.content?.status === "ready" && <pre>{bag.content.data.text}</pre>}
      <button
        type="button"
        data-analytics="none"
        data-analytics-reason="headless demo; the host wraps its own bearer page with tracked()"
        onClick={bag.download}
      >
        {t(DOCS_I18N_KEYS.sharedDownload)}
      </button>
    </article>
  );
}

function Demo(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <SharedDocumentView token={TOKEN}>
        {(bag) => <View bag={bag} />}
      </SharedDocumentView>
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.shared-document",
  title: "Shared document (headless)",
  description:
    "What a link BEARER sees: title, type and body, and nothing around them — no workspace, no folder, no owner, no revision history. A link grants a document, not a seat. The three ways a token can fail to open (expired, revoked, never existed) all answer 404 deliberately, so that the endpoint is not an oracle for guessing tokens; the page says the one true sentence instead of inventing a more specific one. The exception is a deployment that admits no anonymous bearers, which names a remedy the holder can act on.",
  component: SharedDocumentView,
  variants: {
    default: {
      viewport: "phone",
      step: "live",
      description:
        "A live view-level link: the stripped envelope plus the body, read-only by construction — there is no PUT on the token path at all.",
      render: () => <Demo handlers={LIVE} />,
    },
    dead: {
      viewport: "phone",
      step: "dead",
      description:
        "The link does not open anything. Which of the three reasons it is stays deliberately unsaid.",
      render: () => <Demo handlers={DEAD} />,
    },
    signIn: {
      viewport: "phone",
      step: "sign-in",
      description:
        "Anonymous redemption is off in this deployment: sign in and the same URL works. A different remedy from a dead link, so a different sentence.",
      render: () => <Demo handlers={SIGN_IN} />,
    },
  },
});
