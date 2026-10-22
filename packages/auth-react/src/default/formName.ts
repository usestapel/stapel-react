import { useId } from "react";

/**
 * A per-instance antd `Form` name. antd derives every field's DOM id from
 * `<form name>_<field name>`, and without a form name the id is the bare
 * field name: the email and phone tabs both rendered `id="value"`, so a
 * label, an autofill hint or `getElementById` could land on the wrong tab.
 */
export function useFormName(prefix: string): string {
  return `${prefix}-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
}
