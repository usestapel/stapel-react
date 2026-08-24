/**
 * `<RoleSelectField/>` — the default skin for {@link RoleSelect} (§54: every
 * headless primitive gets an AntD default).
 *
 * The visual pass photographed the role story as five bullet points: no
 * control, no current value, nothing focusable, and a deployment role
 * (`secretary`) printed lowercase beside title-cased builtin ones. This is
 * that primitive drawn as what it is — a real `<Select>` with an accessible
 * name, the effective registry behind it, and the role's RANK as the caption
 * in the menu, because "admin outranks member" is the fact a person picking a
 * role is actually reasoning about.
 *
 * The three non-ready states are not a select at all:
 *  - loading — the control is there and busy, so the layout does not jump.
 *  - failed — NO picker. An enabled `<Select options={[]}/>` offers a choice
 *    that does not exist; the reason is printed instead (the registry read is
 *    a separate load from whatever list the caller is drawing).
 *  - empty — a registry with no roles is not a picker either.
 */
import type { ReactElement } from "react";
import { Flex, Select, Typography } from "antd";
import { matchList, useT } from "@stapel/core";
import { spacing, fontSize } from "@stapel/tokens";
import { RoleSelect } from "../headless/RoleSelect.js";
import type { RoleInfo } from "../api/types.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";
import { Muted } from "./parts.js";

/** The system-protected role only an owner may grant. */
const OWNER_ROLE = "owner";

export interface RoleSelectFieldProps {
  /** The registry key currently chosen. Kept as the VALUE even when the
   * registry has no label for it — a deployment that removed an overlay role
   * must still show what the member actually holds. */
  readonly value: string;
  readonly onChange: (role: string) => void;
  /**
   * The control's accessible name. Required, not optional: a roster renders
   * one of these per row, and "combobox, combobox, combobox" is what a screen
   * reader says when the name is left to the layout.
   */
  readonly label: string;
  /** Draw the name above the control as well. Off in a table cell, where the
   * column header is the visible label. */
  readonly showLabel?: boolean;
  /** Leave `owner` out of the menu — the invite path, where the backend
   * enforces "only an owner grants owner" anyway. */
  readonly excludeOwner?: boolean;
  readonly size?: "small" | "middle" | "large";
  /** Forwarded straight to the control by a caller that has already stated
   * its own reason beside it (a gate, a read-only roster). */
  readonly disabled?: boolean;
  readonly "aria-describedby"?: string | undefined;
  readonly testId?: string | undefined;
}

/**
 * A role as a WORD, where there is nothing to pick — an invitation's granted
 * role, a read-only roster. The same label resolution as the field, so one
 * screen never calls `admin` "Admin" while its neighbour prints `admin`.
 */
export function RoleLabel(props: { readonly role: string }): ReactElement {
  return <RoleSelect>{({ labelFor }) => <>{labelFor(props.role)}</>}</RoleSelect>;
}

export function RoleSelectField(props: RoleSelectFieldProps): ReactElement {
  const t = useT();
  return (
    <RoleSelect>
      {({ state, labelFor }) => {
        const control = matchList(state, {
          loading: () => (
            <Select<string>
              value={props.value}
              loading
              open={false}
              size={props.size ?? "middle"}
              style={{ width: "100%" }}
              aria-label={props.label}
              options={[{ value: props.value, label: labelFor(props.value) }]}
              onChange={props.onChange}
              disabled
              data-disabled-reason="the role registry is still loading; the current role is shown meanwhile"
              {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
            />
          ),
          // A failed registry read is not an empty registry, and neither is a
          // picker. The role still READS; only the choice is withdrawn.
          failed: () => (
            <Flex vertical gap={spacing["1"]} align="flex-start">
              <Typography.Text>{labelFor(props.value)}</Typography.Text>
              <Muted testId={props.testId !== undefined ? `${props.testId}-blocked` : undefined}>
                {t(WORKSPACES_I18N_KEYS.rolesLoadFailed)}
              </Muted>
            </Flex>
          ),
          empty: () => (
            <Flex vertical gap={spacing["1"]} align="flex-start">
              <Typography.Text>{labelFor(props.value)}</Typography.Text>
              <Muted>{t(WORKSPACES_I18N_KEYS.rolesLoadFailed)}</Muted>
            </Flex>
          ),
          ready: (roles) => {
            const offered: readonly RoleInfo[] =
              props.excludeOwner === true
                ? roles.filter((role) => role.role !== OWNER_ROLE)
                : roles;
            const rankOf = new Map(offered.map((role) => [role.role, role.rank]));
            const options = offered.map((role) => ({
              value: role.role,
              label: labelFor(role.role),
            }));
            // The member's CURRENT role may be missing from the offered set
            // (an overlay role a deployment removed, or `owner` on the invite
            // path). Antd would render the bare key for it; the registry's
            // own label is better, and the row must keep showing what the
            // person actually holds.
            const hasCurrent = options.some((option) => option.value === props.value);
            const allOptions = hasCurrent
              ? options
              : [{ value: props.value, label: labelFor(props.value) }, ...options];
            return (
              <Select<string>
                value={props.value}
                onChange={props.onChange}
                size={props.size ?? "middle"}
                style={{ width: "100%" }}
                aria-label={props.label}
                {...(props["aria-describedby"] !== undefined
                  ? { "aria-describedby": props["aria-describedby"] }
                  : {})}
                {...(props.disabled !== undefined ? { disabled: props.disabled } : {})}
                options={allOptions}
                optionRender={(option) => {
                  const rank = rankOf.get(String(option.value));
                  return (
                    <Flex vertical gap={spacing["0"]}>
                      <span>{option.label}</span>
                      {rank !== undefined && (
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: fontSize.xs.fontSize }}
                        >
                          {t(WORKSPACES_I18N_KEYS.roleRankCaption, { rank })}
                        </Typography.Text>
                      )}
                    </Flex>
                  );
                }}
                {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
              />
            );
          },
        });
        if (props.showLabel !== true) return control;
        return (
          <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
            <Typography.Text>{props.label}</Typography.Text>
            {control}
          </Flex>
        );
      }}
    </RoleSelect>
  );
}
