---
"@stapel/categories-react": minor
---

Attribute types become words, the picker becomes a field, and one failure is
stated once.

**C-DEVCOPY, the package's worst.** `categories.features.type` was literally
`"{type}"`, so a public category page badged its attributes `select`, `int`,
`bool` — and a host's own `holo_signature`. Every value type this build knows
now has a translated word (en/ru/es) behind `FEATURE_TYPE_LABEL_KEYS`, and a
type the table does not carry says "Another kind of detail" instead of its
identifier. The machine name stays on the element as `data-feature-type`, where
a test reads it and a person does not. `Required` also stops being drawn in the
danger token — it is a fact about the field, not a failure.

**NC-FLEXINBUTTON.** `<Flex justify="space-between">` inside an antd `Button`
shrink-wraps, so every option row came out centred with the chevron hugging the
label. The flex lives on the button now, rows are on the 44px floor, and the
phone TRIGGER is a field: a visible label, the value leading, a caret at the
end. `defaultOpen` mounts the sheet OPEN — the phone story photographed a closed
trigger, so the sheet it documents had no pixels.

**NC-DUPESTATE.** The carousel and the tree read the SAME catalogue, so an empty
or failed one was drawn twice — two stacked `Empty` blocks, two red alerts each
with its own retry. `CatalogPage` answers for both parts and renders them only
when there is something to render. `CategoryBreadcrumbsBar` gains
`onAbsent="quiet"`, which `CategoryPage` passes: one outage no longer produces a
bare red sentence with a blue link on top of a designed error panel, and an
unknown slug is not announced twice. That dead end now carries the "Back to the
catalogue" link its own hint used to promise without offering.

Tree rows are whole-row links on the touch floor with a chevron for a branch
(they were 24px words inside 41px rows); catalogue screens get a measure, so the
"2 subcategories" chip stops sitting 2,300px from the label it counts; and the
truncation notice stops explaining cache semantics to a shopper.
