// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MAX_FILTER_DEPTH,
  validateFilterText,
  validateFilterValue,
} from "../src/model/filter.js";
import { FILTER_MESSAGE_KEYS } from "../src/model/subscriptionForm.js";
import { WEBHOOKS_I18N_KEYS } from "../src/i18n/keys.js";

/**
 * The client's port of `filters.py:validate_filter`, refusal for refusal.
 *
 * The backend answers ONE code for every malformed predicate, with no position
 * in it. These tests are what makes the browser's sentence more useful than
 * that one: each refusal is asserted by the KEY it reports, so a copy change
 * cannot quietly turn "unknown operator $regex at city" back into "invalid".
 */
const K = FILTER_MESSAGE_KEYS;

function problem(text: string): string | undefined {
  const result = validateFilterText(text, K);
  return result.ok ? undefined : result.problem.code;
}

describe("an empty filter is not an error", () => {
  it("blank text means 'every event of this type'", () => {
    const result = validateFilterText("   ", K);
    expect(result.ok && result.value).toBeUndefined();
  });

  it("an empty object is the same thing", () => {
    const result = validateFilterText("{}", K);
    expect(result.ok && result.value).toBeUndefined();
  });
});

describe("the grammar the dispatcher will actually evaluate", () => {
  it("accepts the equality shorthand", () => {
    const result = validateFilterText('{"city": "Berlin"}', K);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({ city: "Berlin" });
  });

  it("accepts a dotted path", () => {
    expect(problem('{"owner.id": 7}')).toBeUndefined();
  });

  it("accepts every field operator", () => {
    expect(
      problem(
        '{"a": {"$eq": 1}, "b": {"$ne": 2}, "c": {"$in": [1]}, "d": {"$nin": [2]},' +
          ' "e": {"$gt": 1}, "f": {"$gte": 1}, "g": {"$lt": 1}, "h": {"$lte": 1},' +
          ' "i": {"$exists": true}, "j": {"$contains": "x"}, "k": {"$prefix": "y"}}'
      )
    ).toBeUndefined();
  });

  it("accepts the three group operators", () => {
    expect(
      problem('{"$or": [{"a": 1}, {"$and": [{"b": 2}]}], "$not": {"c": 3}}')
    ).toBeUndefined();
  });

  it("keeps `null` as 'the key IS null', with no shorthand for 'absent'", () => {
    // `{"city": null}` is a legal equality against null. "Lacks the key" is
    // `$exists: false` and nothing else — conflating them is how a filter
    // silently widens, so neither the grammar nor this port has a shortcut.
    const result = validateFilterText('{"city": null}', K);
    expect(result.ok && result.value).toEqual({ city: null });
    expect(problem('{"city": {"$exists": false}}')).toBeUndefined();
  });
});

describe("every refusal names what it saw", () => {
  it("unparseable text", () => {
    expect(problem("{oops")).toBe(WEBHOOKS_I18N_KEYS.filterNotJson);
  });

  it("a predicate that is not an object", () => {
    expect(problem("[1, 2]")).toBe(WEBHOOKS_I18N_KEYS.filterNotObject);
  });

  it("an unknown GROUP operator", () => {
    expect(problem('{"$nor": [{"a": 1}]}')).toBe(
      WEBHOOKS_I18N_KEYS.filterUnknownGroupOp
    );
  });

  it("an unknown FIELD operator — the regex the module refuses on purpose", () => {
    // No regular expressions, ever: a predicate is evaluated in the dispatcher
    // once per matching event, and a regex there is a catastrophic-backtracking
    // lever pointed at every other subscriber.
    expect(problem('{"city": {"$regex": "^Ber"}}')).toBe(
      WEBHOOKS_I18N_KEYS.filterUnknownFieldOp
    );
  });

  it("$or / $and with something other than a non-empty list", () => {
    expect(problem('{"$or": {}}')).toBe(WEBHOOKS_I18N_KEYS.filterGroupNeedsList);
    expect(problem('{"$and": []}')).toBe(WEBHOOKS_I18N_KEYS.filterGroupNeedsList);
  });

  it("an empty operator object", () => {
    expect(problem('{"city": {}}')).toBe(WEBHOOKS_I18N_KEYS.filterEmptyMatcher);
  });

  it("a malformed payload path", () => {
    expect(problem('{"owner..id": 1}')).toBe(WEBHOOKS_I18N_KEYS.filterBadPath);
  });

  it("an empty key", () => {
    expect(problem('{"": 1}')).toBe(WEBHOOKS_I18N_KEYS.filterBadKey);
  });

  it("operand types, per operator", () => {
    expect(problem('{"a": {"$in": 1}}')).toBe(WEBHOOKS_I18N_KEYS.filterOpNeedsList);
    expect(problem('{"a": {"$exists": "yes"}}')).toBe(
      WEBHOOKS_I18N_KEYS.filterOpNeedsBoolean
    );
    expect(problem('{"a": {"$prefix": 1}}')).toBe(
      WEBHOOKS_I18N_KEYS.filterOpNeedsString
    );
    expect(problem('{"a": {"$gt": "1"}}')).toBe(
      WEBHOOKS_I18N_KEYS.filterOpNeedsNumber
    );
  });

  it("a boolean is not a number for the ordering operators", () => {
    // Python's `bool` IS a `Number`, so the backend excludes it explicitly;
    // ordering booleans against numbers is never what an author meant.
    expect(problem('{"a": {"$gte": true}}')).toBe(
      WEBHOOKS_I18N_KEYS.filterOpNeedsNumber
    );
  });
});

describe("depth is bounded, and the refusal says by how much", () => {
  const nest = (depth: number): unknown => {
    let node: unknown = { a: 1 };
    for (let i = 1; i < depth; i += 1) node = { $not: node };
    return node;
  };

  it(`accepts exactly ${String(MAX_FILTER_DEPTH)} levels`, () => {
    const result = validateFilterValue(nest(MAX_FILTER_DEPTH), K);
    expect(result.ok).toBe(true);
  });

  it("refuses one level deeper, naming the limit", () => {
    const result = validateFilterValue(nest(MAX_FILTER_DEPTH + 1), K);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.code).toBe(WEBHOOKS_I18N_KEYS.filterTooDeep);
      expect(result.problem.params["limit"]).toBe(MAX_FILTER_DEPTH);
    }
  });

  it("counts depth through $or/$and branches too", () => {
    const deep = { $or: [{ $or: [{ $or: [{ $or: [{ a: 1 }] }] }] }] };
    const result = validateFilterValue(deep, K);
    expect(result.ok).toBe(false);
  });
});
