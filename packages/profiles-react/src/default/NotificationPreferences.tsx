/**
 * `<NotificationPreferences/>` — default skin for the headless
 * {@link NotificationPreferences as HeadlessNotificationPreferences} category
 * × channel matrix (`../headless/NotificationPreferences.js`). Renders it as a
 * small table — categories as rows, channels as columns — per the brief
 * ("дефолт-скин может показывать упрощённо"): a plain grid of switches reads
 * fine at today's 2×2 size and keeps scaling to more categories without a
 * redesign, unlike ironmemo's flat checkbox list (`ProfilePage`'s "Email
 * notifications" block, 2 checkboxes with no row/column structure at all).
 */
import type { ReactElement } from "react";
import { Alert, Card, Switch, Table, Typography } from "antd";
import type { TableProps } from "antd";
import { useT } from "@stapel/core";
import {
  NotificationPreferences as HeadlessNotificationPreferences,
  type NotificationCategory,
  type NotificationChannel,
} from "../headless/NotificationPreferences.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

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

export function NotificationPreferences(): ReactElement {
  const t = useT();

  return (
    <HeadlessNotificationPreferences>
      {({ categories, channels, isEnabled, toggle, isLoading, isError, error }) => {
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
          <Card data-testid="notification-preferences">
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {t(PROFILES_I18N_KEYS.notifPrefsTitle)}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t(PROFILES_I18N_KEYS.notifPrefsSubtitle)}
            </Typography.Text>

            {isError && error && (
              <Alert style={{ marginTop: 12 }} type="error" showIcon message={error.message} />
            )}

            <Table<Row>
              style={{ marginTop: 16 }}
              size="small"
              loading={isLoading}
              dataSource={rows}
              columns={columns}
              pagination={false}
            />
          </Card>
        );
      }}
    </HeadlessNotificationPreferences>
  );
}
