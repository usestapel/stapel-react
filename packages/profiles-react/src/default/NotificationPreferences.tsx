/**
 * `<NotificationPreferences/>` — default skin for the headless
 * {@link NotificationPreferences as HeadlessNotificationPreferences} category
 * × channel matrix (`../headless/NotificationPreferences.js`).
 *
 * THE MATRIX IS RENDERED ONLY OUT OF A READ THAT LANDED (`bag.state`, through
 * the shared substrate's `LoadBoundary`). It used to render out of whatever
 * `isEnabled` returned, which is `false` for every cell when there is no
 * profile — so a failed read drew a full grid of live switches, each showing a
 * default rather than the user's real setting, and flipping one PATCHed a
 * preference derived from a state nobody could read. That is the 2026-08-09
 * incident class exactly (@stapel/core `loadState.ts`): the absence of a
 * result rendered as a result.
 *
 * ── WHY THIS IS A GRID AND NO LONGER AN `antd` TABLE ────────────────────────
 *
 * A `<Table>` cannot reflow: at 390px its three columns were three cramped
 * columns, and at 1280px the same 640px block sat at the left edge with the
 * right half dead (visual pass classes VC-A3). The rows here are a
 * `repeat(auto-fit, minmax(…))` grid, so the channels sit side by side when
 * the ELEMENT is wide and stack into full-width "Email ——— [switch]" lines
 * when it is narrow. No breakpoint hook, no viewport read: the container's own
 * width decides.
 *
 * ── EVERY SWITCH SAYS WHAT IT IS ────────────────────────────────────────────
 *
 * A `Switch` whose label lives in a sibling cell announces "switch, off" with
 * no subject. Each one carries `aria-label` = "<category> notifications via
 * <channel>" (`profiles.notif_prefs.toggle_label`), which is also the whole
 * reason the key takes two parameters instead of being assembled from
 * fragments a translator cannot reorder.
 */
import type { ReactElement } from "react";
import { Card, Flex, Switch, Typography } from "antd";
import { ErrorAlert, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  NotificationPreferences as HeadlessNotificationPreferences,
  type NotificationCategory,
  type NotificationChannel,
} from "../headless/NotificationPreferences.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

/** The narrowest a "<channel> [switch]" line may get before the grid drops a
 * column. A length, named rather than inlined (see `no-raw-dimensions`). */
export const NOTIFICATION_CHANNEL_MIN_WIDTH = "10rem";

const CATEGORY_KEY: Record<NotificationCategory, "notifCategoryMessages" | "notifCategorySystem"> = {
  messages: "notifCategoryMessages",
  system: "notifCategorySystem",
};
const CHANNEL_KEY: Record<NotificationChannel, "notifChannelEmail" | "notifChannelPush"> = {
  email: "notifChannelEmail",
  push: "notifChannelPush",
};

export interface NotificationPreferencesProps {
  /**
   * Light or dark. Omitted — the normal case — the skin follows the mode the
   * host's document declares LIVE, through `SkinTheme`/`useThemeMode`: a
   * hardcoded `"light"` default is a wrong answer on every dark deployment,
   * and sampling the mode once per render (`resolveThemeMode()`) leaves the
   * component on the old side when a host flips `data-theme` at runtime.
   * Pass it explicitly to pin a side.
   */
  readonly mode?: ThemeMode;
  /**
   * What the theme root paints. Default `"bare"`: this component draws its
   * own antd `Card`, so painting a second surface behind it would only put a
   * container colour under a container. `"base"` when it is mounted as a
   * whole page of its own (the `profiles.notifications` route).
   */
  readonly surface?: SkinSurface;
}

export function NotificationPreferences(
  props: NotificationPreferencesProps = {}
): ReactElement {
  const t = useT();

  return (
    <HeadlessNotificationPreferences>
      {({ categories, channels, isEnabled, toggle, state, refetch, isError, error }) => (
        <SkinTheme
          surface={props.surface ?? "bare"}
          {...(props.mode !== undefined ? { mode: props.mode } : {})}
        >
          <Card data-testid="notification-preferences" style={{ width: "100%" }}>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {t(PROFILES_I18N_KEYS.notifPrefsTitle)}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t(PROFILES_I18N_KEYS.notifPrefsSubtitle)}
            </Typography.Text>

            <div style={{ marginTop: spacing[4] }}>
              <LoadBoundary
                state={state}
                onRetry={refetch}
                skeletonRows={categories.length}
                testId="notification-prefs"
              >
                {() => (
                  <Flex vertical gap={spacing[5]}>
                    {/* Inside this arm the READ succeeded, so what `isError`
                        still reports is a failed toggle — an alert above a
                        matrix that stays usable (the write rolls itself back). */}
                    <ErrorAlert
                      thrown={isError ? error : undefined}
                      testId="notification-prefs-write-error"
                    />
                    {categories.map((category) => (
                      <Flex vertical gap={spacing[2]} key={category}>
                        <Typography.Text strong>
                          {t(PROFILES_I18N_KEYS[CATEGORY_KEY[category]])}
                        </Typography.Text>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(auto-fit, minmax(${NOTIFICATION_CHANNEL_MIN_WIDTH}, 1fr))`,
                            gap: spacing[3],
                          }}
                        >
                          {channels.map((channel) => (
                            <Flex
                              key={channel}
                              align="center"
                              justify="space-between"
                              gap={spacing[2]}
                            >
                              <Typography.Text type="secondary">
                                {t(PROFILES_I18N_KEYS[CHANNEL_KEY[channel]])}
                              </Typography.Text>
                              <Switch
                                checked={isEnabled(category, channel)}
                                onChange={() => toggle(category, channel)}
                                aria-label={t(PROFILES_I18N_KEYS.notifToggleLabel, {
                                  category: t(PROFILES_I18N_KEYS[CATEGORY_KEY[category]]),
                                  channel: t(PROFILES_I18N_KEYS[CHANNEL_KEY[channel]]),
                                })}
                                data-testid={`notif-toggle-${category}-${channel}`}
                              />
                            </Flex>
                          ))}
                        </div>
                      </Flex>
                    ))}
                  </Flex>
                )}
              </LoadBoundary>
            </div>
          </Card>
        </SkinTheme>
      )}
    </HeadlessNotificationPreferences>
  );
}
