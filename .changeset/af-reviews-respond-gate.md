---
"@stapel/reviews-react": minor
---

Contract pin to stapel-reviews 0.8.0. The reply composer reads the reply door's own refusal, `error.403.reviews_cannot_respond` (the target type's `can_respond` callback, or the stamped owner), as "not the owner" (`isRespondForbidden`); `canRespond` now mirrors that callback. A self-review refusal (`error.403.reviews_self_review`) is a named gate reason on the review form (`selfReview`, `isSelfReview`). Both codes arrive translated in en, ru and es from the backend catalogue.
