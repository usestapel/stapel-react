---
"@stapel/core": patch
---

- **Backend codes that name their status fall back to the HTTP floor.** `error.503.service_unavailable`, `error.500.server` and their kin reached the glass raw wherever a package's catalogue lacked the key. `describeFlowError` now tries `stapel.http.<status>` then `stapel.http.Nxx` for an `error.<status>.<slug>` code — after the exact key and the backend's own localized message, before the raw code — and quotes `HTTP <status>` beside the generic sentence. Codes that do not name a status (`auth.otp.invalid`) keep the documented last resort. `httpStatusFloorKeys(code)` is exported.
- UI floor: `STAPEL_UI_KEYS.more` ("More") and `STAPEL_UI_KEYS.actions` ("Actions") in en/ru/es, for the substrate's row-actions overflow.
