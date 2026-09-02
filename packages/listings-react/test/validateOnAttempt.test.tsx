/**
 * WHEN the mirror's refusals reach the fields (D54, walkers P4/P2).
 *
 * The staged storefront composer autosaves on every step change, and the flat
 * page saves on every blur — and `save()` used to arm `showErrors`, so a
 * person entering step 4 of an untouched form met two or three red
 * "field is required" lines before their first keystroke. Validation must
 * wake on a SUBMIT ATTEMPT (publish), not on the housekeeping saves:
 *
 *  - on mount: no field errors;
 *  - after save()/saveSoon() (autosave, blur-save, the draft button): still
 *    none — a draft is allowed to be incomplete, that is what a draft is;
 *  - after publish(): the mirror reaches the fields, with the engine's own
 *    sentences.
 *
 * Asserted on the bag (`useListingComposer`), since both skins draw
 * `fieldErrors` verbatim.
 */
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import { BUILTIN_VALUE_EDITOR_TYPES } from "@stapel/attributes-react/default";
import { useListingComposer } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";

const MANDATORY: FeatureDef = {
  slug: "condition",
  name: "Condition",
  mandatory: true,
  show_as_badge: false,
  show_at_title: false,
  translate: "all",
  config: {
    type: "select",
    options: [
      { value: "new", label: "New" },
      { value: "used", label: "Used" },
    ],
  },
};

function bagFor() {
  const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <TestProviders server={mockServer({})}>{children}</TestProviders>
  );
  return renderHook(
    () =>
      useListingComposer({
        features: [MANDATORY],
        editorTypes: BUILTIN_VALUE_EDITOR_TYPES,
        category: "phones",
        initialValues: {
          categoryId: "phones",
          title: "A listing",
          description: "A perfectly ordinary description, long enough.",
        },
      }),
    { wrapper }
  );
}

describe("the mirror reaches the fields on a submit attempt, never on a save", () => {
  it("mounts clean: the mirror knows what is missing, the fields say nothing yet", async () => {
    const { result } = bagFor();
    await waitFor(() => {
      expect(Object.keys(result.current.mirror)).toContain("condition");
    });
    expect(result.current.fieldErrors).toEqual({});
  });

  it("save() — the blur-save and the draft button — arms nothing", async () => {
    const { result } = bagFor();
    await waitFor(() => {
      expect(Object.keys(result.current.mirror)).toContain("condition");
    });
    act(() => {
      result.current.save();
    });
    await waitFor(() => {
      expect(result.current.saving).toBe(false);
    });
    expect(result.current.fieldErrors).toEqual({});
  });

  it("saveSoon() — the staged composer's step-change autosave — arms nothing", async () => {
    const { result } = bagFor();
    await waitFor(() => {
      expect(Object.keys(result.current.mirror)).toContain("condition");
    });
    act(() => {
      result.current.saveSoon();
    });
    await waitFor(() => {
      expect(result.current.saving).toBe(false);
    });
    expect(result.current.fieldErrors).toEqual({});
  });

  it("publish() — the submit attempt — is what puts the refusals on the fields", async () => {
    const { result } = bagFor();
    await waitFor(() => {
      expect(Object.keys(result.current.mirror)).toContain("condition");
    });
    act(() => {
      result.current.publish();
    });
    await waitFor(() => {
      expect(Object.keys(result.current.fieldErrors)).toContain("condition");
    });
  });
});
