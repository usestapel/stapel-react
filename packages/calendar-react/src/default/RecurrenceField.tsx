/**
 * `<RecurrenceField>` — the repeat rule, without a meaningless choice in it.
 *
 * ── The presets are a registry, not a switch ──────────────────────────────
 *
 * `stapel-calendar`'s presets are an OPEN merge registry
 * (`STAPEL_CALENDAR["PRESETS"]` + `register_preset()`), so the seven built-ins
 * are a default and not the truth: a deployment can add `"quarterly"` or
 * remove `"biweekly"`. This control therefore READS a list
 * ({@link RecurrenceFieldProps.presets}, defaulting to
 * `CALENDAR_RECURRENCE_PRESETS`) instead of hardcoding one, and labels each
 * value by the derived key `calendar.recurrence.preset.<value>` — so a host
 * preset gets a translated label by registering one string.
 *
 * ── `until` XOR `count` ───────────────────────────────────────────────────
 *
 * RRULE takes UNTIL or COUNT, never both. A form offering both fields at once
 * offers a combination that cannot exist, and then has to explain the refusal
 * afterwards. So the end is a single three-way question — never / on a date /
 * after N times — and only the chosen one's field appears. The model
 * (`recurrenceEndPatch`) nulls the other explicitly, because editing any
 * recurrence field re-specifies the WHOLE rule and an omitted `recurrence_count`
 * would leave the old COUNT in force.
 */
import type { ReactElement } from "react";
import { Checkbox, Flex, Form, Input, InputNumber, Radio, Select, Typography } from "antd";
import { useI18n, useT } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { toDateInput, fromDateInput, weekdayNames } from "../model/format.js";
import {
  CALENDAR_RECURRENCE_PRESETS,
  RECURRENCE_ENDS,
  isRecurring,
} from "../model/recurrence.js";
import type { RecurrenceEnd, RecurrencePreset, RecurrenceValue } from "../model/recurrence.js";

const END_LABEL_KEY: Readonly<Record<RecurrenceEnd, string>> = {
  never: CALENDAR_I18N_KEYS.recurrenceEndNever,
  until: CALENDAR_I18N_KEYS.recurrenceEndUntil,
  count: CALENDAR_I18N_KEYS.recurrenceEndCount,
};

export interface RecurrenceFieldProps {
  readonly value: RecurrenceValue;
  readonly onChange: (next: RecurrenceValue) => void;
  /** Override the offered presets for a deployment with its own registry. */
  readonly presets?: readonly RecurrencePreset[];
  readonly "data-testid"?: string;
}

export function RecurrenceField(props: RecurrenceFieldProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const testId = props["data-testid"] ?? "calendar-recurrence";
  const presets = props.presets ?? CALENDAR_RECURRENCE_PRESETS;
  const { value, onChange } = props;
  const preset = presets.find((p) => p.value === value.type);
  const custom = preset?.custom === true;

  return (
    <Flex vertical gap={spacing["2"]} data-testid={testId}>
      <Form.Item label={t(CALENDAR_I18N_KEYS.recurrenceLabel)} style={{ marginBottom: spacing["0"] }}>
        <Select
          value={value.type}
          data-testid={`${testId}-preset`}
          aria-label={t(CALENDAR_I18N_KEYS.recurrenceLabel)}
          onChange={(next: string) => {
            onChange({ ...value, type: next });
          }}
          options={presets.map((p) => ({ value: p.value, label: t(p.labelKey) }))}
        />
      </Form.Item>

      {custom ? (
        <>
          <Form.Item
            label={t(CALENDAR_I18N_KEYS.recurrenceInterval)}
            style={{ marginBottom: spacing["0"] }}
          >
            <InputNumber
              min={1}
              value={value.interval}
              data-testid={`${testId}-interval`}
              aria-label={t(CALENDAR_I18N_KEYS.recurrenceInterval)}
              onChange={(next) => {
                onChange({ ...value, interval: typeof next === "number" ? next : 1 });
              }}
            />
          </Form.Item>
          <Form.Item
            label={t(CALENDAR_I18N_KEYS.recurrenceWeekdays)}
            style={{ marginBottom: spacing["0"] }}
          >
            <Checkbox.Group
              value={[...value.weekdays]}
              data-testid={`${testId}-weekdays`}
              onChange={(next) => {
                onChange({ ...value, weekdays: next as number[] });
              }}
              options={weekdayNames(locale).map((label, index) => ({
                label,
                // 0 = Monday .. 6 = Sunday, the backend's own convention.
                value: index,
              }))}
            />
          </Form.Item>
        </>
      ) : null}

      {isRecurring(value) ? (
        <>
          <Form.Item
            label={t(CALENDAR_I18N_KEYS.recurrenceEnds)}
            style={{ marginBottom: spacing["0"] }}
          >
            <Radio.Group
              value={value.end}
              data-testid={`${testId}-end`}
              onChange={(event) => {
                onChange({ ...value, end: event.target.value as RecurrenceEnd });
              }}
              options={RECURRENCE_ENDS.map((end) => ({
                value: end,
                label: t(END_LABEL_KEY[end]),
              }))}
            />
          </Form.Item>
          {value.end === "until" ? (
            <Form.Item
              label={t(CALENDAR_I18N_KEYS.recurrenceUntilLabel)}
              style={{ marginBottom: spacing["0"] }}
            >
              <Input
                type="date"
                value={toDateInput(value.until)}
                data-testid={`${testId}-until`}
                aria-label={t(CALENDAR_I18N_KEYS.recurrenceUntilLabel)}
                onChange={(event) => {
                  onChange({ ...value, until: fromDateInput(event.target.value) });
                }}
              />
            </Form.Item>
          ) : null}
          {value.end === "count" ? (
            <Form.Item
              label={t(CALENDAR_I18N_KEYS.recurrenceCountLabel)}
              style={{ marginBottom: spacing["0"] }}
            >
              <InputNumber
                min={1}
                value={value.count}
                data-testid={`${testId}-count`}
                aria-label={t(CALENDAR_I18N_KEYS.recurrenceCountLabel)}
                onChange={(next) => {
                  onChange({ ...value, count: typeof next === "number" ? next : 1 });
                }}
              />
            </Form.Item>
          ) : null}
          <Typography.Text
            type="secondary"
            style={{ fontSize: fontSize.xs.fontSize }}
            data-testid={`${testId}-exclusive-hint`}
          >
            {t(CALENDAR_I18N_KEYS.recurrenceExclusiveHint)}
          </Typography.Text>
        </>
      ) : null}
    </Flex>
  );
}
