---
"@stapel/auth-react": minor
---

Email/phone OTP login now honours the TOTP step-up: a `TOTP_REQUIRED` verify answer parks `otpFlow` in `totpRequired` instead of adopting it as a session, and the new `submitTotp(proof)` (also on `PasswordlessLoginBag`) completes it, with 423 → `totpLocked`.
`FIRST_LOGIN_REQUIRED` answers route to `passwordChangeRequired` / `mfaEnrollRequired` like the password flow, and `otpVerify` is typed as the `LoginResponse` union.
The default `OtpPanel` renders the same inline TOTP step and first-login cards as `PasswordPanel`.
