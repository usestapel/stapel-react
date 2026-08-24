import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  isStapelApiError,
  loadStateFromQuery,
} from "@stapel/core";
import type {
  ActionAvailability,
  LoadState,
  StapelApiError,
} from "@stapel/core";
import type { FormPatchRequest, FormRow, FormSettings } from "../api/types.js";
import { useForm } from "../model/queries.js";
import { useUpdateForm } from "../model/mutations.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/**
 * Headless form settings — the ONLY writer of `Form.settings`, renderless.
 *
 * ── Why this component exists ──────────────────────────────────────────────
 *
 * `PATCH /forms/<id>` is the only route that writes `Form.settings`, and
 * `Form.settings` is where a form's notification DESTINATIONS live
 * (`notify_emails`, `notify_telegram_chat_ids` — stapel-forms MODULE.md §9)
 * together with its retention override. Until this bag existed the pair
 * exported `useUpdateForm` with no caller anywhere, which meant a form built
 * entirely through the shipped skin collected responses that reached nobody:
 * the backend's whole `form.submission.received` → notification half was
 * unreachable from the product.
 *
 * ── What is mirrored and what is not ───────────────────────────────────────
 *
 * `retention_days` is mirrored HALFWAY on purpose. The server accepts an
 * integer `>= 1` that does not exceed `STAPEL_FORMS["RETENTION_DAYS"]` — an
 * override may only SHORTEN the deployment's promise — and refuses with
 * `error.400.forms_invalid_retention` carrying `params.limit`. The `>= 1` half
 * is knowable here and is blocked here; the CEILING is a deployment setting no
 * client can read, so it arrives as the server's own refusal rather than as a
 * guess with a number in it.
 *
 * The destination lists are NOT validated. `services._validated_settings`
 * validates retention and passes the rest of the bag through, so a client-side
 * refusal of an address the server accepts would be a verdict this pair has no
 * standing to give. A malformed address is surfaced as a non-blocking notice
 * beside the field (`suspectEmails`) — visible, never a gate.
 */
export interface FormSettingsEditorBag {
  /** The form being configured. Everything below is meaningless until ready. */
  readonly state: LoadState<FormRow>;

  readonly title: string;
  setTitle(next: string): void;
  /** `settings.notify_emails`. */
  readonly notifyEmails: readonly string[];
  setNotifyEmails(next: readonly string[]): void;
  /** `settings.notify_telegram_chat_ids` — a CHAT id, with no account behind
   * it (stapel-forms MODULE.md §9). */
  readonly notifyTelegramChatIds: readonly string[];
  setNotifyTelegramChatIds(next: readonly string[]): void;
  /** `settings.retention_days`, or `null` for "the deployment's own period". */
  readonly retentionDays: number | null;
  setRetentionDays(next: number | null): void;

  /** Entries of {@link notifyEmails} that do not look like addresses. A NOTICE
   * for the skin to print, never a reason to block the save. */
  readonly suspectEmails: readonly string[];
  /** True when at least one destination is configured — the fact that decides
   * whether a submitted response reaches a human at all. */
  readonly hasDestination: boolean;

  readonly dirty: boolean;
  readonly save: ActionAvailability;
  doSave(): void;
  readonly isSaving: boolean;
  /** True after a save that succeeded, until the next edit. */
  readonly saved: boolean;

  readonly error: StapelApiError | null;
  refetch(): void;
}

/** The draft this bag edits — the three settings keys plus the title. */
interface Draft {
  readonly title: string;
  readonly notifyEmails: readonly string[];
  readonly notifyTelegramChatIds: readonly string[];
  readonly retentionDays: number | null;
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function retentionOf(settings: FormSettings | undefined): number | null {
  const raw = settings?.retention_days;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function draftOf(row: FormRow | undefined): Draft {
  return {
    title: row?.title ?? "",
    notifyEmails: stringList(row?.settings?.notify_emails),
    notifyTelegramChatIds: stringList(row?.settings?.notify_telegram_chat_ids),
    retentionDays: retentionOf(row?.settings),
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, i) => entry === b[i]);
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    a.retentionDays === b.retentionDays &&
    sameList(a.notifyEmails, b.notifyEmails) &&
    sameList(a.notifyTelegramChatIds, b.notifyTelegramChatIds)
  );
}

/**
 * A pragmatic "does this look like an address" shape check. Deliberately
 * loose: it exists to catch a typed comma or a missing `@`, not to adjudicate
 * RFC 5322 — the server does not validate these at all, so anything stricter
 * here would refuse addresses the deployment would happily have used.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

/**
 * Build the PATCH body. Only what CHANGED is sent, and `settings` is sent as
 * a whole bag with the host's own unknown keys preserved: `PATCH` replaces
 * `settings` wholesale (`services.update_form` → `_validated_settings`), so
 * sending only the three keys this pair drives would silently delete every
 * key a host put there.
 */
function patchFor(
  row: FormRow,
  draft: Draft,
  baseline: Draft
): FormPatchRequest {
  const patch: {
    title?: string;
    settings?: Record<string, unknown>;
  } = {};
  if (draft.title !== baseline.title) patch.title = draft.title;
  const settingsChanged =
    !sameList(draft.notifyEmails, baseline.notifyEmails) ||
    !sameList(draft.notifyTelegramChatIds, baseline.notifyTelegramChatIds) ||
    draft.retentionDays !== baseline.retentionDays;
  if (settingsChanged) {
    const next: Record<string, unknown> = { ...row.settings };
    next["notify_emails"] = [...draft.notifyEmails];
    next["notify_telegram_chat_ids"] = [...draft.notifyTelegramChatIds];
    // An absent key means "the deployment's own period"; writing `null` would
    // store a key the purge job then has to interpret.
    if (draft.retentionDays === null) delete next["retention_days"];
    else next["retention_days"] = draft.retentionDays;
    patch.settings = next;
  }
  return patch;
}

/**
 * The settings surface's state machine. Loads the form, holds an editable
 * draft over it, and drives `PATCH /forms/<id>`.
 */
export function FormSettingsEditor(props: {
  workspaceId: string;
  formId: string;
  /** Called with the updated row after a save the server accepted. */
  onSaved?: (form: FormRow) => void;
  children: (bag: FormSettingsEditorBag) => ReactNode;
}): ReactNode {
  const query = useForm(props.workspaceId, props.formId);
  const state = loadStateFromQuery(query);
  const row = state.status === "ready" ? state.data : undefined;

  const baseline = useMemo(() => draftOf(row), [row]);
  const [draft, setDraft] = useState<Draft>(baseline);
  const [error, setError] = useState<StapelApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const update = useUpdateForm();

  // Re-seed the draft when a DIFFERENT server row arrives (a first load, a
  // refetch after a save, a switch to another form) — never on every render,
  // which would throw away what the person is typing.
  const seededFrom = useRef<string | null>(null);
  useEffect(() => {
    if (row === undefined) return;
    const stamp = `${row.id}:${row.updated_at}`;
    if (seededFrom.current === stamp) return;
    seededFrom.current = stamp;
    setDraft(draftOf(row));
  }, [row]);

  const edit = useCallback((patch: Partial<Draft>): void => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const dirty = row !== undefined && !sameDraft(draft, baseline);

  const suspectEmails = useMemo(
    () => draft.notifyEmails.filter((entry) => !EMAIL_SHAPE.test(entry)),
    [draft.notifyEmails]
  );

  const hasDestination =
    draft.notifyEmails.length > 0 || draft.notifyTelegramChatIds.length > 0;

  const save: ActionAvailability = useMemo(() => {
    if (row === undefined) {
      return actionBlocked(FORMS_I18N_KEYS.settingsBlockedLoading);
    }
    if (update.isPending) {
      return actionBlocked(FORMS_I18N_KEYS.settingsBlockedSaving);
    }
    if (draft.retentionDays !== null && draft.retentionDays < 1) {
      return actionBlocked(FORMS_I18N_KEYS.settingsBlockedRetention);
    }
    if (draft.title.trim().length === 0) {
      return actionBlocked(FORMS_I18N_KEYS.settingsBlockedNoTitle);
    }
    if (!dirty) return actionBlocked(FORMS_I18N_KEYS.settingsBlockedNoChanges);
    return actionAvailable();
  }, [row, update.isPending, draft.retentionDays, draft.title, dirty]);

  const doSave = useCallback((): void => {
    if (row === undefined || !save.available) return;
    setError(null);
    update.mutate(
      {
        workspaceId: props.workspaceId,
        formId: props.formId,
        patch: patchFor(row, draft, baseline),
      },
      {
        onError: (caught: unknown) => {
          setError(isStapelApiError(caught) ? caught : null);
        },
        onSuccess: (updated) => {
          setSaved(true);
          props.onSaved?.(updated);
        },
      }
    );
  }, [row, save.available, update, props, draft, baseline]);

  return props.children({
    state,
    title: draft.title,
    setTitle: (title) => edit({ title }),
    notifyEmails: draft.notifyEmails,
    setNotifyEmails: (notifyEmails) => edit({ notifyEmails }),
    notifyTelegramChatIds: draft.notifyTelegramChatIds,
    setNotifyTelegramChatIds: (notifyTelegramChatIds) =>
      edit({ notifyTelegramChatIds }),
    retentionDays: draft.retentionDays,
    setRetentionDays: (retentionDays) => edit({ retentionDays }),
    suspectEmails,
    hasDestination,
    dirty,
    save,
    doSave,
    isSaving: update.isPending,
    saved,
    error,
    refetch: () => {
      void query.refetch();
    },
  });
}
