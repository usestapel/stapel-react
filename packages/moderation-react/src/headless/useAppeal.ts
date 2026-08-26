/**
 * The appeal bag (DSA Art. 20): one composer, and the list of what was already
 * sent.
 *
 * ── `no_case` is a designed state, not a missing prop ─────────────────────
 *
 * `POST appeals/` needs a `case_id`, and the subject of a decision has NO
 * endpoint that lists cases about them — `GET cases` and `GET cases/{id}` are
 * both behind the moderation mandate. The id reaches a person exactly one way:
 * the `?case=<uuid>` deep link in the takedown notification. So an absent id
 * parks the machine in `no_case` and the panel EXPLAINS that, instead of
 * drawing a text box whose submit could never light up.
 */
import { useCallback, useMemo, useState } from "react";
import {
  STAPEL_UI_KEYS,
  actionAvailable,
  actionBlocked,
  firstBlock,
  useFlow,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Appeal } from "../api/types.js";
import { appealRefused, createAppealFlow } from "../flows/appealFlow.js";
import type { AppealFlowState } from "../flows/appealFlow.js";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { useModerationAnalytics } from "../model/context.js";
import { useMyAppealsQuery, useSubmitAppeal } from "../model/queries.js";
import type { PagedRows } from "../model/queries.js";

export interface UseAppealOptions {
  /** From the notification's `?case=` link. Absent = the `no_case` arm. */
  readonly caseId?: string;
  /** Set when the appeal is about the CONSEQUENCE rather than the decision. */
  readonly sanctionId?: string;
}

export interface AppealBag {
  readonly body: string;
  readonly setBody: (text: string) => void;
  readonly submit: ActionAvailability;
  readonly run: () => void;
  readonly state: AppealFlowState;
  /** The appeals this account already filed, keyset-paged. */
  readonly rows: PagedRows<Appeal>;
  readonly loadMore: ActionAvailability;
  readonly reset: () => void;
}

export function useAppeal(options: UseAppealOptions = {}): AppealBag {
  const analytics = useModerationAnalytics();
  const caseId = options.caseId ?? "";
  const machine = useMemo(
    () => createAppealFlow({ analytics, ...(caseId !== "" ? { caseId } : {}) }),
    [analytics, caseId]
  );
  const state = useFlow(machine);
  const submitAppeal = useSubmitAppeal();
  const rows = useMyAppealsQuery();
  const [body, setBody] = useState("");

  const submit = firstBlock(
    caseId === "" ? actionBlocked(MODERATION_I18N_KEYS.appealNeedLink) : actionAvailable(),
    body.trim() === ""
      ? actionBlocked(MODERATION_I18N_KEYS.appealBlockedEmpty)
      : actionAvailable(),
    state.step === "submitting"
      ? actionBlocked(MODERATION_I18N_KEYS.appealBlockedInFlight)
      : actionAvailable()
  );

  const run = useCallback((): void => {
    if (!submit.available) return;
    void machine.run(
      { step: "submitting", caseId },
      () =>
        submitAppeal.mutateAsync({
          caseId,
          body: body.trim(),
          ...(options.sanctionId !== undefined
            ? { sanctionId: options.sanctionId }
            : {}),
        }),
      {
        resolve: (appeal) => ({ step: "submitted" as const, appealId: appeal.id }),
        reject: (error) => appealRefused(error),
      }
    );
  }, [body, caseId, machine, options.sanctionId, submit.available, submitAppeal]);

  return {
    body,
    setBody,
    submit,
    run,
    state,
    rows,
    loadMore: rows.loadingMore
      ? actionBlocked(STAPEL_UI_KEYS.loading)
      : actionAvailable(),
    reset: useCallback((): void => {
      setBody("");
      machine.to(caseId !== "" ? { step: "writing", caseId } : { step: "no_case" });
    }, [caseId, machine]),
  };
}
