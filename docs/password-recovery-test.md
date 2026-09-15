# Password recovery smoke test

- Open `/forgot-password`.
- Submit a known Chill Bros staff email.
- Confirm the UI shows a generic check-email message.
- Open the newest Neon Auth reset email.
- Confirm the link lands on `/reset-password` with a token.
- Set a new 12-128 character password.
- Confirm redirect to `/sign-in?reset=1`.
- Sign in with the new password.
- Confirm the role-specific home loads.
