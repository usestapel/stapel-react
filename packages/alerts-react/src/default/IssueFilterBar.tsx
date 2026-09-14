/**
 * `<IssueFilterBar>` — the four questions somebody asks a tracker, in a row.
 *
 * ── Every control clears ──────────────────────────────────────────────────
 *
 * The filters here are the difference between "nothing is broken" and "nothing
 * is broken THAT I ASKED ABOUT", and the second sentence is the dangerous one.
 * So every select is `allowClear`, the "open only" switch is visibly on or
 * off, and "Clear filters" is offered the moment ANY filter is set — the feed
 * also repeats the fact in its empty state, because one of the two of them is
 * going to be the thing somebody reads.
 *
 * ── `since` is offered as four presets, not a date picker ─────────────────
 *
 * The wire takes an ISO-8601 instant, and nobody triaging an outage wants to
 * pick a calendar day: the question is "in the last day / week / month". The
 * instant is computed at CHANGE time from the clock, so a tab left open
 * overnight does not keep filtering on yesterday's boundary the next time
 * somebody touches another control.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Select, Switch, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { SkinButton, SkinTheme } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { ISSUE_LEVELS, ISSUE_STATUSES } from "../api/types.js";
import type { IssueLevel, IssueStatus } from "../api/types.js";
import type { IssueFeedFilters } from "../model/issues.js";
import { clearedIssueFilters } from "../model/issues.js";
import { ALERTS_I18N_KEYS } from "../i18n/keys.js";
import { levelKey, statusKey } from "./labels.js";
import type { ThemeModeProp } from "./types.js";

/** The four windows the bar offers. `any` sends no `since` at all. */
export type SincePreset = "any" | "day" | "week" | "month";

const PRESET_SECONDS: Readonly<Record<Exclude<SincePreset, "any">, number>> = {
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
};

/** The instant a preset means, taken from the clock at the moment of the choice. */
export function sinceFor(preset: SincePreset, now: Date = new Date()): string | undefined {
  if (preset === "any") return undefined;
  return new Date(now.getTime() - PRESET_SECONDS[preset] * 1000).toISOString();
}

/** A change to one filter — `undefined` for "clear this one". */
type FilterPatch = {
  readonly [K in keyof IssueFeedFilters]?: IssueFeedFilters[K] | undefined;
};

export interface IssueFilterBarProps extends ThemeModeProp {
  readonly value: IssueFeedFilters;
  readonly onChange: (next: IssueFeedFilters) => void;
  /**
   * The services to offer. The tracker serves no service registry, so this is
   * whatever the caller can see — `<IssuesFeed>` passes the services present
   * in the page it has. A service that has never failed is therefore absent,
   * which is correct: there is nothing to filter to.
   */
  readonly services?: readonly string[];
  readonly testId?: string;
}

export function IssueFilterBar(props: IssueFilterBarProps): ReactElement {
  const t = useT();
  const testId = props.testId ?? "alerts-filters";
  const { value, onChange } = props;
  // The preset is the bar's own state; the FILTER is an instant. When the
  // caller drops `since`, the control follows rather than showing a window
  // nobody is filtering on.
  const [chosen, setChosen] = useState<SincePreset>("any");
  const preset: SincePreset = value.since === undefined ? "any" : chosen;

  // `exactOptionalPropertyTypes` makes "absent" and "present as undefined"
  // different types, and CLEARING a filter is exactly the second: the select
  // hands back `undefined`, which this then deletes from the object so the
  // filter key — and the cache entry it names — stays absent.
  const patch = (next: FilterPatch): void => {
    const merged = Object.fromEntries(
      Object.entries({ ...value, ...next }).filter(
        ([, entry]) => entry !== undefined
      )
    );
    onChange(merged as IssueFeedFilters);
  };

  const anySet =
    value.status !== undefined ||
    value.level !== undefined ||
    value.service !== undefined ||
    value.since !== undefined ||
    value.open === true;

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Flex gap={spacing[3]} wrap align="center" data-testid={testId}>
        <Select<IssueStatus | undefined>
          size="small"
          allowClear
          style={{ minWidth: "10rem" }}
          value={value.status}
          placeholder={t(ALERTS_I18N_KEYS.filterAnyStatus)}
          aria-label={t(ALERTS_I18N_KEYS.filterStatus)}
          data-testid={`${testId}-status`}
          onChange={(next) => patch({ status: next })}
          options={ISSUE_STATUSES.map((status) => ({
            value: status,
            label: t(statusKey(status), { status }),
          }))}
        />

        <Select<IssueLevel | undefined>
          size="small"
          allowClear
          style={{ minWidth: "10rem" }}
          value={value.level}
          placeholder={t(ALERTS_I18N_KEYS.filterAnyLevel)}
          aria-label={t(ALERTS_I18N_KEYS.filterLevel)}
          data-testid={`${testId}-level`}
          onChange={(next) => patch({ level: next })}
          options={ISSUE_LEVELS.map((level) => ({
            value: level,
            label: t(levelKey(level), { level }),
          }))}
        />

        <Select<string | undefined>
          size="small"
          allowClear
          showSearch
          style={{ minWidth: "12rem" }}
          value={value.service}
          placeholder={t(ALERTS_I18N_KEYS.filterAnyService)}
          aria-label={t(ALERTS_I18N_KEYS.filterService)}
          data-testid={`${testId}-service`}
          onChange={(next) => patch({ service: next })}
          options={(props.services ?? []).map((service) => ({
            value: service,
            label: service,
          }))}
        />

        <Select<SincePreset>
          size="small"
          style={{ minWidth: "10rem" }}
          value={preset}
          aria-label={t(ALERTS_I18N_KEYS.filterSince)}
          data-testid={`${testId}-since`}
          onChange={(next) => {
            setChosen(next);
            patch({ since: sinceFor(next) });
          }}
          options={[
            { value: "any", label: t(ALERTS_I18N_KEYS.filterSinceAny) },
            { value: "day", label: t(ALERTS_I18N_KEYS.filterSinceDay) },
            { value: "week", label: t(ALERTS_I18N_KEYS.filterSinceWeek) },
            { value: "month", label: t(ALERTS_I18N_KEYS.filterSinceMonth) },
          ]}
        />

        <Flex gap={spacing[2]} align="center">
          <Switch
            size="small"
            checked={value.open === true}
            aria-label={t(ALERTS_I18N_KEYS.filterOpenOnly)}
            data-testid={`${testId}-open`}
            onChange={(next) => patch({ open: next ? true : undefined })}
          />
          <Typography.Text>{t(ALERTS_I18N_KEYS.filterOpenOnly)}</Typography.Text>
          <Typography.Text type="secondary">
            {t(ALERTS_I18N_KEYS.filterOpenOnlyHint)}
          </Typography.Text>
        </Flex>

        {anySet ? (
          <SkinButton
            size="small"
            type="link"
            data-testid={`${testId}-clear`}
            data-analytics="none"
            data-analytics-reason="clearing a filter is a view change, not a decision about a bug"
            onClick={() => {
              setChosen("any");
              onChange(clearedIssueFilters(value));
            }}
          >
            {t(ALERTS_I18N_KEYS.filterClear)}
          </SkinButton>
        ) : null}
      </Flex>
    </SkinTheme>
  );
}
