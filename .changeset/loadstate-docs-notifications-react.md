---
"@stapel/docs-react": minor
"@stapel/notifications-react": minor
---

Headless bags hand out a `LoadState` instead of a flattened array, so a failed
read can no longer be mistaken for an empty one: `DocumentListBag`,
`FolderTreeBag`, `BreadcrumbsBag`, `RevisionHistoryBag`, `TrashBag`,
`MediaViewerBag` and `NotificationFeedBag` expose `state` (plus `urlState` on
the media bag) and drop their `isLoading`/`isError`/`error` read fields; the
default skins render through `matchList`/`matchLoad`, so the empty state is
reachable only from a load that actually succeeded.

Controls that switch off because a read failed now say why: "Empty trash"
(`TrashPane`) and the download button (`FileCard`) go through
`useActionGate` and render the reason as text beside the control.
