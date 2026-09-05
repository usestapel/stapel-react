---
"@stapel/chat-react": patch
---

chat-react: the inbox row reaches the listing, and its thumbnail keeps its shape

The inbox held zero links to a listing. A row carried the subject's title,
price and photo — everything but a way to open the thing being asked about —
so the one move a seller standing in their messages wants to make had to be
made by searching for the listing again. And the photo behind that thumbnail
is 120×160, drawn into a 24×24 square.

The subject title is now a link. `href` defaults to the card's own `url`, the
field the subject provider already serves, so a deployment that resolves
subjects at all gets the link without wiring one; `<ConversationListPanel>`
and `<ConversationSplitPanel>` gain `subjectHref` (an explicit resolver whose
answer wins, `undefined` included) and `linkComponent` (the router's link, for
a client-side navigation).

Only the title, and outside the row's own control: the row opens the
CONVERSATION and the title opens the LISTING, and neither may contain the
other — an anchor inside an anchor is not a document, a link inside a
`role="button"` is a control inside a control. The subject strip therefore
sits beneath the row control as a sibling, indented to the same text column.

The row thumbnail is now a 24×32 portrait frame off the token scale, drawn
`object-fit: cover`, so a marketplace's photos are cropped to the frame rather
than squeezed into a square that had nothing to do with them.
