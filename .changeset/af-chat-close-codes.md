---
"@stapel/chat-react": patch
---

Contract pin to stapel-chat 0.11.0 (wire unchanged). Tests pin the close-code behaviour against stapel-realtime 0.2.3's periodic re-authorization: a 4403 on a long-open socket is a named `forbidden` refusal that is never retried, and a 1011 from a failing authorizer reconnects.
