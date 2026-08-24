/**
 * `<NotificationPreferences/>` — default skin for the headless
 * {@link NotificationPreferences as HeadlessNotificationPreferences} category
 * × channel matrix (`../headless/NotificationPreferences.js`). Renders it as a
 * small table — categories as rows, channels as columns — per the brief
 * (the default skin may render a simplified view): a plain grid of switches reads
 * fine at today's 2×2 size and keeps scaling to more categories without a
 * redesign, unlike ironmemo's flat checkbox list (`ProfilePage`'s "Email
 * notifications" block, 2 checkboxes with no row/column structure at all).
 *
 * THE MATRIX IS RENDERED ONLY OUT OF A READ THAT LANDED (`bag.state`, via
 * `matchLoad`). It used to render out of whatever `isEnabled` returned, which
 * is `false` for every cell when there is no profile — so a failed read drew
 * a full grid of live switches, each showing a default rather than the user's
 * real setting, and flipping one PATCHed a preference derived from a state
 * nobody could read. That is the 2026-08-09 incident class exactly (@stapel/
 * core `loadState.ts`): the absence of a result rendered as a result.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";
import { Button, Card, ConfigProvider, Switch, Table, Typography } from "antd";
import type { TableProps } from "antd";
import { resolveThemeMode, toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { matchLoad, useErrorDisplay, useT } from "@stapel/core";
import {
  NotificationPreferences as HeadlessNotificationPreferences,
  type NotificationCategory,
  type NotificationChannel,
} from "../headless/NotificationPreferences.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

const CATEGORY_KEY: Record<NotificationCategory, "notifCategoryMessages" | "notifCategorySystem"> = {
  messages: "notifCategoryMessages",
  system: "notifCategorySystem",
};
const CHANNEL_KEY: Record<NotificationChannel, "notifChannelEmail" | "notifChannelPush"> = {
  email: "notifChannelEmail",
  push: "notifChannelPush",
};

interface Row {
  readonly key: NotificationCategory;
  readonly category: NotificationCategory;
}

export interface NotificationPreferencesProps {
  /**
   * Light or dark. The theme is derived from `@stapel/tokens` via
   * `toAntdThemeConfig(mode)` — no manual token wiring, same self-theming
   * contract as `AuthPanel`. Defaults to the mode the HOST's document
   * declares (`resolveThemeMode()` — the `data-theme` attribute
   * `@stapel/tokens`' `tokens.css` keys its dark block on), not to a
   * hardcoded `"light"`: a light default is a wrong answer on every dark
   * deployment, and it rendered an unreadable error Alert on a live sandbox
   * (owner report 2026-08-09 — antd's light algorithm derived a near-white
   * `colorErrorBg` while `colorText` came live off the host's dark tokens).
   * Pass it explicitly to pin a side.
   */
  readonly mode?: ThemeMode;
}

export function NotificationPreferences(props: NotificationPreferencesProps = {}): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(PROFILES_I18N_KEYS.unknownError);
  const theme = useMemo(() => toAntdThemeConfig(props.mode ?? resolveThemeMode()), [props.mode]);

  return (
    <HeadlessNotificationPreferences>
      {({ categories, channels, isEnabled, toggle, state, refetch, isError, error }) => {
        const rows: Row[] = categories.map((category) => ({ key: category, category }));
        const columns: TableProps<Row>["columns"] = [
          {
            title: "",
            dataIndex: "category",
            key: "category",
            render: (category: NotificationCategory) => t(PROFILES_I18N_KEYS[CATEGORY_KEY[category]]),
          },
          ...channels.map((channel) => ({
            title: t(PROFILES_I18N_KEYS[CHANNEL_KEY[channel]]),
            key: channel,
            align: "center" as const,
            render: (_: unknown, row: Row) => (
              <Switch
                checked={isEnabled(row.category, channel)}
                onChange={() => toggle(row.category, channel)}
              />
            ),
          })),
        ];

        return (
          <ConfigProvider theme={theme}>
            <Card data-testid="notification-preferences">
              <Typography.Title level={4} style={{ marginTop: 0 }}>
                {t(PROFILES_I18N_KEYS.notifPrefsTitle)}
              </Typography.Title>
              <Typography.Text type="secondary">
                {t(PROFILES_I18N_KEYS.notifPrefsSubtitle)}
              </Typography.Text>

              {matchLoad(state, {
                // No rows to hand out yet — the table's own spinner, over an
                // empty body, rather than a grid of switches at their defaults.
                loading: () => (
                  <Table<Row>
                    style={{ marginTop: 16 }}
                    size="small"
                    loading
                    dataSource={[]}
                    columns={columns}
                    pagination={false}
                  />
                ),
                // A read that could not be made is not a set of preferences.
                failed: (readError) => (
                  <div data-testid="notification-prefs-failed" style={{ marginTop: 12 }}>
                    <ErrorAlert error={errorDisplay(readError)} />
                    <Button
                      onClick={refetch}
                      style={{ marginTop: 8 }}
                      data-analytics="none"
                      data-analytics-reason="retry of a failed read (no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
                    >
                      {t(PROFILES_I18N_KEYS.actionRetry)}
                    </Button>
                  </div>
                ),
                ready: () => (
                  <>
                    {/* Inside this arm the READ succeeded, so what `isError`
                        still reports is a failed toggle — an alert above a
                        matrix that stays usable (the write rolls itself back). */}
                    {isError && (
                      <ErrorAlert error={errorDisplay(error)} style={{ marginTop: 12 }} />
                    )}
                    <Table<Row>
                      style={{ marginTop: 16 }}
                      size="small"
                      dataSource={rows}
                      columns={columns}
                      pagination={false}
                    />
                  </>
                ),
              })}
            </Card>
          </ConfigProvider>
        );
      }}
    </HeadlessNotificationPreferences>
  );
}
