---
"@stapel/categories-react": minor
---

`<CategoryPage breadcrumbs>` and a picker that stops printing its label twice.

**The trail is a deployment's decision.** `breadcrumbs={false}` mounts no
crumb bar — absent from the document, not covered. Which chrome carries "where
am I" is a navigation decision and both answers are right: on a desktop the
trail IS the catalogue's navigation, the only affordance on screen for moving
back up the tree; on a phone the reference design gives that job to the app
bar's back arrow, and a crumb row above the title repeats it in a second
visual language while spending one of four lines above the fold. A live
classified deployment had exactly that, as a `display: none` under a media
query with an upstream ask attached — and a host hiding a pair's output with a
stylesheet is the pair's bug.

**The picker's visible heading goes.** `<CategoryPickerField>` is mounted
inside somebody else's form, whose form item already prints "Category" above
it; a second copy underneath is the same word twice in two type sizes, which
reads as two stacked controls. It is dropped from the SCREEN and not from the
accessibility tree — mounted bare, the trigger would otherwise be a button
whose only name is the value inside it ("Phones, button", with nothing saying
what Phones is a choice OF), so the name is still authored, still translated,
and `visuallyHidden` keeps it in the tree, joined to the value rather than
replacing it. The SHEET keeps its visible title on the same key: there the
word duplicates nothing, and a dialog with no header is a panel that appeared.
