/**
 * The document types the default skin offers when creating a document.
 *
 * ── Why this is a list in the frontend at all ─────────────────────────────
 *
 * `stapel-docs`' type registry is an OPEN merge registry (builtins →
 * `STAPEL_DOCS["DOC_TYPES"]` overlay → runtime `register_doc_type`), and it
 * publishes NO endpoint that lists it: the 27 operations of `docs/schema.json`
 * carry no `/types` read, and a document's envelope names its own type but
 * nothing enumerates the registry. So a "New document" control cannot ask the
 * server what it may create — recorded as a backend gap in the wave's
 * REQUESTS file (a `GET /types` read would let this list be a query instead
 * of a constant).
 *
 * Until then the default below is the smallest honest answer: the three
 * EDITABLE builtins (`doc_types.py`'s `txt` / `md` / `csv`). `file` is
 * deliberately absent — its spec is `body_mutable=False`, so its body may only
 * be produced by an upload session, and offering it here would be a control
 * that creates a document nobody can put bytes into. A deployment that
 * registers its own type passes its own list to the surface
 * (`FileManager.documentTypes`) rather than forking the skin.
 */
import { DOCS_I18N_KEYS } from "../i18n/keys.js";

/** One creatable document type: the registry slug plus the key naming it. */
export interface DocumentTypeOption {
  /** The `type` slug sent as `DocumentCreate.type`. */
  readonly type: string;
  /** i18n key for the human name shown in the picker. */
  readonly labelKey: string;
}

/** The three editable builtins of stapel-docs' type registry (see above). */
export const DEFAULT_DOCUMENT_TYPES: readonly DocumentTypeOption[] = [
  { type: "txt", labelKey: DOCS_I18N_KEYS.typeText },
  { type: "md", labelKey: DOCS_I18N_KEYS.typeMarkdown },
  { type: "csv", labelKey: DOCS_I18N_KEYS.typeCsv },
];
