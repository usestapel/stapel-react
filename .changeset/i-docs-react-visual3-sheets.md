---
"@stapel/docs-react": minor
---

The dialogs go dark, "Actions" becomes an affordance, and "OK" learns what it
does.

**Every dialog and every pane carries its own theme.** `NameDialog`,
`MoveDialog` and `NewDocumentDialog` render into a portal, so they inherit a
`ConfigProvider` only from the tree they are DECLARED in. The header comment
claimed the owning pane's `SkinTheme` covered them; the visual pass photographed
the result — a WHITE sheet over a black page in every dark shot (CF-1 / N-1).
Each dialog now declares `<SkinTheme surface="bare">` around itself and takes a
`mode`. The same applies to the panes: `DocumentListPane`, `FolderTreePane`,
`TrashPane`, `FileManagerBreadcrumbs`, `FileCard` and `EditorChrome` are mounted
standalone as often as inside `<FileManager>`, and unthemed antd is where this
package's SECOND brand blue came from (`#007aff` in the document list and trash
against `#4f46e5` in the file manager — N-8). They self-theme now, and
`<FileManager>` forwards its `mode` to all of them.

**`<FileManager>` paints the page, not a panel.** `surface="base"` instead of
the default `raised`: as a raised panel it drew a slightly lighter box that
stopped at content height with a hard edge over the page's own background, and
the segmented controls inside it — designed against a layout background — read
as holes punched in the panel. Its two tab groups no longer both say "Files":
the pane switch is `Folders | Documents`, which is also what the pane lists.

**The row's overflow action is an icon button.** `Typography.Link` reading
"Actions" — a control named after its own category, three times per screen, with
no icon, no affordance and a touch target well under 44px, pinned to the far
edge of a full-bleed list with ~1400px of dead gap before it — is now a shared
`<RowActions>`: the ⋯ glyph as inline SVG (no icon-font dependency), the
category name moved to `aria-label`, at the antd control height. The list panes
also gained a `READING_MEASURE` cap, so a desktop row is a row and not a
1900px-wide gap.

**Confirms name their action.** "OK" is what a button says when nobody decided
what it does. Rename says Rename, new-folder says Create folder, move says Move,
new-document says Create — and the blocked reason stacks UNDER the affirmative
instead of trailing past the right edge of a 390px sheet. Same fix for
`RevisionsModal`'s Restore, whose inline reason ("This is the document's current
version.") ran off the sheet and cut the row in half.

**Two states stop lying.** `FileManagerBreadcrumbs` draws a skeleton while the
folder read is in flight — it used to render the finished root crumb, which made
`loading` and `root` pixel-identical in a package that already ships a skeleton
for the file list. `FileCard`'s download mint says "Preparing the download
link…" instead of four unlabelled skeleton bars that read the same as a stuck
screen.

**An openable row says so.** The document title is a link button when the host
passed `onOpenDocument` and plain text when it did not, so the §83 rule the
`no-open-route` variant exists to prove is finally visible (it is a
`Button type="link"`, not `Typography.Link`, because antd's
`.ant-list-item-meta-title > a` rule repaints an anchor in there to the plain
text colour). `RevisionsModal`'s redundant `desktop` variant is gone: the
surface is width-driven, so the shot runner photographing the story at both
widths already covered it.

Tests updated where the copy they assert changed (the affirmative's label, and
`<FileManager/>`'s root now painting the layout surface); nothing was relaxed.
10 demos, 15/15 skin covered under `DEMOS_SKIN_GATE=strict`.
