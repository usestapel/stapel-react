---
"@stapel/search-react": patch
---

search: two things stop moving when the answer lands late (D465, D466)

Both measured by a desktop walker on a live stand, and both the same shape —
chrome drawn from the ANSWER while the row or column around it is still drawn
from a HOLD, committed in one place and relocated when the hold ends.

- **D465, the rail's footer bar.** On 9 of 12 loads the answer arrives before the
  category schema. The panel holds its whole group list while the schema is in
  flight, but the footer bar reads the count and the active filters — which come
  from the answer — so it mounted under the loading box at
  `data-facets-schema="pending"` and travelled down the rail when the groups
  replaced it (CLS 0.0056 at 1280, 0.0018 at 1920, 0.0076 at 1100; schema-first
  loads drew the rail in one commit and shifted nothing). The bar is part of the
  settled rail, so it now waits for it: nothing mounts in the hold that the
  settled rail will move.
- **D466, the results toolbar.** The count renders nothing until the answer
  lands, so a row spaced by `space-between` held ONE item in the first frame and
  two in the second — moving the sort/view control from the leading edge to the
  trailing one as the number arrived (x 328→459 at 1280, 564→863 at 1920,
  312→796 at 1100, and the same jump on a seller's page). The row now always
  carries a leading box for the count, and it is the only half that grows: the
  control's trailing edge is the row's in every frame, whatever the count says
  or whether it says anything at all.

No API change: same props, same class and test ids, and the skin bundle is 30 B
smaller than before.
