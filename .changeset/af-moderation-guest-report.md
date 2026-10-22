---
"@stapel/moderation-react": minor
---

Guest reports (stapel-moderation 0.8.4). `<ReportSheet allowGuest captchaToken>` (and `<ReportButton>`, `useReport`) let a visitor file on a deployment that opened `ALLOW_ANONYMOUS_REPORTS`: the sheet asks for a contact address, sends it as `contact_email` with the host captcha widget's token as `captcha_token`, and names the contact and captcha refusals (`isContactRequired`, `isCaptchaRefusal`). Without `allowGuest` a visitor still meets the sign-in door. Contract pin moves to 0.8.4.
