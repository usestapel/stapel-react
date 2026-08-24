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
 *
 * `months` is clamped to the range the view accepts (1..36) BEFORE the read,
 * and the clamp is stated on the page. The pair has owned that predicate since
 * 0.1.0 and never reached a screen with it, so `months={48}` used to produce a
 * server 400 rendered as a generic error — a refusal this side already knew
 * how to make.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Flex, theme } from "antd";
import { useT } from "@stapel/core";
import { EmptyState, ErrorAlert, SkinTheme } from "@stapel/tokens-antd/skin";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { useVideoRuntime } from "../model/context.js";
import { useScopeUsage } from "../model/queries.js";
import { clampUsageMonths, isUsageMonthsOutOfRange } from "../model/usage.js";
import { ScopeUsageTable } from "./ScopeUsageTable.js";
import type { ThemeModeProp } from "./types.js";

export interface ScopeUsagePaneProps extends ThemeModeProp {
  /** The partition to report on. Falls back to the runtime's `scopeKey`. */
  readonly scopeKey?: string;
  /** How many months the selector offers (1..36). Defaults to the view's 6.
   * Out of range is clamped, and the clamp is said out loud. */
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
      <SkinTheme {...(mode !== undefined ? { mode } : {})}>
        <NoScopeNotice />
      </SkinTheme>
    );
  }
  return <WiredPane {...props} scopeKey={scopeKey} />;
}

function NoScopeNotice(): ReactElement {
  const t = useT();
  return (
    <div data-testid="video-usage">
      <EmptyState
        testId="video-usage-no-scope"
        title={t(VIDEO_I18N_KEYS.usageNoScope)}
      />
    </div>
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
  const t = useT();
  const { token } = theme.useToken();
  // `undefined` until a person picks one — the first paint is the window read
  // alone, and its newest month is what the table shows.
  const [month, setMonth] = useState<string | undefined>(undefined);
  const clamped =
    props.months !== undefined ? clampUsageMonths(props.months) : undefined;
  const outOfRange =
    props.months !== undefined && isUsageMonthsOutOfRange(props.months);
  const bag = useScopeUsage(props.scopeKey, {
    ...(clamped !== undefined ? { months: clamped } : {}),
    ...(month !== undefined ? { month } : {}),
    ...(props.tz !== undefined ? { tz: props.tz } : {}),
  });
  return (
    <Flex vertical gap={token.paddingXS}>
      {outOfRange && (
        <ErrorAlert
          variant="inline"
          testId="video-usage-clamped"
          message={t(VIDEO_I18N_KEYS.usageInvalidPeriod)}
        />
      )}
      <ScopeUsageTable
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        rows={bag.rows}
        {...(props.nameFor !== undefined ? { nameFor: props.nameFor } : {})}
        {...(bag.month !== undefined ? { month: bag.month } : {})}
        months={bag.monthLabels}
        onMonthChange={setMonth}
        onRefresh={bag.refetch}
      />
    </Flex>
  );
}
