---
"@stapel/cdn-react": minor
---

`<MediaGalleryField bag={…}>` — the prop the README documented and the package did not have

The field always built its own `useUploadQueue`, so a composer beside it had
two queues: its own, permanently empty, and the one on screen. `bag.settled` —
the publish gate — then talked about photos it could not see, and
`images_draft` went out empty while ten tiles sat there uploading. The
documented wiring (`<MediaGalleryField bag={gallery} />`, in this pair's README
and in `@stapel/listings-react`'s) simply did not compile.

Props are now a union: `{ bag }` **or** `{ max, target, initialRefs,
onRefsChange }`. Passing both is a type error rather than a runtime decision
about which queue wins.

```tsx
const gallery = useUploadQueue({ max: 10 });
<ListingComposerPage images={gallery} gallerySlot={<MediaGalleryField bag={gallery} />} … />
```

`test/galleryBag.test.tsx` proves the two halves see ONE queue — a pick through
the tiles reaches the caller's `refs` and moves the caller's `settled` — and
gates the README against the props declaration, because the defect was
documented for a whole release and nothing in the suite could tell.
