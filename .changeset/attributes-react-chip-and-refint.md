---
"@stapel/attributes-react": patch
---

Two things a person met and nothing on screen showed.

**A chip announced its storage code.** `chipOptions` wraps every label in a
`<span>` under `touchFloor`, which makes the label a node — and the substrate,
having no string form for a node, named the id-carrying chip after
`option.value`. Every group's first chip in the composer was read out as its
code. `chipOptions` now states `ariaLabel` from the plain `choice.label` on
every chip: it is the one place holding both the words and the node built out
of them.

**The vocabulary-backed `int` drew a bare keypad for three different
situations.** A year with `optionsRef` scoped by a parent rendered the same
plain number box whether the allowed set was missing, in flight, or waiting on
a parent nobody had answered. Two of the three are not "there is no set":

- while the fetch is in flight the row is marked busy (`data-state="loading"`,
  `aria-busy`) with a spinner where the steppers will land, instead of claiming
  to be a free-text number until the constraint arrives under the hand;
- while the parent is unanswered (`data-state="awaiting-parent"`) the keypad is
  switched off WITH its reason — "Choose Generation first." — rather than
  offering a box that will refuse every number it is given. The parent's NAME
  comes from a new `ValueEditorProps.siblingNames`, filled by `<FeatureFields>`
  from the feature list it already holds, because the alternative was printing
  a storage slug at a person.

The third — no client, a failed fetch, a page-capped answer — genuinely is
"this side cannot know the set", and the keypad is unchanged there.

**And a refusal now says what IS allowed.** `not_in_options` renders as "Value
is not in allowed options for Year", which names the mistake and not the fix;
where the set is loaded, its ends are said beside it.
