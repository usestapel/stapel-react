---
"@stapel/profiles-react": minor
---

Visual pass 3: delete the legacy harness stories, and fix the defects the new skins shipped with.

**The six `state.step` demos are gone.** `my-profile`, `connection-list`,
`notification-preferences`, `relationship`, `initial-setup` and
`profiles-provider` rendered a debug card — a component class name, a step chip
and a row of naked buttons — beside the real skin of the same component, so the
showcase told two stories about every screen and one of them was the render
bench (§54 / VC-A1). The headless components they stood for are covered by the
screens that USE them (`covers:` on the skin demos), which is what the
completeness gate was always asking for. The demo harness is now the provider
frame and nothing else.

**Connections.** The `list-and-row` story mounted a loose `PersonRow` flush
under a three-row list, so it read as a fourth follower under a heading that
said three; the two specimens are now separately captioned sections.
`<ConnectionList/>`'s row control is no longer a solid primary per row — a
roster line gets a quiet one (`emphasis="row"`) — and on the Followers list the
offer is "Follow back", because everybody in that list already follows you.

**Public profile.** The following count was the caller's own-list copy ("31
people you follow") rendered on somebody else's profile, stating a fact about
the visitor that was not true; third-person copy (`profiles.public.count.
following`) replaces it. "Rating 4.8" now carries its scale — read-only stars
plus "4.8 out of 5" — instead of a number that could be out of anything.

**`<Relationship/>` carries its own theme.** Mounted standalone (a chat header,
a review byline) it fell back to antd's stock palette and drew Follow in iOS
blue beside the same component rendering brand indigo one story over. It now
establishes a `bare` `SkinTheme`, so one accent everywhere.

**First run stops clipping.** The action row moved out of the sheet's scrolling
body into `SkinDialog`'s `footer`, which antd pins outside it: at 390px the
sheet used to cut off at "App language" with Continue below an invisible fold.

**Settings.** One label anatomy across the screen (`SettingRow`, extracted to
`src/default/parts.tsx` — dark and muted labels alternated inside one card);
the display-name edit affordance is a full-height row button named "Edit
Display name" instead of a 14px pencil named after the field; the `Segmented`
track is painted from `surface-sunken` so the control has the same anatomy in
light as in dark; the notification matrix puts each switch against its own
label instead of ~250px away across a grid cell; and the settings, connections
and public-profile columns are centred, so a wide canvas is no longer 65% dead
space beside a left-pinned card.

New i18n keys (en + ru + es): `profiles.relationship.follow_back`,
`profiles.public.count.following` (plural family), `profiles.public.
rating_value`, `profiles.settings.field.edit`.
