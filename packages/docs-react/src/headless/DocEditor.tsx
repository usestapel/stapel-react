import { useState } from "react";
import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { SaveConflict } from "../api/types.js";
import { useDocsApi } from "../model/context.js";
import { useDocumentContent } from "../model/queries.js";
import { useSaveContent } from "../model/mutations.js";

/** Render-prop bag for {@link DocEditor} — also what every registered editor
 * component receives (see `registerDocEditor`). */
export interface DocEditorBag {
  readonly documentId: string;
  /** The text being edited (the draft when dirty, else the loaded content). */
  readonly value: string;
  /** Replace the draft (marks the editor dirty until saved). */
  setValue(next: string): void;
  /**
   * Snapshot save at the loaded head (`PUT …/content` with `If-Match`). No-op
   * while the content has not loaded. On refusal the bag's `conflict` fills
   * instead of an error throwing — render it and offer {@link overrideSave}.
   */
  save(): void;
  /**
   * Resolve a conflict by force: re-reads the CURRENT head sequence and saves
   * this editor's value at it — the override lands as a new revision at the
   * new head (the other author's save stays in history; nothing is lost).
   */
  overrideSave(): void;
  /** The draft differs from the loaded/saved baseline. */
  readonly dirty: boolean;
  /** The content read is loading (no baseline yet). */
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  /** The last save was refused (409/412) — `{headSeq, savedBy, savedAt}`,
   * `null` fields when the refusal carried no body (bare 412). */
  readonly conflict: SaveConflict | null;
  /** The head sequence the next {@link save} sends as `If-Match` (`null`
   * until loaded, or if the backend omitted the seq header — then only
   * {@link overrideSave} can save). */
  readonly headSeq: number | null;
  readonly isError: boolean;
  /** Content-read or save failure (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Re-read the content (drops nothing: the dirty draft is kept). */
  reload(): void;
}

/**
 * Headless document editor — renderless wrapper over content-load + snapshot
 * save with the If-Match discipline (frontend-standard §2: zero visual
 * opinion). Hands a {@link DocEditorBag} to `children` — usually the editor
 * component resolved from the registry for the document's `editor_hint`:
 *
 * ```tsx
 * const Editor = resolveDocEditor(doc.editor_hint);
 * <DocEditor documentId={doc.id}>
 *   {(bag) => (Editor ? <Editor bag={bag} /> : <a href={…}>{t(key)}</a>)}
 * </DocEditor>
 * ```
 *
 * Save discipline: the loaded content carries `head_seq`; `save()` PUTs the
 * whole snapshot with `If-Match: <head_seq>`. A 409 (someone saved past us)
 * or 412 becomes the bag's `conflict` state — typed data, not an exception —
 * and `overrideSave()` re-reads the fresh head and lands this editor's value
 * as a new revision on top of it.
 */
export function DocEditor(props: {
  documentId: string;
  children: (bag: DocEditorBag) => ReactNode;
}): ReactNode {
  const api = useDocsApi();
  const contentQuery = useDocumentContent(props.documentId);
  const saveMutation = useSaveContent(props.documentId);

  const [baseline, setBaseline] = useState<{
    readonly text: string;
    readonly seq: number | null;
  } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);

  // Adopt freshly-read content as the baseline (render-phase state
  // adjustment — the React-sanctioned derived-state pattern; no effect
  // needed). A dirty draft is NEVER clobbered by a background refetch; a
  // draft that equals the new baseline stops being a draft.
  if (contentQuery.data !== undefined && contentQuery.dataUpdatedAt !== syncedAt) {
    setSyncedAt(contentQuery.dataUpdatedAt);
    setBaseline({
      text: contentQuery.data.text,
      seq: contentQuery.data.headSeq,
    });
    if (draft !== null && draft === contentQuery.data.text) setDraft(null);
  }

  const value = draft ?? baseline?.text ?? "";
  const contentType = contentQuery.data?.mimeType ?? null;

  function runSave(ifMatchSeq: number): void {
    const body = draft ?? baseline?.text ?? "";
    saveMutation.mutate(
      {
        body,
        ifMatchSeq,
        ...(contentType !== null ? { contentType } : {}),
      },
      {
        onSuccess: (result) => {
          if (result.status === "saved") {
            setBaseline({ text: body, seq: result.headSeq });
            setDraft(null);
            setConflict(null);
          } else {
            setConflict(result.conflict);
          }
        },
      }
    );
  }

  return props.children({
    documentId: props.documentId,
    value,
    setValue: (next) => {
      setDraft(next);
    },
    save: () => {
      if (baseline?.seq == null || saveMutation.isPending) return;
      runSave(baseline.seq);
    },
    overrideSave: () => {
      if (saveMutation.isPending) return;
      void (async () => {
        // Re-read the CURRENT head — the override is an informed save at the
        // new sequence, landing as a new revision (nothing is overwritten out
        // of history).
        const fresh = await api.getDocument(props.documentId);
        runSave(fresh.head_seq);
      })();
    },
    dirty: draft !== null && draft !== (baseline?.text ?? ""),
    isLoading: contentQuery.isLoading,
    isSaving: saveMutation.isPending,
    conflict,
    headSeq: baseline?.seq ?? null,
    isError: contentQuery.isError || saveMutation.isError,
    error: contentQuery.error ?? saveMutation.error ?? null,
    reload: () => {
      void contentQuery.refetch();
    },
  });
}
