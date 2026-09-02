---
"@stapel/chat-react": patch
---

Enter sends. The thread composer's textarea treated a hardware keyboard's
Enter as a newline, so the draft sat in the field with a `\n` in it and only
the button posted. Plain Enter now sends the draft through the same gate the
button obeys (an empty or blocked composer still refuses), Shift+Enter keeps
the newline, and an IME mid-composition is left alone — its Enter commits the
candidate, never the message. Phone soft keyboards are untouched.
