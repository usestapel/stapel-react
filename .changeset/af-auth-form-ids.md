---
"@stapel/auth-react": patch
---

Each sign-in form has its own antd form name, so field ids are unique in the page: the email and phone tabs no longer both render `id="value"`.
