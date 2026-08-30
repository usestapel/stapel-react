/**
 * A two-level phone catalogue, in memory, plus the {@link VocabularyClient}
 * over it.
 *
 * A LEGITIMATE stand-in, not a mock of the thing under test: the seam IS two
 * async functions, so an implementation of it is the only way to photograph a
 * control that would otherwise need a running stapel-vocabularies. The wire
 * client (`createVocabularyClient`) is exercised against a stubbed `fetch` with
 * real `Response` bodies in `test/client.test.ts`, which is where the transport
 * belongs.
 *
 * The rows are the shape the real catalogue has — a vendor level whose terms
 * have children, and a model level narrowed by the vendor's code — so the
 * screenshots show the same ranking and the same "children of the chosen
 * parent" behaviour a stand does.
 */
import type { VocabularyClient, VocabularyTerm } from "../src/client.js";

interface Row {
  readonly level: string;
  readonly code: string;
  readonly label: string;
  readonly parent?: string;
}

export const PHONE_ROWS: readonly Row[] = [
  { level: "Vendor", code: "apple", label: "Apple" },
  { level: "Vendor", code: "samsung", label: "Samsung" },
  { level: "Vendor", code: "xiaomi", label: "Xiaomi" },
  { level: "Vendor", code: "google", label: "Google" },
  { level: "Model", code: "iphone-15-pro", label: "iPhone 15 Pro", parent: "apple" },
  { level: "Model", code: "iphone-15", label: "iPhone 15", parent: "apple" },
  { level: "Model", code: "iphone-14", label: "iPhone 14", parent: "apple" },
  { level: "Model", code: "galaxy-s24", label: "Galaxy S24", parent: "samsung" },
  { level: "Model", code: "galaxy-a55", label: "Galaxy A55", parent: "samsung" },
  { level: "Model", code: "redmi-note-13", label: "Redmi Note 13", parent: "xiaomi" },
  { level: "Model", code: "pixel-8-pro", label: "Pixel 8 Pro", parent: "google" },
];

/** Prefix matches first, then by label — the ordering the server promises, so
 * a demo does not document a ranking nobody ships. */
function rank(rows: readonly Row[], query: string): readonly Row[] {
  const needle = query.trim().toLowerCase();
  const matched = rows.filter((row) => row.label.toLowerCase().includes(needle));
  return [...matched].sort((a, b) => {
    const ap = a.label.toLowerCase().startsWith(needle) ? 0 : 1;
    const bp = b.label.toLowerCase().startsWith(needle) ? 0 : 1;
    return ap - bp || a.label.localeCompare(b.label);
  });
}

export function demoVocabularyClient(rows: readonly Row[] = PHONE_ROWS): VocabularyClient {
  return {
    search(_vocabulary, level, query, parent): Promise<readonly VocabularyTerm[]> {
      const found = rank(
        rows.filter(
          (row) => row.level === level && (parent === undefined || row.parent === parent)
        ),
        query
      ).map((row) => ({
        code: row.code,
        label: row.label,
        has_children: rows.some((child) => child.parent === row.code),
      }));
      return Promise.resolve(found);
    },
    resolve(_vocabulary, level, codes): Promise<Readonly<Record<string, string>>> {
      const out: Record<string, string> = {};
      for (const row of rows) {
        if (row.level === level && codes.includes(row.code)) out[row.code] = row.label;
      }
      return Promise.resolve(out);
    },
  };
}
