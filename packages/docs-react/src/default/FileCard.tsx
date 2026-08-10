/**
 * `<FileCard/>` — the default skin's download/preview card, the surface a
 * document with no resolvable editor gets (`editor_hint: ""` = download-only
 * by contract; also any unknown hint — degrade to a file, never to a crash).
 * Rides the `MediaViewer` headless bag: `image/*` previews inline, `video/*`
 * plays inline, everything else is a download button on the opaque URL.
 *
 * The download button is gated through core's `useActionGate`, so a URL that
 * could not be minted greys it out WITH the sentence saying so — the button
 * used to go dead on a bare `url === null`, which is also what "still
 * minting" looks like.
 *
 * Replaceable without a fork:
 * `registerDocsSkinComponent("fileCard", …)`.
 */
import type { ReactElement } from "react";
import { Button, Card, Flex, Spin, Typography } from "antd";
import {
  actionAvailable,
  matchLoad,
  requireLoaded,
  useActionGate,
  useErrorDisplay,
  useT,
} from "@stapel/core";
import { MediaViewer } from "../headless/MediaViewer.js";
import type { MediaViewerBag } from "../headless/MediaViewer.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface FileCardProps {
  readonly documentId: string;
}

export function FileCard(props: FileCardProps): ReactElement {
  return (
    <MediaViewer documentId={props.documentId}>
      {(bag) => <FileCardBody bag={bag} />}
    </MediaViewer>
  );
}

/** The card itself — a component, not a closure, so the gate hook runs at a
 * component's top level rather than inside the render prop. */
function FileCardBody(props: { readonly bag: MediaViewerBag }): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);
  const { bag } = props;
  const download = useActionGate(
    requireLoaded(bag.urlState, () => actionAvailable())
  );

  function downloadButton(url: string | null): ReactElement {
    return (
      <Flex vertical gap="small" align="flex-start">
        <Button
          size="small"
          disabled={download.disabled}
          onClick={() => {
            if (url !== null) window.open(url, "_blank", "noopener");
          }}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        >
          {t(DOCS_I18N_KEYS.mediaDownload)}
        </Button>
        {/* Beside the control, not in a `title`: a disabled button gets no
            pointer events, so a tooltip is a reason nobody can read. */}
        {download.reason !== undefined && (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12 }}
            data-testid="docs-file-download-reason"
          >
            {download.reason}
            {download.detail !== undefined ? ` · ${download.detail}` : ""}
          </Typography.Text>
        )}
      </Flex>
    );
  }

  return (
    <Card data-testid="docs-file-card" size="small">
      <Flex vertical gap="small">
        {matchLoad(bag.state, {
          loading: () => <Spin />,
          failed: (error) => (
            <ErrorAlert error={errorDisplay(error)} testId="docs-file-error" />
          ),
          ready: ({ document: doc, kind }) => (
            <>
              <Typography.Text strong>{doc.title}</Typography.Text>
              {matchLoad(bag.urlState, {
                loading: () => <Spin />,
                // The URL failed on its own — the document is fine, so the
                // title stays and only the download is blocked, with why.
                failed: (error) => (
                  <Flex vertical gap="small" align="flex-start">
                    <ErrorAlert
                      error={errorDisplay(error)}
                      testId="docs-file-url-error"
                    />
                    {downloadButton(null)}
                  </Flex>
                ),
                ready: (url) =>
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
                  ),
              })}
            </>
          ),
        })}
      </Flex>
    </Card>
  );
}
