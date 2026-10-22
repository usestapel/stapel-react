---
"@stapel/auth-react": minor
---

`<AuthPanel>` leaves the sign-in page once a sign-in lands on it. `onAuthenticated` hands the moment to the host's router; without it the panel goes to a safe `?next=` path, else to `afterSignInHref` (default `"/"`). It fires on the transition to a non-guest session only, so a signed-in person who opens the page is not bounced. After an OTP "Verified" the panel used to stay on `/login`.
