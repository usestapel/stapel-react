/**
 * `<ScopeUsagePane>` — the wired screen: the hook, the month state and
 * `<ScopeUsageTable>` in one component, so a container's generated navigation
 * can mount `admin.usage` without writing any of it.
 *
 * The scope key is either a prop (a host with a workspace switcher — the
 * partition changes during a session) or the runtime's (`createVideoRuntime({
 * scopeKey })`, a host whose instance reads one partition). Neither is
 * guessable by a library, so when there is no key the pane says so by name
 * (`video.usage.no_scope`) instead of rendering an empty table — a wiring gap
 * is not a workspace with no calls.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Flex } from "antd";
import { useT } from "@stapel/core";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { useVideoRuntime } from "../model/context.js";
import { useScopeUsage } from "../model/queries.js";
import { ScopeUsageTable } from "./ScopeUsageTable.js";
import { VideoSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface ScopeUsagePaneProps extends ThemeModeProp {
  /** The partition to report on. Falls back to the runtime's `scopeKey`. */
  readonly scopeKey?: string;
  /** How many months the selector offers (1..36). Defaults to the view's 6. */
  readonly months?: number;
  /** IANA zone the buckets are cut in. Defaults to the view's `UTC`. */
  readonly tz?: string;
  /** Turn a `user_id` into a name — from the roster the admin page already
   * loaded. Absent, the id is printed. */
  readonly nameFor?: (userId: string) => ReactNode;
}

export function ScopeUsagePane(props: ScopeUsagePaneProps): ReactElement {
  const runtime = useVideoRuntime();
  const scopeKey = props.scopeKey ?? runtime.scopeKey;
  const { mode } = props;

  if (scopeKey === undefined || scopeKey.length === 0) {
    return (
      <VideoSkinTheme {...(mode !== undefined ? { mode } : {})}>
        <NoScopeNotice />
      </VideoSkinTheme>
    );
  }
  return <WiredPane {...props} scopeKey={scopeKey} />;
}

function NoScopeNotice(): ReactElement {
  const t = useT();
  return (
    <Flex vertical gap={8} data-testid="video-usage">
      <Alert
        type="info"
        showIcon
        data-testid="video-usage-no-scope"
        message={t(VIDEO_I18N_KEYS.usageNoScope)}
      />
    </Flex>
  );
}

/**
 * Split out so the hook is never called conditionally: the no-scope arm above
 * returns before this component exists, rather than calling `useScopeUsage`
 * with a key it does not have.
 */
function WiredPane(
  props: ScopeUsagePaneProps & { readonly scopeKey: string }
): ReactElement {
  // `undefined` until a person picks one — the first paint is the window read
  // alone, and its newest month is what the table shows.
  const [month, setMonth] = useState<string | undefined>(undefined);
  const bag = useScopeUsage(props.scopeKey, {
    ...(props.months !== undefined ? { months: props.months } : {}),
    ...(month !== undefined ? { month } : {}),
    ...(props.tz !== undefined ? { tz: props.tz } : {}),
  });
  return (
    <ScopeUsageTable
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      rows={bag.rows}
      {...(props.nameFor !== undefined ? { nameFor: props.nameFor } : {})}
      {...(bag.month !== undefined ? { month: bag.month } : {})}
      months={bag.monthLabels}
      onMonthChange={setMonth}
      onRefresh={bag.refetch}
    />
  );
}
