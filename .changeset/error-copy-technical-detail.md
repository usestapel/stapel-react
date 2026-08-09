---
"@stapel/core": minor
---

Error copy: the human sentence no longer carries the HTTP status; the status
moves to a separate technical detail.

Core's floor copy for the codes core mints itself used to splice the status
into the sentence — every 5xx entry ended in a bare `" (500)"`. That reads as
a diagnostic, not as product copy, and the owner rejected it on sight
(2026-08-09). Deleting the number was not an option either: no Stapel backend
emits a request id, so the status is the ONLY correlation handle a person can
quote to support.

So it moved out of the sentence and into a second field:

- `describeFlowError(error, bundle, opts)` returns
  `{message, detail}` — `message` is the complete human sentence, `detail` is
  the plainly-technical `"HTTP 500"` a skin renders in muted, small type
  beside it. `detail` is `undefined` when there is nothing worth quoting: no
  status, a transport fault that never reached a backend (`status: 0`), or a
  specific backend code whose sentence already says what happened.
- `useErrorDisplay(fallbackCode?)` and `useDescribeFlowError()` are the hook
  forms, for `unknown` and `FlowError` inputs respectively.
- `formatFlowError` / `useErrorText` / `useFormatFlowError` are unchanged and
  still return the sentence alone — a skin that renders only the message keeps
  correct, complete copy. The detail is additive, never load-bearing.
- The detail template is the bundle key `stapel.error.detail`
  (`DETAIL_ERROR_KEY`, `"HTTP {status}"` in en and ru), so a host can override
  it like any other string — and it is where a request id goes when a backend
  starts emitting one.
