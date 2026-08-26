---
"@stapel/notifications-react": minor
---

Delete the legacy harness demos, and fix the feed and push defects the VISUAL3 pass filed.

**Removed stories (breaking for anyone deep-importing a demo id).** `notifications.provider`, `notifications.feed` and `notifications.device_registration` shipped alongside the skins they duplicate, still drawing a `state.step` chip, a component name as a heading, and the two-button push control the toggle replaced. They are gone; `NotificationsProvider`, `NotificationFeed` and `DeviceRegistration` are now covered by the skin demos that actually render them. The demo harness keeps only providers and canned server state — no demo-local card, chip or button.

**Copy that said the wrong thing.**

- The end-of-list footnote said "You're all caught up." — the empty state's sentence, used under rows that exist. "There is no more" and "there is nothing" are different claims and now read differently.
- The polling indicator narrated the client's plumbing ("This site has no live connection, so the list refreshes every minute while this tab is open"). It now states what is true for the reader — "Updates within a minute" — in one line. `notifications.live.polling_hint` is removed.
- "Not delivered to" and "Registered, but not being delivered to" were unfinished phrases; both are finished.

**Feed row anatomy.** The title/time line no longer wraps, so a long title cannot push the time onto a second line and give one list two different row shapes. The title truncates; the time keeps its own column.

**Push registry.** Row removal is red text, matching every other pair's destructive row action, instead of the only outlined button on the screen. A platform the backend adds later renders a human label with the raw wire value as a caption underneath, never as the row title.

**Page geometry.** The notifications page centres its reading measure, so a wide monitor no longer leaves the feed hugging the left edge.

**Fixture.** The demo feed is ordered newest-first, as `GET /feed/` documents. It was not, which made the skin look like it sorted wrongly.

Unread state and mark-read remain unbuilt: `FeedItemResponse` carries no read flag and `/feed/` is GET-only, so both need a backend change first.
