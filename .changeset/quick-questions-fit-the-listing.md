---
"@stapel/listings-react": minor
---

The canned questions fit what the listing is about, and every one of them opens with a greeting.

The founder opened a job vacancy on the live site on 2026-09-13 and was offered
to ask the hiring manager whether their vacancy was still for sale, whether the
price was negotiable and whether there was delivery. Those four are a GOODS
classified's four, and every listing on the board got them — vacancies,
services, flats — with no greeting in front of any of them, in a chip whose
whole job is to become the first line of a message to a stranger.

`<ListingDetailPane questionTopic>` states what kind of thing the page is about
— `"transport" | "realty" | "jobs" | "services" | "goods"` — and the pair picks
the sentences. A vacancy is asked whether it is still open, what the hours are
and where to send a CV; a service, whether it is still provided, what it would
cost and when there is a free slot; goods keep the four they had. `"transport"`
and `"realty"` take the goods set today, because a car and a flat are bought
with exactly those questions and inventing separate wording for them would be
this pair writing copy nobody asked for — they are named so a host can state
the truth about its own tree and so the day one of them earns its own set, no
call site changes.

**It is a prop and not a read, and that is a boundary rather than a
preference.** The detail wire carries `category_id`: a bare string, nullable,
with no slug, no ancestry and no name. Turning it into "this is a job" is a walk
up the CATALOGUE, which belongs to `@stapel/categories-react` — a pair this one
does not import. The storefront routed the visitor here through that tree and
already knows. A host that states nothing keeps exactly the chips it had, and
`quickQuestions` still overrides everything.

Every default now opens with a greeting, written into the copy per locale
rather than concatenated in front of it: a greeting is punctuation and register
as much as words, and a pair that prefixed a string would be deciding another
language's punctuation in TypeScript. Six new keys in `ru`, `en` and `es`.

New in the headless entry: `quickQuestionKeys`, `ListingQuestionTopic`,
`DEFAULT_QUESTION_TOPIC`.
