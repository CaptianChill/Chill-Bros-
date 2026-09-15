# Password recovery

Chill Bros staff password recovery uses Neon Auth email reset links.

Flow:
1. Staff opens `/forgot-password` and submits the account email.
2. The app posts to Neon Auth `/api/auth/request-password-reset` with `/reset-password` as the return page.
3. Neon Auth sends the reset email using the configured email provider.
4. The reset link returns with a short-lived token.
5. `/reset-password` posts the new password and token to `/api/auth/reset-password`.
6. Successful reset returns the user to `/sign-in?reset=1`.

Security notes:
- Existing passwords are never displayed or emailed.
- The public recovery page never creates accounts.
- Reset tokens are handled by Neon Auth and are not persisted by the application.
- The reset route is public only because the user cannot have a valid session while recovering an account.
