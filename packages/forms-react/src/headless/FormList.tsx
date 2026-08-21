import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { isStapelApiError, loadStateFromQuery } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { FormCreateRequest, FormRow, FormState } from "../api/types.js";
import { useForms } from "../model/queries.js";
import { useCreateForm } from "../model/mutations.js";

/** The bag `<FormList>` hands its render prop. */
export interface FormListBag {
  /**
   * The workspace's forms as a state a skin cannot flatten. Render with
   * core's `matchList` — its four required arms are what keeps "no forms yet"
   * a sentence that can only be said about a load that actually succeeded.
   */
  readonly state: LoadState<readonly FormRow[]>;
  /** The active state filter, or `null` for all. */
  readonly filter: FormState | null;
  setFilter(state: FormState | null): void;
  /** `forms.manage`. */
  create(input: Omit<FormCreateRequest, "workspace_id">): void;
  readonly isCreating: boolean;
  /** The last create refusal — `error.400.forms_too_many_open` carries the
   * workspace's cap in `params.limit`. */
  readonly error: StapelApiError | null;
  refetch(): void;
}

/**
 * Headless list of a workspace's forms — the admin surface's entry point,
 * renderless.
 */
export function FormList(props: {
  workspaceId: string;
  /** Called with the new form once the server creates it, so a skin can
   * navigate straight into the builder. */
  onCreated?: (form: FormRow) => void;
  children: (bag: FormListBag) => ReactNode;
}): ReactNode {
  const [filter, setFilter] = useState<FormState | null>(null);
  const [error, setError] = useState<StapelApiError | null>(null);
  const query = useForms(props.workspaceId, filter ?? undefined);
  const createMutation = useCreateForm();

  const create = useCallback(
    (input: Omit<FormCreateRequest, "workspace_id">): void => {
      setError(null);
      createMutation.mutate(
        { ...input, workspace_id: props.workspaceId },
        {
          onError: (caught: unknown) => {
            setError(isStapelApiError(caught) ? caught : null);
          },
          onSuccess: (form) => {
            props.onCreated?.(form);
          },
        }
      );
    },
    [createMutation, props]
  );

  return props.children({
    state: loadStateFromQuery(query),
    filter,
    setFilter,
    create,
    isCreating: createMutation.isPending,
    error,
    refetch: () => {
      void query.refetch();
    },
  });
}
