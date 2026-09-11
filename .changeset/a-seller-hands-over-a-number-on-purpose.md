---
"@stapel/profiles-react": minor
---

A seller's phone number: managed by its owner, handed over on purpose.

stapel-profiles 0.20 gave this pair a `contacts` submodule, and it is two
audiences rather than one feature.

**The owner** — `useContacts()` and `<ContactsManager/>`: add a number, prove
it by SMS, say who may be handed it (`members` / `verified` / `nobody`), switch
it off without deleting it, delete it, and read the hand-over counters (ever /
24h / 7d). Three things in that screen are deliberate. A number is MASKED to
its last two digits until its owner asks to see it — a contacts screen is
opened in public and read over a shoulder, and the last two digits are enough
to tell two of your own numbers apart. An unverified number SAYS so, because
nothing else on the row does and a number that silently reaches nobody is the
defect the line exists to prevent. And the policy picker is built from the
`policies` vocabulary `GET /contacts` sends, not from three hardcoded strings:
a deployment that narrowed `STAPEL_PROFILES["CONTACTS"]["POLICIES"]` would
otherwise offer options its own API refuses.

**The viewer** — `useRevealContacts()` and `<RevealPhoneButton/>`: one button,
one POST, and on a 200 the button IS the numbers, in place, as `tel:` links
with a copy control each. The answer lives on the mutation object and nowhere
else: no query key, `gcTime: 0`, nothing in storage, nothing in the URL. That
is not caution for its own sake — every reveal is journalled for the owner and
counted against the viewer's hourly budget, so a cached copy would be a
hand-over nobody recorded, and a persisted QueryClient would carry a stranger's
phone number to disk. A caller with no account (signed out OR a guest) gets 403
`contacts_registration_required` and the host's `renderDoor()` is rendered
beside the sentence — full registration, not a sign-in link, because the
backend refuses guest sessions too. Over the budget, 429 `retry_after` arrives
in seconds and is spoken in minutes.

`hasPhone(profile)` reads the one bit a public profile carries — the bit a
storefront draws the button from. It is viewer-independent by the backend's
design and it is NOT a promise that a number will arrive; the policy on each
number is applied by the reveal endpoint, whose answer may still be an empty
list. `maskPhoneNumber(value)` is the mask the owner's screen uses, exported
for a host that draws its own row.

There is exactly ONE refusal branch for "you have no account", because the
backend now has one: stapel-profiles 0.20.2 puts
`error.403.contacts_registration_required` at the top level of the envelope for
a guest session and a signed-out caller alike, and removes the seven 401
declarations the contacts routes used to carry. A 401 arm here would be an arm
that can never run, so there is none — and a test reads the generated schema to
keep it that way.

Copy in en/ru/es, demos for both halves (including the guest door and the
budget sentence), a `profiles.contacts` nav entry (visible by default, because
`<ProfileSettings/>` deliberately does not compose this screen), and the pin
bumped to stapel-profiles v0.20.2 with the projections regenerated against it.
