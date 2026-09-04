---
"@stapel/chat-react": patch
---

Replace `<Space direction="vertical">` with `<Space orientation="vertical">` (antd 6's non-deprecated prop) in `StartChatButton`, `ConversationThreadPanel`, `ConversationListPanel` and `ChatNotificationsPrompt` — silences the antd 6 deprecation warning; spacing and alignment unchanged.
