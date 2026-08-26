/**
 * The frame every operator-console screen renders inside. Internal — it is
 * NOT exported from `./index.ts`, because it is a layout, not a product
 * surface: a host mounts one of the five named screens, never this.
 *
 * `surface="base"` because each of these IS a page (the shell routes to it
 * under `admin.root`), unlike the security widgets, which are cards inside
 * someone else's page and paint nothing of their own.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { CSSProperties } from "react";

/** Element-relative page padding — never a viewport measurement. */
const PAGE_STYLE: CSSProperties = {
  minHeight: "100%",
  padding: spacing[4],
  boxSizing: "border-box",
};

/** The readable column. `rem`, so it tracks the reader's own text size. */
const COLUMN_STYLE: CSSProperties = {
  width: "100%",
  maxWidth: "56rem",
  margin: "0 auto",
};

export interface AdminScreenProps {
  readonly title: string;
  readonly subtitle: string;
  /** The page's primary action, beside the title on a wide screen and under
   *  it on a narrow one — the row wraps, it does not overflow. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly testId: string;
}

export function AdminScreen(props: AdminScreenProps): ReactElement {
  return (
    <SkinTheme surface="base" style={PAGE_STYLE} data-testid={`${props.testId}-page`}>
      <Flex vertical gap="large" style={COLUMN_STYLE} data-testid={props.testId}>
        <Flex
          justify="space-between"
          align="flex-start"
          gap="middle"
          wrap
          style={{ width: "100%" }}
        >
          <div style={{ minWidth: 0 }}>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {props.title}
            </Typography.Title>
            <Typography.Text type="secondary">{props.subtitle}</Typography.Text>
          </div>
          {props.action}
        </Flex>
        {props.children}
      </Flex>
    </SkinTheme>
  );
}
