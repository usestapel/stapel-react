/**
 * `<FileCard/>` — the default skin's download/preview card, the surface a
 * document with no resolvable editor gets (`editor_hint: ""` = download-only
 * by contract; also any unknown hint — degrade to a file, never to a crash).
 * Rides the `MediaViewer` headless bag: `image/*` previews inline, `video/*`
 * plays inline, everything else is a download button on the opaque URL.
 *
 * Replaceable without a fork:
 * `registerDocsSkinComponent("fileCard", …)`.
 */
import type { ReactElement } from "react";
import { Button, Card, Flex, Spin, Typography } from "antd";
import { useErrorDisplay, useT } from "@stapel/core";
import { MediaViewer } from "../headless/MediaViewer.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface FileCardProps {
  readonly documentId: string;
}

export function FileCard(props: FileCardProps): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);
  return (
    <MediaViewer documentId={props.documentId}>
      {({ document: doc, kind, url, isLoading, isError, error }) => (
        <Card data-testid="docs-file-card" size="small">
          <Flex vertical gap="small">
            {doc !== null && (
              <Typography.Text strong>{doc.title}</Typography.Text>
            )}

            {isError && (
              <ErrorAlert error={errorDisplay(error)} testId="docs-file-error" />
            )}

            {isLoading ? (
              <Spin />
            ) : kind === "image" && url !== null ? (
              <img
                src={url}
                alt={doc?.title ?? ""}
                style={{ maxWidth: "100%" }}
              />
            ) : kind === "video" && url !== null ? (
              <video src={url} controls style={{ maxWidth: "100%" }} />
            ) : (
              <Flex vertical gap="small" align="flex-start">
                <Typography.Text type="secondary">
                  {t(DOCS_I18N_KEYS.editorDownloadOnly)}
                </Typography.Text>
                <Button
                  size="small"
                  disabled={url === null}
                  onClick={() => {
                    if (url !== null) window.open(url, "_blank", "noopener");
                  }}
                  data-analytics="none"
                  data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                >
                  {t(DOCS_I18N_KEYS.mediaDownload)}
                </Button>
              </Flex>
            )}
          </Flex>
        </Card>
      )}
    </MediaViewer>
  );
}
