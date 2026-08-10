---
"@stapel/calendar-react": minor
---

An empty week and a week the server never answered for no longer look identical: `CalendarViewBag` hands out one `state: LoadState<CalendarRangeData>` — events and occurrences come out of the same `GET /calendar` body, so two states could never disagree — instead of pre-flattened `events` / `occurrences` / `isLoading` / `isError` / `error`.

Render a grid through `matchList(mapLoad(state, (r) => r.events), …)`, whose four required arms keep "nothing scheduled" (`calendar.view.empty`) reachable only from a read that actually answered; the failed arm shows `calendar.view.error` plus a retry through the bag's `refetch()`.
