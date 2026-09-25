---
"@stapel/attributes-react": patch
---

A `ref_select` holding a code now always draws its label: an answer that arrived after the codes moved (recents loading, an assistant's value landing) was dropped while the code stayed marked as asked, leaving the slug on screen (`vaz-lada`). Answers are kept unless the vocabulary, level or client changed; a failed ask may be retried.
