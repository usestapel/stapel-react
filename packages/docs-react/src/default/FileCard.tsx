/**
 * `<FileCard/>` — the default skin's download/preview card, the surface a
 * document with no resolvable editor gets (`editor_hint: ""` = download-only
 * by contract; also any unknown hint — degrade to a file, never to a crash).
 * Rides the `MediaViewer` headless bag: `image/*` previews inline, `video/*`
 * plays inline, everything else is a download button on the opaque URL.
 *
 * The download is a `<GatedButton>`, so a URL that could not be minted greys
 * it out WITH the sentence saying so — the button used to go dead on a bare
 * `url === null`, which is also what "still minting" looks like.
 *
 * Replaceable without a fork:
 * `registerDocsSkinComponent("fileCard", …)`.
 */
import type { ReactElement } from "react";
import { Card, Flex, Skeleton, Typography } from "antd";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { actionAvailable, requireLoaded, useI18n, useT } from "@stapel/core";
import { MediaViewer } from "../headless/MediaViewer.js";
import type { MediaViewerBag } from "../headless/MediaViewer.js";
import { formatBytes } from "../model/format.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";

export interface FileCardProps {
  readonly documentId: string;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

export function FileCard(props: FileCardProps): ReactElement {
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <MediaViewer documentId={props.documentId}>
        {(bag) => <FileCardBody bag={bag} />}
      </MediaViewer>
    </SkinTheme>
  );
}

/** The card itself — a component, not a closure, so the hooks run at a
 * component's top level rather than inside the render prop. */
function FileCardBody(props: { readonly bag: MediaViewerBag }): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { bag } = props;
  // Three reasons the download can be off, and the person is told which:
  // the URL is still being minted, the mint failed, or it is available.
  const download = requireLoaded(bag.urlState, () => actionAvailable());

  function downloadButton(url: string | null): ReactElement {
    return (
      <GatedButton
        gate={download}
        onClick={() => {
          if (url !== null) window.open(url, "_blank", "noopener");
        }}
        testId="docs-file-download"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      >
        {t(DOCS_I18N_KEYS.mediaDownload)}
      </GatedButton>
    );
  }

  return (
    <Card data-testid="docs-file-card" size="small">
      <Flex vertical gap="small">
        <LoadBoundary
          state={bag.state}
          onRetry={bag.refreshUrl}
          testId="docs-file"
        >
          {({ document: doc, kind }) => (
            <Flex vertical gap="small">
              <Typography.Text strong>{doc.title}</Typography.Text>
              <Typography.Text type="secondary">
                {formatBytes(doc.size_bytes, locale)}
              </Typography.Text>
              <LoadBoundary
                state={bag.urlState}
                onRetry={bag.refreshUrl}
                testId="docs-file-url"
                // Minting a signed URL took four unlabelled skeleton bars,
                // which reads the same as a stuck screen. Say what is being
                // waited for (visual pass M-3).
                loading={
                  <Flex
                    vertical
                    gap="small"
                    role="status"
                    aria-busy
                    data-stapel-load-state="loading"
                    data-testid="docs-file-url-loading"
                  >
                    <Typography.Text type="secondary">
                      {t(DOCS_I18N_KEYS.mediaMinting)}
                    </Typography.Text>
                    <Skeleton.Button active size="small" />
                  </Flex>
                }
                // The URL failed on its own — the document is fine, so the
                // title stays, the failure is stated, and only the download
                // is blocked, with the gate's own reason beside it.
                failed={(error) => (
                  <Flex vertical gap="small" align="flex-start">
                    <ErrorAlert
                      thrown={error}
                      onRetry={bag.refreshUrl}
                      testId="docs-file-url-error"
                    />
                    {downloadButton(null)}
                  </Flex>
                )}
              >
                {(url) =>
                  kind === "image" ? (
                    <img src={url} alt={doc.title} style={{ maxWidth: "100%" }} />
                  ) : kind === "video" ? (
                    <video src={url} controls style={{ maxWidth: "100%" }} />
                  ) : (
                    <Flex vertical gap="small" align="flex-start">
                      <Typography.Text type="secondary">
                        {t(DOCS_I18N_KEYS.editorDownloadOnly)}
                      </Typography.Text>
                      {downloadButton(url)}
                    </Flex>
                  )
                }
              </LoadBoundary>
            </Flex>
          )}
        </LoadBoundary>
      </Flex>
    </Card>
  );
}
